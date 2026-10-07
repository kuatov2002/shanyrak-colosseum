// A room on screen: baked base sprite + animated layers (window light, students, cracks, and
// per-room extras). Lives in world units, origin at the room's centre-bottom (Pixi y down).

import { Container, Sprite } from "pixi.js";
import type { RoomId } from "../meta/rooms";
import type { FacultyId } from "../social/faculties";
import { windowLayout, type WindowRect } from "./rooms";
import { BLOCK_H, type TextureBank } from "./textures";

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
  students: Sprite[];
}

export class BlockView extends Container {
  readonly base: Sprite;
  private crackSprite: Sprite | null = null;
  private windows: WindowView[] = [];
  readonly extras = new Container();
  private shownStudents = 0;
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
    for (const rect of windowLayout(type, w, BLOCK_H)) {
      const wl = bank.windowLight(rect.w, rect.h);
      const light = new Sprite(wl.tex);
      light.anchor.set(wl.ax, wl.ay);
      light.position.set(rect.x, rect.y);
      light.blendMode = "add";
      light.tint = cyan ? 0x7cefff : 0xffc46b;
      const students: Sprite[] = [];
      for (let s = 0; s < 2; s++) {
        const sp = new Sprite(bank.student(seed * 7 + rect.i * 2 + s, look.studentSkin));
        sp.anchor.set(0.5, 1);
        sp.position.set(rect.cx + (s === 0 ? -rect.w * 0.2 : rect.w * 0.2), rect.y + rect.h + 0.5);
        sp.alpha = 0;
        sp.visible = false;
        people.addChild(sp);
        students.push(sp);
      }
      lights.addChild(light);
      const rnd = Math.sin(seed * 12.9898 + rect.i * 78.233) * 43758.5453;
      const frac = rnd - Math.floor(rnd);
      this.windows.push({ rect, light, phase: frac * Math.PI * 2, nightOnly: frac < 0.18, students });
    }
    this.addChild(lights, people, this.extras);
  }

  /**
   * @param night 0..1 how dark it is (window light strength)
   * @param shown students to display (animated count)
   */
  sync(t: number, night: number, shown: number, crack: number, tilt: number, squash: number): void {
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
