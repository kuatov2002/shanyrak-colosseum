// Which room comes next. Weighted by rarity from a seeded stream; never three of a kind in a row;
// a dormitory at least every 6 floors (students are the heart of the campus).

import { BALANCE } from "../config/balance";
import type { Rng } from "../core/rng";
import { ROOMS, type RoomId } from "../meta/rooms";

export interface DeckContext {
  pool: RoomId[];
  history: RoomId[];
  rareLevel: number;
  facultyMode: boolean;
  hasFaculty: boolean;
  nauryzEvent: boolean;
  forceFaculty: boolean;
  boost?: Partial<Record<RoomId, number>>;
}

export function drawRoom(rng: Rng, ctx: DeckContext): RoomId {
  if (ctx.forceFaculty && ctx.hasFaculty) return "faculty";
  const last = ctx.history.slice(-2);
  const sinceDorm = (() => {
    const i = ctx.history.lastIndexOf("dorm");
    return i < 0 ? ctx.history.length : ctx.history.length - 1 - i;
  })();
  if (sinceDorm >= 6 && ctx.pool.includes("dorm")) return "dorm";

  const pool = ctx.pool.filter((r) => {
    if (r === "faculty" && !ctx.hasFaculty) return false;
    if (last.length === 2 && last[0] === r && last[1] === r) return false;
    return true;
  });
  if (ctx.nauryzEvent && !pool.includes("nauryz")) pool.push("nauryz");

  return rng.weighted(pool, (r) => {
    const rarity = ROOMS[r].rarity;
    let w: number = BALANCE.rarityWeight[rarity];
    if (rarity !== "common" && rarity !== "uncommon") w *= 1 + BALANCE.rareUpgradeK * ctx.rareLevel;
    if (r === "faculty" && ctx.facultyMode) w *= 2.5;
    if (r === "nauryz" && ctx.nauryzEvent) w = 6;
    if (r === "dorm") w *= 1.3;
    w *= ctx.boost?.[r] ?? 1;
    return w;
  });
}
