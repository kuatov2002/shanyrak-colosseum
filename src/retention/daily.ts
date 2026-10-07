// Daily layer: daily quests reset at 00:00 UTC, the Daily Tower attempt counter, and the 7-day
// login streak (3 days → $SHAI, 5 days → rare ornament, 7 days → rare room or flag).

import type { Store } from "../core/state";
import { dayKey, prevDayKey } from "../core/time";
import type { QuestReward } from "./quests";
import { DAILY_QUESTS, freshProgress } from "./quests";

export function ensureDaily(store: Store, now = new Date()): void {
  const today = dayKey(now);
  if (store.data.daily.day === today && store.data.daily.quests.length) return;
  store.mutate((d) => {
    d.daily = { day: today, quests: freshProgress(DAILY_QUESTS), best: 0, attempts: 0, allClaimed: false };
  });
}

export interface StreakReward {
  day: number;
  label: string;
  icon: string;
  reward: QuestReward & { cosmetic?: string; unlockRoom?: "nauryz"; fallbackCosmetic?: string };
}

export const STREAK_REWARDS: StreakReward[] = [
  { day: 1, label: "30 $SHAI", icon: "🪙", reward: { shai: 30 } },
  { day: 2, label: "2 кирпича", icon: "🧱", reward: { materials: { brick: 2 } } },
  { day: 3, label: "120 $SHAI", icon: "💰", reward: { shai: 120 } },
  { day: 4, label: "2 войлока", icon: "🟫", reward: { materials: { felt: 2 } } },
  { day: 5, label: "Редкий орнамент «Тұмар»", icon: "🔺", reward: { cosmetic: "orn_tumar", fallbackCosmetic: "", shai: 50 } },
  { day: 6, label: "2 нити + 60 $SHAI", icon: "🧵", reward: { materials: { thread: 2 }, shai: 60 } },
  { day: 7, label: "Наурыз-площадь или флаг", icon: "🌷", reward: { unlockRoom: "nauryz", fallbackCosmetic: "flag_campus", shai: 150 } },
];

/** Update the streak on app open. Returns the streak day that can be claimed today (or 0). */
export function touchStreak(store: Store, now = new Date()): number {
  const today = dayKey(now);
  const s = store.data.streak;
  if (s.lastDay === today) return s.claimedDay < s.count ? s.count : 0;
  store.mutate((d) => {
    const continued = d.streak.lastDay === prevDayKey(today);
    const next = continued ? (d.streak.count % 7) + 1 : 1;
    d.streak = { lastDay: today, count: next, claimedDay: 0 };
  });
  return store.data.streak.count;
}

export function streakClaimable(store: Store): number {
  const s = store.data.streak;
  return s.lastDay === dayKey() && s.claimedDay < s.count ? s.count : 0;
}
