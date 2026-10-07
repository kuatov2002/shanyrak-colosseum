// Calendar keys in UTC: the Daily Tower, daily quests and the weekly faculty war reset for
// everyone at the same moment (00:00 UTC), matching the iDos "Daily"/"Weekly" leaderboard cycles.

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function prevDayKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return dayKey(d);
}

/** ISO week key like 2026-W41 (weeks start on Monday, UTC). */
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function prevWeekKey(d = new Date()): string {
  const t = new Date(d.getTime() - 7 * 86400000);
  return weekKey(t);
}

/** 0..1 — how far into the current UTC week we are (drives the simulated faculty war). */
export function weekProgress(d = new Date()): number {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const secs = day * 86400 + d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
  return Math.min(1, secs / (7 * 86400));
}

export function msToNextDay(d = new Date()): number {
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - d.getTime();
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} ч ${String(m).padStart(2, "0")} мин`;
  return `${m} мин ${String(s % 60).padStart(2, "0")} с`;
}
