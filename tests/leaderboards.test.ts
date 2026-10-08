import { describe, expect, it } from "vitest";
import { MemorySaveStore } from "../src/core/save";
import { Store } from "../src/core/state";
import type { Backend, BoardResult } from "../src/platform/backend";
import { FACULTIES, FACULTY_IDS } from "../src/social/faculties";
import { Leaderboards } from "../src/social/leaderboards";

/** A fake online backend that records board reads and how many ran at once. */
function fakeBackend(scores: Record<string, number[]>) {
  const calls: string[] = [];
  let running = 0;
  let maxRunning = 0;
  const backend: Backend = {
    kind: "idos",
    online: true,
    userId: "me",
    titleId: "TEST",
    connect: async () => ({ ok: true }),
    submitScore: async () => ({ ok: true }),
    setName: async () => {},
    linkWallet: async () => ({ ok: true }),
    logEvent: () => {},
    async getBoard(id: string): Promise<BoardResult> {
      calls.push(id);
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 2));
      running--;
      const rows = (scores[id] ?? []).map((score, i) => ({ userId: `u${i}`, name: `P${i}`, score, rank: i + 1 }));
      return { ok: true, rows, total: rows.length };
    },
  } as Backend;
  return { backend, calls, maxRunning: () => maxRunning };
}

describe("leaderboard cache", () => {
  it("reads the five faculty boards one after another and sums them", async () => {
    const scores = Object.fromEntries(FACULTY_IDS.map((id, i) => [FACULTIES[id].boardId, [100 * (i + 1), 10]]));
    const fake = fakeBackend(scores);
    const lb = new Leaderboards(new Store(new MemorySaveStore()), () => fake.backend);
    const { standings, online } = await lb.faculties();
    expect(online).toBe(true);
    expect(fake.calls).toHaveLength(5);
    expect(fake.maxRunning()).toBe(1);
    for (const s of standings) expect(s.real).toBe(scores[FACULTIES[s.id].boardId].reduce((a, b) => a + b, 0));
  });

  it("answers from the cache instantly and skips fresh boards on prefetch", async () => {
    const fake = fakeBackend({ daily_tower: [500, 300], weekly_score: [9000], best_height: [40] });
    const lb = new Leaderboards(new Store(new MemorySaveStore()), () => fake.backend);
    expect(lb.cachedBoard("daily_tower")).toBeNull();
    const fresh = await lb.board("daily_tower");
    expect(fresh.source).toBe("online");
    expect(lb.isFresh("daily_tower")).toBe(true);
    const cached = lb.cachedBoard("daily_tower");
    expect(cached?.rows.filter((r) => !r.demo).map((r) => r.score)).toEqual([500, 300]);
    const before = fake.calls.length;
    await lb.prefetch();
    // daily_tower is fresh: only the 5 faculty boards + weekly + best are read
    expect(fake.calls.length - before).toBe(7);
    expect(fake.calls.slice(before)).not.toContain("daily_tower");
    expect(lb.isFresh("faculties")).toBe(true);
  });
});
