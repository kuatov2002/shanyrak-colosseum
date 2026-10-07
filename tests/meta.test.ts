import { describe, expect, it } from "vitest";
import { defaultSave, MemorySaveStore, migrate, SAVE_VERSION } from "../src/core/save";
import { Store } from "../src/core/state";
import { prevDayKey, weekKey } from "../src/core/time";
import { craft, RECIPES } from "../src/economy/crafting";
import { buyUpgrade } from "../src/economy/shop";
import { applyRoundResult, claimQuest, claimStreak } from "../src/meta/progression";
import { ensureDaily, touchStreak } from "../src/retention/daily";
import { claimSeason, ensureSeason, SEASON } from "../src/retention/season";
import { weeklyStandings } from "../src/social/faculties";
import type { RoundResult } from "../src/gameplay/types";

function result(over: Partial<RoundResult> = {}): RoundResult {
  return {
    mode: "quick",
    missionSuccess: false,
    missionStars: 0,
    reason: "crown",
    height: 22,
    maxHeight: 22,
    score: 1500,
    students: 120,
    perfects: 9,
    bestCombo: 6,
    bestPerfectStreak: 6,
    shai: 80,
    materials: { brick: 1, felt: 0, thread: 0 },
    seasonPts: 70,
    facultyPts: 20,
    innovation: 0,
    typesPlaced: ["foundation", "dorm", "chaikhana", "library", "gym", "garden", "canteen", "hall", "coworking"],
    chaiDorm: true,
    deadlinesSurvived: 1,
    bonusesUsed: 3,
    rarePlaced: true,
    shabyt: true,
    livesLost: 0,
    durationSec: 120,
    seed: 1,
    ...over,
  };
}

describe("save", () => {
  it("migrates a v1 save and keeps player data", () => {
    const v1 = { ...defaultSave(), version: 1, shai: 777 } as Record<string, unknown>;
    delete v1.boosters;
    (v1.settings as Record<string, unknown>).online = undefined;
    const m = migrate(v1);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.shai).toBe(777);
    expect(m.boosters.shield).toBe(0);
  });

  it("survives garbage", () => {
    expect(migrate("nope").version).toBe(SAVE_VERSION);
    expect(migrate(null).shai).toBe(0);
  });
});

describe("economy & retention", () => {
  it("first upgrade is affordable after a few rounds, quests pay out", () => {
    const store = new Store(new MemorySaveStore());
    ensureDaily(store);
    ensureSeason(store);
    const s1 = applyRoundResult(store, result());
    expect(s1.shai).toBeGreaterThanOrEqual(100); // crown bonus applied
    expect(s1.questsDone.length).toBeGreaterThanOrEqual(4);
    expect(claimQuest(store, "daily", "d_height20")).toBe(true);
    expect(claimQuest(store, "daily", "d_height20")).toBe(false);
    expect(buyUpgrade(store, "stability")).toBe(true);
    expect(store.data.upgrades.stability).toBe(1);
  });

  it("login streak advances on consecutive days and resets after a gap", () => {
    const store = new Store(new MemorySaveStore());
    const today = new Date("2026-10-08T10:00:00Z");
    store.mutate((d) => (d.streak = { lastDay: prevDayKey("2026-10-08"), count: 2, claimedDay: 2 }));
    expect(touchStreak(store, today)).toBe(3);
    expect(claimStreak(store)).toContain("SHAI");
    const later = new Date("2026-10-11T10:00:00Z");
    expect(touchStreak(store, later)).toBe(1);
  });

  it("season tiers can be claimed once", () => {
    const store = new Store(new MemorySaveStore());
    ensureSeason(store);
    store.mutate((d) => (d.season.xp = SEASON.tierXp * 2));
    expect(claimSeason(store, 1, "free")).toBe(true);
    expect(claimSeason(store, 1, "free")).toBe(false);
    expect(claimSeason(store, 3, "free")).toBe(false);
    expect(claimSeason(store, 1, "premium")).toBe(false);
  });

  it("crafting the Nauryz plaza needs materials", () => {
    const store = new Store(new MemorySaveStore());
    const recipe = RECIPES.find((r) => r.id === "r_nauryz")!;
    expect(craft(store, recipe)).toBe(false);
    store.mutate((d) => {
      d.materials = { brick: 8, felt: 6, thread: 4 };
      d.shai = 300;
    });
    expect(craft(store, recipe)).toBe(true);
    expect(store.data.unlockedRooms).toContain("nauryz");
  });

  it("faculty war is deterministic per week and includes real points", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    const a = weeklyStandings({ tulpar: 500 }, { simulate: true, now });
    const b = weeklyStandings({ tulpar: 500 }, { simulate: true, now });
    expect(a).toEqual(b);
    expect(a.find((s) => s.id === "tulpar")!.real).toBe(500);
    expect(weekKey(now)).toMatch(/^2026-W\d\d$/);
  });
});
