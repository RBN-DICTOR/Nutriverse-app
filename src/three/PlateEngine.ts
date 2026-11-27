// Imperative Three.js scene: woven market mat, ceramic plate, Plate Compass, food models, particles & effects.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Food } from '../data/foods';
import { createFoodModel, disposeObject } from './foodModels';
import { layout, PLATE_RADIUS } from '../lib/layout';
import { isLowPowerDevice, isMotionReduced } from '../lib/motion';
import { plateShares, TARGET, type Catalogue, type MealItem } from '../lib/nutrition';
import {
  createDetailRig,
  createHeroLeaves,
  disposeDetailRig,
  leafSpriteTexture,
  PointPool,
  ringGlowTexture,
  RipplePool,
  softCircleTexture,
  type HeroLeafEntry,
  type NutrientOrb,
} from './effects';

export interface EngineCallbacks {
  onSelect?: (uid: string | null) => void;
  onMove?: (uid: string, x: number, z: number) => void;
  onHover?: (label: string | null, x: number, y: number) => void;
  onPlateClick?: () => void;
  onCompassComplete?: (complete: boolean) => void;
}
export interface EngineOptions {
  detailFood?: Food;
  turntable?: boolean;
  tiltPointer?: boolean;
  bobPhase?: number;
  emptyGhost?: boolean;
}
export type View = 'full' | 'top' | 'close';

interface Entry {
  group: THREE.Group;
  target: THREE.Vector3;
  scale: number;
  foodId: string;
  justAdded: boolean;
  landed: boolean;
  squashAge: number;
  steamTimer: number;
}
interface ExitingEntry {
  group: THREE.Group;
  age: number;
  life: number;
  startScale: number;
}
interface CompassArc {
  key: 'vegfruit' | 'protein' | 'staple';
  start: number;
  span: number;
  current: number;
  target: number;
  pulse: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

const GROUP_COLORS = { vegfruit: '#4dbb78', protein: '#f16b59', staple: '#ffa45b' } as const;

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
  public effects = {
    landing: true,
    bursts: true,
    steam: true,
    compassAnim: true,
    selectionGlow: true,
    hoverLift: true,
    removeAnim: true,
    ambient: true,
    heroIntro: true,
    depthFog: true,
  };

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private controls: OrbitControls;
  private stageRoot = new THREE.Group();
  private foods = new Map<string, Entry>();
  private exiting: ExitingEntry[] = [];
  private floating: THREE.Group[] = [];
  private heroLeaves: HeroLeafEntry[] = [];
  private ghosts: THREE.Group[] = [];
  private compass = new THREE.Group();
  private compassArcs: CompassArc[] = [];
  private weave: THREE.Mesh | null = null;
  private plateMesh: THREE.Mesh | null = null;
  private ring: THREE.Mesh | null = null;
  private detailRig: THREE.Group | null = null;
  private detailOrbs: NutrientOrb[] = [];

  private sweepLight: THREE.PointLight | null = null;
  private selGlow: THREE.Mesh;
  private hoverShadow: THREE.Mesh;
  private floatOrbit: THREE.Mesh;

  private burstPool: PointPool;
  private steamPool: PointPool;
  private leafPool: PointPool;
  private ripplePool: RipplePool;

  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerNorm = new THREE.Vector2(0, 0);
  private table = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
  private down: { x: number; y: number; uid: string | null; moved: boolean } | null = null;
  private selected: string | null = null;
  private hovered: string | null = null;
  private camGoal: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private observers: (ResizeObserver | IntersectionObserver)[] = [];
  private frame = 0;
  private lastTime = 0;
  private visible = true;
  private cat: Catalogue = {};
  private reduced = isMotionReduced();
  private lowPower = isLowPowerDevice();

  private introAge = 0;
  private introDone = false;
  private celebrated = false;
  private bounceAge = -1;

  private mq: MediaQueryList | null = null;

  constructor(
    private host: HTMLElement,
    private hero: boolean,
    private cb: EngineCallbacks,
    private opts: EngineOptions = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowPower, alpha: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, this.lowPower ? 1.25 : 1.75));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.02;
    host.appendChild(r.domElement);
    r.domElement.style.touchAction = hero ? 'pan-y' : 'none';

    if (this.effects.depthFog) {
      this.scene.fog = new THREE.FogExp2('#123B2A', hero ? 0.028 : 0.024);
    }

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.45;

    const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
    sun.position.set(-4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.lowPower ? 512 : 1024, this.lowPower ? 512 : 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 5;
    const rim = new THREE.DirectionalLight('#c6f36b', 0.7);
    rim.position.set(6, 3, -6);
    this.sweepLight = new THREE.PointLight('#fff8e9', 0, 9, 1.5);
    this.sweepLight.position.set(-3, 2.2, 2);
    this.scene.add(sun, rim, this.sweepLight, new THREE.HemisphereLight('#fff8e9', '#123b2a', 0.45));

    this.scene.add(this.stageRoot);

    if (opts.detailFood) {
      const rig = createDetailRig(opts.detailFood);
      this.detailRig = rig.group;
      this.detailOrbs = rig.orbs;
      this.stageRoot.add(this.detailRig);
    } else {
      const weave = new THREE.Mesh(
        new THREE.CircleGeometry(4.6, 96),
        new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.95 }),
      );
      weave.rotation.x = -Math.PI / 2;
      weave.position.y = -0.02;
      weave.receiveShadow = true;
      this.weave = weave;

      const profile = [[0, 0], [2.5, 0], [2.75, 0.04], [3.3, 0.3], [3.5, 0.38], [3.46, 0.43], [3.28, 0.39], [2.95, 0.24], [2.75, 0.16], [0, 0.15]].map(([x, y]) => new THREE.Vector2(x, y));
      const plate = new THREE.Mesh(
        new THREE.LatheGeometry(profile, 128),
        new THREE.MeshPhysicalMaterial({ color: '#f3eee0', roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.18, side: THREE.DoubleSide }),
      );
      plate.castShadow = plate.receiveShadow = true;
      plate.name = 'plate';
      this.plateMesh = plate;

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.38, 0.022, 10, 160),
        new THREE.MeshStandardMaterial({ color: '#123b2a', roughness: 0.4 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.43;
      this.ring = ring;

      this.stageRoot.add(weave, plate, ring, this.compass);
      this.initCompass();
    }

    // Selection glow, contact shadow, and hover orbit ring
    this.selGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.1),
      new THREE.MeshBasicMaterial({
        map: ringGlowTexture('#C6F36B'),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.selGlow.rotation.x = -Math.PI / 2;
    this.selGlow.position.y = 0.165;
    this.selGlow.visible = false;

    this.hoverShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 1.75),
      new THREE.MeshBasicMaterial({
        map: softCircleTexture('#0A251A', '#0A251A55'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.hoverShadow.rotation.x = -Math.PI / 2;
    this.hoverShadow.position.y = 0.158;
    this.hoverShadow.visible = false;

    this.floatOrbit = new THREE.Mesh(
      new THREE.RingGeometry(0.76, 0.85, 48),
      new THREE.MeshBasicMaterial({ color: '#C6F36B', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.floatOrbit.rotation.x = Math.PI / 2.4;
    this.floatOrbit.visible = false;

    this.stageRoot.add(this.selGlow, this.hoverShadow);
    this.scene.add(this.floatOrbit);

    // Pooled particles: total capacity <= 400 hard cap (240 + 80 + 80 = 400; low-power: 96 + 0 + 32 = 128)
    this.burstPool = new PointPool(this.lowPower ? 96 : 240, softCircleTexture('#ffffff', '#ffffff99'), false);
    this.steamPool = new PointPool(this.lowPower ? 0 : 80, softCircleTexture('#ffffffcc', '#ffffff33'), false);
    this.leafPool = new PointPool(this.lowPower ? 32 : 80, leafSpriteTexture(), false);
    this.ripplePool = new RipplePool(8);

    this.stageRoot.add(this.burstPool.points, this.steamPool.points, this.leafPool.points, this.ripplePool.mesh);

    if (this.effects.ambient && !this.reduced) {
      this.burstPool.seedDust(this.lowPower ? 24 : 60);
    }
    if (hero) {
      this.heroLeaves = createHeroLeaves(this.scene);
    }

    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      minDistance: opts.detailFood ? 3.2 : 5,
      maxDistance: 22,
      maxPolarAngle: 1.38,
      autoRotate: (hero || !!opts.turntable) && !this.reduced,
      autoRotateSpeed: opts.detailFood ? 0.9 : 0.7,
    });
    if (hero) {
      this.controls.enableZoom = false;
      this.controls.enablePan = false;
    }

    const el = r.domElement;
    el.addEventListener('pointerdown', this.onDown, true);
    el.addEventListener('pointermove', this.onMovePointer);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('pointerleave', this.onLeave);

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.mq.addEventListener('change', this.onMotionChange);
      window.addEventListener('nutriverse:motion-change', this.onMotionChange);
    }

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(host);
    const io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; });
    io.observe(host);
    this.observers = [ro, io];
    this.resize();
    this.setView('full', true);

    if (hero && this.effects.heroIntro && !this.reduced) {
      this.introAge = 0;
      this.introDone = false;
      this.camera.position.set(0, 14.5, 16.5);
      this.stageRoot.rotation.y = -Math.PI * 1.15;
    } else {
      this.introDone = true;
    }

    this.loop(0);
  }

  private onMotionChange = () => {
    this.reduced = isMotionReduced();
    this.controls.autoRotate = (this.hero || !!this.opts.turntable) && !this.reduced;
    if (this.reduced) {
      this.introDone = true;
      this.stageRoot.rotation.set(0, 0, 0);
      this.burstPool.clearTransient();
      this.burstPool.setDustVisible(false);
      this.steamPool.clearTransient();
      this.leafPool.clearTransient();
      this.ripplePool.clear();
      this.selGlow.visible = false;
      this.hoverShadow.visible = false;
      this.compassArcs.forEach(a => {
        a.current = a.target;
        this.rebuildCompassArc(a);
      });
    } else {
      this.burstPool.setDustVisible(this.effects.ambient);
    }
  };

  private initCompass() {
    let start = Math.PI / 2;
    for (const key of ['vegfruit', 'protein', 'staple'] as const) {
      const span = TARGET[key] * Math.PI * 2;
      const bg = new THREE.Mesh(
        new THREE.RingGeometry(3.78, 4.02, 96, 1, start + 0.03, span - 0.06),
        new THREE.MeshBasicMaterial({ color: GROUP_COLORS[key], transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false }),
      );
      bg.rotation.x = -Math.PI / 2;
      bg.position.y = 0.01;
      this.compass.add(bg);

      const mat = new THREE.MeshBasicMaterial({ color: GROUP_COLORS[key], transparent: true, opacity: 1, toneMapped: false, depthWrite: false });
      const fg = new THREE.Mesh(new THREE.RingGeometry(3.78, 4.02, 4, 1, start + 0.03, 0.001), mat);
      fg.rotation.x = -Math.PI / 2;
      fg.position.y = 0.025;
      fg.visible = false;
      this.compass.add(fg);
      this.compassArcs.push({ key, start, span, current: 0, target: 0, pulse: 0, mesh: fg, mat });
      start += span;
    }
  }

  private rebuildCompassArc(arc: CompassArc) {
    const length = arc.span * arc.current;
    if (length <= 0.06) {
      arc.mesh.visible = false;
      return;
    }
    arc.mesh.visible = true;
    const old = arc.mesh.geometry;
    arc.mesh.geometry = new THREE.RingGeometry(3.78, 4.02, 72, 1, arc.start + 0.03, length - 0.06);
    old.dispose();
  }

  private resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? Math.min(62, 36 / Math.max(0.55, w / h)) : 36;
    this.camera.updateProjectionMatrix();
  }

  setView(view: View, instant = false) {
    const look = new THREE.Vector3(0, this.opts.detailFood ? 0.35 : 0.2, 0);
    let pos = this.opts.detailFood ? new THREE.Vector3(0, 3.6, 5.4) : new THREE.Vector3(0, 8.4, 9.6);
    if (view === 'top') pos = new THREE.Vector3(0, 13, 0.05);
    if (view === 'close') {
      const e = this.selected ? this.foods.get(this.selected) : undefined;
      if (e) look.copy(e.target).setY(0.45);
      pos = look.clone().add(new THREE.Vector3(0, 3.6, 4.6));
    }
    if (instant) {
      this.camera.position.copy(pos);
      this.controls.target.copy(look);
      this.controls.update();
    } else {
      this.camGoal = { pos, look };
    }
  }

  zoom(factor: number) {
    this.camGoal = null;
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 3.5, 22));
    this.camera.position.copy(this.controls.target).add(offset);
  }

  rotate(angle: number) {
    this.camGoal = null;
    const offset = this.camera.position.clone().sub(this.controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  triggerBounceConfetti() {
    if (this.reduced) return;
    this.bounceAge = 0;
    const count = this.lowPower ? 8 : 20;
    const palette = ['#C6F36B', '#FFA45B', '#4DBB78'];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 1.4 + Math.random() * 1.9;
      this.burstPool.emit({
        x: (Math.random() - 0.5) * 0.4,
        y: 0.75 + Math.random() * 0.3,
        z: (Math.random() - 0.5) * 0.4,
        vx: Math.cos(a) * spd,
        vy: 2.3 + Math.random() * 1.8,
        vz: Math.sin(a) * spd,
        color: palette[i % palette.length],
        life: 0.9 + Math.random() * 0.4,
        size0: 0.2,
        size1: 0.08,
        gravity: -4.2,
      });
    }
  }

  setMeal(items: MealItem[], cat: Catalogue) {
    this.cat = cat;
    const spots = layout(items, cat);
    const keep = new Set(spots.map(s => s.uid));

    for (const [uid, e] of this.foods) {
      if (!keep.has(uid) || items.find(i => i.uid === uid)?.foodId !== e.foodId) {
        if (this.effects.removeAnim && !this.reduced && !this.opts.detailFood) {
          this.exiting.push({ group: e.group, age: 0, life: 0.28, startScale: e.group.scale.x });
          const f = cat[e.foodId];
          this.emitBurstAt(e.group.position, f?.look.color ?? '#FFF8E9', f?.look.accent ?? '#C6F36B', this.lowPower ? 5 : 10, 1.5);
        } else {
          this.stageRoot.remove(e.group);
          disposeObject(e.group);
        }
        this.foods.delete(uid);
      }
    }

    const baseY = this.opts.detailFood ? 0 : 0.15;
    for (const s of spots) {
      const item = items.find(i => i.uid === s.uid)!;
      let e = this.foods.get(s.uid);
      if (!e) {
        const group = createFoodModel(cat[item.foodId]);
        group.userData.uid = s.uid;
        const dropStart = this.effects.landing && !this.reduced && !this.opts.detailFood && !this.hero;
        group.position.set(s.x, dropStart ? 3.4 : baseY, s.z);
        group.scale.setScalar(s.r);
        this.stageRoot.add(group);
        e = {
          group,
          target: new THREE.Vector3(s.x, baseY, s.z),
          scale: s.r,
          foodId: item.foodId,
          justAdded: dropStart,
          landed: !dropStart,
          squashAge: -1,
          steamTimer: Math.random() * 0.35,
        };
        this.foods.set(s.uid, e);
      }
      e.target.set(s.x, baseY, s.z);
      e.scale = s.r;
    }

    this.syncEmptyGhosts(items.length === 0 && !!this.opts.emptyGhost);
    this.updateCompass(items, cat);
    this.setSelected(this.selected);
  }

  private syncEmptyGhosts(show: boolean) {
    if (!show) {
      if (this.ghosts.length) {
        this.ghosts.forEach(g => { this.stageRoot.remove(g); disposeObject(g); });
        this.ghosts = [];
      }
      return;
    }
    if (this.ghosts.length) return;
    const picks = ['ugali', 'beans', 'sukuma'].filter(id => this.cat[id]);
    const coords: [number, number][] = [[-1.35, -0.7], [1.25, -0.8], [0, 1.25]];
    picks.forEach((id, i) => {
      const g = createFoodModel(this.cat[id]);
      g.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = false;
        m.receiveShadow = false;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          mat.transparent = true;
          mat.opacity = 0.28;
          mat.depthWrite = false;
        }
      });
      g.position.set(coords[i][0], 0.45, coords[i][1]);
      g.scale.setScalar(0.75);
      g.userData.ghostPhase = i * 2.1;
      g.userData.baseX = coords[i][0];
      g.userData.baseZ = coords[i][1];
      this.ghosts.push(g);
      this.stageRoot.add(g);
    });
  }

  private updateCompass(items: MealItem[], cat: Catalogue) {
    if (this.opts.detailFood) return;
    const { shares, counted } = plateShares(items, cat);
    for (const arc of this.compassArcs) {
      const fill = counted ? Math.min(1, shares[arc.key] / TARGET[arc.key]) : 0;
      arc.target = fill;
      if (!this.effects.compassAnim || this.reduced) {
        arc.current = fill;
        this.rebuildCompassArc(arc);
      }
    }
    const allFull = counted > 0 && this.compassArcs.every(a => a.target >= 0.95);
    if (!allFull) {
      this.celebrated = false;
      this.cb.onCompassComplete?.(false);
    }
  }

  setFloating(foodIds: string[], cat: Catalogue) {
    this.cat = cat;
    foodIds.forEach((id, i) => {
      if (!cat[id]) return;
      const g = createFoodModel(cat[id]);
      const a = i / foodIds.length * Math.PI * 2 + 0.4;
      const bx = Math.cos(a) * 5.1;
      const by = 1.2 + (i % 3) * 0.5;
      const bz = Math.sin(a) * 4.2;
      g.position.set(bx, by, bz);
      g.scale.setScalar(this.effects.heroIntro && !this.reduced ? 0.001 : 0.5);
      g.userData = { floatId: id, baseX: bx, baseY: by, baseZ: bz, phase: i * 1.7, index: i };
      this.floating.push(g);
      this.scene.add(g);
    });
  }

  setSelected(uid: string | null) {
    this.selected = uid && this.foods.has(uid) ? uid : null;
  }

  private emitBurstAt(pos: THREE.Vector3, colorA: string, colorB: string, count: number, speed = 2.2) {
    if (!this.effects.bursts || this.reduced) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const r = 0.6 + Math.random() * speed;
      this.burstPool.emit({
        x: pos.x + (Math.random() - 0.5) * 0.3,
        y: pos.y + 0.15 + Math.random() * 0.2,
        z: pos.z + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(a) * r,
        vy: 1.4 + Math.random() * 1.6,
        vz: Math.sin(a) * r,
        color: i % 2 === 0 ? colorA : colorB,
        life: 0.55 + Math.random() * 0.35,
        size0: 0.16,
        size1: 0.04,
        gravity: -5.4,
      });
    }
  }

  private fireCompassCelebration() {
    if (this.celebrated) return;
    this.celebrated = true;
    this.cb.onCompassComplete?.(true);
    if (this.reduced) return;
    this.ripplePool.spawn(0, 0, '#C6F36B', 2.4, 4.4, 0.85, 0.04);
    const count = this.lowPower ? 14 : 36;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 1.6 + Math.random() * 2.2;
      this.leafPool.emit({
        x: Math.cos(a) * 0.25,
        y: 0.4,
        z: Math.sin(a) * 0.25,
        vx: Math.cos(a) * spd,
        vy: 2.5 + Math.random() * 2.1,
        vz: Math.sin(a) * spd,
        color: i % 3 === 0 ? '#4DBB78' : '#C6F36B',
        life: 1.2 + Math.random() * 0.5,
        size0: 0.28,
        size1: 0.14,
        gravity: -3.2,
      });
    }
  }

  private cast(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
  }

  private pick(clientX: number, clientY: number): { uid: string | null; floatId: string | null; plate: boolean; tooltip: string | null } {
    this.cast(clientX, clientY);
    const roots: THREE.Object3D[] = [
      ...[...this.foods.values()].map(e => e.group),
      ...this.floating,
      ...this.detailOrbs.map(o => o.mesh),
    ];
    if (this.plateMesh) roots.push(this.plateMesh);
    let o: THREE.Object3D | null = this.ray.intersectObjects(roots, true)[0]?.object ?? null;
    if (o?.userData?.nutrientTooltip) return { uid: null, floatId: null, plate: false, tooltip: String(o.userData.nutrientTooltip) };
    if (o?.name === 'plate') return { uid: null, floatId: null, plate: true, tooltip: null };
    while (o && !o.userData.uid && !o.userData.floatId) o = o.parent;
    return { uid: o?.userData.uid ?? null, floatId: o?.userData.floatId ?? null, plate: false, tooltip: null };
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
    if (hit.uid && !this.hero && !this.opts.detailFood) {
      this.controls.enabled = false;
      this.renderer.domElement.setPointerCapture(e.pointerId);
    }
  };

  private onMovePointer = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width && rect.height) {
      this.pointerNorm.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    }

    const d = this.down;
    if (d) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
      if (d.moved && d.uid && !this.hero && !this.opts.detailFood) {
        const p = this.pointOnPlate(e.clientX, e.clientY), entry = this.foods.get(d.uid);
        if (p && entry) entry.target.set(p.x, 0.65, p.z);
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const hit = this.pick(e.clientX, e.clientY);
    const id = hit.floatId ?? (hit.uid ? this.foods.get(hit.uid)?.foodId : null);
    this.hovered = hit.uid ?? hit.floatId;
    this.renderer.domElement.style.cursor = hit.tooltip || id || (hit.plate && this.hero) ? 'pointer' : 'grab';
    const label = hit.tooltip ?? (id ? this.cat[id].name : hit.plate && this.hero ? 'Build my plate →' : null);
    this.cb.onHover?.(label, e.clientX - rect.left, e.clientY - rect.top);
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    this.controls.enabled = true;
    if (!d) return;
    if (d.uid && d.moved && !this.hero && !this.opts.detailFood) {
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
    this.down = null;
    this.controls.enabled = true;
  };

  private onLeave = () => {
    this.hovered = null;
    this.pointerNorm.set(0, 0);
    this.cb.onHover?.(null, 0, 0);
  };

  private loop = (time: number) => {
    this.frame = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) {
      this.lastTime = time;
      return;
    }
    const rawDt = this.lastTime ? (time - this.lastTime) / 1000 : 0.016;
    this.lastTime = time;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    const t = time / 1000;

    // 1. Hero intro camera & plate spin-in (1.6 s)
    if (this.hero && !this.introDone) {
      this.introAge += dt;
      const p = Math.min(1, this.introAge / 1.6);
      const ease = 1 - Math.pow(1 - p, 3);
      this.camera.position.set(0, THREE.MathUtils.lerp(14.5, 8.4, ease), THREE.MathUtils.lerp(16.5, 9.6, ease));
      this.stageRoot.rotation.y = THREE.MathUtils.lerp(-Math.PI * 1.15, 0, ease);
      if (p >= 1) {
        this.introDone = true;
        this.stageRoot.rotation.y = 0;
      }
    }

    // 2. Compare page tilt toward pointer (max 6 deg)
    if (this.opts.tiltPointer && !this.reduced) {
      const maxRad = THREE.MathUtils.degToRad(6);
      this.stageRoot.rotation.x = THREE.MathUtils.lerp(this.stageRoot.rotation.x, -this.pointerNorm.y * maxRad, 0.08);
      this.stageRoot.rotation.z = THREE.MathUtils.lerp(this.stageRoot.rotation.z, -this.pointerNorm.x * maxRad, 0.08);
    }

    // 3. Ambient woven mat breath (0.4%) & 8-second glaze light sweep
    if (this.weave) {
      const breath = this.effects.ambient && !this.reduced ? 1 + Math.sin(t * 0.9) * 0.004 : 1;
      this.weave.scale.set(breath, breath, 1);
    }
    if (this.sweepLight) {
      if (this.effects.ambient && !this.reduced && !this.opts.detailFood) {
        const cycle = (t % 8) / 8;
        if (cycle < 0.35) {
          const k = cycle / 0.35;
          this.sweepLight.position.set(THREE.MathUtils.lerp(-4.2, 4.2, k), 1.9, THREE.MathUtils.lerp(2.6, -2.6, k));
          this.sweepLight.intensity = Math.sin(k * Math.PI) * 2.2;
        } else {
          this.sweepLight.intensity = 0;
        }
      } else {
        this.sweepLight.intensity = 0;
      }
    }

    // 4. Learn bounce animation
    let bounceScale = 1;
    let bounceY = 0;
    if (this.bounceAge >= 0) {
      this.bounceAge += dt;
      if (this.bounceAge < 0.5) {
        const b = Math.sin((this.bounceAge / 0.5) * Math.PI);
        bounceY = b * 0.35;
        bounceScale = 1 + Math.sin((this.bounceAge / 0.5) * Math.PI * 2) * 0.08;
      } else {
        this.bounceAge = -1;
      }
    }

    // 5. Foods update: landing squash, hover lift, selection sway, steam, compare out-of-sync bobbing
    let selEntry: Entry | null = null;
    let hovEntry: Entry | null = null;

    for (const [uid, e] of this.foods) {
      const isSelected = uid === this.selected;
      const isHovered = uid === this.hovered && !this.hero;
      if (isSelected) selEntry = e;
      if (isHovered) hovEntry = e;

      const lerpRate = e.justAdded && !e.landed ? 0.22 : 0.14;
      e.group.position.lerp(e.target, lerpRate);

      // Landing detection
      if (e.justAdded && !e.landed && e.group.position.y <= e.target.y + 0.08) {
        e.landed = true;
        e.justAdded = false;
        e.squashAge = 0;
        const f = this.cat[e.foodId];
        if (this.effects.landing && !this.reduced) {
          this.ripplePool.spawn(e.target.x, e.target.z, '#FFF8E9', 0.32 * e.scale, 1.9 * e.scale, 0.6);
        }
        this.emitBurstAt(e.target, f?.look.color ?? '#FFF8E9', f?.look.accent ?? '#C6F36B', this.lowPower ? 6 : 15);
      }

      // Squash & spring-back overshoot
      let sx = 1, sy = 1, sz = 1;
      if (e.squashAge >= 0 && this.effects.landing && !this.reduced) {
        e.squashAge += dt;
        const dur = 0.42;
        if (e.squashAge < dur) {
          const p = e.squashAge / dur;
          const sq = Math.sin(p * Math.PI * 2.2) * (1 - p);
          sy = 1 - sq * 0.22; // down to ~0.8 then brief overshoot
          const xz = 1 + sq * 0.11; // up to ~1.1
          sx = xz; sz = xz;
        } else {
          e.squashAge = -1;
        }
      }

      const liftScale = isSelected && this.effects.selectionGlow ? 1.07 : isHovered && this.effects.hoverLift ? 1.05 : 1;
      const curScale = THREE.MathUtils.lerp(e.group.scale.x, e.scale * liftScale * bounceScale, 0.16);
      e.group.scale.set(curScale * sx, curScale * sy, curScale * sz);

      if (this.down?.uid !== uid && e.landed) {
        const bobOffset = this.opts.bobPhase !== undefined && !this.reduced
          ? Math.sin(t * 2.2 + this.opts.bobPhase) * 0.055
          : 0;
        const hoverY = isHovered && this.effects.hoverLift && !this.reduced ? 0.14 : 0;
        const selY = isSelected && this.effects.selectionGlow ? (this.reduced ? 0.1 : 0.12 + Math.sin(t * 3) * 0.04) : 0;
        e.group.position.y = THREE.MathUtils.lerp(e.group.position.y, e.target.y + bobOffset + hoverY + selY + bounceY, 0.18);
      }

      // 8-degree sway on selected food
      if (isSelected && this.effects.selectionGlow && !this.reduced) {
        e.group.rotation.y = Math.sin(t * 1.8) * 0.14;
      } else if (!this.opts.detailFood) {
        e.group.rotation.y = THREE.MathUtils.lerp(e.group.rotation.y, 0, 0.1);
      }

      // Cooked food steam wisps (disabled in low-power and reduced-motion)
      if (
        this.effects.steam &&
        !this.reduced &&
        !this.lowPower &&
        this.cat[e.foodId]?.rawOrCooked === 'cooked' &&
        e.landed
      ) {
        e.steamTimer -= dt;
        if (e.steamTimer <= 0) {
          e.steamTimer = 0.28 + Math.random() * 0.22;
          this.steamPool.emit({
            x: e.group.position.x + (Math.random() - 0.5) * 0.35 * e.scale,
            y: e.group.position.y + 0.38 * e.scale,
            z: e.group.position.z + (Math.random() - 0.5) * 0.35 * e.scale,
            vx: (Math.random() - 0.5) * 0.1,
            vy: 0.32 + Math.random() * 0.2,
            vz: (Math.random() - 0.5) * 0.1,
            color: '#FFF8E9',
            life: 1.7 + Math.random() * 0.7,
            size0: 0.22,
            size1: 0.72,
            alpha0: 0.28,
            gravity: 0.04,
            drag: 0.99,
          });
        }
      }
    }

    // 6. Exiting (remove spin-shrink) animations
    for (let i = this.exiting.length - 1; i >= 0; i--) {
      const ex = this.exiting[i];
      ex.age += dt;
      const p = Math.min(1, ex.age / ex.life);
      const sc = Math.max(0.001, ex.startScale * (1 - p));
      ex.group.scale.setScalar(sc);
      ex.group.rotation.y += 14 * dt;
      ex.group.position.y += 0.8 * dt;
      if (p >= 1) {
        this.stageRoot.remove(ex.group);
        disposeObject(ex.group);
        this.exiting.splice(i, 1);
      }
    }

    // 7. Selection glow sprite & hover contact shadow
    if (selEntry && this.effects.selectionGlow && !this.opts.detailFood) {
      this.selGlow.visible = true;
      this.selGlow.position.set(selEntry.group.position.x, 0.165, selEntry.group.position.z);
      const pulse = this.reduced ? 1 : 0.96 + Math.sin(t * 4) * 0.06;
      this.selGlow.scale.setScalar(selEntry.scale * pulse);
      (this.selGlow.material as THREE.MeshBasicMaterial).opacity = this.reduced ? 0.65 : 0.58 + Math.sin(t * 4) * 0.22;
    } else {
      this.selGlow.visible = false;
    }

    if (hovEntry && this.effects.hoverLift && !this.reduced && !this.opts.detailFood) {
      this.hoverShadow.visible = true;
      this.hoverShadow.position.set(hovEntry.group.position.x, 0.158, hovEntry.group.position.z);
      this.hoverShadow.scale.setScalar(hovEntry.scale * 0.84);
      (this.hoverShadow.material as THREE.MeshBasicMaterial).opacity = 0.42;
    } else {
      this.hoverShadow.visible = false;
    }

    // 8. Empty plate ghost foods
    for (const g of this.ghosts) {
      const ph = g.userData.ghostPhase as number;
      g.position.y = this.reduced ? 0.42 : 0.44 + Math.sin(t * 1.5 + ph) * 0.08;
      g.rotation.y = this.reduced ? 0 : t * 0.35 + ph;
    }

    // 9. Detail page orbiting nutrient orbs
    if (this.detailOrbs.length) {
      for (const orb of this.detailOrbs) {
        const a = orb.angleOffset + (this.reduced ? 0 : t * 0.48);
        orb.mesh.position.set(
          Math.cos(a) * orb.orbitRadius,
          orb.baseY + (this.reduced ? 0 : Math.sin(t * 1.8 + orb.angleOffset) * 0.06),
          Math.sin(a) * orb.orbitRadius,
        );
        if (!this.reduced) orb.mesh.rotation.y = t * 0.8;
      }
    }

    // 10. Hero floating foods + stagger intro + pointer parallax + orbit ring + hero leaves
    let hoveredFloat: THREE.Group | null = null;
    for (const g of this.floating) {
      const idx = (g.userData.index as number) ?? 0;
      if (this.hero && !this.introDone && this.effects.heroIntro && !this.reduced) {
        const local = THREE.MathUtils.clamp((this.introAge - idx * 0.09) / 0.55, 0, 1);
        const targetSc = (1 - Math.pow(1 - local, 3)) * 0.5;
        g.scale.setScalar(Math.max(0.001, targetSc));
      } else {
        const targetSc = this.hovered === g.userData.floatId ? 0.66 : 0.5;
        g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, targetSc, 0.12));
      }
      if (!this.reduced) {
        const px = -this.pointerNorm.x * 0.42;
        const py = -this.pointerNorm.y * 0.25;
        g.position.x = THREE.MathUtils.lerp(g.position.x, g.userData.baseX + px, 0.06);
        g.position.y = g.userData.baseY + py + Math.sin(t + g.userData.phase) * 0.22;
        g.rotation.y = t * 0.25 + g.userData.phase;
      }
      if (this.hovered === g.userData.floatId) hoveredFloat = g;
    }

    if (hoveredFloat && !this.reduced) {
      this.floatOrbit.visible = true;
      this.floatOrbit.position.copy(hoveredFloat.position);
      this.floatOrbit.rotation.z = t * 1.2;
    } else {
      this.floatOrbit.visible = false;
    }

    for (const lf of this.heroLeaves) {
      if (this.reduced) continue;
      lf.mesh.position.x = THREE.MathUtils.lerp(lf.mesh.position.x, lf.basePos.x + this.pointerNorm.x * lf.depthFactor, 0.05);
      lf.mesh.position.y = lf.basePos.y + Math.sin(t * 0.55 + lf.phase) * 0.16 + this.pointerNorm.y * lf.depthFactor * 0.6;
      lf.mesh.rotation.z = lf.baseRot.z + Math.sin(t * 0.4 + lf.phase) * 0.08;
    }

    // 11. Compass smooth arc animation & celebration
    if (this.compassArcs.length) {
      let anyChanged = false;
      for (const arc of this.compassArcs) {
        const prev = arc.current;
        if (this.effects.compassAnim && !this.reduced) {
          arc.current = THREE.MathUtils.lerp(arc.current, arc.target, Math.min(1, dt * 8.5));
          if (Math.abs(arc.current - arc.target) < 0.003) arc.current = arc.target;
        } else {
          arc.current = arc.target;
        }
        if (Math.abs(arc.current - prev) > 0.001) {
          this.rebuildCompassArc(arc);
          anyChanged = true;
        }
        if (prev < 0.99 && arc.current >= 0.99 && !this.reduced) {
          arc.pulse = 1;
          const endAngle = arc.start + arc.span * arc.current - 0.03;
          const sx = Math.cos(-endAngle) * 3.9;
          const sz = Math.sin(-endAngle) * 3.9;
          this.emitBurstAt(new THREE.Vector3(sx, 0.06, sz), '#C6F36B', '#FFF8E9', this.lowPower ? 4 : 8, 1.1);
        }
        if (arc.pulse > 0) {
          arc.pulse = Math.max(0, arc.pulse - dt * 2.5);
          arc.mesh.position.y = 0.025 + Math.sin(arc.pulse * Math.PI) * 0.04;
        }
      }
      const allFull = this.compassArcs.every(a => a.target >= 0.95) && this.compassArcs.every(a => a.current >= 0.94);
      if (allFull && !this.celebrated && (anyChanged || this.foods.size > 0)) {
        this.fireCompassCelebration();
      }
    }

    // 12. Particle pools & ripples
    const h = this.host.clientHeight || 480;
    this.burstPool.update(dt, t, h, this.effects.ambient && !this.reduced);
    this.steamPool.update(dt, t, h, false);
    this.leafPool.update(dt, t, h, false);
    this.ripplePool.update(dt);

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
    this.mq?.removeEventListener('change', this.onMotionChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener('nutriverse:motion-change', this.onMotionChange);
    }
    this.controls.dispose();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown, true);
    el.removeEventListener('pointermove', this.onMovePointer);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onCancel);
    el.removeEventListener('pointerleave', this.onLeave);

    this.burstPool.dispose();
    this.steamPool.dispose();
    this.leafPool.dispose();
    this.ripplePool.dispose();
    disposeDetailRig(this.detailRig);
    disposeObject(this.scene);
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
  }
}
