// Round events: every few floors the campus life throws something at the builder. Chosen from a
// seeded stream so the Daily Tower has the same events for everyone.

import { BALANCE } from "../config/balance";
import type { Rng } from "../core/rng";
import type { EventId } from "./types";

export interface EventDef {
  id: EventId;
  name: string;
  desc: string;
  icon: string;
  color: string;
  weight: number;
}

export const EVENTS: Record<EventId, EventDef> = {
  wind: {
    id: "wind",
    name: "Ветер с гор",
    desc: "Комнату качает сильнее, при падении сносит. Сад гасит ветер.",
    icon: "🌬️",
    color: "#8fd3ff",
    weight: 10,
  },
  deadline: {
    id: "deadline",
    name: "Дедлайн-тряска",
    desc: "Башня дрожит и теряет устойчивость. Уложите «Идеально», чтобы успокоить её!",
    icon: "⏰",
    color: "#ff8a5c",
    weight: 8,
  },
  exam: {
    id: "exam",
    name: "Экзамен",
    desc: "Студенты заселятся после экзамена, а очки за точность ×2.",
    icon: "📝",
    color: "#c9b8ff",
    weight: 7,
  },
  nauryz: {
    id: "nauryz",
    name: "Наурыз",
    desc: "Праздник весны: $SHAI ×1.5, больше материалов и шанс Наурыз-площади.",
    icon: "🌷",
    color: "#ffcf6b",
    weight: 5,
  },
  session: {
    id: "session",
    name: "Ночь перед сессией",
    desc: "Окна горят ярче, награды ×1.5 — но ошибки опаснее.",
    icon: "🌙",
    color: "#a98bff",
    weight: 6,
  },
  festival: {
    id: "festival",
    name: "Студенческий фестиваль",
    desc: "Актовый зал собирает толпу: +3 студента на каждый этаж.",
    icon: "🎪",
    color: "#ff9ad5",
    weight: 9,
  },
};

export interface EventPickContext {
  hasHall: boolean;
  previous: EventId | null;
}

export function pickEvent(rng: Rng, ctx: EventPickContext): EventId {
  const ids = (Object.keys(EVENTS) as EventId[]).filter(
    (id) => id !== ctx.previous && (id !== "festival" || ctx.hasHall),
  );
  return rng.weighted(ids, (id) => EVENTS[id].weight);
}

export function nextEventGap(rng: Rng): number {
  return rng.int(BALANCE.events.gapMin, BALANCE.events.gapMax);
}

export function eventDuration(id: EventId): number {
  return BALANCE.events.durations[id] ?? 3;
}
