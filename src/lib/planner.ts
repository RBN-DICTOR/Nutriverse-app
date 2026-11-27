// Budget-aware meal planner. Prices come ONLY from the user. Unknown cost is never counted as zero.
import { RECIPES, type Food } from '../data/foods';
import { isAllowed, type Catalogue, type Prefs } from './nutrition';

export interface Price { perKg: number; yield?: number; source: string; date: string }
export type Prices = Record<string, Price>;
export type Slot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
export type Equipment = 'stove' | 'none';
export interface Template { id: string; name: string; slots: Slot[]; needs: Equipment; items: [string, number][] }

export const TEMPLATES: Template[] = [
  { id: 'b1', name: 'Millet porridge with groundnuts and banana', slots: ['Breakfast'], needs: 'stove', items: [['millet', 200], ['groundnuts', 20], ['banana', 100]] },
  { id: 'b2', name: 'Sweet potato with egg and orange', slots: ['Breakfast'], needs: 'stove', items: [['sweetpotato', 180], ['egg', 50], ['orange', 120]] },
  { id: 'b3', name: 'Bread, avocado and tomato', slots: ['Breakfast'], needs: 'none', items: [['bread', 70], ['avocado', 60], ['tomato', 60]] },
  { id: 'b4', name: 'Sweet potato with beans and pawpaw', slots: ['Breakfast'], needs: 'stove', items: [['sweetpotato', 150], ['beans', 80], ['pawpaw', 120]] },
  { id: 'b5', name: 'Yoghurt, banana and pumpkin seeds', slots: ['Breakfast', 'Snack'], needs: 'none', items: [['yoghurt', 150], ['banana', 100], ['pumpkinseeds', 15]] },
  { id: 'm1', name: 'Ugali, beans and sukuma wiki', slots: ['Lunch', 'Dinner'], needs: 'stove', items: [['ugali', 250], ['beans', 140], ['sukuma', 180], ['oil', 8]] },
  { id: 'm2', name: 'Rice, green grams and cabbage', slots: ['Lunch', 'Dinner'], needs: 'stove', items: [['rice', 180], ['greengrams', 150], ['cabbage', 150], ['carrot', 50], ['oil', 8]] },
  { id: 'm3', name: 'Githeri with spinach and avocado', slots: ['Lunch', 'Dinner'], needs: 'stove', items: [['githeri', 300], ['spinach', 120], ['avocado', 40]] },
  { id: 'm4', name: 'Rice, tilapia and vegetables', slots: ['Lunch', 'Dinner'], needs: 'stove', items: [['rice', 170], ['fish', 110], ['sukuma', 120], ['tomato', 80], ['oil', 10]] },
  { id: 'm5', name: 'Chapati, lentils and tomato salad', slots: ['Lunch', 'Dinner'], needs: 'stove', items: [['chapati', 90], ['lentils', 160], ['tomato', 130]] },
  { id: 'm6', name: 'Matoke, beef and amaranth leaves', slots: ['Lunch', 'Dinner'], needs: 'stove', items: [['matoke', 250], ['beef', 90], ['amaranth', 180], ['oil', 6]] },
  { id: 'm7', name: 'Mukimo with beans and carrots', slots: ['Lunch', 'Dinner'], needs: 'stove', items: [['mukimo', 280], ['beans', 100], ['carrot', 90]] },
  { id: 'm8', name: 'Ugali, eggs and amaranth leaves', slots: ['Lunch', 'Dinner'], needs: 'stove', items: [['ugali', 240], ['egg', 100], ['amaranth', 180], ['oil', 8]] },
  { id: 'm9', name: 'Potatoes, chicken and pumpkin', slots: ['Lunch', 'Dinner'], needs: 'stove', items: [['potato', 200], ['chicken', 100], ['pumpkin', 150], ['oil', 8]] },
  { id: 'm10', name: 'Bread, groundnuts, tomato and mango', slots: ['Lunch', 'Dinner'], needs: 'none', items: [['bread', 100], ['groundnuts', 35], ['tomato', 120], ['mango', 120]] },
  { id: 's1', name: 'Banana and groundnuts', slots: ['Snack'], needs: 'none', items: [['banana', 100], ['groundnuts', 20]] },
  { id: 's2', name: 'Mango slices', slots: ['Snack'], needs: 'none', items: [['mango', 150]] },
  { id: 's3', name: 'Watermelon and pineapple', slots: ['Snack'], needs: 'none', items: [['watermelon', 150], ['pineapple', 80]] },
];

export interface PlanMeal { slot: Slot; templateId: string; name: string; items: { foodId: string; grams: number }[] }
export interface PlanDay { day: string; meals: PlanMeal[] }

/** Break recipe dishes into purchasable ingredients. */
export function toPurchasable(foodId: string, grams: number): { foodId: string; grams: number }[] {
  const r = RECIPES.find(x => x.id === foodId);
  return r ? r.ingredients.flatMap(i => toPurchasable(i.foodId, i.grams * grams / r.cookedYieldGrams)) : [{ foodId, grams }];
}

export function cost(items: { foodId: string; grams: number }[], cat: Catalogue, prices: Prices, pantry: string[] = []) {
  let known = 0; const missing = new Set<string>();
  for (const part of items.flatMap(i => toPurchasable(i.foodId, i.grams))) {
    if (pantry.includes(part.foodId)) continue;
    const p = prices[part.foodId];
    if (!p || !(p.perKg > 0)) { missing.add(part.foodId); continue; }
    known += part.grams / (p.yield || cat[part.foodId].yield) / 1000 * p.perKg;
  }
  return { known, missing: [...missing], complete: missing.size === 0 };
}

export interface PlanInput { days: number; people: number; budget: number | null; snacks: boolean; slots: Slot[]; pantry: string[]; equipment: Equipment; prefs: Prefs; variety: number }

export function eligible(slot: Slot, cat: Catalogue, input: PlanInput): Template[] {
  return TEMPLATES.filter(t => t.slots.includes(slot)
    && (input.equipment === 'stove' || t.needs === 'none')
    && t.items.every(([id]) => cat[id] && isAllowed(cat[id], input.prefs) && toPurchasable(id, 1).every(p => isAllowed(cat[p.foodId], input.prefs))));
}

export const scale = (t: Template, slot: Slot): PlanMeal => ({ slot, templateId: t.id, name: t.name, items: t.items.map(([foodId, grams]) => ({ foodId, grams })) });
export const times = (meals: PlanMeal[], people: number) => meals.flatMap(m => m.items.map(i => ({ foodId: i.foodId, grams: i.grams * people })));

export function planCost(days: PlanDay[], cat: Catalogue, prices: Prices, people: number, pantry: string[]) {
  return cost(times(days.flatMap(d => d.meals), people), cat, prices, pantry);
}

export function generatePlan(input: PlanInput, cat: Catalogue, prices: Prices): { days: PlanDay[]; emptySlots: Slot[] } {
  const slots: Slot[] = [...input.slots, ...(input.snacks ? ['Snack' as Slot] : [])];
  const used: Record<string, number> = {};
  const emptySlots = new Set<Slot>();
  const mealCost = (t: Template) => cost(times([scale(t, t.slots[0])], input.people), cat, prices, input.pantry);
  const days: PlanDay[] = Array.from({ length: input.days }, (_, d) => ({
    day: input.days === 1 ? 'Today' : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d % 7],
    meals: slots.flatMap(slot => {
      const options = eligible(slot, cat, input);
      if (!options.length) { emptySlots.add(slot); return []; }
      const rank = (t: Template) => {
        const c = mealCost(t);
        const pantryHits = t.items.filter(([id]) => input.pantry.includes(id)).length;
        // lower is better: repeats, then pantry use, then cost (unpriced meals ranked after priced ones)
        return (used[t.id] ?? 0) * 100 - pantryHits * 25 + (c.complete ? Math.min(40, c.known / Math.max(1, input.budget ?? 1000) * 200) : 45);
      };
      const sorted = [...options].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
      const best = sorted.filter(t => rank(t) <= rank(sorted[0]) + 1);
      const pick = best[(d + input.variety) % best.length];
      used[pick.id] = (used[pick.id] ?? 0) + 1;
      return [scale(pick, slot)];
    }),
  }));
  // If fully priced and over budget, swap in cheaper priced meals, one swap at a time.
  if (input.budget !== null) {
    for (let guard = 0; guard < 80; guard++) {
      const total = planCost(days, cat, prices, input.people, input.pantry);
      if (total.known <= input.budget) break;
      let bestSwap: { saving: number; d: number; m: number; t: Template } | null = null;
      days.forEach((day, d) => day.meals.forEach((meal, m) => {
        const now = cost(times([meal], input.people), cat, prices, input.pantry);
        for (const t of eligible(meal.slot, cat, input)) {
          const next = mealCost(t);
          const saving = now.known - next.known;
          if (next.complete && saving > 0.001 && (!bestSwap || saving > bestSwap.saving)) bestSwap = { saving, d, m, t };
        }
      }));
      if (!bestSwap) break;
      const s = bestSwap as { d: number; m: number; t: Template };
      days[s.d].meals[s.m] = scale(s.t, days[s.d].meals[s.m].slot);
    }
  }
  return { days, emptySlots: [...emptySlots] };
}

export interface ShopLine { foodId: string; name: string; group: string; buyGrams: number; cost: number | null; have: boolean }
export const SHOP_GROUPS = ['Cereals and staples', 'Legumes', 'Vegetables', 'Fruits', 'Protein-rich foods', 'Dairy', 'Other ingredients'];
function shopGroup(f: Food) {
  if (f.category === 'Cereals and grains' || f.category === 'Staples') return SHOP_GROUPS[0];
  if (f.category === 'Legumes') return 'Legumes';
  if (f.category === 'Vegetables') return 'Vegetables';
  if (f.category === 'Fruits') return 'Fruits';
  if (f.category === 'Animal-source foods') return 'Protein-rich foods';
  if (f.category === 'Dairy') return 'Dairy';
  return 'Other ingredients';
}

export function shoppingList(days: PlanDay[], cat: Catalogue, prices: Prices, people: number, pantry: string[]): ShopLine[] {
  const sum: Record<string, number> = {};
  for (const p of times(days.flatMap(d => d.meals), people).flatMap(i => toPurchasable(i.foodId, i.grams))) sum[p.foodId] = (sum[p.foodId] ?? 0) + p.grams;
  return Object.entries(sum).map(([id, edible]) => {
    const f = cat[id], p = prices[id], buyGrams = edible / (p?.yield || f.yield), have = pantry.includes(id);
    return { foodId: id, name: f.buyAs, group: shopGroup(f), buyGrams, have, cost: have ? 0 : p?.perKg > 0 ? buyGrams / 1000 * p.perKg : null };
  }).sort((a, b) => SHOP_GROUPS.indexOf(a.group) - SHOP_GROUPS.indexOf(b.group) || a.name.localeCompare(b.name));
}
