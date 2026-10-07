import { describe, expect, it } from "vitest";
import { Round } from "../src/gameplay/round";
import type { RoundConfig, RoundEvent, RoundResult } from "../src/gameplay/types";
import { DEFAULT_EQUIPPED } from "../src/meta/collection";
import { START_ROOMS } from "../src/meta/rooms";
import { emptyUpgrades } from "../src/meta/upgrades";
import { evaluateLanding } from "../src/gameplay/block";
import { dailySeed, Rng } from "../src/core/rng";
import { MISSIONS } from "../src/gameplay/modes";

function cfg(over: Partial<RoundConfig> = {}): RoundConfig {
  return {
    mode: "quick",
    seed: 12345,
    faculty: "tulpar",
    upgrades: emptyUpgrades(),
    unlockedRooms: [...START_ROOMS],
    cosmetics: { ...DEFAULT_EQUIPPED },
    boosterShields: 0,
    ...over,
  };
}

/** Bot: drops when the crane is within `aim` units of the tower top; picks the first bonus. */
function play(round: Round, aim: number, maxSeconds = 600): RoundResult | null {
  const dt = 1 / 120;
  let result: RoundResult | null = null;
  round.events.on((e: RoundEvent) => {
    if (e.k === "end") result = e.result;
  });
  for (let i = 0; i < maxSeconds * 120 && !result; i++) {
    if (round.phase === "bonus" && round.offer) round.pickBonus(round.offer[0]);
    if (round.phase === "swing") {
      const top = round.tower.visualX(round.tower.top);
      if (Math.abs(round.crane.x - top) <= aim) round.drop();
    }
    round.update(dt);
  }
  return result;
}

describe("landing evaluation", () => {
  it("grades by offset", () => {
    expect(evaluateLanding({ dx: 2, w: 190, topW: 190, gentle: false, balcony: false })).toBe("perfect");
    expect(evaluateLanding({ dx: 18, w: 190, topW: 190, gentle: false, balcony: false })).toBe("good");
    expect(evaluateLanding({ dx: 40, w: 190, topW: 190, gentle: false, balcony: false })).toBe("normal");
    expect(evaluateLanding({ dx: 70, w: 190, topW: 190, gentle: false, balcony: false })).toBe("bad");
    expect(evaluateLanding({ dx: 120, w: 190, topW: 190, gentle: false, balcony: false })).toBe("critical");
    expect(evaluateLanding({ dx: 14, w: 190, topW: 190, gentle: true, balcony: false })).toBe("perfect");
  });
});

describe("round simulation", () => {
  it("tutorial finishes with a shanyrak after 5 rooms", () => {
    const r = new Round(cfg({ mode: "tutorial" }));
    const res = play(r, 4, 120);
    expect(res).not.toBeNull();
    expect(res!.height).toBe(5);
    expect(res!.reason).toBe("goal");
    expect(res!.students).toBeGreaterThan(10);
    expect(res!.chaiDorm).toBe(true);
  });

  it("an accurate bot builds high in quick mode and gets crowned at the goal", () => {
    const r = new Round(cfg());
    const res = play(r, 3);
    expect(res).not.toBeNull();
    expect(res!.height).toBeGreaterThanOrEqual(20);
    expect(res!.perfects).toBeGreaterThan(10);
    expect(res!.shabyt).toBe(true);
    expect(res!.bonusesUsed).toBeGreaterThan(0);
  });

  it("a sloppy bot loses the tower but the round still ends cleanly", () => {
    const r = new Round(cfg({ mode: "endless" }));
    const res = play(r, 75);
    expect(res).not.toBeNull();
    expect(["collapse", "lives"]).toContain(res!.reason);
    expect(res!.height).toBeGreaterThanOrEqual(1);
  });

  it("daily tower gives the same rooms for the same seed regardless of skill", () => {
    const seed = dailySeed("2026-10-07");
    const a = new Round(cfg({ mode: "daily", seed }));
    const b = new Round(cfg({ mode: "daily", seed, upgrades: { ...emptyUpgrades(), rareChance: 0 } }));
    play(a, 3, 60);
    play(b, 40, 60);
    const n = Math.min(a.history.length, b.history.length, 8);
    expect(n).toBeGreaterThan(3);
    expect(a.history.slice(0, n)).toEqual(b.history.slice(0, n));
  });

  it("every campaign mission is winnable by a precise bot", () => {
    for (const m of MISSIONS) {
      const r = new Round(cfg({ mode: "campaign", missionIndex: m.index }));
      const res = play(r, 2.5, 900);
      expect(res, m.title).not.toBeNull();
      expect(res!.missionSuccess, m.title).toBe(true);
    }
  });
});

describe("rng", () => {
  it("is deterministic", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});
