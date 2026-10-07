// After a round: turn the raw result into rewards and progress — $SHAI, materials, stats, quests,
// season XP, faculty war, campaign stars, achievements and the occasional cosmetic find.

import { BALANCE } from "../config/balance";
import type { Store } from "../core/state";
import { grant } from "../economy/shai";
import { MISSIONS } from "../gameplay/modes";
import type { RoundResult } from "../gameplay/types";
import { ACHIEVEMENTS, applyMetrics, DAILY_ALL_BONUS, DAILY_QUESTS, WEEKLY_QUESTS, isComplete, type AchievementDef, type QuestReward } from "../retention/quests";
import { addSeasonXp, seasonTier } from "../retention/season";
import { STREAK_REWARDS } from "../retention/daily";
import { COSMETICS, COSMETIC_BY_ID, type Cosmetic } from "./collection";
import { ROOMS } from "./rooms";

export interface RewardLine {
  icon: string;
  label: string;
  value: string;
}

export interface RoundSummary {
  result: RoundResult;
  shai: number;
  lines: RewardLine[];
  questsDone: string[];
  achievements: AchievementDef[];
  newBestHeight: boolean;
  found: Cosmetic | null;
  missionReward: string | null;
  seasonTierBefore: number;
  seasonTierAfter: number;
  firstDaily: boolean;
}

export function applyRoundResult(store: Store, r: RoundResult): RoundSummary {
  const d = store.data;
  const lines: RewardLine[] = [];
  const firstDaily = r.mode === "daily" && d.daily.attempts === 0;

  // $SHAI with multipliers
  let shai = r.shai;
  let mult = 1 + BALANCE.shai.perUpgrade * d.upgrades.shaiBoost;
  if (r.reason === "crown") mult *= BALANCE.shai.crownBonusK;
  if (firstDaily) mult *= BALANCE.shai.dailyFirstK;
  shai = Math.round(shai * mult);
  if (r.mode === "tutorial") shai = Math.max(shai, 40);
  lines.push({ icon: "🪙", label: "$SHAI", value: `+${shai}` });
  if (r.reason === "crown") lines.push({ icon: "🏛️", label: "Бонус за шанырак", value: "×1.25" });
  if (firstDaily) lines.push({ icon: "📅", label: "Первая ежедневная башня", value: "×1.5" });
  const mats = r.materials;
  if (mats.brick) lines.push({ icon: "🧱", label: "Кирпич", value: `+${mats.brick}` });
  if (mats.felt) lines.push({ icon: "🟫", label: "Войлок", value: `+${mats.felt}` });
  if (mats.thread) lines.push({ icon: "🧵", label: "Нить орнамента", value: `+${mats.thread}` });
  if (r.seasonPts) lines.push({ icon: "⭐", label: "Очки сезона", value: `+${r.seasonPts}` });
  if (r.facultyPts && d.player.faculty) lines.push({ icon: "🚩", label: "Очки факультета", value: `+${r.facultyPts}` });
  grant(store, shai, mats);

  const newBestHeight = r.height > d.stats.bestHeight && r.mode !== "tutorial";
  const seasonTierBefore = seasonTier(d.season.xp);

  store.mutate((s) => {
    const st = s.stats;
    if (r.mode !== "tutorial") st.rounds++;
    st.bestHeight = Math.max(st.bestHeight, r.height);
    st.bestScore = Math.max(st.bestScore, r.score);
    st.totalStudents += r.students;
    st.totalPerfects += r.perfects;
    st.bestPerfectStreak = Math.max(st.bestPerfectStreak, r.bestPerfectStreak);
    if (r.reason !== "quit") st.shanyraks++;
    st.deadlinesSurvived += r.deadlinesSurvived;
    st.bonusesUsed += r.bonusesUsed;
    st.facultyPoints += r.facultyPts;
    for (const t of r.typesPlaced) if (!st.placedTypes.includes(t)) st.placedTypes.push(t);
    if (r.chaiDorm) st.chaiDorm = true;
    if (r.mode === "tutorial") s.tutorialDone = true;
    if (r.mode === "daily") {
      s.daily.attempts++;
      s.daily.best = Math.max(s.daily.best, r.score);
    }
    s.weekly.facultyContrib += r.facultyPts;
    if (s.boosters.shield > 0 && r.mode !== "tutorial") s.boosters.shield = 0;
  });

  // Quests
  const questsDone: string[] = [];
  if (r.mode !== "tutorial") {
    store.mutate((s) => {
      const dDone = applyMetrics(DAILY_QUESTS, s.daily.quests, {
        maxHeight: r.maxHeight,
        perfectStreak: r.bestPerfectStreak,
        students: r.students,
        chaiDorm: r.chaiDorm ? 1 : 0,
        bonuses: r.bonusesUsed,
      });
      const wDone = applyMetrics(WEEKLY_QUESTS, s.weekly.quests, {
        rounds: 1,
        facultyRounds: r.mode === "faculty" ? 1 : 0,
        rareRoom: r.rarePlaced ? 1 : 0,
        typesInTower: r.typesPlaced.filter((t) => t !== "foundation").length,
      });
      for (const id of [...dDone, ...wDone]) {
        const q = [...DAILY_QUESTS, ...WEEKLY_QUESTS].find((x) => x.id === id);
        if (q) questsDone.push(q.title);
      }
    });
  }

  // Season
  addSeasonXp(store, r.seasonPts);
  const seasonTierAfter = seasonTier(store.data.season.xp);

  // Campaign
  let missionReward: string | null = null;
  if (r.mode === "campaign" && r.missionIndex !== undefined && r.missionSuccess) {
    const key = String(r.missionIndex);
    const firstClear = !store.data.campaign.stars[key];
    store.mutate((s) => {
      s.campaign.stars[key] = Math.max(s.campaign.stars[key] ?? 0, r.missionStars);
    });
    if (firstClear) {
      const m = MISSIONS[r.missionIndex];
      grant(store, m.reward.shai, m.reward.materials ?? {});
      const parts = [`+${m.reward.shai} $SHAI`];
      store.mutate((s) => {
        if (m.reward.unlockRoom && !s.unlockedRooms.includes(m.reward.unlockRoom)) {
          s.unlockedRooms.push(m.reward.unlockRoom);
          parts.push(`комната «${ROOMS[m.reward.unlockRoom].name}»`);
        }
        if (m.reward.cosmetic && !s.owned.includes(m.reward.cosmetic)) {
          s.owned.push(m.reward.cosmetic);
          parts.push(`«${COSMETIC_BY_ID[m.reward.cosmetic]?.name}»`);
        }
      });
      if (m.reward.materials) parts.push("материалы");
      missionReward = parts.join(", ");
    }
  }

  // Lucky find
  let found: Cosmetic | null = null;
  if (r.height >= BALANCE.loot.cosmeticDropHeight && r.shabyt && Math.random() < BALANCE.loot.cosmeticDropChance) {
    const pool = COSMETICS.filter((c) => (c.source.kind === "drop" || c.source.kind === "shop") && !store.data.owned.includes(c.id) && c.rarity !== "legendary");
    if (pool.length) {
      found = pool[Math.floor(Math.random() * pool.length)];
      const id = found.id;
      store.mutate((s) => s.owned.push(id));
    }
  }

  const achievements = checkAchievements(store);
  return {
    result: r,
    shai,
    lines,
    questsDone,
    achievements,
    newBestHeight,
    found,
    missionReward,
    seasonTierBefore,
    seasonTierAfter,
    firstDaily,
  };
}

export function checkAchievements(store: Store): AchievementDef[] {
  const unlocked: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (store.data.achievements[a.id]) continue;
    if (!a.check(store.data)) continue;
    unlocked.push(a);
    grant(store, a.reward.shai ?? 0, a.reward.materials ?? {});
    store.mutate((s) => {
      s.achievements[a.id] = Date.now();
      if (a.reward.cosmetic && !s.owned.includes(a.reward.cosmetic)) s.owned.push(a.reward.cosmetic);
    });
  }
  return unlocked;
}

export function grantQuestReward(store: Store, reward: QuestReward): void {
  grant(store, reward.shai ?? 0, reward.materials ?? {});
  addSeasonXp(store, reward.season ?? 0);
}

export function claimQuest(store: Store, kind: "daily" | "weekly", id: string): boolean {
  const defs = kind === "daily" ? DAILY_QUESTS : WEEKLY_QUESTS;
  const def = defs.find((q) => q.id === id);
  const list = kind === "daily" ? store.data.daily.quests : store.data.weekly.quests;
  const p = list.find((q) => q.id === id);
  if (!def || !p || p.claimed || !isComplete(def, p)) return false;
  store.mutate(() => {
    p.claimed = true;
  });
  grantQuestReward(store, def.reward);
  return true;
}

export function claimDailyAllBonus(store: Store): boolean {
  const d = store.data.daily;
  if (d.allClaimed || !DAILY_QUESTS.every((q) => d.quests.find((p) => p.id === q.id)?.claimed)) return false;
  store.mutate((s) => {
    s.daily.allClaimed = true;
  });
  grantQuestReward(store, DAILY_ALL_BONUS);
  return true;
}

export function claimStreak(store: Store): string | null {
  const s = store.data.streak;
  if (s.claimedDay >= s.count || s.count === 0) return null;
  const row = STREAK_REWARDS[s.count - 1];
  const r = row.reward;
  grant(store, r.shai ?? 0, r.materials ?? {});
  let label = row.label;
  store.mutate((d) => {
    d.streak.claimedDay = d.streak.count;
    if (r.cosmetic && !d.owned.includes(r.cosmetic)) d.owned.push(r.cosmetic);
    if (r.unlockRoom) {
      if (!d.unlockedRooms.includes(r.unlockRoom)) {
        d.unlockedRooms.push(r.unlockRoom);
        label = "Наурыз-площадь открыта!";
      } else if (d.player.faculty) {
        const flag = `flag_${d.player.faculty}`;
        if (!d.owned.includes(flag)) d.owned.push(flag);
        label = "Флаг вашего факультета!";
      }
    }
  });
  return label;
}

/** Remember the rooms of the finished tower for the menu backdrop. */
export function rememberTower(store: Store, rooms: string[]): void {
  store.mutate((s) => {
    s.lastTower = rooms.filter((r) => r !== "foundation" && r in ROOMS) as typeof s.lastTower;
  });
}
