// Leaderboards. Online: iDos server boards (daily_tower, best_height, weekly_score, faculty_*).
// Offline (or while a fresh board is still empty): the player's own local results plus clearly
// labelled demo rivals, so a board is never an unexplained empty list.

import type { LocalScore } from "../core/save";
import type { Store } from "../core/state";
import { hashString, Rng } from "../core/rng";
import { dayKey, weekKey } from "../core/time";
import type { RoundResult } from "../gameplay/types";
import type { Backend } from "../platform/backend";
import { FACULTIES, FACULTY_IDS, weeklyStandings, type FacultyId, type FacultyStanding } from "./faculties";

export type BoardId = "daily_tower" | "best_height" | "weekly_score" | "wallets";

export const BOARD_INFO: Record<BoardId, { title: string; unit: string; desc: string }> = {
  daily_tower: { title: "Ежедневная башня", unit: "очков", desc: "Один сид для всех на сутки (UTC). Лучший результат дня." },
  best_height: { title: "Рекорд высоты", unit: "этажей", desc: "Самая высокая башня за всё время." },
  weekly_score: { title: "Неделя кампуса", unit: "очков", desc: "Сумма очков всех раундов за неделю." },
  wallets: { title: "Кошельки", unit: "очков", desc: "Рекорды, подтверждённые подписью Solana-кошелька." },
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
    const wallet = board === "wallets" ? `${randBase58(rng, 4)}…${randBase58(rng, 4)}` : undefined;
    rows.push({
      name: wallet ?? name,
      score: Math.max(1, Math.round(base * k)),
      rank: 0,
      me: false,
      demo: true,
      sub: board === "wallets" ? "демо-кошелёк" : `${FACULTIES[faculty].name} · демо`,
    });
  }
  return rows;
}

function randBase58(rng: Rng, n: number): string {
  const abc = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < n; i++) s += abc[rng.int(0, abc.length - 1)];
  return s;
}

function rankRows(rows: Row[]): Row[] {
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export function shortAddress(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export class Leaderboards {
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
      wallet: d.wallet.address,
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
      case "wallets":
        return d.wallet.address ? Math.max(0, ...d.scores.filter((s) => s.wallet === d.wallet.address).map((s) => s.score)) : 0;
    }
  }

  async board(board: BoardId): Promise<BoardView> {
    const d = this.store.data;
    const myName = d.player.name;
    const b = this.backend();
    const key = board === "weekly_score" ? weekKey() : board === "daily_tower" ? dayKey() : "all";

    if (board !== "wallets" && b.online) {
      const res = await b.getBoard(board);
      if (res.ok) {
        const rows: Row[] = res.rows.map((r) => ({
          name: r.userId === b.userId ? `${myName} (вы)` : r.name,
          score: r.score,
          rank: r.rank,
          me: r.userId === b.userId,
          demo: false,
        }));
        const me = rows.find((r) => r.me) ?? null;
        let note = `Онлайн · iDos Games · ${res.total} участн.`;
        if (rows.length < 5) {
          const demo = rankRows(demoRows(board, key, 8));
          demo.forEach((r) => (r.rank = 0));
          note =
            rows.length === 0
              ? "Онлайн-таблица пока пуста — сыграйте и станьте первым! Ниже — демо-соперники для наглядности (не настоящие игроки)."
              : "Таблица только наполняется. Демо-соперники ниже не участвуют в рейтинге.";
          return { rows: [...rows, ...demo], source: "online", note, myRank: me?.rank ?? null };
        }
        return { rows, source: "online", note, myRank: me?.rank ?? null };
      }
    }

    const mine = this.localScore(board);
    const rows = demoRows(board, key, 14);
    if (mine > 0 || board !== "wallets") {
      rows.push({
        name: board === "wallets" && d.wallet.address ? shortAddress(d.wallet.address) : `${myName} (вы)`,
        score: mine,
        rank: 0,
        me: true,
        demo: false,
        sub: board === "wallets" ? "ваш кошелёк" : undefined,
      });
    }
    rankRows(rows);
    const me = rows.find((r) => r.me);
    const note =
      board === "wallets"
        ? d.wallet.address
          ? "Ваши результаты, привязанные к кошельку, среди демо-кошельков. Подтвердите рекорд в devnet на экране кошелька."
          : "Подключите кошелёк (необязательно), чтобы появиться в этой таблице. Строки «демо» — примеры."
        : "Оффлайн-режим: ваш результат среди демо-соперников. Онлайн-рейтинг iDos включится при подключении к сети.";
    return { rows, source: "offline", note, myRank: me && me.score > 0 ? me.rank : null };
  }

  /** Faculty war standings (simulated campus + real points). */
  async faculties(): Promise<{ standings: FacultyStanding[]; online: boolean }> {
    const d = this.store.data;
    const b = this.backend();
    const real: Partial<Record<FacultyId, number>> = {};
    let online = false;
    if (b.online) {
      const results = await Promise.all(FACULTY_IDS.map((id) => b.getBoard(FACULTIES[id].boardId)));
      results.forEach((res, i) => {
        if (res.ok) {
          online = true;
          real[FACULTY_IDS[i]] = res.rows.reduce((a, r) => a + r.score, 0);
        }
      });
    }
    if (!online && d.player.faculty) real[d.player.faculty] = d.weekly.facultyContrib;
    return { standings: weeklyStandings(real), online };
  }
}
