// Client state synced with the built-in Express SQLite database and cached locally.
import { useSyncExternalStore } from 'react';
import { buildCatalogue, type Food, type Nutrients } from '../data/foods';
import { index, type Catalogue, type MealItem, type Prefs } from './nutrition';
import type { PlanDay, Prices, ShopLine } from './planner';

export interface SavedMeal { id: string; name: string; date: string; items: MealItem[] }
export interface SavedPlan { id: string; name: string; date: string; days: PlanDay[]; people: number; budget: number | null; currency: string; location: string; pantry: string[]; bought: string[]; done: string[] }
export interface State {
  plate: MealItem[]; history: MealItem[][];
  meals: SavedMeal[]; plan: SavedPlan | null;
  prices: Prices; currency: string; location: { country: string; town: string };
  prefs: Prefs;
  lessons: string[]; quiz: Record<string, number>; explored: string[];
  verified: Record<string, { nutrients: Nutrients; fdcId: number; fetched: string }>;
}
export type { ShopLine };

const KEY = 'nutriverse:v1';
const initial: State = {
  plate: [], history: [], meals: [], plan: null, prices: {}, currency: 'KES', location: { country: 'Kenya', town: '' },
  prefs: { diet: 'any', allergies: [], avoid: [] }, lessons: [], quiz: {}, explored: [], verified: {},
};

const toPersistable = (s: State) => ({
  plate: s.plate,
  meals: s.meals,
  plan: s.plan,
  prices: s.prices,
  currency: s.currency,
  location: s.location,
  prefs: s.prefs,
  lessons: s.lessons,
  quiz: s.quiz,
  explored: s.explored,
  verified: s.verified,
});

function hasUserContent(s: State): boolean {
  return (
    s.plate.length > 0 ||
    s.meals.length > 0 ||
    s.plan !== null ||
    Object.keys(s.prices).length > 0 ||
    s.currency !== initial.currency ||
    s.location.country !== initial.location.country ||
    s.location.town !== '' ||
    s.prefs.diet !== 'any' ||
    s.prefs.allergies.length > 0 ||
    s.prefs.avoid.length > 0 ||
    s.lessons.length > 0 ||
    Object.keys(s.quiz).length > 0 ||
    s.explored.length > 0 ||
    Object.keys(s.verified).length > 0
  );
}

function loadLocal(): State {
  if (typeof localStorage === 'undefined') return initial;
  try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? '{}'), history: [] }; } catch { return initial; }
}

function writeLocal(s: State) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...toPersistable(s), history: [] })); } catch { /* storage full or blocked */ }
}

let state = loadLocal();
let localDirty = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

async function pushToServer(snapshot: State, keepalive = false) {
  if (typeof fetch !== 'function') return;
  try {
    await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPersistable(snapshot)),
      keepalive,
    });
  } catch {
    /* keep local cache when offline */
  }
}

function scheduleSync() {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void pushToServer(state);
  }, 150);
}

if (typeof window !== 'undefined' && typeof fetch === 'function') {
  void (async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return;
      const data = await res.json() as { hasData?: boolean; state?: Partial<State> };
      if (!localDirty && data.hasData && data.state) {
        state = { ...initial, ...data.state, history: state.history };
        writeLocal(state);
        listeners.forEach(l => l());
      } else if (!data.hasData && hasUserContent(state)) {
        await pushToServer(state);
      }
    } catch {
      /* offline or server unavailable; local cache remains active */
    }
  })();

  window.addEventListener('pagehide', () => {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
      void pushToServer(state, true);
    }
  });
}

export const getState = () => state;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const delta = typeof patch === 'function' ? patch(state) : patch;
  const keys = Object.keys(delta);
  if (!keys.length) return;
  state = { ...state, ...delta };
  writeLocal(state);
  if (keys.some(k => k !== 'history')) {
    localDirty = true;
    scheduleSync();
  }
  listeners.forEach(l => l());
}
export const useStore = () => useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, getState, getState);
export function clearAll() {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  localDirty = true;
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
  state = initial;
  listeners.forEach(l => l());
  if (typeof fetch === 'function') {
    void fetch('/api/state', { method: 'DELETE' }).catch(() => { /* ignore */ });
  }
}

let cache: { v: State['verified']; foods: Food[]; cat: Catalogue } | null = null;
export function useFoods() {
  const { verified } = useStore();
  if (!cache || cache.v !== verified) { const foods = buildCatalogue(verified); cache = { v: verified, foods, cat: index(foods) }; }
  return cache;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export function setPlate(next: MealItem[]) { setState(s => ({ history: [...s.history.slice(-29), s.plate], plate: next })); }
export function addToPlate(food: Food, grams = food.defaultServingGrams, pos?: { x: number; z: number }) {
  const item = { uid: uid(), foodId: food.id, grams, pos };
  setPlate([...state.plate, item]);
  return item.uid;
}
export function undo() { setState(s => (s.history.length ? { plate: s.history[s.history.length - 1], history: s.history.slice(0, -1) } : {})); }
export function saveMeal(name: string, items: MealItem[]) {
  setState(s => ({ meals: [{ id: uid(), name: name.trim() || 'My meal', date: new Date().toISOString(), items: items.map(i => ({ ...i })) }, ...s.meals] }));
}

export const SAMPLE: MealItem[] = [
  { uid: 'sample-ugali', foodId: 'ugali', grams: 250 }, { uid: 'sample-beans', foodId: 'beans', grams: 150 }, { uid: 'sample-sukuma', foodId: 'sukuma', grams: 180 },
];
export const SAMPLE_B: MealItem[] = [
  { uid: 'b-rice', foodId: 'rice', grams: 180 }, { uid: 'b-fish', foodId: 'fish', grams: 110 }, { uid: 'b-spinach', foodId: 'spinach', grams: 100 }, { uid: 'b-tomato', foodId: 'tomato', grams: 80 },
];
