// Season pass "Сезон 1: Алатау". Free track for everyone; the premium track unlocks with in-game
// $SHAI (never real money). Rewards are cosmetics, materials, $SHAI and badges.

import type { Store } from "../core/state";
import { grant } from "../economy/shai";
import type { Materials } from "../core/save";

export const SEASON = {
  id: "S1-alatau",
  name: "Сезон 1 · Алатау",
  tierXp: 150,
  ends: "2026-11-30T00:00:00Z",
};

export interface SeasonReward {
  shai?: number;
  materials?: Partial<Materials>;
  cosmetic?: string;
  label: string;
  icon: string;
}

const S = (shai: number): SeasonReward => ({ shai, label: `${shai} $SHAI`, icon: "🪙" });
const M = (m: Partial<Materials>, label: string, icon: string): SeasonReward => ({ materials: m, label, icon });
const C = (cosmetic: string, label: string, icon: string): SeasonReward => ({ cosmetic, label, icon });

export const SEASON_TIERS: { tier: number; free: SeasonReward; premium: SeasonReward }[] = [
  { tier: 1, free: S(50), premium: M({ brick: 3 }, "3 кирпича", "🧱") },
  { tier: 2, free: M({ brick: 2 }, "2 кирпича", "🧱"), premium: S(80) },
  { tier: 3, free: S(60), premium: C("fx_stars", "Эффект «Звёзды»", "✨") },
  { tier: 4, free: M({ felt: 1 }, "Войлок", "🟫"), premium: M({ thread: 2 }, "2 нити", "🧵") },
  { tier: 5, free: C("bg_lake", "Фон «Горное озеро»", "🏞️"), premium: S(150) },
  { tier: 6, free: S(80), premium: M({ felt: 3 }, "3 войлока", "🟫") },
  { tier: 7, free: M({ thread: 1 }, "Нить", "🧵"), premium: C("mus_session", "Тема «Ночь сессии»", "🎵") },
  { tier: 8, free: S(100), premium: M({ brick: 5 }, "5 кирпичей", "🧱") },
  { tier: 9, free: M({ brick: 3 }, "3 кирпича", "🧱"), premium: C("sh_lights", "Шанырак «Огни Наурыза»", "🏮") },
  { tier: 10, free: S(150), premium: C("fac_night", "Фасад «Неон сессии»", "🌃") },
  { tier: 11, free: M({ felt: 2 }, "2 войлока", "🟫"), premium: S(200) },
  { tier: 12, free: S(120), premium: M({ thread: 3 }, "3 нити", "🧵") },
  { tier: 13, free: M({ thread: 1, brick: 2 }, "Нить + 2 кирпича", "🧵"), premium: S(220) },
  { tier: 14, free: S(150), premium: M({ felt: 4 }, "4 войлока", "🟫") },
  { tier: 15, free: M({ thread: 2 }, "2 нити", "🧵"), premium: C("fac_gold", "Фасад «Алтын»", "👑") },
  { tier: 16, free: S(180), premium: M({ brick: 6, thread: 2 }, "6 кирпичей + 2 нити", "🧱") },
  { tier: 17, free: M({ felt: 3 }, "3 войлока", "🟫"), premium: S(300) },
  { tier: 18, free: S(200), premium: M({ thread: 4 }, "4 нити", "🧵") },
  { tier: 19, free: M({ brick: 4, felt: 2 }, "Стройнабор", "🧰"), premium: S(400) },
  { tier: 20, free: S(400), premium: M({ thread: 5, felt: 5, brick: 5 }, "Сундук мастера", "🎁") },
];

export function ensureSeason(store: Store): void {
  if (store.data.season.id === SEASON.id) return;
  store.mutate((d) => {
    d.season = { id: SEASON.id, xp: 0, premium: false, claimedFree: [], claimedPremium: [] };
  });
}

export function seasonTier(xp: number): number {
  return Math.min(SEASON_TIERS.length, Math.floor(xp / SEASON.tierXp));
}

export function addSeasonXp(store: Store, xp: number): void {
  if (xp <= 0) return;
  store.mutate((d) => {
    d.season.xp += Math.round(xp);
  });
}

export function claimSeason(store: Store, tier: number, track: "free" | "premium"): boolean {
  const d = store.data;
  const row = SEASON_TIERS.find((t) => t.tier === tier);
  if (!row || seasonTier(d.season.xp) < tier) return false;
  if (track === "premium" && !d.season.premium) return false;
  const claimed = track === "free" ? d.season.claimedFree : d.season.claimedPremium;
  if (claimed.includes(tier)) return false;
  const r = track === "free" ? row.free : row.premium;
  grant(store, r.shai ?? 0, r.materials ?? {});
  store.mutate((s) => {
    (track === "free" ? s.season.claimedFree : s.season.claimedPremium).push(tier);
    if (r.cosmetic && !s.owned.includes(r.cosmetic)) s.owned.push(r.cosmetic);
  });
  return true;
}

export function unclaimedSeasonCount(store: Store): number {
  const d = store.data;
  const tier = seasonTier(d.season.xp);
  let n = 0;
  for (const row of SEASON_TIERS) {
    if (row.tier > tier) break;
    if (!d.season.claimedFree.includes(row.tier)) n++;
    if (d.season.premium && !d.season.claimedPremium.includes(row.tier)) n++;
  }
  return n;
}
