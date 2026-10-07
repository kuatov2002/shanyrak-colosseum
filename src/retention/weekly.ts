// Weekly layer: weekly quests and the faculty-war payout for last week's winning faculty.

import type { Store } from "../core/state";
import { prevWeekKey, weekKey } from "../core/time";
import { FACULTIES, lastWeekWinner, type FacultyId } from "../social/faculties";
import { freshProgress, WEEKLY_QUESTS } from "./quests";

export interface WeeklyNotice {
  kind: "war-won" | "war-lost";
  faculty: FacultyId;
  text: string;
}

export function ensureWeekly(store: Store, now = new Date()): WeeklyNotice | null {
  const week = weekKey(now);
  if (store.data.weekly.week !== week) {
    store.mutate((d) => {
      const lastContrib = d.weekly.week === prevWeekKey(now) ? d.weekly.facultyContrib : 0;
      d.weekly = { week, quests: freshProgress(WEEKLY_QUESTS), facultyContrib: 0, lastWeekContrib: lastContrib };
    });
  }
  const d = store.data;
  const prev = prevWeekKey(now);
  if (!d.player.faculty || d.war.lastRewardWeek === prev || d.stats.rounds === 0) return null;
  const winner = lastWeekWinner(d.player.faculty, d.weekly.lastWeekContrib, now);
  store.mutate((s) => {
    s.war.lastRewardWeek = prev;
  });
  if (d.weekly.lastWeekContrib <= 0) return null;
  if (winner === d.player.faculty) {
    const flag = `flag_${winner}`;
    store.mutate((s) => {
      if (!s.owned.includes(flag)) s.owned.push(flag);
      s.shai += 200;
    });
    return { kind: "war-won", faculty: winner, text: `«${FACULTIES[winner].name}» победил в неделе! Флаг факультета и +200 $SHAI.` };
  }
  return { kind: "war-lost", faculty: winner, text: `Прошлую неделю выиграл «${FACULTIES[winner].name}». Новая война уже идёт!` };
}
