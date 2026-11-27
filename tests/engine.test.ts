import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogue, NUTRIENTS, RECIPES } from '../src/data/foods';
import { compositionIndicator, fmt, index, isAllowed, mealTotals, plateShares, portion } from '../src/lib/nutrition';
import { cost, eligible, generatePlan, planCost, shoppingList, TEMPLATES, toPurchasable, type PlanInput, type Prices } from '../src/lib/planner';
import { layout, PLATE_RADIUS } from '../src/lib/layout';
import { createStore } from '../server/db';

const foods = buildCatalogue();
const cat = index(foods);
const item = (foodId: string, grams: number) => ({ uid: foodId + grams, foodId, grams });
const base: PlanInput = { days: 7, people: 2, budget: null, snacks: false, slots: ['Breakfast', 'Lunch', 'Dinner'], pantry: [], equipment: 'stove', prefs: { diet: 'any', allergies: [], avoid: [] }, variety: 0 };
const allPrices: Prices = Object.fromEntries(foods.map((f, i) => [f.id, { perKg: 50 + i * 9, source: 'test fixture', date: '2026-01-01' }]));

test('ids are unique and every reference resolves', () => {
  assert.equal(new Set(foods.map(f => f.id)).size, foods.length);
  for (const f of foods) for (const r of f.related) assert.ok(cat[r], `${f.id} -> ${r}`);
  for (const t of TEMPLATES) for (const [id] of t.items) assert.ok(cat[id], id);
  for (const r of RECIPES) for (const i of r.ingredients) assert.ok(cat[i.foodId]);
});

test('data sanity: macros fit in 100 g and energy is plausible', () => {
  for (const f of foods) {
    const n = f.nutrients;
    assert.ok(n.proteinGrams! + n.carbohydrateGrams! + n.fatGrams! <= 100.5, f.id);
    const atwater = 4 * n.proteinGrams! + 4 * n.carbohydrateGrams! + 9 * n.fatGrams!;
    assert.ok(Math.abs(atwater - n.energyKcal!) <= Math.max(30, n.energyKcal! * .3), `${f.id} ${atwater} vs ${n.energyKcal}`);
    for (const { key } of NUTRIENTS) assert.ok(n[key] === null || n[key]! >= 0);
  }
});

test('portion scales per 100 g and keeps missing values missing', () => {
  assert.equal(portion(cat.beans, 150, 'energyKcal'), 190.5);
  assert.equal(portion(cat.beans, 150, 'iodineUg'), null);
  assert.equal(fmt(null), 'No data');
});

test('meal totals flag incomplete nutrients', () => {
  const t = mealTotals([item('rice', 100), item('amaranth', 100)], cat);
  assert.equal(t.energyKcal.value, 151);
  assert.equal(t.fibreGrams.complete, false);
  assert.equal(t.fibreGrams.value, 0.4);
  assert.equal(t.iodineUg.value, null);
  assert.equal(mealTotals([], cat).energyKcal.value, null);
});

test('recipe nutrients use cooked yield', () => {
  assert.ok(Math.abs(cat.ugali.nutrients.energyKcal! - 362 * 100 / 320) < 1e-9);
  assert.deepEqual(toPurchasable('ugali', 320), [{ foodId: 'maizeflour', grams: 100 }]);
});

test('plate shares and indicator', () => {
  const good = [item('sukuma', 200), item('beans', 100), item('ugali', 100)];
  assert.deepEqual(plateShares(good, cat).shares, { vegfruit: .5, protein: .25, staple: .25 });
  assert.equal(compositionIndicator(good, cat).score, 95);
  assert.equal(compositionIndicator([], cat).score, 0);
});

test('allergies and diets are hard filters, including inside recipes', () => {
  const prefs = { diet: 'vegan' as const, allergies: ['peanut' as const, 'gluten' as const], avoid: ['beans'] };
  assert.equal(isAllowed(cat.groundnuts, prefs), false);
  assert.equal(isAllowed(cat.fish, prefs), false);
  const input = { ...base, prefs };
  const { days } = generatePlan(input, cat, {});
  for (const m of days.flatMap(d => d.meals)) for (const i of m.items.flatMap(x => toPurchasable(x.foodId, x.grams))) assert.ok(isAllowed(cat[i.foodId], prefs), i.foodId);
});

test('no stove means only no-cook meals; impossible slots are reported', () => {
  for (const t of eligible('Lunch', cat, { ...base, equipment: 'none' })) assert.equal(t.needs, 'none');
  const r = generatePlan({ ...base, equipment: 'none', prefs: { diet: 'any', allergies: ['gluten', 'milk'], avoid: [] } }, cat, {});
  assert.ok(r.emptySlots.includes('Lunch'));
});

test('unknown prices are never counted as zero cost', () => {
  const c = cost([{ foodId: 'beans', grams: 240 }, { foodId: 'rice', grams: 100 }], cat, { beans: { perKg: 100, source: 't', date: 'd' } });
  assert.equal(c.complete, false);
  assert.deepEqual(c.missing, ['rice']);
  assert.ok(Math.abs(c.known - 10) < 1e-9);
});

test('budget pass reduces cost', () => {
  const free = planCost(generatePlan(base, cat, allPrices).days, cat, allPrices, 2, []).known;
  const tight = planCost(generatePlan({ ...base, budget: free * .75 }, cat, allPrices).days, cat, allPrices, 2, []).known;
  assert.ok(tight < free, `${tight} < ${free}`);
});

test('shopping list expands recipes and respects pantry', () => {
  const days = [{ day: 'Today', meals: [{ slot: 'Lunch' as const, templateId: 'm1', name: 'x', items: [{ foodId: 'ugali', grams: 320 }, { foodId: 'beans', grams: 240 }] }] }];
  const list = shoppingList(days, cat, {}, 2, ['maizeflour']);
  assert.equal(list.find(l => l.foodId === 'maizeflour')!.buyGrams, 200);
  assert.equal(list.find(l => l.foodId === 'beans')!.buyGrams, 200);
  assert.equal(list.find(l => l.foodId === 'beans')!.cost, null);
});

test('layout keeps foods on the plate', () => {
  const items = foods.slice(0, 9).map(f => item(f.id, f.defaultServingGrams));
  for (const s of layout(items, cat)) assert.ok(Math.hypot(s.x, s.z) <= PLATE_RADIUS);
});

test('sqlite store round-trips, sanitizes invalid data, and clears cleanly', () => {
  const db = createStore(':memory:');
  try {
    assert.equal(db.loadWorkspaceState().hasData, false);

    db.saveWorkspaceState({
      plate: [
        { uid: 'u1', foodId: 'ugali', grams: 250 },
        { uid: 'bad1', foodId: '../bad', grams: 100 },
        { uid: 'bad2', foodId: 'beans', grams: -10 },
      ],
      meals: [{ id: 'm1', name: 'Supper', date: '2026-11-27', items: [{ uid: 'x1', foodId: 'beans', grams: 150 }] }],
      plan: {
        id: 'p1',
        name: 'Week 1',
        date: '2026-11-27',
        days: [{ day: 'Mon', meals: [{ slot: 'Lunch', templateId: 'm1', name: 'Ugali & beans', items: [{ foodId: 'ugali', grams: 250 }] }] }],
        people: 2,
        budget: 1500,
        currency: 'KES',
        location: 'Nairobi',
        pantry: ['maizeflour'],
        bought: ['beans'],
        done: ['0-0'],
      },
      prices: {
        beans: { perKg: 180, source: 'Gikomba', date: '2026-11-27' },
        badfood: { perKg: -50, source: 'invalid', date: '2026-11-27' },
      },
      currency: 'KES',
      location: { country: 'Kenya', town: 'Kisumu' },
      prefs: { diet: 'vegetarian', allergies: ['peanut', 'unknown_allergen'], avoid: ['fish', '../hack'] },
      lessons: ['l1'],
      quiz: { q1: 4 },
      explored: ['ugali'],
      verified: {
        ugali: { fdcId: 12345, fetched: '2026-11-27', nutrients: cat.ugali.nutrients },
      },
    });

    const loaded = db.loadWorkspaceState();
    assert.equal(loaded.hasData, true);
    assert.equal(loaded.state.plate.length, 1);
    assert.equal(loaded.state.plate[0].foodId, 'ugali');
    assert.equal(loaded.state.meals.length, 1);
    assert.equal(loaded.state.meals[0].id, 'm1');
    assert.equal(loaded.state.plan?.budget, 1500);
    assert.equal(loaded.state.prices.beans.perKg, 180);
    assert.equal(loaded.state.prices.badfood, undefined);
    assert.deepEqual(loaded.state.prefs, { diet: 'vegetarian', allergies: ['peanut'], avoid: ['fish'] });
    assert.equal(loaded.state.verified.ugali.fdcId, 12345);
    assert.equal(loaded.state.verified.ugali.nutrients.iodineUg, null);

    db.clearWorkspaceState();
    assert.equal(db.loadWorkspaceState().hasData, false);
  } finally {
    db.close();
  }
});

