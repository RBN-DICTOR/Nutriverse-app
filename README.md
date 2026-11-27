# NutriVerse

Build Better Plates. Understand Better Nutrition.

## Run
    npm install
    npm run dev      # http://localhost:3000
    npm test
    npm run typecheck

Secrets (server side only): `GEMINI_API_KEY` for the scanner and NutriGuide, `FDC_API_KEY` for data verification. Everything else works without keys.

## Architecture
- `src/data/foods.ts`: food records and recipes. `src/lib/nutrition.ts`: calculation engine.
- `src/lib/planner.ts`: budget planner using only user-entered prices.
- `src/three/`: plain Three.js scene and original procedural food models (no third-party assets).
- `server.ts` & `server/db.ts`: Express API with built-in SQLite persistence (`data/nutriverse.sqlite`) and server-side proxies for Gemini and USDA FoodData Central. `supabase/schema.sql` remains as an optional external schema.

## Before presenting
1. Settings > Verify against USDA, and check any unmatched records.
2. Enter real market prices with the date you collected them.
3. Test the 3D view on an Android phone.

## Known limits
No accounts, no preloaded prices, no availability filter, no regional food-composition table yet.
