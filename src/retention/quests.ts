// Quest engine shared by daily and weekly tasks, plus achievements. Quests listen to "metrics"
// produced at the end of each round (and a few meta actions).

import type { QuestProgress, SaveData } from "../core/save";
import type { Materials } from "../core/save";
import { PLAYABLE_ROOMS } from "../meta/rooms";

export type Metric =
  | "maxHeight"
  | "perfectStreak"
  | "students"
  | "chaiDorm"
  | "bonuses"
  | "rounds"
  | "facultyRounds"
  | "rareRoom"
  | "typesInTower"
  | "dailyRank";

export interface QuestReward {
  shai?: number;
  materials?: Partial<Materials>;
  season?: number;
}

export interface QuestDef {
  id: string;
  title: string;
  metric: Metric;
  target: number;
  /** "max": best single value counts; "sum": values accumulate. */
  mode: "max" | "sum";
  reward: QuestReward;
}

export const DAILY_QUESTS: QuestDef[] = [
  { id: "d_height20", title: "Построить башню высотой 20 этажей", metric: "maxHeight", target: 20, mode: "max", reward: { shai: 80, season: 40 } },
  { id: "d_perfect5", title: "Сделать 5 идеальных укладок подряд", metric: "perfectStreak", target: 5, mode: "max", reward: { shai: 60, season: 30 } },
  { id: "d_students100", title: "Заселить 100 студентов", metric: "students", target: 100, mode: "sum", reward: { shai: 60, materials: { brick: 1 }, season: 30 } },
  { id: "d_chaidorm", title: "Поставить чайхану рядом с общагой", metric: "chaiDorm", target: 1, mode: "sum", reward: { shai: 40, materials: { felt: 1 }, season: 20 } },
  { id: "d_bonus3", title: "Использовать 3 бонуса", metric: "bonuses", target: 3, mode: "sum", reward: { shai: 50, season: 25 } },
];

export const DAILY_ALL_BONUS: QuestReward = { shai: 60, materials: { thread: 1 }, season: 60 };

export const WEEKLY_QUESTS: QuestDef[] = [
  { id: "w_rounds15", title: "Сыграть 15 раундов", metric: "rounds", target: 15, mode: "sum", reward: { shai: 300, materials: { brick: 3 }, season: 120 } },
  { id: "w_war", title: "Поучаствовать в войне факультетов (3 раунда)", metric: "facultyRounds", target: 3, mode: "sum", reward: { shai: 200, materials: { felt: 2 }, season: 100 } },
  { id: "w_rare", title: "Открыть или поставить редкую комнату", metric: "rareRoom", target: 1, mode: "sum", reward: { shai: 150, materials: { thread: 2 }, season: 80 } },
  { id: "w_types8", title: "Построить башню с 8 разными типами комнат", metric: "typesInTower", target: 8, mode: "max", reward: { shai: 250, materials: { thread: 2 }, season: 120 } },
  { id: "w_daily", title: "Войти в топ-10 ежедневной башни", metric: "dailyRank", target: 1, mode: "sum", reward: { shai: 200, materials: { brick: 2, felt: 2 }, season: 100 } },
];

export function freshProgress(defs: QuestDef[]): QuestProgress[] {
  return defs.map((q) => ({ id: q.id, progress: 0, claimed: false }));
}

/** Apply metric values to a quest list; returns ids that just became complete. */
export function applyMetrics(defs: QuestDef[], list: QuestProgress[], metrics: Partial<Record<Metric, number>>): string[] {
  const done: string[] = [];
  for (const def of defs) {
    const v = metrics[def.metric];
    if (v === undefined || v <= 0) continue;
    let p = list.find((x) => x.id === def.id);
    if (!p) {
      p = { id: def.id, progress: 0, claimed: false };
      list.push(p);
    }
    const before = p.progress;
    p.progress = def.mode === "max" ? Math.max(p.progress, v) : p.progress + v;
    p.progress = Math.min(p.progress, def.target);
    if (before < def.target && p.progress >= def.target) done.push(def.id);
  }
  return done;
}

export function isComplete(def: QuestDef, p: QuestProgress | undefined): boolean {
  return !!p && p.progress >= def.target;
}

// ── Achievements ───────────────────────────────────────────────────────────

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  reward: QuestReward & { cosmetic?: string };
  check(d: SaveData): boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "a_first", title: "Первая башня", desc: "Завершите первый раунд шаныраком.", icon: "🏛️", reward: { shai: 50 }, check: (d) => d.stats.shanyraks >= 1 },
  { id: "a_perfect10", title: "Рука мастера", desc: "10 идеальных укладок подряд.", icon: "🎯", reward: { shai: 150, materials: { thread: 1 } }, check: (d) => d.stats.bestPerfectStreak >= 10 },
  { id: "a_students1000", title: "Тысяча студентов", desc: "Заселите 1000 студентов за всё время.", icon: "🎓", reward: { shai: 200, cosmetic: "stu_grad" }, check: (d) => d.stats.totalStudents >= 1000 },
  { id: "a_height50", title: "Выше облаков", desc: "Башня высотой 50 этажей.", icon: "☁️", reward: { shai: 400, materials: { thread: 3 } }, check: (d) => d.stats.bestHeight >= 50 },
  { id: "a_chaidorm", title: "Чай для общаги", desc: "Поставьте чайхану рядом с общагой.", icon: "🫖", reward: { shai: 40 }, check: (d) => d.stats.chaiDorm },
  { id: "a_deadline", title: "Дедлайн не страшен", desc: "Переживите дедлайн-тряску.", icon: "⏰", reward: { shai: 80 }, check: (d) => d.stats.deadlinesSurvived >= 1 },
  { id: "a_allrooms", title: "Полный кампус", desc: "Откройте все типы комнат.", icon: "🗝️", reward: { shai: 500, materials: { thread: 3, felt: 3 } }, check: (d) => PLAYABLE_ROOMS.filter((r) => r !== "faculty").every((r) => d.unlockedRooms.includes(r)) },
  { id: "a_legend", title: "Легенда факультета", desc: "Принесите факультету 1000 очков.", icon: "🚩", reward: { shai: 300, materials: { felt: 3 } }, check: (d) => d.stats.facultyPoints >= 1000 },
];
