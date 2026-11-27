// Pure plate layout shared by the 3D scene and the 2D fallback.
// Foods settle into their guide zone: vegetables/fruit on the left half, protein front-right, staples back-right (matches the compass ring).
import type { PlateGroup } from '../data/foods';
import type { MealItem, Catalogue } from './nutrition';

export const PLATE_RADIUS = 3;
export interface Spot { uid: string; x: number; z: number; r: number }

export const radiusFor = (grams: number, reference: number) =>
  Math.min(1.25, Math.max(0.38, 0.8 * Math.cbrt(Math.max(1, grams) / Math.max(1, reference))));

const HOME: Record<PlateGroup, [number, number]> = {
  vegfruit: [-1.25, 0], protein: [1.05, 1.05], staple: [1.05, -1.05], mixed: [0.15, 0.25], extra: [0, -1.8],
};

export function layout(items: MealItem[], cat: Catalogue): Spot[] {
  const seen: Record<string, number> = {};
  const spots = items.filter(i => cat[i.foodId]).map(i => {
    const f = cat[i.foodId];
    const n = (seen[f.group] = (seen[f.group] ?? 0) + 1) - 1;
    const a = n * 2.4, d = n ? 0.7 : 0;
    const r = radiusFor(i.grams, f.defaultServingGrams);
    return { uid: i.uid, r, fixed: !!i.pos, x: i.pos?.x ?? HOME[f.group][0] + Math.cos(a) * d, z: i.pos?.z ?? HOME[f.group][1] + Math.sin(a) * d };
  });
  // Shrink footprints when the plate gets crowded.
  const area = spots.reduce((s, p) => s + p.r * p.r, 0);
  const shrink = Math.min(1, Math.sqrt((PLATE_RADIUS ** 2 * 0.68) / (area || 1)));
  spots.forEach(s => (s.r *= shrink));
  const clamp = (s: { x: number; z: number; r: number }) => {
    const max = PLATE_RADIUS - s.r * 0.9, len = Math.hypot(s.x, s.z);
    if (len > max) { s.x *= max / len; s.z *= max / len; }
  };
  for (let it = 0; it < 120; it++) {
    for (let a = 0; a < spots.length; a++) for (let b = a + 1; b < spots.length; b++) {
      const p = spots[a], q = spots[b];
      let dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz);
      const overlap = (p.r + q.r) * 0.95 - len;
      if (overlap <= 0) continue;
      if (len < 0.001) { dx = 1; dz = 0; len = 1; }
      const wp = p.fixed && !q.fixed ? 0 : q.fixed && !p.fixed ? 1 : 0.5;
      p.x -= dx / len * overlap * wp * 0.5; p.z -= dz / len * overlap * wp * 0.5;
      q.x += dx / len * overlap * (1 - wp) * 0.5; q.z += dz / len * overlap * (1 - wp) * 0.5;
    }
    spots.forEach(clamp);
  }
  return spots.map(({ uid, x, z, r }) => ({ uid, x, z, r }));
}
