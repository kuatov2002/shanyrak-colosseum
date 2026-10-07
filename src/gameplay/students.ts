// Settling students: room base × landing quality × bonuses. Perfect drops fill the windows faster.

import { BALANCE } from "../config/balance";
import { ROOMS, type RoomId } from "../meta/rooms";
import type { Quality } from "./types";

export interface SettleContext {
  magnet: boolean;
  upgradeLevel: number;
  festival: boolean;
}

const QUALITY_K: Record<Quality, number> = {
  perfect: BALANCE.students.perfectK,
  good: BALANCE.students.goodK,
  normal: BALANCE.students.normalK,
  bad: BALANCE.students.badK,
  critical: 0,
};

export function settleStudents(type: RoomId, q: Quality, ctx: SettleContext): number {
  const s = BALANCE.students;
  let n = ROOMS[type].students * QUALITY_K[q];
  if (ctx.magnet) n *= s.magnetK;
  n *= 1 + s.perUpgrade * ctx.upgradeLevel;
  if (ctx.festival) n += s.festivalBonus;
  return Math.round(n);
}

/** Window capacity for drawing (students sit two per window, at most). */
export function windowCount(w: number): number {
  return Math.max(2, Math.min(5, Math.floor((w - 24) / 42)));
}
