// WebGL renderer (PixiJS 8). Reads a WorldView (a Round, or the decorative MenuScene) and keeps a
// scene graph in sync with it: sky → parallax landscape → campus ground → tower → crane → crown →
// particles → overlays. Never mutates game state.

import {
  Application,
  BitmapFont,
  BitmapText,
  BlurFilter,
  Container,
  Graphics,
  ParticleContainer,
  Particle,
  Sprite,
  Texture,
  TilingSprite,
  UPDATE_PRIORITY,
} from "pixi.js";
import { AdvancedBloomFilter, DropShadowFilter, GlowFilter, ZoomBlurFilter } from "pixi-filters";
import { BALANCE } from "../config/balance";
import { CROWN_DURATION } from "../gameplay/round";
import type { Tower } from "../gameplay/tower";
import type { Debris, EventId, FloatText, RoundEvent } from "../gameplay/types";
import type { Equipped } from "../meta/collection";
import type { RoomId } from "../meta/rooms";
import { FACULTIES, type FacultyId } from "../social/faculties";
import { Particles } from "../visuals/particles";
import { BlockView, type BlockLook } from "./blockView";
import { ARCHETYPES, crowdSilhouette, Figure, specFor } from "./characters";
import { clamp01, easeOutBack, hexToRgb, mix, shade } from "./color";
import { themeFor, type Theme } from "./sky";
import { TextureBank } from "./textures";
import { createWarmGrade, type Grade } from "./warmGrade";
import { FONT_CHARS } from "./hud/fonts";
import { Hud } from "./hud/hud";
import { buildSkin, type Skin } from "../design/skin";

export interface WorldView {
  t: number;
  tower: Tower;
  hanging: { type: RoomId; w: number } | null;
  crane: { x: number; tilt: number };
  falling: { type: RoomId; w: number; x: number; y: number; rot: number } | null;
  debris: Debris[];
  floats: FloatText[];
  event: { id: EventId } | null;
  wind: number;
  windDir: number;
  shabytLevel: number;
  danger: boolean;
  flash: number;
  shake: number;
  phase: string;
  crownT: number;
  crowned: boolean;
  height: number;
  students: number;
  isTutorial: boolean;
  eff: { teaBreak: number };
  cfg: { faculty: FacultyId | null; cosmetics: Equipped; weather?: "clear" | "rain" | "snow" };
}

export interface RenderOptions {
  menu: boolean;
  guide: boolean;
  reducedMotion: boolean;
}

const H = BALANCE.world.blockH;
export const FLOAT_FONT = "ShFloat";
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;


function hex(c: string): number {
  const [r, g, b] = hexToRgb(c);
  return (r << 16) | (g << 8) | b;
}

/** Yield to the browser so the loading bar can paint between heavy steps. */
function nextFrame(): Promise<void> {
  return new Promise((r) => (typeof requestAnimationFrame === "function" && !document.hidden ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));
}

/** Wait (bounded) for the brand font so baked BitmapFonts use it. */
async function loadFonts(): Promise<void> {
  try {
    await Promise.race([
      Promise.all([document.fonts.load("800 48px Rubik"), document.fonts.load("700 24px Rubik"), document.fonts.load("500 16px Rubik")]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* system font fallback */
  }
}

/** Critically damped spring towards a target (Unity's SmoothDamp). Returns [value, velocity]. */
function smoothDamp(cur: number, target: number, vel: number, smoothTime: number, dt: number): [number, number] {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel + omega * change) * dt;
  const nextVel = (vel - omega * temp) * exp;
  return [target + (change + temp) * exp, nextVel];
}

/** How many to spawn this frame for a per-second rate: frame-rate independent and unbiased. */
function spawnCount(perSec: number, dt: number): number {
  return Math.floor(perSec * dt + Math.random());
}

/** Ambient weather stops spawning above this, so gameplay feedback bursts always find free slots. */
const AMBIENT_BUDGET = 900;

export class PixiRenderer {
  readonly app: Application;
  readonly bank = new TextureBank();
  particles!: Particles;
  view: WorldView | null = null;
  opts: RenderOptions = { menu: true, guide: true, reducedMotion: false };
  focus = 0.5;
  /** Effective world scale this frame (layout scale × camera zoom). */
  scale = 1;
  /** Layout scale from the viewport (no zoom). */
  private baseScale = 1;
  private zoomCur = 1;
  private camVelY = 0;
  private camVelX = 0;
  /** Punch-in timer (s) on a perfect landing. */
  private punchT = 0;
  /** Event-driven camera shake, decays exponentially. */
  private shakeK = 0;
  /** Opening pan from the campus up to the crane. */
  private introT = 0;
  contextLost = false;
  /** Called when the WebGL context is lost (true) or restored (false). */
  onContextChange?: (lost: boolean) => void;

  private cssW = 0;
  private cssH = 0;
  private focusCur = 0.5;
  private camY = 0;
  private camX = 0;
  private eventK = 0;
  private lastEvent: EventId | null = null;
  private time = 0;
  private steamT = 0;
  private kick = 0;
  private fireworkQueue: { at: number; x: number; y: number }[] = [];
  private theme: Theme = themeFor(0, null, true, 0);

  // layers
  readonly bg = new Container();
  readonly world = new Container();
  readonly screenFx = new Container();
  readonly overlay = new Container();
  readonly hudLayer = new Container();
  skin!: Skin;
  hudUi!: Hud;
  /** Tap on the game field (not on a HUD control). */
  onTap: (() => void) | null = null;
  private sky!: { tex: Texture; paint(top: string, bottom: string): void };
  private skySprite!: Sprite;
  private stars!: ParticleContainer;
  private starList: { p: Particle; ph: number; x: number; y: number }[] = [];
  private sun!: Sprite;
  private moon!: Sprite;
  private clouds = new Container();
  private mtn!: TilingSprite;
  private hills!: TilingSprite;
  private detail!: TilingSprite;
  private lights!: TilingSprite;
  private detailKind = "";
  private grass!: Sprite;
  private groundWorld = new Container();
  private plaza!: Sprite;
  private plazaW = 0;
  private trees: Sprite[] = [];
  private lamps: { lamp: Sprite; glow: Sprite }[] = [];
  private flags: { cloth: TilingSprite; pole: Sprite }[] = [];
  private figures: Figure[] = [];
  /** Emissive sources only (window cores, neon, LEDs, lanterns); bloom applies to this layer alone. */
  private readonly emissive = new Container();
  private readonly bloom = new AdvancedBloomFilter({ threshold: 0.12, bloomScale: 1.15, brightness: 0, blur: 5, quality: 5 });
  private readonly people = new Container();
  private readonly crowdBack = new Container();
  private readonly crowdFront = new Container();
  private peopleKey = "";
  private aura!: Sprite;
  private towerLayer = new Container();
  private movingLayer = new Container();
  private crownLayer = new Container();
  private crownSprite: Sprite | null = null;
  private crownKey = "";
  private rays!: Sprite;
  private floatLayer = new Container();
  private floatPool: BitmapText[] = [];
  private crane = new Graphics();
  private vignette!: Sprite;
  private danger!: Sprite;
  private flashSprite!: Sprite;
  private fog!: Sprite;
  private fg!: TilingSprite;
  private towerShadow = new DropShadowFilter({ offset: { x: 5, y: 6 }, blur: 3, alpha: 0.32, color: 0x0a0618, quality: 3 });
  private towerGlow = new GlowFilter({ distance: 14, outerStrength: 2, innerStrength: 0, color: 0xffc94d, quality: 0.15 });
  private crownGlow = new GlowFilter({ distance: 16, outerStrength: 2, innerStrength: 0.4, color: 0xffe9a8, quality: 0.2 });
  private zoom = new ZoomBlurFilter({ strength: 0, innerRadius: 60 });
  private zoomT = 0;
  private trail: { x: number; y: number }[] = [];
  private leavesT = 0;
  private crownHalo!: Sprite;
  private grade!: Grade;

  private blocks = new Map<number, BlockView>();
  private hangingView: { key: string; view: BlockView } | null = null;
  private fallingView: { key: string; view: BlockView } | null = null;
  private debrisViews = new Map<Debris, BlockView>();
  private lookKey = "";

  private constructor(app: Application) {
    this.app = app;
  }

  static async create(parent: HTMLElement, progress?: (p: number, label: string) => void): Promise<PixiRenderer> {
    progress?.(0.08, "Шрифты…");
    await loadFonts();
    progress?.(0.3, "Запускаем WebGL…");
    const app = new Application();
    await app.init({
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      background: 0x1a1a2e,
      width: parent.clientWidth || window.innerWidth,
      height: parent.clientHeight || window.innerHeight,
      preference: "webgl",
      powerPreference: "high-performance",
      autoStart: false,
    });
    const r = new PixiRenderer(app);
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.className = "world";
    canvas.setAttribute("aria-hidden", "true");
    parent.prepend(canvas);
    // Pixi itself re-uploads textures on restore; the game only needs to know to pause and explain.
    canvas.addEventListener("webglcontextlost", () => {
      r.contextLost = true;
      r.onContextChange?.(true);
    });
    canvas.addEventListener("webglcontextrestored", () => {
      r.contextLost = false;
      r.onContextChange?.(false);
    });
    progress?.(0.5, "Рисуем кампус…");
    await nextFrame();
    r.build();
    r.resize(parent.clientWidth || window.innerWidth, parent.clientHeight || window.innerHeight);
    progress?.(0.72, "Собираем студентов…");
    await nextFrame();
    return r;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  /** Drive a per-frame callback from Pixi's ticker (runs before rendering). */
  onTick(fn: (dtSeconds: number) => void): () => void {
    const cb = () => fn(Math.min(0.1, this.app.ticker.deltaMS / 1000));
    this.app.ticker.add(cb, undefined, UPDATE_PRIORITY.HIGH);
    return () => this.app.ticker.remove(cb);
  }

  private build(): void {
    const b = this.bank;
    BitmapFont.install({
      name: FLOAT_FONT,
      style: { fontFamily: "Rubik, system-ui, sans-serif", fontSize: 48, fontWeight: "800", fill: "#ffffff", stroke: { color: "#1a1030", width: 7, join: "round" } },
      chars: FONT_CHARS,
      resolution: 2,
    });

    // Sky
    this.sky = b.skyTexture();
    this.skySprite = new Sprite(this.sky.tex);
    this.stars = new ParticleContainer({ texture: b.particles().spark, dynamicProperties: { position: true, color: true } });
    this.stars.blendMode = "add";
    for (let i = 0; i < 160; i++) {
      const p = new Particle({ texture: b.particles().spark });
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      const s = 0.06 + Math.random() * 0.12;
      p.scaleX = s;
      p.scaleY = s;
      this.stars.addParticle(p);
      this.starList.push({ p, ph: Math.random() * 6, x: Math.random(), y: Math.random() * 0.8 });
    }
    this.sun = new Sprite(b.softDot());
    this.sun.anchor.set(0.5);
    this.sun.tint = 0xfff0c0;
    this.sun.blendMode = "add";
    this.moon = new Sprite(this.moonTexture());
    this.moon.anchor.set(0.5);
    for (let i = 0; i < 6; i++) {
      const c = new Sprite(b.cloud(i % 3));
      c.anchor.set(0.5);
      c.alpha = 0.6;
      this.clouds.addChild(c);
    }
    // Parallax landscape (TilingSprites)
    this.mtn = new TilingSprite({ texture: b.mountainsTile(), width: 10, height: 320 });
    this.hills = new TilingSprite({ texture: b.hillsTile(), width: 10, height: 200 });
    this.detail = new TilingSprite({ texture: b.detailTile("bg_alatau"), width: 10, height: 220 });
    this.lights = new TilingSprite({ texture: b.lightsTile("bg_alatau"), width: 10, height: 220 });
    this.lights.blendMode = "add";
    this.grass = new Sprite(Texture.WHITE);
    this.bg.addChild(this.skySprite, this.stars, this.sun, this.moon, this.clouds, this.mtn, this.hills, this.detail, this.lights, this.grass);

    // World (camera space)
    this.plaza = new Sprite(Texture.EMPTY);
    this.groundWorld.addChild(this.plaza);
    for (let i = 0; i < 6; i++) {
      const tr = b.tree(i);
      const t = new Sprite(tr.tex);
      t.anchor.set(tr.ax, tr.ay);
      this.trees.push(t);
      this.groundWorld.addChild(t);
    }
    for (let i = 0; i < 2; i++) {
      const lp = b.lamp();
      const lamp = new Sprite(lp.tex);
      lamp.anchor.set(lp.ax, lp.ay);
      const glow = new Sprite(b.softDot());
      glow.anchor.set(0.5);
      glow.blendMode = "add";
      glow.tint = 0xffd27a;
      glow.scale.set(0.7);
      this.lamps.push({ lamp, glow });
      this.groundWorld.addChild(lamp, glow);
    }
    for (let i = 0; i < 2; i++) {
      const pole = new Sprite(Texture.WHITE);
      pole.tint = 0xd9d4c8;
      pole.width = 2.4;
      pole.height = 70;
      pole.anchor.set(0.5, 1);
      const cloth = new TilingSprite({ texture: b.flagCloth("#00afca"), width: 28, height: 14 });
      this.flags.push({ cloth, pole });
      this.groundWorld.addChild(pole, cloth);
    }
    this.groundWorld.addChild(this.crowdBack, this.crowdFront, this.people);
    this.aura = new Sprite(b.softDot());
    this.aura.anchor.set(0.5);
    this.aura.blendMode = "add";
    this.aura.tint = 0xffd75e;
    this.aura.visible = false;
    this.rays = new Sprite(b.rays());
    this.rays.anchor.set(0.5);
    this.rays.blendMode = "add";
    this.rays.visible = false;
    this.crownLayer.addChild(this.rays);

    this.mtn.filters = [new BlurFilter({ strength: 1.4, quality: 2 })];
    this.fog = new Sprite(b.fog());
    this.fog.anchor.set(0.5, 0.5);
    this.fog.filters = [new BlurFilter({ strength: 6, quality: 2 })];
    this.fg = new TilingSprite({ texture: b.foregroundTile(), width: 10, height: 90 });
    this.crownHalo = new Sprite(b.softDot());
    this.crownHalo.anchor.set(0.5);
    this.crownHalo.blendMode = "add";
    this.crownHalo.tint = 0xffe9a8;
    this.crownLayer.addChild(this.crownHalo);
    this.crownLayer.filters = [this.crownGlow];
    this.towerLayer.filters = [this.towerShadow];
    this.grade = createWarmGrade();
    this.world.filters = [this.grade.filter];
    this.particles = new Particles(b.particles());
    this.bloom.resolution = 0.5;
    this.emissive.filters = [this.bloom];
    this.world.addChild(this.groundWorld, this.aura, this.towerLayer, this.fog, this.movingLayer, this.emissive, this.crownLayer, this.particles.worldNormal, this.particles.worldAdd, this.floatLayer);
    this.screenFx.addChild(this.crane, this.particles.screen, this.particles.screenAdd);

    this.vignette = new Sprite(b.vignette());
    this.vignette.tint = 0x050314;
    this.danger = new Sprite(b.vignette());
    this.danger.tint = 0xc81e28;
    this.danger.visible = false;
    this.flashSprite = new Sprite(Texture.WHITE);
    this.flashSprite.tint = 0xfff4d6;
    this.flashSprite.alpha = 0;
    this.overlay.addChild(this.vignette, this.danger, this.flashSprite);

    this.skin = buildSkin();
    this.hudUi = new Hud(this.skin, this.bank);
    this.hudLayer.addChild(this.hudUi);
    this.app.stage.addChild(this.bg, this.world, this.fg, this.screenFx, this.overlay, this.hudLayer);
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      this.onTap?.();
    });
  }

  private moonTexture(): Texture {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 10, 32, 32, 32);
      g.addColorStop(0, "rgba(255,246,220,0.35)");
      g.addColorStop(1, "rgba(255,246,220,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = "#fff6dc";
      ctx.beginPath();
      ctx.arc(32, 32, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(39, 28, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    return Texture.from(c);
  }

  resize(w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    this.cssW = w;
    this.cssH = h;
    this.app.renderer.resize(w, h);
    // Portrait phones must show the whole swing (±~250 world units); landscape is height-bound.
    this.baseScale = Math.max(0.5, Math.min(w / 500, h / 800, 1.6));
    this.scale = this.baseScale * this.zoomCur;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.bank.scale = Math.max(1.5, Math.min(3, Math.round(this.baseScale * dpr * 2) / 2));
    this.skySprite.width = w;
    this.skySprite.height = h;
    for (const ts of [this.mtn, this.hills, this.detail, this.lights, this.fg]) ts.width = w;
    for (const s of [this.vignette, this.danger]) {
      s.width = w;
      s.height = h;
    }
    this.flashSprite.width = w;
    this.flashSprite.height = h;
    this.lookKey = ""; // rebuild block views at the new bake scale
    this.hudUi.layout(w, h);
  }

  get groundY(): number {
    return this.cssH - 96 * this.baseScale;
  }

  private screenX(x: number): number {
    return this.cssW * this.focusCur + (x - this.camX) * this.scale;
  }

  private screenY(y: number): number {
    return this.groundY - (y - this.camY) * this.scale;
  }

  toScreen = (x: number, y: number): [number, number] => [this.screenX(x), this.screenY(y)];

  // ── Effects from round events ────────────────────────────────────────────

  attach(events: { on(fn: (e: RoundEvent) => void): () => void }, cosmetics: Equipped): () => void {
    // Opening shot: start low and wide on the campus, then pan up to the crane.
    if (!this.opts.reducedMotion) {
      this.introT = 1.5;
      this.camY = 0;
      this.camVelY = 0;
      this.zoomCur = 0.84;
    }
    return events.on((e) => this.onEvent(e, cosmetics));
  }

  /** Camera shake by severity (0.5 light … 10 collapse); decays on its own. */
  private shakeBy(amount: number): void {
    this.shakeK = Math.max(this.shakeK, amount);
  }

  private settleBurst(effect: string, x: number, y: number, n: number): void {
    const p = this.particles;
    switch (effect) {
      case "fx_petals":
        p.burst("petal", x, y, n, { speed: 180, size: 5, colors: ["#ffd1dc", "#ff9ab8", "#fff5f8"], g: -120, life: 1.6, drag: 1.6 });
        break;
      case "fx_stars":
        p.burst("star", x, y, n, { speed: 220, size: 6, colors: ["#fff3c4", "#9fe3ff", "#ffd75e"], g: -60, life: 1.1 });
        break;
      case "fx_confetti":
        p.burst("confetti", x, y, n, { speed: 260, size: 7, colors: ["#c0392b", "#2aa79a", "#f2b84b", "#2f4c8c", "#ff9ad5"], g: -380, life: 1.5 });
        break;
      default:
        p.burst("spark", x, y, n, { speed: 240, size: 3.2, colors: ["#ffd75e", "#fff3c4", "#ffb347"], g: -200, life: 0.9 });
    }
  }

  /** Short radial zoom-blur burst over the world (combo milestones, Shabyt, crown). */
  private flashZoom(strength: number): void {
    if (this.opts.reducedMotion) return;
    this.zoomT = 0.3;
    this.zoom.strength = strength;
    this.world.filters = [this.grade.filter, this.zoom];
  }

  private onEvent(e: RoundEvent, cos: Equipped): void {
    const p = this.particles;
    switch (e.k) {
      case "land":
        if (e.q === "perfect") {
          this.settleBurst(cos.effect, e.x, e.y, 30);
          p.burst("glow", e.x, e.y, 10, { speed: 90, size: 6, color: "#ffe9a8", g: 40, life: 0.8 });
          p.spawn({ kind: "ring", x: e.x, y: e.y, size: 10, life: 0.5, color: "#ffe9a8" });
          this.kick = 0.25;
          this.punchT = 0.12;
          const top = this.view?.tower.top;
          if (top) this.blocks.get(top.id)?.cheer();
        } else if (e.q === "good") {
          this.shakeBy(0.6);
          this.settleBurst(cos.effect, e.x, e.y, 12);
          p.burst("dust", e.x, e.y, 6, { speed: 80, size: 7, color: "#e9dcc0", g: 30, life: 0.7 });
        } else if (e.q === "normal") {
          this.shakeBy(1.3);
          p.burst("dust", e.x, e.y, 10, { speed: 110, size: 8, color: "#d8cbb0", g: 20, life: 0.8 });
        } else {
          this.shakeBy(e.q === "bad" ? 3 : 4.5);
          p.burst("dust", e.x, e.y, 16, { speed: 140, size: 9, color: "#bfae8f", g: 10, life: 1 });
          p.burst("chip", e.x, e.y, 10, { speed: 220, size: 5, colors: ["#7a5a3a", "#5d4e43", "#a88b6a"], g: -900, life: 1.2 });
        }
        if (e.students > 0) p.burst("glow", e.x, e.y - 25, Math.min(12, e.students), { speed: 50, size: 4, color: "#ffd27a", g: 60, life: 1 });
        break;
      case "miss":
        this.shakeBy(5);
        p.burst("chip", e.x, e.y, 18, { speed: 260, size: 6, colors: ["#7a5a3a", "#5d4e43", "#a88b6a"], g: -900, life: 1.4 });
        p.burst("dust", e.x, e.y, 14, { speed: 120, size: 10, color: "#bfae8f", g: 10, life: 1 });
        break;
      case "combo":
        this.flashZoom(0.12);
        p.burst("star", this.view ? this.view.crane.x : 0, (this.view?.tower.topY ?? 0) + 40, 22, { speed: 300, size: 7, colors: ["#ffd75e", "#fff3c4"], g: -120, life: 1.2 });
        break;
      case "shabyt":
        if (e.on) this.flashZoom(0.16);
        if (e.on && this.view) p.burst("glow", this.view.crane.x, this.view.tower.topY, 30, { speed: 260, size: 6, color: "#ffd75e", g: 0, life: 1.2 });
        break;
      case "material":
        p.burst("coin", e.x, e.y + 20, 6, { speed: 160, size: 5, g: -500, life: 1.1 });
        break;
      case "collapse":
        this.shakeBy(10);
        if (this.view) {
          const y = this.view.tower.topY;
          p.burst("dust", 0, y, 110, { speed: 240, size: 14, color: "#bfae8f", g: 10, life: 1.8, spread: 180 });
          p.burst("chip", 0, y, 40, { speed: 320, size: 6, colors: ["#7a5a3a", "#5d4e43"], g: -900, life: 1.6, spread: 120 });
        }
        break;
      case "crowned":
        this.flashZoom(0.2);
        for (const bv of this.blocks.values()) bv.cheer(3.2);
        if (this.view) {
          const top = this.view.tower.top;
          const x = this.view.tower.visualX(top);
          const y = this.view.tower.topY + 50;
          this.settleBurst(cos.effect, x, y, 60);
          p.burst("star", x, y + 40, 40, { speed: 340, size: 7, colors: ["#fff3c4", "#ffd75e"], g: -80, life: 1.6 });
          p.burst("confetti", x, y, 80, { speed: 380, size: 7, colors: ["#c0392b", "#2aa79a", "#f2b84b", "#2f4c8c", "#ffffff"], g: -420, life: 2.2, spread: 80 });
          for (let i = 0; i < 4; i++) this.fireworkQueue.push({ at: this.time + 0.3 + i * 0.45, x: x + (i - 1.5) * 120, y: y + 200 + (i % 2) * 80 });
        }
        break;
      case "fireworks":
        for (let i = 0; i < 3; i++) this.fireworkQueue.push({ at: this.time + i * 0.4, x: e.x + (i - 1) * 140, y: e.y + 160 + i * 40 });
        break;
      case "examPassed":
        if (this.view) p.burst("star", this.view.tower.visualX(this.view.tower.top), this.view.tower.topY, 20, { speed: 200, size: 6, colors: ["#c9b8ff", "#fff3c4"], g: -60 });
        break;
      case "bonusApplied":
        if (this.view) p.burst("glow", this.view.crane.x, this.view.tower.topY + BALANCE.world.hangAbove, 24, { speed: 200, size: 5, color: "#ffe9a8", g: 0 });
        break;
      default:
        break;
    }
  }

  // ── Per-frame update ─────────────────────────────────────────────────────

  private frameDt = 1 / 60;

  update(dt: number): void {
    this.time += dt;
    this.frameDt = dt;
    this.particles.reduced = this.opts.reducedMotion;
    this.hudUi.reducedMotion = this.opts.reducedMotion;
    this.particles.update(dt);
    this.hudUi.update(dt);
    const v = this.view;
    if (!v) return;
    this.focusCur += (this.focus - this.focusCur) * Math.min(1, dt * 3);

    // Camera zoom: gentle zoom-out as the tower grows, a 120 ms punch-in on "Perfect", a slow
    // push-in on the shanyrak at the finale, and the wide opening shot easing back to 1.
    const crowning = !this.opts.menu && (v.phase === "crowning" || v.crowned);
    let zoomTarget = this.opts.menu ? 1 : 1 - Math.min(0.14, Math.max(0, v.height - 6) * 0.006);
    if (crowning) zoomTarget = 1.12;
    this.introT = Math.max(0, this.introT - dt);
    this.zoomCur += (zoomTarget - this.zoomCur) * Math.min(1, dt * (this.introT > 0 ? 1.6 : crowning ? 1.2 : 2.5));
    this.punchT = Math.max(0, this.punchT - dt);
    const punch = this.opts.reducedMotion || this.punchT <= 0 ? 0 : 0.06 * Math.sin(Math.PI * (1 - this.punchT / 0.12));
    this.scale = this.baseScale * this.zoomCur * (1 + punch);

    // Camera follow: critically damped spring (no overshoot, no lag jumps)
    const topY = v.tower.topY;
    let target: number;
    if (this.opts.menu) {
      const fullH = topY + (v.crowned ? 140 : 40);
      const visible = (this.groundY - this.cssH * 0.2) / this.scale;
      target = Math.max(0, fullH - visible);
    } else {
      const anchor = this.cssH * (crowning ? 0.62 : 0.56);
      target = Math.max(0, topY - (this.groundY - anchor) / this.scale);
      if (crowning) target += 40;
    }
    [this.camY, this.camVelY] = smoothDamp(this.camY, target, this.camVelY, this.opts.menu ? 0.6 : this.introT > 0 ? 0.55 : 0.3, dt);
    const topX = v.tower.blocks.length > 1 ? v.tower.visualX(v.tower.top) * (crowning ? 0.8 : 0.35) : 0;
    [this.camX, this.camVelX] = smoothDamp(this.camX, topX, this.camVelX, 0.6, dt);
    this.shakeK *= Math.exp(-dt * 7);
    if (this.shakeK < 0.02) this.shakeK = 0;

    if (v.event) this.lastEvent = v.event.id;
    this.eventK += ((v.event ? 1 : 0) - this.eventK) * Math.min(1, dt * 1.2);
    this.theme = themeFor(v.height, this.lastEvent, this.opts.menu, this.eventK);

    this.emitAmbient(v, dt);
    this.kick = Math.max(0, this.kick - dt * 2);
    this.syncScene(v, dt);
  }

  private emitAmbient(v: WorldView, dt: number): void {
    this.steamT += dt;
    const topY = v.tower.topY;
    const ambientOk = this.particles.count < AMBIENT_BUDGET;
    if (this.steamT > 0.22) {
      this.steamT = 0;
      for (const b of v.tower.blocks) {
        if (b.type !== "chaikhana" && b.type !== "canteen") continue;
        const sy = this.screenY(b.floor * H + H);
        if (!ambientOk || sy < -40 || sy > this.cssH + 40) continue;
        if (b.type === "canteen" && Math.random() < 0.6) continue;
        const x = v.tower.visualX(b) + b.w * 0.3;
        this.particles.spawn({ kind: "steam", x, y: (b.floor + 1) * H + 4, vx: 6 + v.wind * v.windDir * 40, vy: 28, life: 2, size: 5, color: "#f4efe4", g: 6, drag: 0.4 });
      }
      if (v.shabytLevel > 0) {
        const b = v.tower.blocks[1 + Math.floor(Math.random() * Math.max(1, v.tower.blocks.length - 1))];
        if (b) this.particles.spawn({ kind: "glow", x: v.tower.visualX(b) + (Math.random() - 0.5) * b.w, y: b.floor * H + Math.random() * H, vy: 40, life: 1.4, size: 3, color: "#ffd75e", g: 10, drag: 0.5 });
      }
      if (v.event?.id === "festival") {
        this.particles.spawn({ kind: "confetti", x: (Math.random() - 0.5) * 500, y: 160 + Math.random() * 120, vx: (Math.random() - 0.5) * 60, vy: 0, life: 2.4, size: 6, color: ["#c0392b", "#2aa79a", "#f2b84b", "#ff9ad5"][Math.floor(Math.random() * 4)], g: -120, vr: 5, drag: 0.8 });
      }
      for (const b of v.tower.blocks) {
        if (b.type !== "nauryz") continue;
        const sy = this.screenY(b.floor * H + H);
        if (sy < -40 || sy > this.cssH + 40) continue;
        const x = v.tower.visualX(b) + b.w * 0.32;
        for (let i = 0; i < 2; i++) this.particles.spawn({ kind: "fire", x: x + (Math.random() - 0.5) * 6, y: (b.floor + 1) * H + 2, vx: (Math.random() - 0.5) * 14 + v.wind * v.windDir * 30, vy: 40 + Math.random() * 30, life: 0.7, size: 4, color: ["#ffb347", "#ff6b3c", "#ffd75e"][i], g: 20, drag: 0.6 });
      }
      if (v.event?.id === "nauryz" && Math.random() < 0.12) this.fireworkQueue.push({ at: this.time, x: (Math.random() - 0.5) * 600, y: topY + 200 + Math.random() * 150 });
    }
    const rate = this.opts.reducedMotion ? 0.35 : 1;
    this.leavesT += dt;
    const leafEvery = v.wind > 0.05 ? 0.12 : 0.9;
    if (!this.opts.menu && ambientOk && this.leavesT > leafEvery / rate) {
      this.leavesT = 0;
      const dir = v.wind > 0.05 ? v.windDir : Math.random() < 0.5 ? 1 : -1;
      this.particles.spawn({ kind: "leaf", x: dir > 0 ? -20 : this.cssW + 20, y: this.cssH * (0.25 + Math.random() * 0.5), vx: dir * (60 + v.wind * 260 + Math.random() * 40), vy: 20 + Math.random() * 30, life: 7, size: 5, color: ["#7fb85a", "#e0a63a", "#c8643b", "#a9d46a"][Math.floor(Math.random() * 4)], g: 12, vr: (Math.random() - 0.5) * 4, drag: 0.1, screen: true });
    }
    // Rates are per second (tuned at 60 fps): 120/144/240 Hz screens get the same density.
    const windN = ambientOk && v.wind > 0.05 ? spawnCount(v.wind * 54 * rate, dt) : 0;
    for (let n = 0; n < windN; n++) {
      const fromLeft = v.windDir > 0;
      this.particles.spawn({ kind: "wind", x: fromLeft ? -40 : this.cssW + 40, y: Math.random() * this.cssH * 0.8, vx: v.windDir * (500 + Math.random() * 300), vy: 0, life: 1.6, size: 1, color: "#e8f4ff", screen: true, rot: 0 });
    }
    const weather = this.opts.menu ? "clear" : (v.cfg.weather ?? "clear");
    const weatherN = !ambientOk ? 0 : weather === "rain" ? spawnCount(108 * rate, dt) : weather === "snow" ? spawnCount(36 * rate, dt) : 0;
    if (weather === "rain") {
      for (let i = 0; i < weatherN; i++) this.particles.spawn({ kind: "rain", x: Math.random() * this.cssW * 1.2 - 40, y: -10, vx: -60 + v.wind * v.windDir * 200, vy: 900, life: 1.4, size: 1, color: "#bed7ff", screen: true, rot: 0.06 });
    } else if (weather === "snow") {
      for (let i = 0; i < weatherN; i++) this.particles.spawn({ kind: "snow", x: Math.random() * this.cssW, y: -10, vx: v.wind * v.windDir * 120 + (Math.random() - 0.5) * 20, vy: 50 + Math.random() * 40, life: 12, size: 1.6 + Math.random() * 2, color: "#ffffff", screen: true });
    }
    const due = this.fireworkQueue.filter((f) => f.at <= this.time);
    this.fireworkQueue = this.fireworkQueue.filter((f) => f.at > this.time);
    for (const f of due) {
      const colors = [["#ffd75e", "#fff3c4"], ["#ff6b6b", "#ffd1dc"], ["#7cefff", "#ffffff"], ["#8ef0a5", "#fff3c4"]][Math.floor(Math.random() * 4)];
      this.particles.burst("firework", f.x, f.y, 34, { speed: 320, size: 2.6, colors, g: -140, life: 1.3, drag: 1.4 });
    }
  }

  private look(v: WorldView): BlockLook {
    const c = v.cfg.cosmetics;
    return { facade: c.facade, ornament: c.ornament, faculty: v.cfg.faculty, studentSkin: c.student };
  }

  private syncScene(v: WorldView, dt: number): void {
    const s = this.scale;
    const th = this.theme;
    const night = Math.min(1, th.lights * 0.8 + (v.event?.id === "session" ? 0.4 : 0));
    const look = this.look(v);
    const lookKey = `${look.facade}|${look.ornament}|${look.faculty}|${look.studentSkin}|${this.bank.scale}`;
    this.buildPeople(look);
    if (lookKey !== this.lookKey) {
      this.lookKey = lookKey;
      for (const bv of this.blocks.values()) bv.destroy({ children: true });
      this.blocks.clear();
      this.hangingView?.view.destroy({ children: true });
      this.hangingView = null;
      this.fallingView?.view.destroy({ children: true });
      this.fallingView = null;
      this.crownKey = "";
    }

    // Shake (screen-space offset)
    // Shake: gameplay tremor (deadline) + decaying impact shake, smooth rather than jittery
    const shakeAmp = this.opts.reducedMotion ? 0 : v.shake * 6 + this.shakeK + this.kick * 1.5;
    const ox = shakeAmp * (Math.sin(this.time * 47) * 0.6 + Math.sin(this.time * 83 + 1.3) * 0.4) * 0.5;
    const oy = shakeAmp * (Math.cos(this.time * 41) * 0.6 + Math.sin(this.time * 67 + 0.7) * 0.4) * 0.5;

    // Sky & landscape
    this.sky.paint(th.top, th.bottom);
    const w = this.cssW;
    const hgt = this.cssH;
    for (const st of this.starList) {
      st.p.x = st.x * w;
      st.p.y = (st.y * hgt * 0.75 + this.camY * s * 0.03) % (hgt * 0.8);
      st.p.alpha = th.stars * (0.45 + 0.55 * Math.sin(this.time * 1.5 + st.ph));
    }
    const bodyY = hgt * 0.22 + this.camY * s * 0.04;
    this.sun.visible = th.sun > 0.05;
    this.sun.position.set(w * 0.78, bodyY);
    this.sun.scale.set(1.5 + th.sun * 0.4);
    this.sun.alpha = th.sun;
    this.moon.visible = th.sun <= 0.05;
    this.moon.position.set(w * 0.8, bodyY);
    this.moon.scale.set(1.4);
    this.clouds.children.forEach((c, i) => {
      const speed = 6 + i * 3;
      const span = w + 400;
      c.x = ((((i * 260 + this.time * speed) % span) + span) % span) - 200;
      c.y = hgt * (0.12 + (i % 3) * 0.08) + this.camY * s * 0.05;
      c.alpha = (0.25 + 0.35 * (1 - th.stars)) * (v.event?.id === "wind" ? 1.3 : 1);
      c.tint = hex(mix("#ffffff", th.bottom, 0.35));
      c.scale.set(0.8 + (i % 3) * 0.25);
    });
    const horizon = this.groundY + this.camY * s * 0.18;
    const kind = v.cfg.cosmetics.background;
    if (kind !== this.detailKind) {
      this.detailKind = kind;
      this.detail.texture = this.bank.detailTile(kind);
      this.lights.texture = this.bank.lightsTile(kind);
    }
    const ls = Math.max(0.6, s);
    for (const [ts, k, par, yOff] of [
      [this.mtn, 0.62, 0.06, -46],
      [this.hills, 0.62, 0.12, -20],
      [this.detail, 0.66, 0.2, -6],
      [this.lights, 0.66, 0.2, -6],
    ] as [TilingSprite, number, number, number][]) {
      ts.tileScale.set(ls * k, ls * k);
      // 2px short of a full tile so the texture never wraps a sliver of its bottom row on top
      ts.height = Math.floor(ts.texture.height * ls * k) - 2;
      ts.y = horizon + yOff * s - ts.height + this.camY * s * par * 0.2;
      ts.tilePosition.x = -this.camX * s * par - (this.focusCur - 0.5) * w * par * 2;
    }
    this.mtn.tint = hex(th.far);
    this.hills.tint = hex(mix(th.mid, th.far, 0.25));
    this.detail.tint = hex(shade(th.mid, -0.15));
    this.lights.alpha = th.lights;
    this.lights.visible = th.lights > 0.05;
    const gy = this.screenY(0);
    this.grass.position.set(0, gy);
    this.grass.width = w;
    this.grass.height = Math.max(0, hgt - gy) + 20;
    this.grass.tint = hex(shade("#4f8f58", -th.lights * 0.45));
    this.grass.visible = gy < hgt + 10;

    // Foreground grass in front of the campus, fog at the foot of the tower
    const fgScale = Math.max(0.6, s) * 0.7;
    this.fg.tileScale.set(fgScale, fgScale);
    this.fg.height = Math.floor(90 * fgScale) - 2;
    this.fg.y = gy + 20 * s;
    this.fg.tilePosition.x = -this.camX * s * 1.2;
    this.fg.tint = hex(shade("#ffffff", -th.lights * 0.5));
    this.fg.visible = this.fg.y < hgt;
    this.fog.position.set(0, -8);
    this.fog.width = 1100;
    this.fog.height = 70;
    this.fog.alpha = 0.18 + th.lights * 0.22 + (v.cfg.weather === "rain" && !this.opts.menu ? 0.15 : 0);
    this.fog.tint = hex(mix("#ffffff", th.bottom, 0.4));
    // Custom warm-night colour grade (own GLSL filter)
    this.grade.set(Math.min(1, th.lights), 0.6 + th.lights * 0.6);
    // Shabyt: the whole tower glows
    const glowOn = v.shabytLevel > 0 && !this.opts.menu;
    this.towerLayer.filters = glowOn ? [this.towerShadow, this.towerGlow] : [this.towerShadow];
    if (glowOn) this.towerGlow.outerStrength = (v.shabytLevel === 2 ? 2.6 : 1.8) + Math.sin(this.time * 5) * 0.8;
    // Zoom-blur burst decays to nothing, then the filter is removed (zero cost when idle)
    if (this.zoomT > 0) {
      this.zoomT -= dt;
      this.zoom.strength *= 0.85;
      if (v.tower.blocks.length) {
        const [zx, zy] = this.toScreen(v.tower.visualX(v.tower.top), v.tower.topY);
        this.zoom.center = { x: zx, y: zy };
      }
      if (this.zoomT <= 0) this.world.filters = [this.grade.filter];
    }

    // Camera transform for the world
    this.world.position.set(this.screenX(0) + ox, this.screenY(0) + oy);
    this.world.scale.set(s);

    this.syncGround(v, th.lights);
    this.syncTower(v, night, look);
    this.syncMoving(v, night, look);
    this.syncCrown(v, dt);
    this.syncFloats(v);
    this.drawCrane(v, ox, oy);

    // Overlays
    // A light vignette (0.06 by day, 0.10 at night) — framing, not a dark tunnel.
    this.vignette.alpha = 0.06 + 0.04 * Math.min(1, th.stars + (v.event?.id === "session" ? 0.5 : 0));
    this.danger.visible = v.danger && !this.opts.menu;
    if (this.danger.visible) this.danger.alpha = 0.5 + 0.3 * Math.sin(this.time * 7);
    this.flashSprite.alpha = this.opts.reducedMotion ? 0 : v.flash * 0.22;
  }

  /** (Re)create the plaza people for the current faculty / student skin / bake scale. */
  private buildPeople(look: BlockLook): void {
    const key = `${look.faculty}|${look.studentSkin}|${this.bank.scale}`;
    if (key === this.peopleKey) return;
    this.peopleKey = key;
    for (const f of this.figures) f.destroy({ children: true });
    this.figures = [];
    this.people.removeChildren();
    for (let i = 0; i < 16; i++) {
      const f = new Figure(this.bank, specFor(i * 31 + 5, look.faculty, look.studentSkin));
      f.visible = false;
      this.figures.push(f);
      this.people.addChild(f);
    }
    // Two rows of designed silhouettes for the crowd (hair, backpacks, bags) — not blobs.
    for (const [layer, n, scale, tint] of [
      [this.crowdBack, 22, 0.86, 0x3b355e],
      [this.crowdFront, 16, 0.96, 0x272241],
    ] as [Container, number, number, number][]) {
      layer.removeChildren().forEach((c) => c.destroy());
      for (let i = 0; i < n; i++) {
        const sil = crowdSilhouette(this.bank, ARCHETYPES[(i * 5 + n) % ARCHETYPES.length], i);
        const s = new Sprite(sil.tex);
        s.anchor.set(sil.ax, sil.ay);
        s.scale.set((i % 2 ? scale : -scale) * (0.94 + ((i * 7) % 5) * 0.03), scale * (0.94 + ((i * 7) % 5) * 0.03));
        s.tint = tint;
        layer.addChild(s);
      }
    }
  }

  private syncGround(v: WorldView, lights: number): void {
    const foundW = v.tower.blocks[0]?.w ?? 250;
    const pw = foundW + 300;
    if (pw !== this.plazaW) {
      this.plazaW = pw;
      const pz = this.bank.plaza(pw);
      this.plaza.texture = pz.tex;
      this.plaza.anchor.set(pz.ax, pz.ay);
    }
    this.plaza.tint = hex(shade("#ffffff", -lights * 0.45));
    const treeX = [-foundW / 2 - 60, foundW / 2 + 60, -foundW / 2 - 200, foundW / 2 + 210, -foundW / 2 - 330, foundW / 2 + 340];
    const dim = hex(shade("#ffffff", -lights * 0.45));
    this.trees.forEach((t, i) => {
      t.position.set(treeX[i], 2);
      t.tint = dim;
      t.rotation = Math.sin(this.time * 0.8 + i) * 0.015 * (1 + v.wind * 3);
    });
    const lampX = [-foundW / 2 - 120, foundW / 2 + 125];
    this.lamps.forEach((l, i) => {
      l.lamp.position.set(lampX[i], 2);
      l.glow.position.set(lampX[i], -54);
      l.glow.alpha = lights > 0.3 ? 0.55 * lights * (0.92 + 0.08 * Math.sin(this.time * 9 + i)) : 0;
    });
    const flagColor = (() => {
      const id = v.cfg.cosmetics.flag.replace("flag_", "");
      if (id in FACULTIES) return FACULTIES[id as FacultyId].color;
      return v.cfg.faculty ? FACULTIES[v.cfg.faculty].color : "#00afca";
    })();
    const flagX = [-foundW / 2 - 18, foundW / 2 + 18];
    this.flags.forEach((f, i) => {
      f.pole.position.set(flagX[i], 2);
      f.pole.tint = dim;
      f.cloth.texture = this.bank.flagCloth(flagColor);
      f.cloth.position.set(flagX[i] + 1, -70);
      f.cloth.tilePosition.x = this.time * (20 + v.wind * 60) * (i ? 1 : 1.1);
      f.cloth.skew.y = Math.sin(this.time * 3 + i) * 0.06;
      f.cloth.tint = dim;
    });
    // People on the plaza: walkers cross it, a few stand and chat (one with tea), everyone panics
    // when the tower wobbles and cheers when the shanyrak crowns it.
    const celebrate = v.phase === "crowning" || (v.crowned && !this.opts.menu) || v.event?.id === "festival";
    const walkers = Math.min(16, 3 + Math.floor(v.students / 10));
    const dtp = Math.min(0.05, this.frameDt);
    this.figures.forEach((fig, i) => {
      if (i >= walkers) {
        fig.visible = false;
        return;
      }
      fig.visible = true;
      const standing = i % 4 === 0;
      const dir = i % 2 ? 1 : -1;
      let wx: number;
      if (standing) {
        wx = (i % 8 === 0 ? -1 : 1) * (foundW / 2 + 70 + ((i * 23) % 90));
        fig.pose = v.danger && !this.opts.menu ? "panic" : celebrate ? "cheer" : i % 8 === 4 ? "tea" : "idle";
        fig.scale.x = wx > 0 ? -1 : 1;
      } else {
        const panic = v.danger && !this.opts.menu;
        const speed = (panic ? 2.2 : 1) * (16 + ((i * 7) % 16));
        const span = 1100;
        wx = ((((i * 137 + this.time * speed * dir) % span) + span) % span) - span / 2;
        fig.pose = panic ? "panic" : celebrate && i % 3 === 0 ? "cheer" : "walk";
        fig.stride = speed / 22;
        fig.scale.x = dir;
      }
      const row = i % 3;
      fig.scale.y = 1 - row * 0.05;
      fig.scale.x *= 1 - row * 0.05;
      fig.position.set(wx, 10 + row * 4);
      fig.update(dtp, lights);
    });
    // Two crowd rows sway in antiphase; the back row drifts with a little parallax.
    const crowdOn = v.students >= 24 || celebrate;
    const dense = celebrate;
    for (const [layer, rowY, par, phase] of [
      [this.crowdBack, -2, 0.12, 0],
      [this.crowdFront, 4, 0, Math.PI],
    ] as [Container, number, number, number][]) {
      layer.visible = crowdOn && (layer === this.crowdBack || dense);
      if (!layer.visible) continue;
      layer.position.set(this.camX * par, rowY);
      layer.tint = dim;
      const n = layer.children.length;
      layer.children.forEach((c, i) => {
        const side = i % 2 ? 1 : -1;
        const spread = foundW / 2 + 40 + ((i * 37) % 260);
        c.x = side * spread;
        const sway = Math.sin(this.time * 1.6 + phase + i * 0.7);
        c.rotation = sway * 0.035;
        c.y = dense ? -Math.abs(Math.sin(this.time * 5 + i * 1.3 + phase)) * 4 : -Math.max(0, sway) * 0.6;
        c.visible = dense || i < Math.min(n, Math.floor(v.students / 6));
      });
    }
  }

  private syncTower(v: WorldView, night: number, look: BlockLook): void {
    const seen = new Set<number>();
    const viewTop = this.camY + (this.groundY + 60) / this.scale;
    const viewBottom = this.camY - (this.cssH - this.groundY + 60) / this.scale;
    for (const b of v.tower.blocks) {
      seen.add(b.id);
      let bv = this.blocks.get(b.id);
      if (!bv) {
        bv = new BlockView(this.bank, b.type, b.w, look, b.id);
        this.blocks.set(b.id, bv);
        this.towerLayer.addChild(bv);
        this.emissive.addChild(bv.glow);
      }
      const by = b.floor * H;
      bv.visible = !(by > viewTop || by + H < viewBottom);
      bv.glow.visible = bv.visible && night > 0.04;
      bv.contact.visible = b.floor > 0;
      if (!bv.visible) continue;
      bv.position.set(v.tower.visualX(b), -by);
      bv.mood = v.event?.id === "session" && b.id % 2 === 1 ? "sleep" : "idle";
      bv.sync(this.time, b.type === "foundation" ? night * 0.7 : night, b.shown, b.crack, b.tilt, b.squash);
      this.followGlow(bv);
    }
    for (const [id, bv] of this.blocks) {
      if (!seen.has(id)) {
        bv.destroy({ children: true });
        this.blocks.delete(id);
      }
    }
    // Shabyt aura
    this.aura.visible = v.shabytLevel > 0 && v.tower.floors > 1;
    if (this.aura.visible) {
      const top = v.tower.topY;
      const ry = Math.min(top, 700) * 0.6 + 80;
      this.aura.position.set(v.tower.visualX(v.tower.top), -(top - ry * 0.55));
      this.aura.width = 380;
      this.aura.height = ry * 2;
      this.aura.alpha = (v.shabytLevel === 2 ? 0.55 : 0.38) * (0.8 + 0.2 * Math.sin(this.time * 4));
    }
  }

  /** The emissive twin of a room follows its position, tilt and squash. */
  private followGlow(bv: BlockView): void {
    const g = bv.glow;
    if (g.parent !== this.emissive) this.emissive.addChild(g);
    g.position.copyFrom(bv.position);
    g.rotation = bv.rotation;
    g.scale.copyFrom(bv.scale);
    g.alpha = bv.alpha;
  }

  private syncMoving(v: WorldView, night: number, look: BlockLook): void {
    const mk = (type: RoomId, w: number) => new BlockView(this.bank, type, w, look, 1);
    // Hanging room on the crane
    if (v.hanging && !this.opts.menu) {
      const key = `${v.hanging.type}|${v.hanging.w}`;
      if (this.hangingView?.key !== key) {
        this.hangingView?.view.destroy({ children: true });
        this.hangingView = { key, view: mk(v.hanging.type, v.hanging.w) };
        this.movingLayer.addChild(this.hangingView.view);
      }
      const hv = this.hangingView.view;
      hv.visible = true;
      hv.position.set(v.crane.x, -(v.tower.topY + BALANCE.world.hangAbove));
      hv.sync(this.time, night * 0.6, 0, 0, v.crane.tilt, 0);
      this.followGlow(hv);
      hv.glow.visible = night > 0.04;
    } else if (this.hangingView) {
      this.hangingView.view.visible = false;
      this.hangingView.view.glow.visible = false;
    }
    // Falling room
    if (v.falling) {
      const f = v.falling;
      const key = `${f.type}|${f.w}`;
      if (this.fallingView?.key !== key) {
        this.fallingView?.view.destroy({ children: true });
        this.fallingView = { key, view: mk(f.type, f.w) };
        this.movingLayer.addChild(this.fallingView.view);
      }
      const fv = this.fallingView.view;
      fv.visible = true;
      fv.position.set(f.x, -f.y);
      fv.sync(this.time, night * 0.6, 0, 0, f.rot, 0);
      this.followGlow(fv);
      fv.glow.visible = night > 0.04;
    } else if (this.fallingView) {
      this.fallingView.view.visible = false;
      this.fallingView.view.glow.visible = false;
    }
    // Debris
    const alive = new Set(v.debris);
    for (const d of v.debris) {
      let dv = this.debrisViews.get(d);
      if (!dv) {
        dv = mk(d.type, d.w);
        dv.pivot.set(0, -H / 2);
        this.debrisViews.set(d, dv);
        this.movingLayer.addChild(dv);
      }
      dv.position.set(d.x, -d.y - H / 2);
      dv.alpha = Math.min(1, d.life);
      dv.sync(this.time, 0, 0, 1, d.rot, 0);
    }
    for (const [d, dv] of this.debrisViews) {
      if (!alive.has(d)) {
        dv.destroy({ children: true });
        this.debrisViews.delete(d);
      }
    }
  }

  private syncCrown(v: WorldView, dt: number): void {
    const show = v.phase === "crowning" || v.crowned;
    this.crownLayer.visible = show && v.tower.blocks.length > 0;
    if (!this.crownLayer.visible) return;
    const top = v.tower.top;
    const cos = v.cfg.cosmetics;
    const key = `${Math.round(top.w / 8)}|${cos.shanyrak}|${cos.ornament}|${this.bank.scale}`;
    if (key !== this.crownKey) {
      this.crownKey = key;
      this.crownSprite?.destroy();
      const art = this.bank.crown(top.w, cos.shanyrak, cos.ornament);
      this.crownSprite = new Sprite(art.tex);
      this.crownSprite.anchor.set(art.ax, art.ay);
      this.crownLayer.addChild(this.crownSprite);
    }
    const p = this.opts.menu ? 1 : clamp01(v.crownT / (CROWN_DURATION * 0.62));
    const drop = (1 - easeOutBack(p)) * 320;
    const x = v.tower.visualX(top);
    const y = v.tower.topY + Math.max(-20, drop);
    const crownSprite = this.crownSprite as Sprite;
    crownSprite.position.set(x, -y);
    const glow = v.crowned ? clamp01((this.opts.menu ? 3 : v.crownT - CROWN_DURATION * 0.62) * 1.5) : 0;
    const W = top.w + 26;
    this.rays.visible = glow > 0;
    this.rays.position.set(x, -(y + W * 0.34));
    this.rays.width = W * 2.6;
    this.rays.height = W * 2.6;
    this.rays.rotation += dt * 0.15;
    this.rays.alpha = 0.55 * glow;
    this.crownHalo.visible = glow > 0;
    this.crownHalo.position.set(x, -(y + W * 0.34));
    this.crownHalo.width = W * 0.9;
    this.crownHalo.height = W * 0.55;
    this.crownHalo.alpha = glow * (0.45 + 0.2 * Math.sin(this.time * 2.2));
    this.crownGlow.outerStrength = glow > 0 ? 1.6 + Math.sin(this.time * 2.5) * 0.9 : 0;
    this.crownGlow.enabled = glow > 0;
    crownSprite.rotation = glow > 0 ? Math.sin(this.time * 0.8) * 0.012 : 0;
  }

  private syncFloats(v: WorldView): void {
    let i = 0;
    for (const f of v.floats) {
      let t = this.floatPool[i];
      if (!t) {
        t = new BitmapText({ text: "", style: { fontFamily: FLOAT_FONT, fontSize: 30 } });
        t.anchor.set(0.5);
        this.floatPool.push(t);
        this.floatLayer.addChild(t);
      }
      const text = f.text.replace(EMOJI, "").trim();
      if (t.text !== text) t.text = text;
      t.visible = true;
      const k = f.t / f.life;
      const pop = f.t < 0.15 ? 0.6 + (f.t / 0.15) * 0.5 : 1.1 - Math.min(0.1, (f.t - 0.15) * 0.3);
      const size = (f.size / 30) * pop * Math.max(0.8, 1 / Math.max(0.7, this.scale));
      t.scale.set(size);
      t.position.set(f.x, -f.y);
      t.tint = hex(f.color);
      t.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      i++;
    }
    for (; i < this.floatPool.length; i++) this.floatPool[i].visible = false;
  }

  private drawCrane(v: WorldView, ox: number, oy: number): void {
    const g = this.crane;
    g.clear();
    if (!v.hanging || this.opts.menu) {
      this.trail.length = 0;
      return;
    }
    const s = this.scale;
    const railY = 18;
    g.rect(0, railY - 8, this.cssW, 8).fill({ color: 0x3a3d55 });
    for (let k = 0; k < this.cssW; k += 40) g.rect(k, railY - 8, 20, 3).fill({ color: 0xf2b84b });
    const [hx, hyTop] = this.toScreen(v.crane.x, v.tower.topY + BALANCE.world.hangAbove + H);
    g.rect(hx - 16 + ox, railY, 32, 12).fill({ color: 0x4a4e6d });
    // Fading trail of the swinging room
    const [, hyMid] = this.toScreen(v.crane.x, v.tower.topY + BALANCE.world.hangAbove + H / 2);
    this.trail.push({ x: hx, y: hyMid });
    if (this.trail.length > 18) this.trail.shift();
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1];
      const c = this.trail[i];
      g.moveTo(a.x + ox, a.y + oy).lineTo(c.x + ox, c.y + oy).stroke({ width: 3 * s, color: 0xffe9a8, alpha: (i / this.trail.length) * 0.35 });
    }
    g.moveTo(hx + ox, railY + 12)
      .lineTo(hx + Math.sin(v.crane.tilt) * 20 * s + ox, hyTop + oy - 12 * s)
      .stroke({ width: 2, color: 0x2b2d40 });
    const guideOn = this.opts.guide && (v.isTutorial || v.height < 6 || v.eff.teaBreak > 0);
    if (guideOn) {
      const [, hy] = this.toScreen(v.crane.x, v.tower.topY + BALANCE.world.hangAbove);
      const [tx, ty] = this.toScreen(v.tower.visualX(v.tower.top), v.tower.topY);
      for (let y = hy + 6; y < ty - 6; y += 14) g.moveTo(hx + ox, y + oy).lineTo(hx + ox, Math.min(ty - 6, y + 6) + oy);
      g.stroke({ width: 2, color: 0xfff3c4, alpha: 0.55 });
      const aligned = Math.abs(v.crane.x - v.tower.visualX(v.tower.top)) < 10;
      g.poly([tx + ox, ty - 4 + oy, tx - 8 + ox, ty - 16 + oy, tx + 8 + ox, ty - 16 + oy]).fill({ color: aligned ? 0x8ef0a5 : 0xffd75e });
    }
  }

  async capture(): Promise<Blob | null> {
    try {
      const c = this.app.renderer.extract.canvas(this.app.stage) as HTMLCanvasElement;
      return await new Promise((resolve) => (c.toBlob ? c.toBlob((b) => resolve(b), "image/png") : resolve(null)));
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.particles.clear();
    this.app.destroy({ removeView: true }, { children: true, texture: false });
  }
}
