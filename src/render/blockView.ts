// A room on screen: baked base sprite + animated layers (window light, students, cracks, and
// per-room extras). Lives in world units, origin at the room's centre-bottom (Pixi y down).
// Students sit in the windows as rigged busts (render/characters.ts): they breathe, blink, wave now
// and then, sip tea in the chaikhana, doze off on session night and cheer at a perfect landing.

import { Container, Sprite } from "pixi.js";
import { Bust, specFor } from "./characters";
import type { RoomId } from "../meta/rooms";
import type { FacultyId } from "../social/faculties";
import { windowLayout, type WindowRect } from "./rooms";
import { BLOCK_H, type TextureBank } from "./textures";
import { decorateRoom } from "./roomExtras";

export interface BlockLook {
  facade: string;
  ornament: string;
  faculty: FacultyId | null;
  studentSkin: string;
}

interface WindowView {
  rect: WindowRect;
  light: Sprite;
  phase: number;
  nightOnly: boolean;
  students: Bust[];
}

export type RoomMood = "idle" | "sleep";

export class BlockView extends Container {
  readonly base: Sprite;
  private crackSprite: Sprite | null = null;
  private windows: WindowView[] = [];
  readonly extras = new Container();
  /** Layer between the base and the windows (wall ornament, interior glow). */
  readonly wall = new Container();
  readonly windowRects: WindowRect[];
  private shownStudents = 0;
  private lastT = -1;
  private cheerT = 0;
  /** Set by the renderer from the round (session night puts the campus to sleep). */
  mood: RoomMood = "idle";
  /** Extras updaters registered by decorators (render/roomExtras.ts). */
  readonly tickers: ((t: number, night: number) => void)[] = [];

  constructor(
    private readonly bank: TextureBank,
    readonly type: RoomId,
    readonly w: number,
    readonly look: BlockLook,
    readonly seed: number,
  ) {
    super();
    const art = bank.room(type, w, look.facade, look.ornament, look.faculty);
    this.base = new Sprite(art.tex);
    this.base.anchor.set(art.ax, art.ay);
    this.base.scale.x = w / (Math.round(w / 4) * 4);
    this.addChild(this.base);
    const lights = new Container();
    const people = new Container();
    const cyan = type === "itlab";
    this.windowRects = windowLayout(type, w, BLOCK_H);
    for (const rect of this.windowRects) {
      const wl = bank.windowLight(rect.w, rect.h);
      const light = new Sprite(wl.tex);
      light.anchor.set(wl.ax, wl.ay);
      light.position.set(rect.x, rect.y);
      light.blendMode = "add";
      light.tint = cyan ? 0x7cefff : 0xffc46b;
      const students: Bust[] = [];
      const fit = Math.min(0.84, (rect.h * 0.52) / 14.1, rect.w / 24);
      for (let s = 0; s < 2; s++) {
        const bust = new Bust(bank, specFor(seed * 7 + rect.i * 2 + s, look.faculty, look.studentSkin, type));
        bust.scale.set(s === 0 ? fit : -fit, fit);
        bust.position.set(rect.cx + (s === 0 ? -rect.w * 0.21 : rect.w * 0.21), rect.y + rect.h + 0.4);
        bust.alpha = 0;
        bust.visible = false;
        people.addChild(bust);
        students.push(bust);
      }
      lights.addChild(light);
      const rnd = Math.sin(seed * 12.9898 + rect.i * 78.233) * 43758.5453;
      const frac = rnd - Math.floor(rnd);
      this.windows.push({ rect, light, phase: frac * Math.PI * 2, nightOnly: frac < 0.18, students });
    }
    this.addChild(this.wall, lights, people, this.extras);
    decorateRoom(this, bank, type);
  }

  /**
   * @param night 0..1 how dark it is (window light strength)
   * @param shown students to display (animated count)
   */
  /** Everyone in this room cheers for a moment (perfect landing, the crown). */
  cheer(seconds = 1.6): void {
    this.cheerT = Math.max(this.cheerT, seconds);
  }

  sync(t: number, night: number, shown: number, crack: number, tilt: number, squash: number): void {
    const dt = this.lastT < 0 ? 0 : Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.cheerT = Math.max(0, this.cheerT - dt);
    // Window light: base glow by night, gentle flicker, a few windows only lit at night
    for (const wv of this.windows) {
      const flicker = 0.9 + 0.1 * Math.sin(t * 2.3 + wv.phase) + (Math.sin(t * 13 + wv.phase * 3) > 0.985 ? -0.25 : 0);
      const on = wv.nightOnly ? Math.max(0, night - 0.35) / 0.65 : 1;
      wv.light.alpha = (0.18 + 0.82 * night) * flicker * on;
    }
    // Students fade in window by window
    const target = Math.floor(shown);
    if (target !== this.shownStudents || target > 0) {
      let left = target;
      for (const wv of this.windows) {
        for (const sp of wv.students) {
          const want = left > 0;
          left--;
          if (want) {
            sp.visible = true;
            sp.alpha = Math.min(1, sp.alpha + 0.08);
          } else if (sp.visible) {
            sp.alpha = Math.max(0, sp.alpha - 0.1);
            if (sp.alpha <= 0) sp.visible = false;
          }
        }
      }
      this.shownStudents = target;
    }
    const mood = this.cheerT > 0 ? "cheer" : this.mood === "sleep" ? "sleep" : this.type === "chaikhana" ? "tea" : "idle";
    for (const wv of this.windows) {
      for (const b of wv.students) {
        if (!b.visible) continue;
        b.mood = mood;
        b.update(dt, night);
      }
    }
    // Crack overlay
    if (crack > 0.05) {
      if (!this.crackSprite) {
        this.crackSprite = new Sprite(this.bank.crack(this.w));
        this.crackSprite.anchor.set(0.5, 1);
        this.addChildAt(this.crackSprite, 1);
      }
      this.crackSprite.alpha = Math.min(1, crack);
    }
    this.rotation = tilt;
    if (squash > 0) {
      const sq = Math.sin(squash * Math.PI) * 0.08 * squash;
      this.scale.set(1 + sq, 1 - sq);
    } else if (this.scale.x !== 1) this.scale.set(1, 1);
    for (const fn of this.tickers) fn(t, night);
  }
}
