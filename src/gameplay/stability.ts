// Stability ("Устойчивость") — the one meter that decides when the tower gives up.

import { BALANCE } from "../config/balance";
import type { Quality } from "./types";

export interface StabilityContext {
  gentle: boolean;
  session: boolean;
  lean: number;
}

export function stabilityDelta(q: Quality, ctx: StabilityContext): number {
  const s = BALANCE.stability;
  let d: number = { perfect: s.perfect, good: s.good, normal: s.normal, bad: s.bad, critical: s.critical }[q];
  if (d < 0) {
    if (ctx.gentle) d *= s.gentleK;
    if (ctx.session) d *= s.sessionPenaltyK;
  }
  if (ctx.lean > s.leanFree) d -= (ctx.lean - s.leanFree) * s.leanK * (ctx.gentle ? s.gentleK : 1);
  return d;
}

export function startStability(upgradeLevel: number): { value: number; max: number } {
  const s = BALANCE.stability;
  const max = s.max + upgradeLevel * s.perUpgrade;
  return { value: max, max };
}

/** How many top floors fall in a collapse — never the whole campus. */
export function collapseCount(floors: number): number {
  const c = BALANCE.collapse;
  return Math.max(1, Math.min(floors - 2, c.baseFallen + Math.floor(floors / 10) * c.perTenFloors));
}
