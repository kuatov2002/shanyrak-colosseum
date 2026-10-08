// Leaderboards — off-chain only, on iDos server boards (daily_tower, best_height, weekly_score,
// faculty_*) via client.leaderboard.submitScore. No Solana transactions are involved.
// Offline (or while a fresh board is still empty): the player's own local results plus clearly
// labelled demo rivals, so a board is never an unexplained empty list.
// Board calls are rate-limited and go through one spaced queue (IdosBackend), so five faculty
// boards take a few seconds. The last answer of every board is therefore cached on the device:
// screens show it at once and refresh in the background, and boards are prefetched after login.

import type { LocalScore } from "../core/save";
import type { Store } from "../core/state";
import { hashString, Rng } from "../core/rng";
import { dayKey, weekKey } from "../core/time";
import type { RoundResult } from "../gameplay/types";
import type { Backend, BoardRow } from "../platform/backend";
import { FACULTIES, FACULTY_IDS, weeklyStandings, type FacultyId, type FacultyStanding } from "./faculties";

export type BoardId = "daily_tower" | "best_height" | "weekly_score";

export const BOARD_INFO: Record<BoardId, { title: string; unit: string; desc: string }> = {
  daily_tower: { title: "Ежедневная башня", unit: "очков", desc: "Одна башня для всех на сутки. Лучший результат дня." },
  best_height: { title: "Рекорд высоты", unit: "этажей", desc: "Самая высокая башня за всё время." },
  weekly_score: { title: "Неделя кампуса", unit: "очков", desc: "Сумма очков всех раундов за неделю." },
};

export interface Row {
  name: string;
  score: number;
  rank: number;
  me: boolean;
  demo: boolean;
  sub?: string;
}

export interface BoardView {
  rows: Row[];
  source: "online" | "offline";
  note: string;
  myRank: number | null;
}

const NAMES = ["Айгерим", "Данияр", "Асель", "Ерасыл", "Мадина", "Тимур", "Алия", "Арман", "Жанна", "Бекзат", "Дана", "Санжар", "Камила", "Ержан", "Томирис", "Нурлан", "Аружан", "Ильяс"];

function demoRows(board: BoardId, key: string, count: number): Row[] {
  const rng = new Rng(hashString(`${board}:${key}`));
  const base = board === "best_height" ? 34 : board === "weekly_score" ? 9000 : 1500;
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    const k = Math.pow(0.86, i) * rng.range(0.85, 1.1);
    const name = `${NAMES[(i * 5 + rng.int(0, NAMES.length - 1)) % NAMES.length]}`;
    const faculty = FACULTY_IDS[rng.int(0, FACULTY_IDS.length - 1)];
    rows.push({
      name,
      score: Math.max(1, Math.round(base * k)),
      rank: 0,
      me: false,
      demo: true,
      sub: `${FACULTIES[faculty].name} · демо`,
    });
  }
  return rows;
}

function rankRows(rows: Row[]): Row[] {
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export function shortAddress(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

interface CachedBoard {
  period: string;
  at: number;
  rows: BoardRow[];
  total: number;
}

const CACHE_KEY = "shanyrak.boards.v1";
/** A cached board younger than this is not refetched. */
const FRESH_MS = 90_000;

function periodOf(boardId: string): string {
  if (boardId === "daily_tower") return dayKey();
  if (boardId === "best_height") return "all";
  return weekKey(); // weekly_score and faculty_* boards reset weekly
}

/** Last server answer per board, kept in localStorage (best-effort: private mode just skips it). */
class BoardCache {
  private data: Record<string, CachedBoard> = {};
  constructor() {
    try {
      this.data = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, CachedBoard>;
    } catch {
      this.data = {};
    }
  }
  get(boardId: string): CachedBoard | null {
    const c = this.data[boardId];
    return c && c.period === periodOf(boardId) ? c : null;
  }
  fresh(boardId: string): boolean {
    const c = this.get(boardId);
    return !!c && Date.now() - c.at < FRESH_MS;
  }
  set(boardId: string, rows: BoardRow[], total: number): void {
    this.data[boardId] = { period: periodOf(boardId), at: Date.now(), rows: rows.slice(0, 100), total };
    this.save();
  }
  /** Keep the rows but refetch on the next look (after the player submitted a score). */
  expire(boardId: string): void {
    const c = this.data[boardId];
    if (c) c.at = 0;
    this.save();
  }
  private save(): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage full or blocked */
    }
  }
}

const ALL_BOARDS: BoardId[] = ["daily_tower", "weekly_score", "best_height"];

export class Leaderboards {
  private cache = new BoardCache();

  constructor(
    private store: Store,
    private backend: () => Backend,
  ) {}

  /** Record locally and submit to iDos. Returns the daily rank if it could be determined. */
  async submitRound(r: RoundResult): Promise<void> {
    const d = this.store.data;
    const entry: LocalScore = {
      board: r.mode,
      score: r.score,
      height: r.height,
      at: Date.now(),
      day: dayKey(),
      week: weekKey(),
    };
    this.store.mutate((s) => {
      s.scores.unshift(entry);
      if (s.scores.length > 120) s.scores.length = 120;
    });
    const b = this.backend();
    if (!b.online) return;
    const jobs: Promise<unknown>[] = [b.submitScore("weekly_score", r.score)];
    if (r.height > 0) jobs.push(b.submitScore("best_height", r.height));
    if (r.mode === "daily") jobs.push(b.submitScore("daily_tower", r.score));
    if (d.player.faculty && r.facultyPts > 0) jobs.push(b.submitScore(FACULTIES[d.player.faculty].boardId, r.facultyPts));
    await Promise.allSettled(jobs);
    for (const id of ALL_BOARDS) this.cache.expire(id);
    if (d.player.faculty) this.cache.expire(FACULTIES[d.player.faculty].boardId);
  }

  private localScore(board: BoardId): number {
    const d = this.store.data;
    const today = dayKey();
    const week = weekKey();
    switch (board) {
      case "daily_tower":
        return Math.max(0, ...d.scores.filter((s) => s.board === "daily" && s.day === today).map((s) => s.score));
      case "best_height":
        return d.stats.bestHeight;
      case "weekly_score":
        return d.scores.filter((s) => s.week === week && s.board !== "tutorial").reduce((a, s) => a + s.score, 0);
    }
  }

  /** The last known online view of a board (instant), or null if it was never loaded this period. */
  cachedBoard(board: BoardId): BoardView | null {
    const c = this.cache.get(board);
    return c ? this.onlineView(board, c.rows, c.total) : null;
  }

  /** True when the cached board is recent enough not to refetch. */
  isFresh(board: BoardId | "faculties"): boolean {
    if (board === "faculties") return FACULTY_IDS.every((id) => this.cache.fresh(FACULTIES[id].boardId));
    return this.cache.fresh(board);
  }

  private onlineView(board: BoardId, raw: BoardRow[], total: number): BoardView {
    const d = this.store.data;
    const myName = d.player.name;
    const b = this.backend();
    const key = periodOf(board);
    const rows: Row[] = raw.map((r) => ({
          name: r.userId === b.userId ? `${myName} (вы)` : r.name,
      score: r.score,
      rank: r.rank,
      me: r.userId === b.userId,
      demo: false,
    }));
    const me = rows.find((r) => r.me) ?? null;
    let note = `Онлайн · ${total} участн.`;
    if (rows.length < 5) {
      const demo = rankRows(demoRows(board, key, 8));
      demo.forEach((r) => (r.rank = 0));
      note = rows.length === 0 ? "Таблица пока пуста — сыграйте и станьте первым!" : "Таблица только наполняется — сыграйте и поднимитесь выше!";
      return { rows: [...rows, ...demo], source: "online", note, myRank: me?.rank ?? null };
    }
    return { rows, source: "online", note, myRank: me?.rank ?? null };
  }

  /** Fresh board from the server (cached for next time); falls back to the cache, then offline. */
  async board(board: BoardId): Promise<BoardView> {
    const b = this.backend();
    if (b.online) {
      const res = await b.getBoard(board);
      if (res.ok) {
        this.cache.set(board, res.rows, res.total);
        return this.onlineView(board, res.rows, res.total);
      }
      const cached = this.cachedBoard(board);
      if (cached) return cached;
    }
    return this.offlineBoard(board);
  }

  private offlineBoard(board: BoardId): BoardView {
    const d = this.store.data;
    const myName = d.player.name;
    const key = periodOf(board);

    const mine = this.localScore(board);
    const rows = demoRows(board, key, 14);
    rows.push({ name: `${myName} (вы)`, score: mine, rank: 0, me: true, demo: false });
    rankRows(rows);
    const me = rows.find((r) => r.me);
    const note = "Нет связи — показан результат с этого устройства. Онлайн-таблица вернётся, когда игра подключится к сети.";
    return { rows, source: "offline", note, myRank: me && me.score > 0 ? me.rank : null };
  }

  /** Faculty war right now from what is known on the device (cache + own contribution). Instant. */
  facultiesNow(): FacultyStanding[] {
    const d = this.store.data;
    const real: Partial<Record<FacultyId, number>> = {};
    for (const id of FACULTY_IDS) {
      const c = this.cache.get(FACULTIES[id].boardId);
      if (c) real[id] = c.rows.reduce((a, r) => a + r.score, 0);
    }
    if (d.player.faculty && real[d.player.faculty] === undefined) real[d.player.faculty] = d.weekly.facultyContrib;
    return weeklyStandings(real);
  }

  /** Faculty war from the server: five boards, one after another (see IdosBackend.getBoard). */
  async faculties(): Promise<{ standings: FacultyStanding[]; online: boolean }> {
    const b = this.backend();
    let online = false;
    if (b.online) {
      for (const id of FACULTY_IDS) {
        const res = await b.getBoard(FACULTIES[id].boardId);
        if (res.ok) {
          online = true;
          this.cache.set(FACULTIES[id].boardId, res.rows, res.total);
        }
      }
    }
    return { standings: this.facultiesNow(), online };
  }

  /** After login: warm the cache in the background so the Rating screen opens instantly. */
  async prefetch(): Promise<void> {
    const b = this.backend();
    if (!b.online) return;
    const ids = [...FACULTY_IDS.map((id) => FACULTIES[id].boardId), ...ALL_BOARDS];
    for (const id of ids) {
      if (!b.online) return;
      if (this.cache.fresh(id)) continue;
      const res = await b.getBoard(id);
      if (res.ok) this.cache.set(id, res.rows, res.total);
    }
  }
}
