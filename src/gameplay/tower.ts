// The tower: stacked rooms, their lean (centre of mass vs. foundation) and the visible sway.
// Sway is arcade, not physics: an amplitude driven by lean, wind, height and danger, applied as a
// height-weighted offset. Landing checks use the same swayed position the player sees.

import { BALANCE } from "../config/balance";
import type { RoomId } from "../meta/rooms";
import type { PlacedBlock, Quality } from "./types";

export class Tower {
  blocks: PlacedBlock[] = [];
  private nextId = 1;
  swayAmp = 0;
  swayT = 0;
  /** Extra high-frequency jitter (deadline shake / danger). */
  jitter = 0;

  get floors(): number {
    return this.blocks.length;
  }

  get top(): PlacedBlock {
    return this.blocks[this.blocks.length - 1];
  }

  /** World Y of the top surface. */
  get topY(): number {
    return this.blocks.length * BALANCE.world.blockH;
  }

  add(type: RoomId, x: number, w: number, quality: Quality, students: number, t: number): PlacedBlock {
    const b: PlacedBlock = {
      id: this.nextId++,
      type,
      x,
      w,
      floor: this.blocks.length,
      quality,
      students,
      shown: 0,
      bornAt: t,
      crack: quality === "bad" ? 0.8 : quality === "critical" ? 1 : 0,
      tilt: quality === "bad" ? 0.06 * Math.sign(x || 1) : 0,
      squash: 1,
    };
    this.blocks.push(b);
    return b;
  }

  /** Sway offset at a given floor index (0 = foundation never moves). */
  swayAt(floor: number): number {
    if (floor <= 0) return 0;
    const h = (floor * BALANCE.world.blockH) / 600;
    const k = Math.pow(h, 1.3);
    const base = Math.sin(this.swayT * 1.7) * this.swayAmp * k;
    const jit = this.jitter > 0 ? Math.sin(this.swayT * 41) * this.jitter * Math.min(1, h) : 0;
    return base + jit;
  }

  /** Visible centre of a block. */
  visualX(b: PlacedBlock): number {
    return b.x + this.swayAt(b.floor);
  }

  /** Lean ratio: |centre of mass| relative to half the foundation width. */
  leanRatio(): number {
    if (this.blocks.length < 2) return 0;
    let sum = 0;
    let mass = 0;
    for (let i = 1; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      sum += b.x * b.w;
      mass += b.w;
    }
    const com = mass > 0 ? sum / mass : 0;
    return Math.abs(com) / (this.blocks[0].w * 0.5);
  }

  leanDir(): number {
    let sum = 0;
    for (let i = 1; i < this.blocks.length; i++) sum += this.blocks[i].x;
    return Math.sign(sum) || 1;
  }

  update(dt: number, swayTarget: number, jitterTarget: number): void {
    this.swayT += dt;
    this.swayAmp += (swayTarget - this.swayAmp) * Math.min(1, dt * 1.5);
    this.jitter += (jitterTarget - this.jitter) * Math.min(1, dt * 4);
    for (const b of this.blocks) {
      if (b.squash > 0) b.squash = Math.max(0, b.squash - dt * 3.2);
      if (b.shown < b.students) b.shown = Math.min(b.students, b.shown + dt * 9);
      if (b.tilt !== 0) b.tilt *= Math.pow(0.25, dt);
      if (Math.abs(b.tilt) < 0.001) b.tilt = 0;
    }
  }

  countType(type: RoomId): number {
    let n = 0;
    for (const b of this.blocks) if (b.type === type) n++;
    return n;
  }

  /** Remove the top `n` blocks (collapse) and return them. */
  removeTop(n: number): PlacedBlock[] {
    const keep = Math.max(1, this.blocks.length - n);
    return this.blocks.splice(keep);
  }
}
