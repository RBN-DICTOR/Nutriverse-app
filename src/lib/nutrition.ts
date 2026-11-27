// Pure, testable nutrition engine. No UI, no AI. All numbers in the app come from here.
import { NUTRIENTS, type Allergen, type Diet, type Food, type NutrientKey, type PlateGroup } from '../data/foods';

export interface MealItem { uid: string; foodId: string; grams: number; pos?: { x: number; z: number } }
export type Catalogue = Record<string, Food>;
export const index = (foods: Food[]): Catalogue => Object.fromEntries(foods.map(f => [f.id, f]));

export function portion(food: Food, grams: number, key: NutrientKey): number | null {
  const v = food.nutrients[key];
  return v === null ? null : v * Math.max(0, grams) / 100;
}

export interface Total { value: number | null; known: number; count: number; complete: boolean }

export function mealTotals(items: MealItem[], cat: Catalogue): Record<NutrientKey, Total> {
  const valid = items.filter(i => cat[i.foodId]);
  return Object.fromEntries(NUTRIENTS.map(({ key }) => {
    const vals = valid.map(i => portion(cat[i.foodId], i.grams, key)).filter((v): v is number => v !== null);
    return [key, { value: vals.length ? vals.reduce((a, b) => a + b, 0) : null, known: vals.length, count: valid.length, complete: vals.length === valid.length }];
  })) as Record<NutrientKey, Total>;
}

/** Rounded for display, to avoid false precision. */
export function fmt(v: number | null, unit = ''): string {
  if (v === null) return 'No data';
  let s: string;
  if (unit === 'kcal') s = String(Math.round(v / 5) * 5);
  else if (v >= 100) s = String(Math.round(v));
  else if (v >= 10) s = String(Math.round(v));
  else if (v > 0 && v < 0.1) s = '<0.1';
  else s = String(Math.round(v * 10) / 10);
  return unit ? `${s} ${unit}` : s;
}
export const fmtTotal = (t: Total, unit: string) =>
  t.value === null ? 'No data' : `${t.complete ? '≈ ' : 'at least '}${fmt(t.value, unit)}`;

export type Shares = { vegfruit: number; protein: number; staple: number };
export const TARGET: Shares = { vegfruit: 0.5, protein: 0.25, staple: 0.25 };

/** Weight share of the three guide groups. Mixed dishes and extras (oil, milk) are excluded. */
export function plateShares(items: MealItem[], cat: Catalogue): { shares: Shares; counted: number; mixed: number } {
  const g = { vegfruit: 0, protein: 0, staple: 0 };
  let mixed = 0;
  for (const i of items) {
    const group: PlateGroup | undefined = cat[i.foodId]?.group;
    if (group === 'vegfruit' || group === 'protein' || group === 'staple') g[group] += i.grams;
    else if (group === 'mixed') mixed += i.grams;
  }
  const counted = g.vegfruit + g.protein + g.staple;
  const d = counted || 1;
  return { shares: { vegfruit: g.vegfruit / d, protein: g.protein / d, staple: g.staple / d }, counted, mixed };
}

export interface Check { label: string; points: number; max: number }
/** Educational composition indicator. NOT a health score. */
export function compositionIndicator(items: MealItem[], cat: Catalogue): { score: number; checks: Check[] } {
  const foods = items.map(i => cat[i.foodId]).filter(Boolean);
  const has = (g: PlateGroup) => foods.some(f => f.group === g);
  const mixedHas = foods.some(f => f.group === 'mixed');
  const { shares, counted } = plateShares(items, cat);
  const distance = (Math.abs(shares.vegfruit - .5) + Math.abs(shares.protein - .25) + Math.abs(shares.staple - .25)) / 2;
  const groups = new Set(foods.map(f => f.category)).size;
  const fibre = mealTotals(items, cat).fibreGrams.value ?? 0;
  const checks: Check[] = [
    { label: 'Includes a vegetable or fruit', points: has('vegfruit') ? 25 : 0, max: 25 },
    { label: 'Includes a protein-rich food (mixed dishes with legumes count)', points: has('protein') || mixedHas ? 20 : 0, max: 20 },
    { label: 'Variety: 5 points per food category, up to 20', points: Math.min(20, groups * 5), max: 20 },
    { label: 'Contains at least 3 g of recorded fibre', points: fibre >= 3 ? 15 : 0, max: 15 },
    { label: 'Closeness to the ½ + ¼ + ¼ plate guide (by weight)', points: counted ? Math.round(20 * Math.max(0, 1 - distance / .75)) : 0, max: 20 },
  ];
  return { score: items.length ? checks.reduce((a, c) => a + c.points, 0) : 0, checks };
}

export interface Prefs { diet: Diet; allergies: Allergen[]; avoid: string[] }
export function isAllowed(food: Food, p: Prefs): boolean {
  if (food.allergens.some(a => p.allergies.includes(a))) return false;
  if (p.avoid.includes(food.id)) return false;
  if (p.diet === 'vegan' && food.diet !== 'vegan') return false;
  if (p.diet === 'vegetarian' && food.diet === 'any') return false;
  return true;
}

export function alternatives(food: Food, foods: Food[], prefs: Prefs): Food[] {
  const dryOrUnsafe = ['maizeflour', 'sorghum', 'cassava'];
  return foods.filter(f => f.id !== food.id && f.group === food.group && !dryOrUnsafe.includes(f.id) && isAllowed(f, prefs)).slice(0, 6);
}
