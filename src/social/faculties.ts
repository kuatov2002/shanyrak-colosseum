// Faculties and the weekly faculty war. Every point a player earns in Faculty Tower (and every
// faculty block placed anywhere) goes to their faculty. Online, contributions are summed from the
// iDos weekly boards faculty_<id>; offline, other faculties' totals are a deterministic simulation
// seeded by the week (clearly labelled in the UI) so the rating is never empty.

import { hashString, Rng } from "../core/rng";
import { prevWeekKey, weekKey, weekProgress } from "../core/time";

export type FacultyId = "tulpar" | "barys" | "burkit" | "dombyra" | "zhuldyz";

export interface FacultyDef {
  id: FacultyId;
  name: string;
  field: string;
  motto: string;
  color: string;
  dark: string;
  emblem: string; // single letter/rune drawn on flags and faculty blocks
  boardId: string;
}

export const FACULTIES: Record<FacultyId, FacultyDef> = {
  tulpar: {
    id: "tulpar",
    name: "Тұлпар",
    field: "Инженерия и IT",
    motto: "Быстрее ветра — к цели",
    color: "#2aa79a",
    dark: "#1b6d64",
    emblem: "Т",
    boardId: "faculty_tulpar",
  },
  barys: {
    id: "barys",
    name: "Барыс",
    field: "Медицина и естественные науки",
    motto: "Сила, точность, забота",
    color: "#5b8fd9",
    dark: "#34588f",
    emblem: "Б",
    boardId: "faculty_barys",
  },
  burkit: {
    id: "burkit",
    name: "Бүркіт",
    field: "Экономика и бизнес",
    motto: "Видим дальше всех",
    color: "#e0a63a",
    dark: "#9a6c17",
    emblem: "Ү",
    boardId: "faculty_burkit",
  },
  dombyra: {
    id: "dombyra",
    name: "Домбыра",
    field: "Искусство и музыка",
    motto: "Кампус звучит вместе",
    color: "#c8463f",
    dark: "#862a25",
    emblem: "Д",
    boardId: "faculty_dombyra",
  },
  zhuldyz: {
    id: "zhuldyz",
    name: "Жұлдыз",
    field: "Педагогика и гуманитарные",
    motto: "Светим другим",
    color: "#8a63c9",
    dark: "#58398c",
    emblem: "Ж",
    boardId: "faculty_zhuldyz",
  },
};

export const FACULTY_IDS = Object.keys(FACULTIES) as FacultyId[];

export interface FacultyStanding {
  id: FacultyId;
  points: number;
  /** Part of the points that are real (this player locally, or iDos boards online). */
  real: number;
  simulated: number;
}

/** Simulated weekly total of the rest of the campus for one faculty (deterministic per week). */
function simulatedTotal(week: string, id: FacultyId, progress: number): number {
  const rng = new Rng(hashString(`war:${week}:${id}`));
  const pace = rng.range(5200, 9000);
  const wobble = 0.85 + 0.3 * rng.next();
  return Math.round(pace * wobble * Math.pow(progress, 0.9));
}

/**
 * Weekly standings. `realPoints` maps faculty → real contributions known to the client
 * (online: sum of the iDos board; offline: just this player's own contribution).
 */
export function weeklyStandings(
  realPoints: Partial<Record<FacultyId, number>>,
  opts: { simulate: boolean; now?: Date } = { simulate: true },
): FacultyStanding[] {
  const now = opts.now ?? new Date();
  const week = weekKey(now);
  const progress = weekProgress(now);
  return FACULTY_IDS.map((id) => {
    const real = Math.max(0, Math.round(realPoints[id] ?? 0));
    const simulated = opts.simulate ? simulatedTotal(week, id, progress) : 0;
    return { id, points: real + simulated, real, simulated };
  }).sort((a, b) => b.points - a.points);
}

/** Winner of last week (simulation + the player's stored last-week contribution). */
export function lastWeekWinner(
  myFaculty: FacultyId | null,
  myLastWeekContribution: number,
  now = new Date(),
): FacultyId {
  const week = prevWeekKey(now);
  let best: FacultyId = "tulpar";
  let bestPts = -1;
  for (const id of FACULTY_IDS) {
    const pts = simulatedTotal(week, id, 1) + (id === myFaculty ? myLastWeekContribution : 0);
    if (pts > bestPts) {
      bestPts = pts;
      best = id;
    }
  }
  return best;
}
