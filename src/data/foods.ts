// Food catalogue. Values are per 100 g EDIBLE portion in the stated preparation state.
// IMPORTANT: bundled numbers are PROVISIONAL reference values written from knowledge of
// USDA FoodData Central (SR Legacy) records. They have NOT been machine-verified.
// Use Settings > "Verify against USDA" to replace them with official records.
// null means "not available". It is never treated as zero.

export const NUTRIENTS = [
  { key: 'energyKcal', label: 'Energy', unit: 'kcal', fdc: '208' },
  { key: 'proteinGrams', label: 'Protein', unit: 'g', fdc: '203' },
  { key: 'carbohydrateGrams', label: 'Carbohydrate', unit: 'g', fdc: '205' },
  { key: 'fatGrams', label: 'Fat', unit: 'g', fdc: '204' },
  { key: 'fibreGrams', label: 'Fibre', unit: 'g', fdc: '291' },
  { key: 'sugarGrams', label: 'Sugars', unit: 'g', fdc: '269' },
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg', fdc: '307' },
  { key: 'ironMg', label: 'Iron', unit: 'mg', fdc: '303' },
  { key: 'calciumMg', label: 'Calcium', unit: 'mg', fdc: '301' },
  { key: 'zincMg', label: 'Zinc', unit: 'mg', fdc: '309' },
  { key: 'potassiumMg', label: 'Potassium', unit: 'mg', fdc: '306' },
  { key: 'vitaminCMg', label: 'Vitamin C', unit: 'mg', fdc: '401' },
  { key: 'folateUg', label: 'Folate', unit: 'µg', fdc: '417' },
  { key: 'vitaminAUg', label: 'Vitamin A (RAE)', unit: 'µg', fdc: '320' },
  { key: 'vitaminB12Ug', label: 'Vitamin B12', unit: 'µg', fdc: '418' },
  { key: 'vitaminDUg', label: 'Vitamin D', unit: 'µg', fdc: '328' },
  { key: 'iodineUg', label: 'Iodine', unit: 'µg', fdc: '314' },
] as const;

export type NutrientKey = (typeof NUTRIENTS)[number]['key'];
export type Nutrients = Record<NutrientKey, number | null>;

export const CATEGORIES = ['Staples', 'Cereals and grains', 'Legumes', 'Vegetables', 'Fruits',
  'Animal-source foods', 'Dairy', 'Nuts and seeds', 'Oils and fats', 'Mixed dishes'] as const;
export type Category = (typeof CATEGORIES)[number];
export type PlateGroup = 'vegfruit' | 'protein' | 'staple' | 'mixed' | 'extra';
export type Allergen = 'peanut' | 'tree nut' | 'fish' | 'egg' | 'milk' | 'gluten';
export type Diet = 'any' | 'vegetarian' | 'vegan';

export type Shape = 'grains' | 'dome' | 'mash' | 'beans' | 'mixed' | 'leaves' | 'flatbread' | 'rounds'
  | 'cubes' | 'coins' | 'egg' | 'fish' | 'drumstick' | 'banana' | 'whole' | 'halves' | 'wedge'
  | 'glass' | 'bowl' | 'bread' | 'cob' | 'pods';

export interface Food {
  id: string; name: string; alternativeNames: string[]; regionalNames: string[];
  category: Category; group: PlateGroup; countryOrRegion: string;
  preparationMethod: string; rawOrCooked: 'raw' | 'cooked' | 'ready-to-eat';
  description: string; uses: string; related: string[];
  servingDescription: string; defaultServingGrams: number;
  presets: { label: string; grams: number }[];
  gramsPerMl?: number;
  nutrients: Nutrients;
  sourceName: string; sourceReference: string; fdcQuery: string | null;
  dataQuality: 'provisional' | 'calculated' | 'verified';
  lastUpdated: string; limitations: string;
  allergens: Allergen[]; diet: Diet;
  buyAs: string; yield: number; // approx. edible grams obtained per 1 g bought
  look: { shape: Shape; color: string; accent: string };
}

// order: kcal, protein, carb, fat, fibre, sugar, sodium, iron, calcium, zinc, potassium, vitC, folate, vitA, B12, vitD, iodine
type Row = (number | null)[];
export function toNutrients(row: Row): Nutrients {
  return Object.fromEntries(NUTRIENTS.map((n, i) => [n.key, row[i] ?? null])) as Nutrients;
}

interface Spec {
  id: string; name: string; cat: Category; group: PlateGroup; prep: string; state: Food['rawOrCooked'];
  serve: [string, number]; presets?: [string, number][]; n: Row; fdc: string;
  look: [Shape, string, string]; desc: string; uses: string; rel: string[];
  alt?: string[]; regional?: string[]; allergens?: Allergen[]; diet?: Diet;
  buy?: [string, number]; limit?: string; ml?: number;
}

function make(s: Spec): Food {
  return {
    id: s.id, name: s.name, category: s.cat, group: s.group, preparationMethod: s.prep, rawOrCooked: s.state,
    servingDescription: s.serve[0], defaultServingGrams: s.serve[1],
    presets: (s.presets ?? []).map(([label, grams]) => ({ label, grams })),
    nutrients: toNutrients(s.n), sourceName: 'USDA FoodData Central, SR Legacy (provisional transcription)',
    sourceReference: s.fdc, fdcQuery: s.fdc, dataQuality: 'provisional', lastUpdated: '2026-11',
    limitations: s.limit ?? 'Reference record may differ from local varieties and recipes.',
    look: { shape: s.look[0], color: s.look[1], accent: s.look[2] },
    description: s.desc, uses: s.uses, related: s.rel, alternativeNames: s.alt ?? [],
    regionalNames: s.regional ?? [], countryOrRegion: 'Reference data: United States. Eaten widely in East Africa.',
    allergens: s.allergens ?? [], diet: s.diet ?? 'vegan',
    buyAs: s.buy?.[0] ?? s.name.toLowerCase(), yield: s.buy?.[1] ?? 1, gramsPerMl: s.ml,
  };
}

const BASE: Food[] = ([
  // Staples and grains
  { id: 'rice', name: 'White rice', cat: 'Cereals and grains', group: 'staple', prep: 'Boiled', state: 'cooked', serve: ['150 g cooked', 150],
    n: [130, 2.69, 28.17, 0.28, 0.4, 0.05, 1, 1.2, 10, 0.49, 35, 0, 58, 0, 0, 0, null], fdc: 'Rice, white, long-grain, regular, enriched, cooked',
    look: ['grains', '#f7f2e2', '#e9dfc4'], desc: 'Polished rice, boiled until soft.', uses: 'Served with beans, green grams, fish or stew.', rel: ['greengrams', 'beans', 'spinach'], regional: ['Wali (Swahili)'], buy: ['dry rice', 2.8],
    limit: 'This is an enriched US record. Unenriched local rice usually has less iron and folate.' },
  { id: 'maizeflour', name: 'Maize flour (whole grain)', cat: 'Cereals and grains', group: 'staple', prep: 'Milled, dry', state: 'raw', serve: ['80 g dry flour', 80],
    n: [362, 8.12, 76.89, 3.59, 7.3, 0.64, 35, 3.45, 6, 1.82, 287, 0, 25, 11, 0, 0, null], fdc: 'Cornmeal, whole-grain, yellow',
    look: ['dome', '#f1d77a', '#e5c45a'], desc: 'Dry maize meal, the base of ugali and porridge.', uses: 'Ugali, uji.', rel: ['beans', 'sukuma'], regional: ['Unga wa mahindi'], buy: ['maize flour', 1] },
  { id: 'maize', name: 'Maize (boiled)', cat: 'Cereals and grains', group: 'staple', prep: 'Boiled', state: 'cooked', serve: ['100 g kernels', 100],
    n: [96, 3.41, 20.98, 1.5, 2.4, 4.54, 1, 0.45, 3, 0.62, 218, 5.5, 23, 13, 0, 0, null], fdc: 'Corn, sweet, yellow, cooked, boiled, drained, without salt',
    look: ['cob', '#f4c43d', '#7da83f'], desc: 'Boiled maize on or off the cob.', uses: 'Snack, githeri.', rel: ['beans'], regional: ['Mahindi'],
    limit: 'Sweet corn record. Field (white) maize contains more starch.' },
  { id: 'millet', name: 'Millet (cooked)', cat: 'Cereals and grains', group: 'staple', prep: 'Boiled', state: 'cooked', serve: ['170 g cooked', 170],
    n: [119, 3.51, 23.67, 1.0, 1.3, 0.13, 2, 0.63, 3, 0.91, 62, 0, 19, 0, 0, 0, null], fdc: 'Millet, cooked',
    look: ['grains', '#e8c66f', '#c99d45'], desc: 'Small grain used whole or as flour.', uses: 'Porridge, or in place of rice.', rel: ['groundnuts', 'milk'], regional: ['Wimbi (finger millet) differs from this record'], buy: ['dry millet', 3.4],
    limit: 'Generic millet. Finger millet (wimbi) differs, notably in calcium.' },
  { id: 'sorghum', name: 'Sorghum grain', cat: 'Cereals and grains', group: 'staple', prep: 'Whole grain, dry', state: 'raw', serve: ['60 g dry', 60],
    n: [329, 10.62, 72.09, 3.46, 6.7, 2.53, 2, 3.36, 13, 1.67, 363, 0, 20, 0, 0, 0, null], fdc: 'Sorghum grain',
    look: ['grains', '#c58a5a', '#8f5a38'], desc: 'Drought-tolerant African cereal. Values are for dry grain.', uses: 'Porridge, flatbreads, boiled grain.', rel: ['beans', 'milk'], regional: ['Mtama'], buy: ['dry sorghum', 1],
    limit: 'DRY weight. Cooked sorghum absorbs water, so do not enter cooked weight.' },
  { id: 'chapati', name: 'Chapati', cat: 'Staples', group: 'staple', prep: 'Griddle-cooked', state: 'cooked', serve: ['70 g piece (approx.)', 70],
    n: [297, 11.25, 46.36, 7.45, 4.9, 2.72, 409, 3.0, 93, 1.57, 266, 0, null, 0, 0, null, null], fdc: 'Bread, chapati or roti, plain, commercially prepared',
    look: ['flatbread', '#dfae6b', '#8a5524'], desc: 'Layered wheat flatbread.', uses: 'With beans, green grams or meat stew.', rel: ['greengrams', 'beef'], allergens: ['gluten'], buy: ['chapati', 1],
    limit: 'Commercial roti record. East African chapati often uses much more oil.' },
  { id: 'bread', name: 'Whole-wheat bread', cat: 'Staples', group: 'staple', prep: 'Baked', state: 'ready-to-eat', serve: ['2 slices (about 64 g)', 64],
    n: [252, 12.45, 42.71, 3.5, 6.0, 4.34, 455, 2.47, 161, 1.77, 254, 0, 42, 0, 0, 0, null], fdc: 'Bread, whole-wheat, commercially prepared',
    look: ['bread', '#c99255', '#7a4a22'], desc: 'Bread made with whole wheat flour.', uses: 'Breakfast with eggs or groundnut paste.', rel: ['egg', 'avocado'], allergens: ['gluten'], diet: 'vegetarian',
    limit: 'Recipes vary. Check the label for milk, soy, egg or sesame.' },
  { id: 'potato', name: 'Potatoes (boiled)', cat: 'Staples', group: 'staple', prep: 'Boiled without skin', state: 'cooked', serve: ['150 g', 150],
    n: [86, 1.71, 20.01, 0.1, 1.8, 0.85, 5, 0.31, 8, 0.27, 328, 7.4, 9, 0, 0, 0, null], fdc: 'Potatoes, boiled, cooked without skin, flesh, without salt',
    look: ['rounds', '#ecd28a', '#d2ac5c'], desc: 'Boiled white potatoes.', uses: 'Stews, mukimo.', rel: ['beef', 'cabbage'], regional: ['Viazi'], buy: ['raw potatoes', 0.85] },
  { id: 'sweetpotato', name: 'Sweet potato (boiled)', cat: 'Staples', group: 'staple', prep: 'Boiled without skin', state: 'cooked', serve: ['150 g', 150],
    n: [76, 1.37, 17.72, 0.14, 2.5, 5.74, 27, 0.72, 27, 0.2, 230, 12.8, 6, 787, 0, 0, null], fdc: 'Sweet potato, cooked, boiled, without skin',
    look: ['rounds', '#ee9442', '#9c3f4e'], desc: 'Boiled sweet potato. This record is orange-fleshed.', uses: 'Breakfast with eggs or milk.', rel: ['egg', 'milk'], regional: ['Viazi vitamu'], buy: ['raw sweet potatoes', 0.85],
    limit: 'Orange-fleshed record. White or cream varieties have far less vitamin A.' },
  { id: 'cassava', name: 'Cassava (raw reference)', cat: 'Staples', group: 'staple', prep: 'Raw reference weight', state: 'raw', serve: ['100 g raw weight', 100],
    n: [160, 1.36, 38.06, 0.28, 1.8, 1.7, 14, 0.27, 16, 0.34, 271, 20.6, 27, 1, 0, 0, null], fdc: 'Cassava, raw',
    look: ['cubes', '#f3ecd9', '#8c6a4a'], desc: 'Starchy root. Must be properly prepared and cooked before eating.', uses: 'Boiled, roasted or fried.', rel: ['beans', 'fish'], regional: ['Muhogo'],
    limit: 'RAW record. Never eat raw cassava. Cooking changes weight and some vitamins.' },
  { id: 'matoke', name: 'Matoke (cooked)', cat: 'Staples', group: 'staple', prep: 'Boiled or steamed', state: 'cooked', serve: ['180 g', 180],
    n: [116, 0.79, 31.15, 0.18, 2.3, 14, 5, 0.58, 2, 0.13, 465, 10.9, 26, 45, 0, 0, null], fdc: 'Plantains, yellow, cooked',
    look: ['mash', '#e9c65b', '#b99730'], desc: 'East African cooking bananas.', uses: 'Mashed or stewed with beans or meat.', rel: ['beans', 'beef'], buy: ['unpeeled cooking bananas', 0.62],
    limit: 'PROXY: plantain record. East African highland banana differs.' },
  // Legumes
  { id: 'beans', name: 'Beans', cat: 'Legumes', group: 'protein', prep: 'Boiled, no salt', state: 'cooked', serve: ['150 g cooked', 150],
    n: [127, 8.67, 22.8, 0.5, 6.4, 0.32, 1, 2.22, 35, 1.0, 405, 1.2, 130, 0, 0, 0, null], fdc: 'Beans, kidney, all types, mature seeds, cooked, boiled, without salt',
    look: ['beans', '#8e2f27', '#b4533c'], desc: 'Dried common beans, boiled until tender. A source of plant protein and fibre.', uses: 'Stewed with tomato and onion, or in githeri.', rel: ['maize', 'rice', 'sukuma'], regional: ['Maharagwe'], buy: ['dry beans', 2.4],
    limit: 'Kidney bean record, plain. Added oil and salt are not included.' },
  { id: 'lentils', name: 'Lentils', cat: 'Legumes', group: 'protein', prep: 'Boiled, no salt', state: 'cooked', serve: ['150 g cooked', 150],
    n: [116, 9.02, 20.13, 0.38, 7.9, 1.8, 2, 3.33, 19, 1.27, 369, 1.5, 181, 0, 0, 0, null], fdc: 'Lentils, mature seeds, cooked, boiled, without salt',
    look: ['grains', '#a8723f', '#7f5230'], desc: 'Quick-cooking pulse.', uses: 'Stews with rice or chapati.', rel: ['rice', 'tomato'], regional: ['Kamande'], buy: ['dry lentils', 2.4] },
  { id: 'greengrams', name: 'Green grams', cat: 'Legumes', group: 'protein', prep: 'Boiled, no salt', state: 'cooked', serve: ['150 g cooked', 150],
    n: [105, 7.02, 19.15, 0.38, 7.6, 2.0, 2, 1.4, 27, 0.84, 266, 1.0, 159, 1, 0, 0, null], fdc: 'Mung beans, mature seeds, cooked, boiled, without salt',
    look: ['beans', '#74842f', '#99a447'], desc: 'Mung beans.', uses: 'Stewed, with rice or chapati.', rel: ['rice', 'chapati'], alt: ['Mung beans'], regional: ['Ndengu'], buy: ['dry green grams', 2.5] },
  { id: 'peas', name: 'Green peas', cat: 'Legumes', group: 'protein', prep: 'Boiled, no salt', state: 'cooked', serve: ['100 g', 100],
    n: [84, 5.36, 15.63, 0.22, 5.5, 5.93, 3, 1.54, 27, 1.19, 271, 14.2, 63, 40, 0, 0, null], fdc: 'Peas, green, cooked, boiled, drained, without salt',
    look: ['beans', '#69a93a', '#8fc44f'], desc: 'Fresh green peas.', uses: 'Mukimo, stews, pilau.', rel: ['potato', 'rice'], regional: ['Njegere'] },
  { id: 'groundnuts', name: 'Groundnuts', cat: 'Nuts and seeds', group: 'protein', prep: 'Dry-roasted, no salt', state: 'ready-to-eat', serve: ['30 g handful (approx.)', 30],
    n: [585, 23.68, 21.51, 49.66, 8.0, 4.18, 6, 2.26, 54, 3.31, 658, 0, 145, 0, 0, 0, null], fdc: 'Peanuts, all types, dry-roasted, without salt',
    look: ['beans', '#c88a52', '#96502f'], desc: 'Peanuts: energy-dense, with protein and fats.', uses: 'Snack, paste, sauces, porridge.', rel: ['millet', 'banana'], alt: ['Peanuts'], regional: ['Njugu karanga'], allergens: ['peanut'] },
  // Animal-source
  { id: 'egg', name: 'Egg (boiled)', cat: 'Animal-source foods', group: 'protein', prep: 'Hard-boiled', state: 'cooked', serve: ['1 large egg (50 g)', 50], presets: [['1 egg', 50], ['2 eggs', 100]],
    n: [155, 12.58, 1.12, 10.61, 0, 1.12, 124, 1.19, 50, 1.05, 126, 0, 44, 149, 1.11, 2.2, null], fdc: 'Egg, whole, cooked, hard-boiled',
    look: ['egg', '#fbf7ee', '#f4b62d'], desc: 'Whole boiled hen egg.', uses: 'Breakfast, or with sweet potatoes or vegetables.', rel: ['sweetpotato', 'bread'], regional: ['Yai'], allergens: ['egg'], diet: 'vegetarian' },
  { id: 'fish', name: 'Tilapia (cooked)', cat: 'Animal-source foods', group: 'protein', prep: 'Dry heat', state: 'cooked', serve: ['100 g edible flesh', 100],
    n: [128, 26.15, 0, 2.65, 0, 0, 56, 0.69, 14, 0.41, 380, 0, 6, 0, 1.86, 3.7, null], fdc: 'Fish, tilapia, cooked, dry heat',
    look: ['fish', '#d59a52', '#6d4727'], desc: 'Cooked tilapia flesh without bones.', uses: 'With ugali or rice and greens.', rel: ['ugali', 'sukuma'], regional: ['Samaki'], allergens: ['fish'], diet: 'any', buy: ['whole raw fish', 0.3],
    limit: 'Edible flesh only. Fried fish contains added oil. Whole small fish such as omena differ greatly.' },
  { id: 'chicken', name: 'Chicken', cat: 'Animal-source foods', group: 'protein', prep: 'Roasted, meat only', state: 'cooked', serve: ['100 g meat', 100],
    n: [165, 31.02, 0, 3.57, 0, 0, 74, 1.04, 15, 1.0, 256, 0, 4, 6, 0.34, 0.1, null], fdc: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
    look: ['drumstick', '#c77d38', '#f0e4cf'], desc: 'Cooked chicken meat.', uses: 'Stew or roast.', rel: ['rice', 'ugali'], regional: ['Kuku'], diet: 'any', buy: ['whole raw chicken', 0.45],
    limit: 'Skinless breast record. Other cuts, skin and indigenous chicken differ.' },
  { id: 'beef', name: 'Beef (nyama)', cat: 'Animal-source foods', group: 'protein', prep: 'Cooked', state: 'cooked', serve: ['100 g cooked', 100],
    n: [250, 25.93, 0, 15.41, 0, 0, 72, 2.6, 18, 6.31, 318, 0, 10, 3, 2.64, 0.1, null], fdc: 'Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled',
    look: ['cubes', '#6f3524', '#9a5336'], desc: 'Cooked beef.', uses: 'Stew or roast with ugali and greens.', rel: ['ugali', 'sukuma'], regional: ['Nyama'], diet: 'any', buy: ['raw beef', 0.7],
    limit: 'PROXY: lean minced beef record. Fat content varies widely by cut.' },
  // Vegetables
  { id: 'sukuma', name: 'Sukuma wiki', cat: 'Vegetables', group: 'vegfruit', prep: 'Boiled, drained, no oil', state: 'cooked', serve: ['100 g cooked', 100],
    n: [33, 2.71, 5.65, 0.72, 4.0, 0.4, 15, 1.13, 141, 0.23, 117, 18.2, 16, 380, 0, 0, null], fdc: 'Collards, cooked, boiled, drained, without salt',
    look: ['leaves', '#2f6b2f', '#4f8f3a'], desc: 'Collard greens, an everyday East African vegetable.', uses: 'Sautéed with onion and tomato beside ugali.', rel: ['ugali', 'beans', 'fish'], alt: ['Collard greens'], regional: ['Sukuma wiki'], buy: ['fresh sukuma wiki', 0.7],
    limit: 'Collards record, no oil. Add cooking oil separately.' },
  { id: 'spinach', name: 'Spinach (cooked)', cat: 'Vegetables', group: 'vegfruit', prep: 'Boiled, drained', state: 'cooked', serve: ['100 g cooked', 100],
    n: [23, 2.97, 3.75, 0.26, 2.4, 0.43, 70, 3.57, 136, 0.76, 466, 9.8, 146, 524, 0, 0, null], fdc: 'Spinach, cooked, boiled, drained, without salt',
    look: ['leaves', '#1f5b34', '#357a45'], desc: 'Cooked spinach.', uses: 'Side dish or in stews.', rel: ['rice', 'egg'], regional: ['Mchicha is often amaranth'], buy: ['fresh spinach', 0.6] },
  { id: 'amaranth', name: 'Amaranth leaves', cat: 'Vegetables', group: 'vegfruit', prep: 'Boiled, drained', state: 'cooked', serve: ['100 g cooked', 100],
    n: [21, 2.11, 4.11, 0.18, null, null, 21, 2.26, 209, 0.88, 641, 41.1, 57, 139, 0, 0, null], fdc: 'Amaranth leaves, cooked, boiled, drained, without salt',
    look: ['leaves', '#3d7a2c', '#8a3550'], desc: 'Traditional leafy vegetable.', uses: 'Sautéed or in mixed greens.', rel: ['ugali', 'beans'], regional: ['Terere', 'Mchicha'], buy: ['fresh amaranth leaves', 0.6] },
  { id: 'cabbage', name: 'Cabbage (cooked)', cat: 'Vegetables', group: 'vegfruit', prep: 'Boiled, drained', state: 'cooked', serve: ['100 g cooked', 100],
    n: [23, 1.27, 5.51, 0.06, 1.9, 2.79, 8, 0.17, 48, 0.2, 196, 37.5, 30, 4, 0, 0, null], fdc: 'Cabbage, cooked, boiled, drained, without salt',
    look: ['leaves', '#bcd98a', '#e3efc4'], desc: 'Cooked green cabbage.', uses: 'Sautéed with carrot.', rel: ['ugali', 'carrot'], regional: ['Kabichi'], buy: ['fresh cabbage', 0.8] },
  { id: 'tomato', name: 'Tomatoes', cat: 'Vegetables', group: 'vegfruit', prep: 'Fresh', state: 'raw', serve: ['100 g', 100],
    n: [18, 0.88, 3.89, 0.2, 1.2, 2.63, 5, 0.27, 10, 0.17, 237, 13.7, 15, 42, 0, 0, null], fdc: 'Tomatoes, red, ripe, raw, year round average',
    look: ['coins', '#e2452f', '#ffb09a'], desc: 'Ripe red tomatoes.', uses: 'Salads and stew bases.', rel: ['beans', 'egg'], regional: ['Nyanya'], buy: ['tomatoes', 0.9] },
  { id: 'carrot', name: 'Carrots (cooked)', cat: 'Vegetables', group: 'vegfruit', prep: 'Boiled, drained', state: 'cooked', serve: ['80 g', 80],
    n: [35, 0.76, 8.22, 0.18, 3.0, 3.45, 58, 0.34, 30, 0.2, 235, 3.6, 14, 852, 0, 0, null], fdc: 'Carrots, cooked, boiled, drained, without salt',
    look: ['coins', '#f07f1f', '#ffab4e'], desc: 'Cooked carrots.', uses: 'Stews, pilau, mixed vegetables.', rel: ['cabbage', 'peas'], regional: ['Karoti'], buy: ['raw carrots', 0.85] },
  { id: 'pumpkin', name: 'Pumpkin (cooked)', cat: 'Vegetables', group: 'vegfruit', prep: 'Boiled, drained', state: 'cooked', serve: ['120 g', 120],
    n: [20, 0.72, 4.9, 0.07, 1.1, 2.08, 1, 0.57, 15, 0.23, 230, 4.7, 9, 288, 0, 0, null], fdc: 'Pumpkin, cooked, boiled, drained, without salt',
    look: ['cubes', '#f28c1b', '#54702c'], desc: 'Cooked pumpkin flesh.', uses: 'Mashed or stewed.', rel: ['beans'], regional: ['Malenge'], buy: ['whole pumpkin', 0.65] },
  { id: 'okra', name: 'Okra (cooked)', cat: 'Vegetables', group: 'vegfruit', prep: 'Boiled, drained', state: 'cooked', serve: ['100 g', 100],
    n: [22, 1.87, 4.51, 0.21, 2.5, 2.4, 6, 0.28, 77, 0.43, 135, 16.3, 46, 14, 0, 0, null], fdc: 'Okra, cooked, boiled, drained, without salt',
    look: ['pods', '#6f9e3c', '#dfe8b0'], desc: 'Tender green pods.', uses: 'Stews and soups.', rel: ['ugali', 'tomato'], regional: ['Bamia'], buy: ['fresh okra', 0.85] },
  // Fruits
  { id: 'banana', name: 'Banana', cat: 'Fruits', group: 'vegfruit', prep: 'Fresh, peeled', state: 'raw', serve: ['1 medium (118 g)', 118], presets: [['Small', 101], ['Medium', 118], ['Large', 136]],
    n: [89, 1.09, 22.84, 0.33, 2.6, 12.23, 1, 0.26, 5, 0.15, 358, 8.7, 20, 3, 0, 0, null], fdc: 'Bananas, raw',
    look: ['banana', '#f6d23f', '#6f5420'], desc: 'Ripe dessert banana.', uses: 'Snack or with porridge.', rel: ['groundnuts', 'yoghurt'], regional: ['Ndizi'], buy: ['unpeeled bananas', 0.64] },
  { id: 'mango', name: 'Mango', cat: 'Fruits', group: 'vegfruit', prep: 'Fresh', state: 'raw', serve: ['150 g flesh', 150],
    n: [60, 0.82, 14.98, 0.38, 1.6, 13.66, 1, 0.16, 11, 0.09, 168, 36.4, 43, 54, 0, 0, null], fdc: 'Mangos, raw',
    look: ['cubes', '#ffb21c', '#e8731a'], desc: 'Ripe mango flesh.', uses: 'Fresh fruit.', rel: ['yoghurt'], regional: ['Embe'], buy: ['whole mangoes', 0.65] },
  { id: 'avocado', name: 'Avocado', cat: 'Fruits', group: 'vegfruit', prep: 'Fresh', state: 'raw', serve: ['70 g (about half, varies)', 70],
    n: [160, 2.0, 8.53, 14.66, 6.7, 0.66, 7, 0.55, 12, 0.64, 485, 10, 81, 7, 0, 0, null], fdc: 'Avocados, raw, all commercial varieties',
    look: ['halves', '#c9d65a', '#345021'], desc: 'Fruit rich in unsaturated fat.', uses: 'Sliced beside meals.', rel: ['githeri', 'bread'], regional: ['Parachichi'], buy: ['whole avocados', 0.7] },
  { id: 'orange', name: 'Orange', cat: 'Fruits', group: 'vegfruit', prep: 'Fresh, peeled', state: 'raw', serve: ['130 g peeled', 130],
    n: [47, 0.94, 11.75, 0.12, 2.4, 9.35, 0, 0.1, 40, 0.07, 181, 53.2, 30, 11, 0, 0, null], fdc: 'Oranges, raw, all commercial varieties',
    look: ['halves', '#ffa11f', '#f58200'], desc: 'Citrus fruit.', uses: 'Fresh, whole fruit.', rel: ['beans', 'sukuma'], regional: ['Chungwa'], buy: ['whole oranges', 0.72] },
  { id: 'watermelon', name: 'Watermelon', cat: 'Fruits', group: 'vegfruit', prep: 'Fresh', state: 'raw', serve: ['200 g flesh', 200],
    n: [30, 0.61, 7.55, 0.15, 0.4, 6.2, 1, 0.24, 7, 0.1, 112, 8.1, 3, 28, 0, 0, null], fdc: 'Watermelon, raw',
    look: ['wedge', '#ee4452', '#3f8a3c'], desc: 'Water-rich fruit.', uses: 'Fresh slices.', rel: ['pineapple'], regional: ['Tikiti maji'], buy: ['whole watermelon', 0.52] },
  { id: 'pawpaw', name: 'Pawpaw', cat: 'Fruits', group: 'vegfruit', prep: 'Fresh', state: 'raw', serve: ['150 g flesh', 150],
    n: [43, 0.47, 10.82, 0.26, 1.7, 7.82, 8, 0.25, 20, 0.08, 182, 60.9, 37, 47, 0, 0, null], fdc: 'Papayas, raw',
    look: ['wedge', '#fa8a35', '#c9b23a'], desc: 'Papaya.', uses: 'Fresh slices.', rel: ['yoghurt'], alt: ['Papaya'], regional: ['Papai'], buy: ['whole pawpaw', 0.62] },
  { id: 'pineapple', name: 'Pineapple', cat: 'Fruits', group: 'vegfruit', prep: 'Fresh', state: 'raw', serve: ['150 g flesh', 150],
    n: [50, 0.54, 13.12, 0.12, 1.4, 9.85, 1, 0.29, 13, 0.12, 109, 47.8, 18, 3, 0, 0, null], fdc: 'Pineapple, raw, all varieties',
    look: ['cubes', '#ffd83b', '#d9a514'], desc: 'Sweet tropical fruit.', uses: 'Fresh pieces.', rel: ['mango'], regional: ['Nanasi'], buy: ['whole pineapple', 0.52] },
  // Dairy, oils, seeds
  { id: 'milk', name: 'Whole milk', cat: 'Dairy', group: 'extra', prep: 'Pasteurised', state: 'ready-to-eat', serve: ['250 ml glass', 258], ml: 1.03,
    n: [61, 3.15, 4.8, 3.25, 0, 5.05, 43, 0.03, 113, 0.37, 132, 0, 5, 46, 0.45, 1.3, null], fdc: 'Milk, whole, 3.25% milkfat, with added vitamin D',
    look: ['glass', '#fffdf6', '#cfe6e0'], desc: 'Whole cow milk.', uses: 'Drink, tea, porridge.', rel: ['millet'], regional: ['Maziwa'], allergens: ['milk'], diet: 'vegetarian',
    limit: 'Vitamin D reflects fortification. Local milk may not be fortified.' },
  { id: 'yoghurt', name: 'Plain yoghurt', cat: 'Dairy', group: 'extra', prep: 'Cultured, whole milk', state: 'ready-to-eat', serve: ['150 g bowl', 150],
    n: [61, 3.47, 4.66, 3.25, 0, 4.66, 46, 0.05, 121, 0.59, 155, 0.5, 7, 27, 0.37, 0.1, null], fdc: 'Yogurt, plain, whole milk',
    look: ['bowl', '#fffaf0', '#c4673f'], desc: 'Unsweetened yoghurt.', uses: 'With fruit.', rel: ['banana', 'mango'], regional: ['Mtindi is a related product'], allergens: ['milk'], diet: 'vegetarian' },
  { id: 'oil', name: 'Cooking oil (sunflower)', cat: 'Oils and fats', group: 'extra', prep: 'Refined', state: 'ready-to-eat', serve: ['1 tablespoon (about 15 ml)', 14], ml: 0.92,
    n: [884, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null], fdc: 'Oil, sunflower, linoleic, (approx. 65%)',
    look: ['glass', '#f2bd2c', '#fff0b8'], desc: 'Vegetable oil used in cooking. Easy to overlook in meals.', uses: 'Frying and stews.', rel: ['sukuma'], regional: ['Mafuta'],
    limit: 'Oil types differ in fat profile and added vitamins.' },
  { id: 'pumpkinseeds', name: 'Pumpkin seeds', cat: 'Nuts and seeds', group: 'protein', prep: 'Dried kernels', state: 'ready-to-eat', serve: ['30 g', 30],
    n: [559, 30.23, 10.71, 49.05, 6.0, 1.4, 7, 8.82, 46, 7.81, 809, 1.9, 58, 1, 0, 0, null], fdc: 'Seeds, pumpkin and squash seed kernels, dried',
    look: ['beans', '#7f9650', '#c4cf8b'], desc: 'Edible seed kernels.', uses: 'Snack or topping.', rel: ['yoghurt'] },
] as Spec[]).map(make);

// ---------- Recipes (calculated from ingredient records, never hand-typed) ----------
export interface Recipe {
  id: string; name: string; description: string; ingredients: { foodId: string; grams: number }[];
  instructions: string; servings: number; cookingMethod: string; cookedYieldGrams: number;
}
export const RECIPES: Recipe[] = [
  { id: 'ugali', name: 'Ugali', description: 'Firm maize-meal staple.', ingredients: [{ foodId: 'maizeflour', grams: 100 }],
    instructions: 'Bring water to a boil, stir in flour, cook while turning until firm.', servings: 1, cookingMethod: 'Boiled', cookedYieldGrams: 320 },
  { id: 'githeri', name: 'Githeri', description: 'Maize and beans cooked together. Recipes vary by household.', ingredients: [{ foodId: 'maize', grams: 500 }, { foodId: 'beans', grams: 500 }, { foodId: 'oil', grams: 20 }, { foodId: 'tomato', grams: 150 }],
    instructions: 'Combine boiled maize and beans with fried tomato and simmer.', servings: 4, cookingMethod: 'Simmered', cookedYieldGrams: 1150 },
  { id: 'mukimo', name: 'Mukimo', description: 'Mashed potato with maize, peas and greens. Recipes vary by region.', ingredients: [{ foodId: 'potato', grams: 600 }, { foodId: 'maize', grams: 200 }, { foodId: 'peas', grams: 200 }, { foodId: 'amaranth', grams: 150 }],
    instructions: 'Boil the ingredients, then mash together.', servings: 4, cookingMethod: 'Boiled and mashed', cookedYieldGrams: 1150 },
];

const DISH_LOOK: Record<string, Food['look']> = {
  ugali: { shape: 'dome', color: '#fbf1cf', accent: '#ead79c' },
  githeri: { shape: 'mixed', color: '#8e2f27', accent: '#f4c43d' },
  mukimo: { shape: 'mash', color: '#a9bd62', accent: '#f4c43d' },
};

export function recipeToFood(r: Recipe, base: Food[]): Food {
  const parts = r.ingredients.map(i => ({ f: base.find(f => f.id === i.foodId)!, g: i.grams }));
  const nutrients = Object.fromEntries(NUTRIENTS.map(({ key }) => {
    let sum = 0;
    for (const p of parts) {
      const v = p.f.nutrients[key];
      if (v === null) return [key, null]; // one unknown ingredient makes the recipe value unknown
      sum += v * p.g / 100;
    }
    return [key, sum * 100 / r.cookedYieldGrams];
  })) as Nutrients;
  const order: Diet[] = ['vegan', 'vegetarian', 'any'];
  const verified = parts.every(p => p.f.dataQuality === 'verified');
  return {
    id: r.id, name: r.name, alternativeNames: [], regionalNames: [r.name], category: r.id === 'ugali' ? 'Staples' : 'Mixed dishes',
    group: r.id === 'ugali' ? 'staple' : 'mixed', countryOrRegion: 'East Africa', preparationMethod: r.cookingMethod, rawOrCooked: 'cooked',
    description: r.description, uses: r.instructions, related: r.id === 'ugali' ? ['sukuma', 'beans', 'fish'] : ['avocado', 'sukuma'],
    servingDescription: `1 recipe serving (${Math.round(r.cookedYieldGrams / r.servings)} g)`, defaultServingGrams: Math.round(r.cookedYieldGrams / r.servings),
    presets: [], nutrients, sourceName: `NutriVerse recipe calculation from ${verified ? 'verified' : 'provisional'} ingredient records`,
    sourceReference: r.ingredients.map(i => `${i.grams} g ${i.foodId}`).join(', ') + `; cooked yield ${r.cookedYieldGrams} g`,
    fdcQuery: null, dataQuality: 'calculated', lastUpdated: '2026-11',
    limitations: 'Estimate based on one assumed recipe and cooked yield. Vitamin losses during cooking are not modelled.',
    allergens: [...new Set(parts.flatMap(p => p.f.allergens))],
    diet: order[Math.max(...parts.map(p => order.indexOf(p.f.diet)))],
    buyAs: r.name, yield: 1, look: DISH_LOOK[r.id],
  };
}

export function buildCatalogue(verified: Record<string, { nutrients: Nutrients; fdcId: number; fetched: string }> = {}): Food[] {
  const base = BASE.map(f => {
    const v = verified[f.id];
    return v ? { ...f, nutrients: v.nutrients, dataQuality: 'verified' as const, sourceName: 'USDA FoodData Central, SR Legacy (fetched live)',
      sourceReference: `FDC ID ${v.fdcId}: ${f.fdcQuery}`, lastUpdated: v.fetched } : f;
  });
  return [...base, ...RECIPES.map(r => recipeToFood(r, base))];
}
export const BASE_FOODS = BASE;
