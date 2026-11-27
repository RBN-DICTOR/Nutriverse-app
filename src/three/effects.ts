// Procedural canvas sprites, GPU-pooled particle systems, ripples, hero leaves, and food-detail nutrient orbits.
import * as THREE from 'three';
import { NUTRIENTS, type Food, type NutrientKey } from '../data/foods';
import { fmt } from '../lib/nutrition';
import { disposeObject, leafGeometry } from './foodModels';

export function softCircleTexture(inner = '#ffffff', mid = '#ffffffaa'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function ringGlowTexture(color = '#C6F36B'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 20, 64, 64, 62);
  g.addColorStop(0, 'rgba(198,243,107,0)');
  g.addColorStop(0.55, color + '55');
  g.addColorStop(0.76, color + 'ee');
  g.addColorStop(0.92, color + '44');
  g.addColorStop(1, 'rgba(198,243,107,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function leafSpriteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.translate(32, 32);
  x.beginPath();
  x.moveTo(-20, 6);
  x.quadraticCurveTo(-4, -22, 22, -10);
  x.quadraticCurveTo(8, 20, -20, 6);
  x.fillStyle = '#ffffff';
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function pedestalTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#F4ECD8';
  x.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 6) {
    x.fillStyle = y % 12 === 0 ? 'rgba(184, 143, 82, 0.18)' : 'rgba(255, 248, 233, 0.45)';
    x.fillRect(0, y, 256, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

interface ParticleSlot {
  active: boolean;
  persistent: boolean;
  age: number;
  life: number;
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  gravity: number;
  drag: number;
  size0: number;
  size1: number;
  alpha0: number;
  r: number; g: number; b: number;
  phase: number;
}

export class PointPool {
  readonly points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private tex: THREE.Texture;
  private slots: ParticleSlot[];
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private cursor = 0;

  constructor(
    readonly capacity: number,
    tex: THREE.Texture,
    additive = false,
  ) {
    this.tex = tex;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);

    this.slots = Array.from({ length: capacity }, () => ({
      active: false, persistent: false, age: 0, life: 1,
      px: 0, py: -99, pz: 0, vx: 0, vy: 0, vz: 0,
      gravity: 0, drag: 1, size0: 10, size1: 10, alpha0: 0,
      r: 1, g: 1, b: 1, phase: 0,
    }));

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));

    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex }, uScale: { value: 260 } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aAlpha > 0.002 ? clamp(aSize * (uScale / max(0.5, -mv.z)), 1.0, 96.0) : 0.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 texel = texture2D(uMap, gl_PointCoord);
          float a = texel.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * texel.rgb, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
  }

  private alloc(preferTransient = true): number {
    if (this.capacity <= 0) return -1;
    for (let i = 0; i < this.capacity; i++) {
      const idx = (this.cursor + i) % this.capacity;
      if (!this.slots[idx].active) {
        this.cursor = (idx + 1) % this.capacity;
        return idx;
      }
    }
    if (!preferTransient) return -1;
    for (let i = 0; i < this.capacity; i++) {
      const idx = (this.cursor + i) % this.capacity;
      if (!this.slots[idx].persistent) {
        this.cursor = (idx + 1) % this.capacity;
        return idx;
      }
    }
    return -1;
  }

  seedDust(count: number) {
    const c = new THREE.Color('#FFF8E9');
    for (let i = 0; i < count; i++) {
      const idx = this.alloc(false);
      if (idx < 0) break;
      const s = this.slots[idx];
      s.active = true;
      s.persistent = true;
      s.age = Math.random() * 10;
      s.life = 1;
      s.px = (Math.random() - 0.5) * 9.5;
      s.py = 0.5 + Math.random() * 3.8;
      s.pz = (Math.random() - 0.5) * 9.5;
      s.vx = (Math.random() - 0.5) * 0.08;
      s.vy = 0.02 + Math.random() * 0.05;
      s.vz = (Math.random() - 0.5) * 0.08;
      s.gravity = 0;
      s.drag = 1;
      s.size0 = 0.16 + Math.random() * 0.14;
      s.size1 = s.size0;
      s.alpha0 = 0.25 + Math.random() * 0.22;
      s.r = c.r; s.g = c.g; s.b = c.b;
      s.phase = Math.random() * Math.PI * 2;
    }
  }

  emit(opts: {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    color: string;
    life: number;
    size0: number; size1: number;
    alpha0?: number;
    gravity?: number;
    drag?: number;
  }) {
    const idx = this.alloc(true);
    if (idx < 0) return;
    const s = this.slots[idx];
    const c = new THREE.Color(opts.color);
    s.active = true;
    s.persistent = false;
    s.age = 0;
    s.life = Math.max(0.05, opts.life);
    s.px = opts.x; s.py = opts.y; s.pz = opts.z;
    s.vx = opts.vx; s.vy = opts.vy; s.vz = opts.vz;
    s.gravity = opts.gravity ?? -4.8;
    s.drag = opts.drag ?? 0.985;
    s.size0 = opts.size0;
    s.size1 = opts.size1;
    s.alpha0 = opts.alpha0 ?? 0.92;
    s.r = c.r; s.g = c.g; s.b = c.b;
    s.phase = Math.random() * 6.28;
  }

  clearTransient() {
    for (let i = 0; i < this.capacity; i++) {
      if (!this.slots[i].persistent) {
        this.slots[i].active = false;
        this.alpha[i] = 0;
      }
    }
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  setDustVisible(show: boolean) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.slots[i].persistent) {
        this.alpha[i] = show ? this.slots[i].alpha0 : 0;
      }
    }
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number, elapsed: number, pixelHeight: number, showDust = true) {
    if (this.capacity <= 0) return;
    this.mat.uniforms.uScale.value = Math.max(180, pixelHeight * 0.72);
    let dirty = false;

    for (let i = 0; i < this.capacity; i++) {
      const s = this.slots[i];
      if (!s.active) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          dirty = true;
        }
        continue;
      }
      dirty = true;
      if (s.persistent) {
        s.px += s.vx * dt + Math.sin(elapsed * 0.4 + s.phase) * 0.04 * dt;
        s.py += s.vy * dt;
        s.pz += s.vz * dt + Math.cos(elapsed * 0.35 + s.phase) * 0.04 * dt;
        if (s.py > 4.6) s.py = 0.4;
        if (s.px > 5) s.px = -5; else if (s.px < -5) s.px = 5;
        if (s.pz > 5) s.pz = -5; else if (s.pz < -5) s.pz = 5;
        const pulse = 0.65 + 0.35 * Math.sin(elapsed * 0.9 + s.phase);
        this.pos[i * 3] = s.px; this.pos[i * 3 + 1] = s.py; this.pos[i * 3 + 2] = s.pz;
        this.col[i * 3] = s.r; this.col[i * 3 + 1] = s.g; this.col[i * 3 + 2] = s.b;
        this.size[i] = s.size0;
        this.alpha[i] = showDust ? s.alpha0 * pulse : 0;
      } else {
        s.age += dt;
        if (s.age >= s.life) {
          s.active = false;
          this.alpha[i] = 0;
          continue;
        }
        const t = s.age / s.life;
        s.vy += s.gravity * dt;
        const damp = Math.pow(s.drag, dt * 60);
        s.vx *= damp; s.vz *= damp;
        s.px += s.vx * dt;
        s.py += s.vy * dt;
        s.pz += s.vz * dt;
        if (s.py < 0.16 && s.vy < 0) {
          s.py = 0.16;
          s.vy = -s.vy * 0.25;
        }
        const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        this.pos[i * 3] = s.px; this.pos[i * 3 + 1] = s.py; this.pos[i * 3 + 2] = s.pz;
        this.col[i * 3] = s.r; this.col[i * 3 + 1] = s.g; this.col[i * 3 + 2] = s.b;
        this.size[i] = THREE.MathUtils.lerp(s.size0, s.size1, t);
        this.alpha[i] = s.alpha0 * Math.max(0, fade);
      }
    }

    if (dirty) {
      (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}

interface RippleSlot {
  active: boolean;
  age: number;
  life: number;
  x: number; y: number; z: number;
  r0: number; r1: number;
  color: THREE.Color;
}

export class RipplePool {
  readonly mesh: THREE.InstancedMesh;
  private geo: THREE.RingGeometry;
  private mat: THREE.ShaderMaterial;
  private alphaAttr: THREE.InstancedBufferAttribute;
  private slots: RippleSlot[];
  private dummy = new THREE.Object3D();

  constructor(readonly capacity = 8) {
    this.geo = new THREE.RingGeometry(0.86, 1.0, 48);
    this.geo.rotateX(-Math.PI / 2);

    const alphas = new Float32Array(capacity);
    this.alphaAttr = new THREE.InstancedBufferAttribute(alphas, 1);
    this.geo.setAttribute('aAlpha', this.alphaAttr);

    this.mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          #ifdef USE_INSTANCING_COLOR
            vColor = instanceColor;
          #else
            vColor = vec3(1.0, 0.97, 0.91);
          #endif
          vec4 world = instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * world;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          if (vAlpha < 0.01) discard;
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity);
    this.mesh.frustumCulled = false;
    this.slots = Array.from({ length: capacity }, () => ({
      active: false, age: 0, life: 0.6, x: 0, y: 0.165, z: 0, r0: 0.3, r1: 2.2, color: new THREE.Color('#FFF8E9'),
    }));
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) {
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, new THREE.Color('#FFF8E9'));
      this.alphaAttr.setX(i, 0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  spawn(x: number, z: number, color = '#FFF8E9', r0 = 0.35, r1 = 2.0, life = 0.6, y = 0.165) {
    const slot = this.slots.find(s => !s.active) ?? this.slots[0];
    slot.active = true;
    slot.age = 0;
    slot.life = life;
    slot.x = x; slot.y = y; slot.z = z;
    slot.r0 = r0; slot.r1 = r1;
    slot.color.set(color);
  }

  clear() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.capacity; i++) {
      this.slots[i].active = false;
      this.alphaAttr.setX(i, 0);
      this.mesh.setMatrixAt(i, zero);
    }
    this.alphaAttr.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    let dirty = false;
    for (let i = 0; i < this.capacity; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      dirty = true;
      s.age += dt;
      if (s.age >= s.life) {
        s.active = false;
        this.alphaAttr.setX(i, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      const p = s.age / s.life;
      const ease = 1 - Math.pow(1 - p, 2.2);
      const radius = THREE.MathUtils.lerp(s.r0, s.r1, ease);
      this.dummy.position.set(s.x, s.y, s.z);
      this.dummy.scale.set(radius, 1, radius);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, s.color);
      this.alphaAttr.setX(i, (1 - p) * 0.72);
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.alphaAttr.needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

export interface HeroLeafEntry {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  depthFactor: number;
  phase: number;
}

export function createHeroLeaves(scene: THREE.Scene): HeroLeafEntry[] {
  const geo = leafGeometry();
  const entries: HeroLeafEntry[] = [];
  const specs: { pos: [number, number, number]; scale: number; color: string; opacity: number; depthFactor: number; rot: [number, number, number] }[] = [
    // 3 large far background leaves
    { pos: [-5.6, 2.4, -5.8], scale: 3.1, color: '#245E44', opacity: 0.34, depthFactor: -0.45, rot: [0.35, 0.6, 0.25] },
    { pos: [5.9, 3.1, -6.4], scale: 3.4, color: '#2E7852', opacity: 0.30, depthFactor: -0.55, rot: [-0.25, -0.9, -0.2] },
    { pos: [0.4, 4.3, -7.2], scale: 2.9, color: '#1F543D', opacity: 0.28, depthFactor: -0.60, rot: [0.45, 1.8, 0.1] },
    // 2 foreground leaves
    { pos: [-4.9, 0.6, 4.4], scale: 1.5, color: '#4DBB78', opacity: 0.52, depthFactor: 0.52, rot: [0.2, -0.4, 0.35] },
    { pos: [5.1, 1.3, 4.1], scale: 1.35, color: '#C6F36B', opacity: 0.45, depthFactor: 0.46, rot: [-0.2, 2.2, -0.25] },
  ];

  specs.forEach((sp, i) => {
    const m = new THREE.MeshBasicMaterial({
      color: sp.color,
      transparent: true,
      opacity: sp.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo.clone(), m);
    mesh.position.set(...sp.pos);
    mesh.rotation.set(...sp.rot);
    mesh.scale.setScalar(sp.scale);
    scene.add(mesh);
    entries.push({
      mesh,
      basePos: new THREE.Vector3(...sp.pos),
      baseRot: new THREE.Euler(...sp.rot),
      depthFactor: sp.depthFactor,
      phase: i * 1.4,
    });
  });
  geo.dispose();
  return entries;
}

export interface NutrientOrb {
  mesh: THREE.Mesh;
  angleOffset: number;
  orbitRadius: number;
  baseY: number;
  tooltip: string;
}

export function createDetailRig(food: Food): { group: THREE.Group; orbs: NutrientOrb[] } {
  const group = new THREE.Group();
  const tex = pedestalTexture();
  const profile = [
    [0.01, -0.34], [1.18, -0.34], [1.22, -0.28], [1.1, -0.18],
    [1.06, -0.08], [1.16, -0.02], [1.12, 0.0], [0.01, 0.0],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const pedestal = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 64),
    new THREE.MeshPhysicalMaterial({ map: tex, color: '#FFF8E9', roughness: 0.58, clearcoat: 0.25 }),
  );
  pedestal.receiveShadow = true;
  pedestal.castShadow = true;
  group.add(pedestal);

  const specs: { key: NutrientKey; label: string; color: string }[] = [
    { key: 'proteinGrams', label: 'Protein', color: '#F16B59' },
    { key: 'carbohydrateGrams', label: 'Carbohydrate', color: '#FFA45B' },
    { key: 'fatGrams', label: 'Fat', color: '#E2B93B' },
    { key: 'fibreGrams', label: 'Fibre', color: '#4DBB78' },
  ];

  const orbs: NutrientOrb[] = specs.map((sp, i) => {
    const val = food.nutrients[sp.key];
    const meta = NUTRIENTS.find(n => n.key === sp.key)!;
    const mat = new THREE.MeshPhysicalMaterial({
      color: sp.color,
      roughness: 0.28,
      clearcoat: 0.65,
      emissive: new THREE.Color(sp.color),
      emissiveIntensity: 0.14,
    });
    const geo = val === null
      ? new THREE.TorusGeometry(0.16, 0.032, 12, 32)
      : new THREE.SphereGeometry(0.10 + Math.sqrt(Math.min(100, Math.max(0, val)) / 100) * 0.24, 24, 18);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const angleOffset = (i / specs.length) * Math.PI * 2;
    const orbitRadius = 1.68;
    const baseY = 0.54 + (i % 2) * 0.14;
    mesh.position.set(Math.cos(angleOffset) * orbitRadius, baseY, Math.sin(angleOffset) * orbitRadius);
    const tooltip = `${sp.label}: ${fmt(val, meta.unit)} / 100 g`;
    mesh.userData.nutrientTooltip = tooltip;
    group.add(mesh);
    return { mesh, angleOffset, orbitRadius, baseY, tooltip };
  });

  return { group, orbs };
}

export function disposeDetailRig(group: THREE.Group | null) {
  if (!group) return;
  disposeObject(group);
}
