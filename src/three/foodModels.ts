// Original procedural food models (no third-party assets, no licence risk).
// Every model is built to fit a footprint of radius 1 and sit on y = 0.
import * as THREE from 'three';
import type { Food } from '../data/foods';

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6d2b79f5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const mat = (color: string, o: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, ...o });

function mesh(g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0], r: [number, number, number] = [0, 0, 0], s: [number, number, number] = [1, 1, 1]) {
  const x = new THREE.Mesh(g, m);
  x.position.set(...p); x.rotation.set(...r); x.scale.set(...s);
  x.castShadow = x.receiveShadow = true;
  return x;
}

/** Lumpy organic displacement, consistent for shared vertices. */
function lumpy(g: THREE.BufferGeometry, amount: number, freq = 4) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * freq + 1.3) * Math.sin(v.y * freq * 1.3 + 2.1) * Math.sin(v.z * freq * 0.9 + 0.4)
      + 0.5 * Math.sin(v.x * freq * 2.7) * Math.sin(v.z * freq * 2.3 + v.y * 3);
    v.multiplyScalar(1 + n * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Many small pieces heaped into a mound, drawn with one instanced draw call. */
function heap(geo: THREE.BufferGeometry, colors: string[], count: number, rand: () => number, height: number, size: [number, number, number], rough = 0.55) {
  const inst = new THREE.InstancedMesh(geo, mat('#ffffff', { roughness: rough, clearcoat: 0.25, clearcoatRoughness: 0.5 }), count);
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 0.9;
    const top = height * (1 - rr * rr);
    const y = 0.05 + top * (i < count * 0.7 ? 0.55 + rand() * 0.45 : rand() * 0.6);
    d.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    d.rotation.set((rand() - 0.5) * 0.9, rand() * 6.28, (rand() - 0.5) * 0.9);
    d.scale.set(...size).multiplyScalar(0.85 + rand() * 0.3);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
    inst.setColorAt(i, c.set(colors[Math.floor(rand() * colors.length)]).offsetHSL(0, 0, (rand() - 0.5) * 0.05));
  }
  inst.castShadow = inst.receiveShadow = true;
  return inst;
}

function spotted(base: string, spot: string, rand: () => number, n = 90) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++) {
    const px = rand() * 256, py = rand() * 256, r = 2 + rand() * 18;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, spot + 'cc'); g.addColorStop(1, spot + '00');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function leafGeometry() {
  const g = new THREE.PlaneGeometry(0.8, 0.42, 10, 6);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.4, y = p.getY(i) / 0.21;
    p.setY(i, p.getY(i) * Math.max(0.08, 1 - x * x));
    p.setZ(i, 0.09 * y * y + 0.05 * Math.sin(x * 7) * Math.abs(y) - 0.07 * x * x);
  }
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  return g;
}

function disc(skin: string, face: string, radius: number, h: number, detail: (g: THREE.Group, top: number) => void) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(radius, radius * 0.94, h, 32), mat(skin), [0, h / 2, 0]));
  g.add(mesh(new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, 0.02, 32), mat(face, { clearcoat: 0.6 }), [0, h + 0.002, 0]));
  detail(g, h + 0.03);
  return g;
}

export function createFoodModel(food: Food): THREE.Group {
  const { shape, color, accent } = food.look;
  const rand = rng(food.id);
  const g = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 12, 9);

  switch (shape) {
    case 'grains': {
      const lentil = food.id === 'lentils';
      g.add(heap(sphere, [color, color, accent], lentil ? 340 : 520, rand, 0.55, lentil ? [0.085, 0.045, 0.085] : food.id === 'rice' ? [0.1, 0.038, 0.042] : [0.055, 0.05, 0.055]));
      break;
    }
    case 'beans': {
      const bean = new THREE.SphereGeometry(1, 14, 10);
      const p = bean.attributes.position as THREE.BufferAttribute;
      const kidney = food.id === 'beans' || food.id === 'groundnuts';
      if (kidney) for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + 0.45 * p.getX(i) ** 2);
      bean.computeVertexNormals();
      const flat = food.id === 'pumpkinseeds';
      const round = food.id === 'peas' || food.id === 'greengrams';
      g.add(heap(bean, [color, color, accent], round ? 210 : 120, rand, 0.55, flat ? [0.16, 0.035, 0.09] : round ? [0.095, 0.085, 0.085] : [0.17, 0.1, 0.1], 0.38));
      break;
    }
    case 'mixed':
      g.add(heap(sphere, [color, color, color], 90, rand, 0.55, [0.16, 0.1, 0.11], 0.4));
      g.add(heap(sphere, [accent, '#ffdd6b'], 100, rand, 0.62, [0.095, 0.08, 0.09]));
      g.add(heap(new THREE.BoxGeometry(1, 1, 1), ['#d8452c'], 14, rand, 0.66, [0.15, 0.05, 0.11]));
      break;
    case 'dome': {
      const geo = lumpy(new THREE.SphereGeometry(0.88, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2), 0.025, 6);
      g.add(mesh(geo, mat(color, { roughness: 0.85, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }), [0, 0.02, 0], [0, 0, 0], [1, 0.82, 1]));
      break;
    }
    case 'mash': {
      const geo = lumpy(new THREE.SphereGeometry(0.9, 56, 36, 0, Math.PI * 2, 0, Math.PI / 2), 0.09, 7);
      g.add(mesh(geo, mat(color, { roughness: 0.78 }), [0, 0.02, 0], [0, 0, 0], [1, 0.6, 1]));
      g.add(heap(sphere, [accent, '#4d7c2d'], 55, rand, 0.55, [0.06, 0.045, 0.06]));
      break;
    }
    case 'leaves': {
      const leaf = leafGeometry();
      const cols = [color, color, accent];
      const mats = cols.map(c => mat(c, { side: THREE.DoubleSide, roughness: 0.5, clearcoat: 0.35 }));
      for (let i = 0; i < 85; i++) {
        const a = rand() * 6.28, r = Math.sqrt(rand()) * 0.65;
        g.add(mesh(leaf, mats[i % 3], [Math.cos(a) * r, 0.07 + rand() * 0.4 * (1 - r), Math.sin(a) * r],
          [(rand() - 0.5) * 0.8, rand() * 6.28, (rand() - 0.5) * 0.8], [0.55 + rand() * 0.45, 1, 0.55 + rand() * 0.45]));
      }
      break;
    }
    case 'flatbread': {
      const m = mat('#ffffff', { map: spotted(color, accent, rand), roughness: 0.7 });
      for (let i = 0; i < 3; i++) g.add(mesh(lumpy(new THREE.CylinderGeometry(0.94 - i * 0.02, 0.94 - i * 0.02, 0.07, 64, 1), 0.012, 9), m, [i * 0.05 - 0.05, 0.05 + i * 0.085, 0], [0, i * 2, 0]));
      break;
    }
    case 'rounds': {
      const skin = mat('#ffffff', { map: spotted(color, food.id === 'sweetpotato' ? '#c9631f' : accent, rand, 50), roughness: 0.55 });
      const pos: [number, number, number][] = [[-0.38, 0.3, -0.2], [0.4, 0.28, -0.1], [0, 0.28, 0.45], [0.05, 0.62, 0]];
      pos.forEach((p, i) => g.add(mesh(lumpy(new THREE.SphereGeometry(0.4, 28, 20), 0.05, 5), skin, p, [rand(), rand() * 3, rand()], [1.15, 0.72, i % 2 ? 0.9 : 1])));
      break;
    }
    case 'cubes': {
      const m = mat(color, { roughness: food.id === 'beef' ? 0.45 : 0.55, clearcoat: 0.3 });
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4, r = 0.17 * Math.sqrt(i);
        const s = 0.26 + rand() * 0.1;
        g.add(mesh(lumpy(new THREE.BoxGeometry(s, s * 0.8, s, 4, 4, 4), 0.06, 11), i % 5 === 4 ? mat(accent) : m, [Math.cos(a) * r, s * 0.4 + (i < 5 ? 0.22 : 0), Math.sin(a) * r], [rand() * 0.4, rand() * 3, rand() * 0.4]));
      }
      break;
    }
    case 'coins':
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, r = 0.21 * Math.sqrt(i);
        const c = disc(color, accent, 0.29, 0.11, (d, y) => {
          if (food.id === 'tomato') for (let k = 0; k < 5; k++) d.add(mesh(sphere, mat('#d63a25', { clearcoat: 0.8 }), [Math.cos(k * 1.256) * 0.13, y - 0.015, Math.sin(k * 1.256) * 0.13], [0, -k * 1.256, 0], [0.08, 0.02, 0.045]));
          else d.add(mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 24), mat(color), [0, y - 0.015, 0], [Math.PI / 2, 0, 0]));
        });
        c.position.set(Math.cos(a) * r, i * 0.035, Math.sin(a) * r);
        c.rotation.set((rand() - 0.5) * 0.35, rand() * 3, (rand() - 0.5) * 0.35);
        g.add(c);
      }
      break;
    case 'pods':
      for (let i = 0; i < 18; i++) {
        const a = i * 2.4, r = 0.17 * Math.sqrt(i);
        const c = new THREE.Group();
        c.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.13, 5), mat(color), [0, 0.07, 0]));
        c.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 5), mat(accent), [0, 0.14, 0]));
        for (let k = 0; k < 5; k++) c.add(mesh(sphere, mat('#f6f2cf'), [Math.cos(k * 1.256) * 0.07, 0.155, Math.sin(k * 1.256) * 0.07], [0, 0, 0], [0.025, 0.018, 0.025]));
        c.position.set(Math.cos(a) * r, i < 6 ? 0.14 : 0, Math.sin(a) * r);
        c.rotation.set((rand() - 0.5) * 0.6, rand() * 3, (rand() - 0.5) * 0.6);
        g.add(c);
      }
      break;
    case 'egg':
      for (const [x, z, rot] of [[-0.4, -0.1, 0.4], [0.42, 0.15, -0.5]]) {
        const half = new THREE.Group();
        half.add(mesh(new THREE.SphereGeometry(0.5, 40, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(color, { roughness: 0.3, clearcoat: 0.6 }), [0, 0.32, 0], [0, 0, 0], [1, 0.65, 1.3]));
        half.add(mesh(new THREE.CircleGeometry(0.5, 40), mat('#fffdf5', { roughness: 0.35, side: THREE.DoubleSide }), [0, 0.32, 0], [-Math.PI / 2, 0, 0], [1, 1.3, 1]));
        half.add(mesh(new THREE.SphereGeometry(0.24, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(accent, { roughness: 0.55 }), [0, 0.322, 0.06], [0, 0, 0], [1, 0.3, 1]));
        half.position.set(x, 0, z); half.rotation.y = rot; g.add(half);
      }
      break;
    case 'fish': {
      const s = new THREE.Shape();
      s.moveTo(-0.95, 0);
      s.bezierCurveTo(-0.65, 0.55, 0.2, 0.52, 0.55, 0.12);
      s.lineTo(0.95, 0.36); s.quadraticCurveTo(0.82, 0, 0.95, -0.36); s.lineTo(0.55, -0.12);
      s.bezierCurveTo(0.2, -0.52, -0.65, -0.55, -0.95, 0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.09, bevelSegments: 5, curveSegments: 32 });
      geo.rotateX(-Math.PI / 2);
      g.add(mesh(geo, mat('#ffffff', { map: spotted(color, accent, rand, 120), roughness: 0.42, clearcoat: 0.5 }), [0, 0.1, 0.05]));
      for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CapsuleGeometry(0.018, 0.4 - Math.abs(i - 1.5) * 0.08, 3, 8), mat('#4c2a12'), [-0.3 + i * 0.22, 0.3, 0], [Math.PI / 2, 0, 0.35]));
      g.add(mesh(sphere, mat('#14100c', { clearcoat: 1 }), [-0.68, 0.3, -0.08], [0, 0, 0], [0.055, 0.04, 0.055]));
      g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20, 1, false, 0, Math.PI), mat('#f7d93e'), [0.25, 0.1, 0.62], [0, -0.4, 0]));
      break;
    }
    case 'drumstick':
      for (const [x, z, rot] of [[-0.12, -0.3, 0.35], [0.1, 0.32, -0.3]]) {
        const d = new THREE.Group();
        const meat = mat('#ffffff', { map: spotted(color, '#6f3a14', rand, 60), roughness: 0.4, clearcoat: 0.5 });
        d.add(mesh(lumpy(new THREE.SphereGeometry(0.4, 32, 24), 0.035, 7), meat, [-0.25, 0.3, 0], [0, 0, 0], [1.35, 0.7, 0.9]));
        d.add(mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.4, 16), meat, [0.32, 0.27, 0], [0, 0, -Math.PI / 2]));
        d.add(mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.38, 12), mat(accent), [0.64, 0.27, 0], [0, 0, -Math.PI / 2]));
        d.add(mesh(sphere, mat(accent), [0.84, 0.27, 0.05], [0, 0, 0], [0.09, 0.08, 0.08]));
        d.add(mesh(sphere, mat(accent), [0.84, 0.27, -0.05], [0, 0, 0], [0.09, 0.08, 0.08]));
        d.position.set(x, 0, z); d.rotation.y = rot; g.add(d);
      }
      break;
    case 'banana':
      for (let n = 0; n < 2; n++) {
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.9, 0, 0.12), new THREE.Vector3(-0.45, 0, -0.2), new THREE.Vector3(0.1, 0, -0.32), new THREE.Vector3(0.9, 0, 0.1)]);
        const segs = 48, ring = 12, geo = new THREE.TubeGeometry(curve, segs, 0.2, ring, false);
        const p = geo.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
        for (let i = 0; i <= segs; i++) {
          const t = i / segs, c = curve.getPointAt(t), k = Math.max(0.2, Math.pow(Math.sin(Math.PI * (0.05 + t * 0.9)), 0.55));
          for (let j = 0; j <= ring; j++) { const q = i * (ring + 1) + j; v.fromBufferAttribute(p, q).sub(c).multiplyScalar(k).add(c); p.setXYZ(q, v.x, v.y, v.z); }
        }
        geo.computeVertexNormals();
        const b = mesh(geo, mat(color, { roughness: 0.45, clearcoat: 0.3 }), [0, 0.2 + n * 0.04, n * 0.45 - 0.12], [0, n * 0.12, 0]);
        b.add(mesh(sphere, mat(accent), [0.9, 0, 0.1], [0, 0, 0], [0.06, 0.05, 0.05]), mesh(sphere, mat(accent), [-0.9, 0, 0.12], [0, 0, 0], [0.09, 0.05, 0.05]));
        g.add(b);
      }
      break;
    case 'halves':
      for (const [x, z] of [[-0.45, 0.05], [0.45, -0.05]]) {
        const h = new THREE.Group();
        const avo = food.id === 'avocado';
        h.add(mesh(new THREE.SphereGeometry(0.46, 40, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(accent, { roughness: avo ? 0.8 : 0.55 }), [0, 0.38, 0], [0, 0, 0], [1, 0.82, avo ? 1.35 : 1]));
        h.add(mesh(new THREE.CircleGeometry(0.46, 40), mat(avo ? color : '#ffc14a', { side: THREE.DoubleSide, clearcoat: 0.5 }), [0, 0.381, 0], [-Math.PI / 2, 0, 0], [1, avo ? 1.35 : 1, 1]));
        if (avo) h.add(mesh(sphere, mat('#7a4a26', { clearcoat: 0.7 }), [0, 0.39, 0.14], [0, 0, 0], [0.19, 0.13, 0.2]));
        else for (let k = 0; k < 9; k++) h.add(mesh(new THREE.BoxGeometry(0.76, 0.012, 0.016), mat('#fff1c9'), [0, 0.388, 0], [0, k * Math.PI / 9, 0]));
        h.position.set(x, 0, z); h.rotation.y = x; g.add(h);
      }
      break;
    case 'wedge':
      for (let i = 0; i < 3; i++) {
        const w = new THREE.Group();
        const slice = (r: number, d: number, m: THREE.Material, y: number) => {
          const geo = new THREE.CylinderGeometry(r, r, d, 40, 1, false, -Math.PI / 2, Math.PI);
          w.add(mesh(geo, m, [0, y, 0]));
        };
        slice(0.74, 0.19, mat(accent), 0.1); slice(0.67, 0.2, mat('#f4efc9'), 0.101); slice(0.61, 0.21, mat(color, { clearcoat: 0.6 }), 0.102);
        for (let k = 0; k < 9; k++) w.add(mesh(sphere, mat('#1c1710', { clearcoat: 1 }), [(rand() - 0.5) * 0.65, 0.215, 0.12 + rand() * 0.32], [0, rand() * 3, 0], [0.025, 0.012, 0.04]));
        w.position.set((i - 1) * 0.12, i * 0.17, (i - 1) * 0.35 - 0.25); w.rotation.y = (i - 1) * 0.22; g.add(w);
      }
      break;
    case 'glass': {
      const glass = mat('#ffffff', { transparent: true, opacity: 0.2, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
      g.add(mesh(new THREE.CylinderGeometry(0.5, 0.42, 1.25, 40, 1, true), glass, [0, 0.65, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.465, 0.405, 0.95, 40), mat(color, { roughness: 0.15, clearcoat: 1 }), [0, 0.5, 0]));
      g.add(mesh(new THREE.TorusGeometry(0.5, 0.018, 8, 48), mat(accent), [0, 1.275, 0], [Math.PI / 2, 0, 0]));
      break;
    }
    case 'bowl': {
      const pts = [[0.02, 0.02], [0.45, 0.04], [0.72, 0.22], [0.86, 0.55], [0.79, 0.55], [0.66, 0.28], [0.02, 0.18]].map(([x, y]) => new THREE.Vector2(x, y));
      g.add(mesh(new THREE.LatheGeometry(pts, 48), mat(accent, { side: THREE.DoubleSide, clearcoat: 0.8 })));
      g.add(mesh(lumpy(new THREE.CylinderGeometry(0.75, 0.62, 0.12, 48, 2), 0.015, 6), mat(color, { roughness: 0.25, clearcoat: 0.8 }), [0, 0.44, 0]));
      break;
    }
    case 'bread': {
      const s = new THREE.Shape();
      s.moveTo(-0.5, -0.55); s.lineTo(0.5, -0.55); s.lineTo(0.5, 0.2);
      s.bezierCurveTo(0.9, 0.55, 0.35, 0.8, 0, 0.64); s.bezierCurveTo(-0.35, 0.8, -0.9, 0.55, -0.5, 0.2); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 3 });
      geo.rotateX(-Math.PI / 2);
      const crumb = mat('#ffffff', { map: spotted('#e6c08a', '#b8854b', rand, 150), roughness: 0.9 }), crust = mat(accent);
      g.add(mesh(geo, [crumb, crust] as unknown as THREE.Material, [-0.18, 0.06, 0], [0, 0.15, 0]));
      g.add(mesh(geo, [crumb, crust] as unknown as THREE.Material, [0.2, 0.29, 0.08], [0, -0.28, 0.04]));
      break;
    }
    case 'cob':
      for (let n = 0; n < 2; n++) {
        const cob = new THREE.Group();
        cob.add(mesh(new THREE.CapsuleGeometry(0.2, 1.15, 6, 20), mat('#e8b92f'), [0, 0, 0], [0, 0, Math.PI / 2]));
        const k = new THREE.InstancedMesh(sphere, mat(color, { clearcoat: 0.6, roughness: 0.35 }), 14 * 18);
        const d = new THREE.Object3D(); let q = 0;
        for (let i = 0; i < 18; i++) for (let j = 0; j < 14; j++) {
          const a = j / 14 * 6.283;
          d.position.set(-0.62 + i * 0.073, Math.sin(a) * 0.205, Math.cos(a) * 0.205); d.scale.setScalar(0.052); d.updateMatrix(); k.setMatrixAt(q++, d.matrix);
        }
        k.castShadow = true; cob.add(k);
        cob.add(mesh(leafGeometry(), mat(accent, { side: THREE.DoubleSide }), [0.55, -0.16, n ? 0.18 : -0.18], [0, n ? 0.5 : -0.5, 0], [1.4, 1, 1.1]));
        cob.position.set(0, 0.28, n * 0.52 - 0.26); cob.rotation.y = n * 0.2; g.add(cob);
      }
      break;
    case 'whole':
      g.add(mesh(new THREE.SphereGeometry(0.7, 32, 24), mat(color), [0, 0.7, 0]));
      break;
  }
  g.userData.shape = shape;
  return g;
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse(c => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const material of Array.isArray(m.material) ? m.material : [m.material]) {
      (material as THREE.MeshPhysicalMaterial).map?.dispose();
      material.dispose();
    }
    (m as THREE.InstancedMesh).isInstancedMesh && (m as THREE.InstancedMesh).dispose();
  });
}
