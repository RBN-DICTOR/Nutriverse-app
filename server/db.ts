// Lightweight built-in SQLite store using Node's native node:sqlite module.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { NUTRIENTS, type Allergen, type Diet, type NutrientKey, type Nutrients } from '../src/data/foods';
import type { MealItem, Prefs } from '../src/lib/nutrition';
import type { PlanDay, PlanMeal, Price, Prices, Slot } from '../src/lib/planner';
import type { SavedMeal, SavedPlan } from '../src/lib/store';

export interface PersistedState {
  plate: MealItem[];
  meals: SavedMeal[];
  plan: SavedPlan | null;
  prices: Prices;
  currency: string;
  location: { country: string; town: string };
  prefs: Prefs;
  lessons: string[];
  quiz: Record<string, number>;
  explored: string[];
  verified: Record<string, { nutrients: Nutrients; fdcId: number; fetched: string }>;
}

const VALID_DIETS = new Set<Diet>(['any', 'vegetarian', 'vegan']);
const VALID_ALLERGENS = new Set<Allergen>(['peanut', 'tree nut', 'fish', 'egg', 'milk', 'gluten']);
const VALID_SLOTS = new Set<Slot>(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
const NUTRIENT_KEYS = NUTRIENTS.map(n => n.key) as NutrientKey[];
const FOOD_ID_RE = /^[a-z0-9]+$/;

export function defaultPersistedState(): PersistedState {
  return {
    plate: [],
    meals: [],
    plan: null,
    prices: {},
    currency: 'KES',
    location: { country: 'Kenya', town: '' },
    prefs: { diet: 'any', allergies: [], avoid: [] },
    lessons: [],
    quiz: {},
    explored: [],
    verified: {},
  };
}

const cleanStr = (v: unknown, max: number, fallback = ''): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : fallback;

const cleanFoodId = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, 40);
  return FOOD_ID_RE.test(s) ? s : null;
};

const cleanMealItems = (raw: unknown): MealItem[] => {
  if (!Array.isArray(raw)) return [];
  const out: MealItem[] = [];
  for (const item of raw.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const foodId = cleanFoodId(rec.foodId);
    const grams = Number(rec.grams);
    if (!foodId || !Number.isFinite(grams) || grams <= 0 || grams > 5000) continue;
    const uid = cleanStr(rec.uid, 40) || `${foodId}-${out.length}`;
    let pos: { x: number; z: number } | undefined;
    if (rec.pos && typeof rec.pos === 'object') {
      const p = rec.pos as Record<string, unknown>;
      const x = Number(p.x), z = Number(p.z);
      if (Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= 10 && Math.abs(z) <= 10) {
        pos = { x, z };
      }
    }
    out.push(pos ? { uid, foodId, grams, pos } : { uid, foodId, grams });
  }
  return out;
};

const cleanSavedMeals = (raw: unknown): SavedMeal[] => {
  if (!Array.isArray(raw)) return [];
  const out: SavedMeal[] = [];
  const seen = new Set<string>();
  for (const m of raw.slice(0, 100)) {
    if (!m || typeof m !== 'object') continue;
    const rec = m as Record<string, unknown>;
    const items = cleanMealItems(rec.items);
    if (!items.length) continue;
    let id = cleanStr(rec.id, 40) || `meal-${out.length}`;
    if (seen.has(id)) id = `${id.slice(0, 32)}-${out.length}`;
    seen.add(id);
    const name = cleanStr(rec.name, 80) || 'My meal';
    const date = cleanStr(rec.date, 40) || new Date().toISOString();
    out.push({ id, name, date, items });
  }
  return out;
};

const cleanSavedPlan = (raw: unknown): SavedPlan | null => {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (!Array.isArray(rec.days)) return null;
  const days: PlanDay[] = [];
  for (const d of rec.days.slice(0, 14)) {
    if (!d || typeof d !== 'object') continue;
    const dRec = d as Record<string, unknown>;
    const day = cleanStr(dRec.day, 20) || 'Day';
    const meals: PlanMeal[] = [];
    if (Array.isArray(dRec.meals)) {
      for (const m of dRec.meals.slice(0, 10)) {
        if (!m || typeof m !== 'object') continue;
        const mRec = m as Record<string, unknown>;
        const slot = VALID_SLOTS.has(mRec.slot as Slot) ? (mRec.slot as Slot) : 'Lunch';
        const items: { foodId: string; grams: number }[] = [];
        if (Array.isArray(mRec.items)) {
          for (const it of mRec.items.slice(0, 20)) {
            if (!it || typeof it !== 'object') continue;
            const itRec = it as Record<string, unknown>;
            const foodId = cleanFoodId(itRec.foodId);
            const grams = Number(itRec.grams);
            if (foodId && Number.isFinite(grams) && grams > 0 && grams <= 5000) {
              items.push({ foodId, grams });
            }
          }
        }
        if (!items.length) continue;
        meals.push({
          slot,
          templateId: cleanStr(mRec.templateId, 40) || 'custom',
          name: cleanStr(mRec.name, 100) || 'Meal',
          items,
        });
      }
    }
    days.push({ day, meals });
  }
  if (!days.length) return null;
  const peopleNum = Math.round(Number(rec.people));
  const people = Number.isFinite(peopleNum) && peopleNum >= 1 && peopleNum <= 30 ? peopleNum : 1;
  const budgetRaw = rec.budget === null || rec.budget === undefined ? null : Number(rec.budget);
  const budget = budgetRaw !== null && Number.isFinite(budgetRaw) && budgetRaw > 0 && budgetRaw <= 10_000_000 ? budgetRaw : null;
  const cleanStrList = (arr: unknown, maxLen: number) =>
    Array.isArray(arr) ? [...new Set(arr.slice(0, 120).map(x => cleanStr(x, maxLen)).filter(Boolean))] : [];

  return {
    id: cleanStr(rec.id, 40) || 'plan',
    name: cleanStr(rec.name, 100) || 'Meal plan',
    date: cleanStr(rec.date, 40) || new Date().toISOString(),
    days,
    people,
    budget,
    currency: cleanStr(rec.currency, 10) || 'KES',
    location: cleanStr(rec.location, 80),
    pantry: cleanStrList(rec.pantry, 40).filter(x => FOOD_ID_RE.test(x)),
    bought: cleanStrList(rec.bought, 40).filter(x => FOOD_ID_RE.test(x)),
    done: cleanStrList(rec.done, 80),
  };
};

const cleanPrices = (raw: unknown): Prices => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Prices = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>).slice(0, 120)) {
    const foodId = cleanFoodId(key);
    if (!foodId || !val || typeof val !== 'object') continue;
    const p = val as Record<string, unknown>;
    const perKg = Number(p.perKg);
    if (!Number.isFinite(perKg) || perKg <= 0 || perKg > 1_000_000) continue;
    const entry: Price = {
      perKg,
      source: cleanStr(p.source, 120) || 'Market entry',
      date: cleanStr(p.date, 40) || new Date().toISOString().slice(0, 10),
    };
    if (p.yield !== undefined && p.yield !== null) {
      const y = Number(p.yield);
      if (Number.isFinite(y) && y > 0 && y <= 2) entry.yield = y;
    }
    out[foodId] = entry;
  }
  return out;
};

const cleanPrefs = (raw: unknown): Prefs => {
  if (!raw || typeof raw !== 'object') return { diet: 'any', allergies: [], avoid: [] };
  const rec = raw as Record<string, unknown>;
  const diet = VALID_DIETS.has(rec.diet as Diet) ? (rec.diet as Diet) : 'any';
  const allergies = Array.isArray(rec.allergies)
    ? [...new Set(rec.allergies.filter((a): a is Allergen => VALID_ALLERGENS.has(a as Allergen)))]
    : [];
  const avoid = Array.isArray(rec.avoid)
    ? [...new Set(rec.avoid.slice(0, 120).map(cleanFoodId).filter((x): x is string => x !== null))]
    : [];
  return { diet, allergies, avoid };
};

const cleanVerified = (raw: unknown): PersistedState['verified'] => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PersistedState['verified'] = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>).slice(0, 120)) {
    const foodId = cleanFoodId(key);
    if (!foodId || !val || typeof val !== 'object') continue;
    const rec = val as Record<string, unknown>;
    const fdcId = Math.round(Number(rec.fdcId));
    if (!Number.isFinite(fdcId) || fdcId <= 0) continue;
    if (!rec.nutrients || typeof rec.nutrients !== 'object') continue;
    const rawN = rec.nutrients as Record<string, unknown>;
    const nutrients = {} as Nutrients;
    for (const nk of NUTRIENT_KEYS) {
      const nv = rawN[nk];
      if (nv === null || nv === undefined) {
        nutrients[nk] = null;
      } else {
        const num = Number(nv);
        nutrients[nk] = Number.isFinite(num) && num >= 0 && num <= 100_000 ? num : null;
      }
    }
    out[foodId] = {
      nutrients,
      fdcId,
      fetched: cleanStr(rec.fetched, 30) || new Date().toISOString().slice(0, 10),
    };
  }
  return out;
};

export function sanitizeState(raw: unknown): PersistedState {
  const base = defaultPersistedState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const rec = raw as Record<string, unknown>;
  const loc = rec.location && typeof rec.location === 'object' ? (rec.location as Record<string, unknown>) : {};
  const quizOut: Record<string, number> = {};
  if (rec.quiz && typeof rec.quiz === 'object' && !Array.isArray(rec.quiz)) {
    for (const [k, v] of Object.entries(rec.quiz as Record<string, unknown>).slice(0, 40)) {
      const key = cleanStr(k, 40);
      const score = Number(v);
      if (key && Number.isFinite(score) && score >= 0 && score <= 20) quizOut[key] = Math.round(score);
    }
  }
  return {
    plate: cleanMealItems(rec.plate),
    meals: cleanSavedMeals(rec.meals),
    plan: cleanSavedPlan(rec.plan),
    prices: cleanPrices(rec.prices),
    currency: cleanStr(rec.currency, 10) || 'KES',
    location: {
      country: cleanStr(loc.country, 60) || 'Kenya',
      town: cleanStr(loc.town, 60),
    },
    prefs: cleanPrefs(rec.prefs),
    lessons: Array.isArray(rec.lessons)
      ? [...new Set(rec.lessons.slice(0, 40).map(x => cleanStr(x, 40)).filter(Boolean))]
      : [],
    quiz: quizOut,
    explored: Array.isArray(rec.explored)
      ? [...new Set(rec.explored.slice(0, 120).map(cleanFoodId).filter((x): x is string => x !== null))]
      : [],
    verified: cleanVerified(rec.verified),
  };
}

export interface NutriDb {
  loadWorkspaceState: (workspaceId?: string) => { hasData: boolean; state: PersistedState };
  saveWorkspaceState: (raw: unknown, workspaceId?: string) => PersistedState;
  clearWorkspaceState: (workspaceId?: string) => void;
  close: () => void;
}

const cleanWorkspaceId = (id?: string) => {
  const s = typeof id === 'string' ? id.trim().slice(0, 40) : 'default';
  return /^[a-zA-Z0-9_-]+$/.test(s) ? s : 'default';
};

export function createStore(dbPath?: string): NutriDb {
  const target = dbPath || process.env.NUTRIVERSE_DB_PATH || path.resolve(process.cwd(), 'data', 'nutriverse.sqlite');
  if (target !== ':memory:') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
  }
  const db = new DatabaseSync(target);
  if (target !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS workspace_state (
      workspace_id TEXT PRIMARY KEY,
      plate_json TEXT NOT NULL,
      currency TEXT NOT NULL,
      location_json TEXT NOT NULL,
      prefs_json TEXT NOT NULL,
      lessons_json TEXT NOT NULL,
      quiz_json TEXT NOT NULL,
      explored_json TEXT NOT NULL,
      verified_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_meals (
      id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      items_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, id),
      FOREIGN KEY (workspace_id) REFERENCES workspace_state(workspace_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
      workspace_id TEXT PRIMARY KEY,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      days_json TEXT NOT NULL,
      people INTEGER NOT NULL,
      budget REAL,
      currency TEXT NOT NULL,
      location TEXT NOT NULL,
      pantry_json TEXT NOT NULL,
      bought_json TEXT NOT NULL,
      done_json TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspace_state(workspace_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS market_prices (
      workspace_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      per_kg REAL NOT NULL,
      yield REAL,
      source TEXT NOT NULL,
      date TEXT NOT NULL,
      PRIMARY KEY (workspace_id, food_id),
      FOREIGN KEY (workspace_id) REFERENCES workspace_state(workspace_id) ON DELETE CASCADE
    );
  `);

  const selectWorkspace = db.prepare(
    'SELECT plate_json, currency, location_json, prefs_json, lessons_json, quiz_json, explored_json, verified_json FROM workspace_state WHERE workspace_id = ?'
  );
  const selectMeals = db.prepare(
    'SELECT id, name, date, items_json FROM saved_meals WHERE workspace_id = ? ORDER BY sort_order ASC'
  );
  const selectPlan = db.prepare(
    'SELECT id, name, date, days_json, people, budget, currency, location, pantry_json, bought_json, done_json FROM meal_plans WHERE workspace_id = ?'
  );
  const selectPrices = db.prepare(
    'SELECT food_id, per_kg, yield, source, date FROM market_prices WHERE workspace_id = ?'
  );

  const upsertWorkspace = db.prepare(`
    INSERT INTO workspace_state (
      workspace_id, plate_json, currency, location_json, prefs_json,
      lessons_json, quiz_json, explored_json, verified_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET
      plate_json = excluded.plate_json,
      currency = excluded.currency,
      location_json = excluded.location_json,
      prefs_json = excluded.prefs_json,
      lessons_json = excluded.lessons_json,
      quiz_json = excluded.quiz_json,
      explored_json = excluded.explored_json,
      verified_json = excluded.verified_json,
      updated_at = excluded.updated_at
  `);

  const deleteMeals = db.prepare('DELETE FROM saved_meals WHERE workspace_id = ?');
  const insertMeal = db.prepare(
    'INSERT INTO saved_meals (id, workspace_id, name, date, items_json, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const deletePlan = db.prepare('DELETE FROM meal_plans WHERE workspace_id = ?');
  const insertPlan = db.prepare(`
    INSERT INTO meal_plans (
      workspace_id, id, name, date, days_json, people, budget, currency, location, pantry_json, bought_json, done_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const deletePrices = db.prepare('DELETE FROM market_prices WHERE workspace_id = ?');
  const insertPrice = db.prepare(
    'INSERT INTO market_prices (workspace_id, food_id, per_kg, yield, source, date) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const deleteWorkspace = db.prepare('DELETE FROM workspace_state WHERE workspace_id = ?');

  const safeJson = <T,>(raw: string, fallback: T): T => {
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  };

  return {
    loadWorkspaceState(workspaceId?: string) {
      const ws = cleanWorkspaceId(workspaceId);
      const row = selectWorkspace.get(ws) as Record<string, string> | undefined;
      if (!row) return { hasData: false, state: defaultPersistedState() };

      const mealRows = selectMeals.all(ws) as Array<{ id: string; name: string; date: string; items_json: string }>;
      const planRow = selectPlan.get(ws) as Record<string, unknown> | undefined;
      const priceRows = selectPrices.all(ws) as Array<{ food_id: string; per_kg: number; yield: number | null; source: string; date: string }>;

      const prices: Prices = {};
      for (const p of priceRows) {
        prices[p.food_id] = p.yield !== null
          ? { perKg: p.per_kg, yield: p.yield, source: p.source, date: p.date }
          : { perKg: p.per_kg, source: p.source, date: p.date };
      }

      const assembled = sanitizeState({
        plate: safeJson(row.plate_json, []),
        meals: mealRows.map(m => ({ id: m.id, name: m.name, date: m.date, items: safeJson(m.items_json, []) })),
        plan: planRow
          ? {
              id: planRow.id,
              name: planRow.name,
              date: planRow.date,
              days: safeJson(String(planRow.days_json), []),
              people: planRow.people,
              budget: planRow.budget,
              currency: planRow.currency,
              location: planRow.location,
              pantry: safeJson(String(planRow.pantry_json), []),
              bought: safeJson(String(planRow.bought_json), []),
              done: safeJson(String(planRow.done_json), []),
            }
          : null,
        prices,
        currency: row.currency,
        location: safeJson(row.location_json, { country: 'Kenya', town: '' }),
        prefs: safeJson(row.prefs_json, { diet: 'any', allergies: [], avoid: [] }),
        lessons: safeJson(row.lessons_json, []),
        quiz: safeJson(row.quiz_json, {}),
        explored: safeJson(row.explored_json, []),
        verified: safeJson(row.verified_json, {}),
      });

      return { hasData: true, state: assembled };
    },

    saveWorkspaceState(raw: unknown, workspaceId?: string) {
      const ws = cleanWorkspaceId(workspaceId);
      const next = sanitizeState(raw);
      const now = new Date().toISOString();

      db.exec('BEGIN IMMEDIATE');
      try {
        upsertWorkspace.run(
          ws,
          JSON.stringify(next.plate),
          next.currency,
          JSON.stringify(next.location),
          JSON.stringify(next.prefs),
          JSON.stringify(next.lessons),
          JSON.stringify(next.quiz),
          JSON.stringify(next.explored),
          JSON.stringify(next.verified),
          now
        );

        deleteMeals.run(ws);
        next.meals.forEach((m, idx) => {
          insertMeal.run(m.id, ws, m.name, m.date, JSON.stringify(m.items), idx);
        });

        deletePlan.run(ws);
        if (next.plan) {
          insertPlan.run(
            ws,
            next.plan.id,
            next.plan.name,
            next.plan.date,
            JSON.stringify(next.plan.days),
            next.plan.people,
            next.plan.budget,
            next.plan.currency,
            next.plan.location,
            JSON.stringify(next.plan.pantry),
            JSON.stringify(next.plan.bought),
            JSON.stringify(next.plan.done)
          );
        }

        deletePrices.run(ws);
        for (const [foodId, p] of Object.entries(next.prices)) {
          insertPrice.run(ws, foodId, p.perKg, p.yield ?? null, p.source, p.date);
        }

        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      return next;
    },

    clearWorkspaceState(workspaceId?: string) {
      const ws = cleanWorkspaceId(workspaceId);
      db.exec('BEGIN IMMEDIATE');
      try {
        deleteWorkspace.run(ws);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    close() {
      db.close();
    },
  };
}

let defaultDb: NutriDb | null = null;
export function getDb(): NutriDb {
  if (!defaultDb) defaultDb = createStore();
  return defaultDb;
}
