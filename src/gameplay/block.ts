// Landing evaluation: how far the dropped room is from the room below decides everything —
// quality, combo, stability, students. Kept pure so it is unit-testable.

import { BALANCE } from "../config/balance";
import type { Quality } from "./types";

export interface LandingInput {
  dx: number; // dropped centre − top centre (world units)
  w: number; // dropped room width
  topW: number;
  gentle: boolean; // first floors / tutorial
  balcony: boolean; // "Двойной балкон" widens the perfect window
}

export function perfectTolerance(gentle: boolean, balcony: boolean): number {
  const q = BALANCE.quality;
  return (gentle ? q.perfectTolGentle : q.perfectTol) * (balcony ? q.balconyK : 1);
}

export function evaluateLanding(i: LandingInput): Quality {
  const q = BALANCE.quality;
  const ad = Math.abs(i.dx);
  const w = Math.min(i.w, i.topW);
  if (ad <= perfectTolerance(i.gentle, i.balcony)) return "perfect";
  if (ad <= q.good * w) return "good";
  if (ad <= q.normal * w) return "normal";
  if (ad <= q.bad * w) return "bad";
  return "critical";
}

/** For the forgiving phase: a "critical" drop is nudged back onto the tower as a "bad" one. */
export function nudgeOffset(dx: number, w: number, topW: number): number {
  const limit = BALANCE.quality.bad * Math.min(w, topW) * 0.95;
  return Math.sign(dx || 1) * limit;
}
