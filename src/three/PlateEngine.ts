// Imperative Three.js scene: woven market mat, ceramic plate, Plate Compass ring, food models.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createFoodModel, disposeObject } from './foodModels';
import { layout, PLATE_RADIUS } from '../lib/layout';
import { plateShares, TARGET, type Catalogue, type MealItem } from '../lib/nutrition';

export interface EngineCallbacks {
  onSelect?: (uid: string | null) => void;
  onMove?: (uid: string, x: number, z: number) => void;
  onHover?: (label: string | null, x: number, y: number) => void;
  onPlateClick?: () => void;
}
export type View = 'full' | 'top' | 'close';
interface Entry { group: THREE.Group; target: THREE.Vector3; scale: number; foodId: string }

const GROUP_COLORS = { vegfruit: '#4dbb78', protein: '#f16b59', staple: '#ffa45b' };

function matTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d')!;
  x.translate(512, 512);
  const bands = ['#caa86a', '#b88f52', '#d6b97d', '#a97c45', '#123b2a', '#d6b97d', '#c15f3c', '#caa86a'];
  for (let r = 510; r > 0; r -= 9) {
    const band = bands[Math.floor(r / 38) % bands.length];
    const stitches = Math.max(10, Math.floor(r / 5));
    for (let i = 0; i < stitches; i++) {
      x.beginPath();
      x.arc(0, 0, r - 4, i / stitches * 6.283, (i + 0.82) / stitches * 6.283);
      x.strokeStyle = band; x.globalAlpha = (i + Math.floor(r / 9)) % 2 ? 1 : 0.78; x.lineWidth = 8; x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class PlateEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private controls: OrbitControls;
  private foods = new Map<string, Entry>();
  private floating: THREE.Group[] = [];
  private compass = new THREE.Group();
  private ring: THREE.Mesh;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private table = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
  private down: { x: number; y: number; uid: string | null; moved: boolean } | null = null;
  private selected: string | null = null;
  private camGoal: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private observers: (ResizeObserver | IntersectionObserver)[] = [];
  private frame = 0;
  private visible = true;
  private cat: Catalogue = {};
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private host: HTMLElement, private hero: boolean, private cb: EngineCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.02;
    host.appendChild(r.domElement);
    r.domElement.style.touchAction = hero ? 'pan-y' : 'none';

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.45;
    const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
    sun.position.set(-4, 9, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
    const rim = new THREE.DirectionalLight('#c6f36b', 0.7); rim.position.set(6, 3, -6);
    this.scene.add(sun, rim, new THREE.HemisphereLight('#fff8e9', '#123b2a', 0.45));

    const weave = new THREE.Mesh(new THREE.CircleGeometry(4.6, 96), new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.95 }));
    weave.rotation.x = -Math.PI / 2; weave.position.y = -0.02; weave.receiveShadow = true;
    const profile = [[0, 0], [2.5, 0], [2.75, 0.04], [3.3, 0.3], [3.5, 0.38], [3.46, 0.43], [3.28, 0.39], [2.95, 0.24], [2.75, 0.16], [0, 0.15]].map(([x, y]) => new THREE.Vector2(x, y));
    const plate = new THREE.Mesh(new THREE.LatheGeometry(profile, 128), new THREE.MeshPhysicalMaterial({ color: '#f3eee0', roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.18, side: THREE.DoubleSide }));
    plate.castShadow = plate.receiveShadow = true; plate.name = 'plate';
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(3.38, 0.022, 10, 160), new THREE.MeshStandardMaterial({ color: '#123b2a', roughness: 0.4 }));
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 0.43;
    this.scene.add(weave, plate, this.ring, this.compass);

    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, minDistance: 5, maxDistance: 22, maxPolarAngle: 1.38, autoRotate: hero && !this.reduced, autoRotateSpeed: 0.7 });
    if (hero) { this.controls.enableZoom = false; this.controls.enablePan = false; }

    const el = r.domElement;
    el.addEventListener('pointerdown', this.onDown, true);
    el.addEventListener('pointermove', this.onMovePointer);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('pointerleave', this.onLeave);
    const ro = new ResizeObserver(() => this.resize()); ro.observe(host);
    const io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }); io.observe(host);
    this.observers = [ro, io];
    this.resize();
    this.setView('full', true);
    this.loop(0);
  }

  private resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? Math.min(62, 36 / Math.max(0.55, w / h)) : 36;
    this.camera.updateProjectionMatrix();
  }

  setView(view: View, instant = false) {
    const look = new THREE.Vector3(0, 0.2, 0);
    let pos = new THREE.Vector3(0, 8.4, 9.6);
    if (view === 'top') pos = new THREE.Vector3(0, 13, 0.05);
    if (view === 'close') {
      const e = this.selected ? this.foods.get(this.selected) : undefined;
      if (e) look.copy(e.target).setY(0.45);
      pos = look.clone().add(new THREE.Vector3(0, 3.6, 4.6));
    }
    if (instant) { this.camera.position.copy(pos); this.controls.target.copy(look); this.controls.update(); }
    else this.camGoal = { pos, look };
  }

  zoom(factor: number) {
    this.camGoal = null;
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 5, 22));
    this.camera.position.copy(this.controls.target).add(offset);
  }

  rotate(angle: number) {
    this.camGoal = null;
    const offset = this.camera.position.clone().sub(this.controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  setMeal(items: MealItem[], cat: Catalogue) {
    this.cat = cat;
    const spots = layout(items, cat);
    const keep = new Set(spots.map(s => s.uid));
    for (const [uid, e] of this.foods) if (!keep.has(uid) || items.find(i => i.uid === uid)?.foodId !== e.foodId) {
      this.scene.remove(e.group); disposeObject(e.group); this.foods.delete(uid);
    }
    for (const s of spots) {
      const item = items.find(i => i.uid === s.uid)!;
      let e = this.foods.get(s.uid);
      if (!e) {
        const group = createFoodModel(cat[item.foodId]);
        group.userData.uid = s.uid;
        group.position.set(s.x, this.reduced ? 0.15 : 3.5, s.z);
        group.scale.setScalar(s.r);
        this.scene.add(group);
        e = { group, target: new THREE.Vector3(), scale: s.r, foodId: item.foodId };
        this.foods.set(s.uid, e);
      }
      e.target.set(s.x, 0.15, s.z);
      e.scale = s.r;
    }
    this.updateCompass(items, cat);
    this.setSelected(this.selected);
  }

  /** The Plate Compass: outer arcs show where the current meal sits against the 1/2 + 1/4 + 1/4 guide. */
  private updateCompass(items: MealItem[], cat: Catalogue) {
    this.compass.children.slice().forEach(c => { this.compass.remove(c); disposeObject(c); });
    const { shares, counted } = plateShares(items, cat);
    let start = Math.PI / 2;
    for (const key of ['vegfruit', 'protein', 'staple'] as const) {
      const span = TARGET[key] * Math.PI * 2;
      const fill = counted ? Math.min(1, shares[key] / TARGET[key]) : 0;
      const arc = (length: number, opacity: number, y: number) => {
        if (length <= 0.06) return;
        const m = new THREE.Mesh(new THREE.RingGeometry(3.78, 4.02, 96, 1, start + 0.03, length - 0.06),
          new THREE.MeshBasicMaterial({ color: GROUP_COLORS[key], transparent: true, opacity, toneMapped: false, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.y = y; this.compass.add(m);
      };
      arc(span, 0.25, 0.01); arc(span * fill, 1, 0.025);
      start += span;
    }
  }

  setFloating(foodIds: string[], cat: Catalogue) {
    this.cat = cat;
    foodIds.forEach((id, i) => {
      if (!cat[id]) return;
      const g = createFoodModel(cat[id]);
      const a = i / foodIds.length * Math.PI * 2 + 0.4;
      g.position.set(Math.cos(a) * 5.1, 1.2 + (i % 3) * 0.5, Math.sin(a) * 4.2);
      g.scale.setScalar(0.5);
      g.userData = { floatId: id, baseY: g.position.y, phase: i * 1.7 };
      this.floating.push(g); this.scene.add(g);
    });
  }

  setSelected(uid: string | null) {
    this.selected = uid && this.foods.has(uid) ? uid : null;
  }

  private cast(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
  }

  private pick(clientX: number, clientY: number): { uid: string | null; floatId: string | null; plate: boolean } {
    this.cast(clientX, clientY);
    const roots = [...[...this.foods.values()].map(e => e.group), ...this.floating, this.scene.getObjectByName('plate')!];
    let o: THREE.Object3D | null = this.ray.intersectObjects(roots, true)[0]?.object ?? null;
    if (o?.name === 'plate') return { uid: null, floatId: null, plate: true };
    while (o && !o.userData.uid && !o.userData.floatId) o = o.parent;
    return { uid: o?.userData.uid ?? null, floatId: o?.userData.floatId ?? null, plate: false };
  }

  /** Table position under a screen point, used for drag and drop. */
  pointOnPlate(clientX: number, clientY: number): { x: number; z: number } | null {
    this.cast(clientX, clientY);
    const p = this.ray.ray.intersectPlane(this.table, new THREE.Vector3());
    return p && Math.hypot(p.x, p.z) <= PLATE_RADIUS + 0.6 ? { x: p.x, z: p.z } : null;
  }

  private onDown = (e: PointerEvent) => {
    const hit = this.pick(e.clientX, e.clientY);
    this.down = { x: e.clientX, y: e.clientY, uid: hit.uid, moved: false };
    this.camGoal = null;
    if (hit.uid && !this.hero) { this.controls.enabled = false; this.renderer.domElement.setPointerCapture(e.pointerId); }
  };

  private onMovePointer = (e: PointerEvent) => {
    const d = this.down;
    if (d) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
      if (d.moved && d.uid && !this.hero) {
        const p = this.pointOnPlate(e.clientX, e.clientY), entry = this.foods.get(d.uid);
        if (p && entry) entry.target.set(p.x, 0.65, p.z);
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const hit = this.pick(e.clientX, e.clientY);
    const id = hit.floatId ?? (hit.uid ? this.foods.get(hit.uid)?.foodId : null);
    this.hovered = hit.uid ?? hit.floatId;
    this.renderer.domElement.style.cursor = id || (hit.plate && this.hero) ? 'pointer' : 'grab';
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.cb.onHover?.(id ? this.cat[id].name : hit.plate && this.hero ? 'Build my plate →' : null, e.clientX - rect.left, e.clientY - rect.top);
  };
  private hovered: string | null = null;

  private onUp = (e: PointerEvent) => {
    const d = this.down; this.down = null; this.controls.enabled = true;
    if (!d) return;
    if (d.uid && d.moved && !this.hero) {
      const entry = this.foods.get(d.uid);
      if (entry) { entry.target.y = 0.15; this.cb.onMove?.(d.uid, entry.target.x, entry.target.z); }
      return;
    }
    if (d.moved) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (this.hero && (hit.plate || hit.uid)) this.cb.onPlateClick?.();
    else this.cb.onSelect?.(hit.uid);
  };
  private onCancel = () => {
    const entry = this.down?.uid ? this.foods.get(this.down.uid) : null;
    if (entry) entry.target.y = 0.15;
    this.down = null; this.controls.enabled = true;
  };
  private onLeave = () => { this.hovered = null; this.cb.onHover?.(null, 0, 0); };

  private loop = (time: number) => {
    this.frame = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) return;
    const t = time / 1000;
    for (const [uid, e] of this.foods) {
      e.group.position.lerp(e.target, 0.14);
      const lift = uid === this.selected ? 1.08 : uid === this.hovered ? 1.05 : 1;
      e.group.scale.setScalar(THREE.MathUtils.lerp(e.group.scale.x, e.scale * lift, 0.15));
      if (uid === this.selected && this.down?.uid !== uid) e.group.position.y = 0.15 + (this.reduced ? 0.12 : 0.12 + Math.sin(t * 3) * 0.04);
    }
    for (const g of this.floating) {
      if (!this.reduced) { g.position.y = g.userData.baseY + Math.sin(t + g.userData.phase) * 0.22; g.rotation.y = t * 0.25 + g.userData.phase; }
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, this.hovered === g.userData.floatId ? 0.66 : 0.5, 0.12));
    }
    if (this.camGoal) {
      this.camera.position.lerp(this.camGoal.pos, 0.09);
      this.controls.target.lerp(this.camGoal.look, 0.09);
      if (this.camera.position.distanceTo(this.camGoal.pos) < 0.03) this.camGoal = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.observers.forEach(o => o.disconnect());
    this.controls.dispose();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown, true);
    el.removeEventListener('pointermove', this.onMovePointer);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onCancel);
    el.removeEventListener('pointerleave', this.onLeave);
    disposeObject(this.scene);
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
  }
}
