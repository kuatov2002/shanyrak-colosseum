// Bonus cards offered every 5–8 floors. Each supports a build style so runs feel different:
// steady, fast-height, economy, social, events, faculty.

import { BALANCE } from "../config/balance";
import type { Rng } from "../core/rng";
import type { BonusId } from "./types";

export type BuildStyle = "Устойчивость" | "Высота" | "Экономика" | "Соцбилд" | "События" | "Факультет";

export interface BonusDef {
  id: BonusId;
  name: string;
  desc: string;
  icon: string;
  style: BuildStyle;
  weight: number;
}

export const BONUSES: Record<BonusId, BonusDef> = {
  teaBreak: {
    id: "teaBreak",
    name: "Чайный перерыв",
    desc: `Следующие ${BALANCE.bonuses.teaBreakBlocks} комнаты почти не качаются.`,
    icon: "🍵",
    style: "Высота",
    weight: 10,
  },
  wideCrane: {
    id: "wideCrane",
    name: "Кран общаги",
    desc: `Следующие ${BALANCE.bonuses.wideCraneBlocks} комнаты на 22% шире.`,
    icon: "🏗️",
    style: "Устойчивость",
    weight: 9,
  },
  reinforce: {
    id: "reinforce",
    name: "Укрепление",
    desc: "Щит: одна плохая укладка станет нормальной.",
    icon: "🛡️",
    style: "Устойчивость",
    weight: 9,
  },
  magnet: {
    id: "magnet",
    name: "Магнит студентов",
    desc: `+50% студентов на ${BALANCE.bonuses.magnetBlocks} этажей.`,
    icon: "🧲",
    style: "Соцбилд",
    weight: 8,
  },
  windbreak: {
    id: "windbreak",
    name: "Ветрозащита",
    desc: "Ветер вдвое слабее до конца раунда.",
    icon: "🌲",
    style: "Устойчивость",
    weight: 6,
  },
  antiDeadline: {
    id: "antiDeadline",
    name: "Антидедлайн",
    desc: "Дедлайн-тряска на 60% слабее до конца раунда.",
    icon: "📅",
    style: "События",
    weight: 6,
  },
  balcony: {
    id: "balcony",
    name: "Двойной балкон",
    desc: "Окно «Идеально» шире на 45% — комбо держать легче.",
    icon: "🏛️",
    style: "Высота",
    weight: 7,
  },
  garland: {
    id: "garland",
    name: "Наурыз-гирлянда",
    desc: `Очки ×2 на ${BALANCE.bonuses.garlandBlocks} этажа.`,
    icon: "🏮",
    style: "Экономика",
    weight: 8,
  },
  builderTea: {
    id: "builderTea",
    name: "Строительный чай",
    desc: `+${BALANCE.stability.builderTea} устойчивости прямо сейчас.`,
    icon: "🫖",
    style: "Устойчивость",
    weight: 8,
  },
  facultySpirit: {
    id: "facultySpirit",
    name: "Дух факультета",
    desc: `Следующие ${BALANCE.bonuses.facultySpiritBlocks} комнаты — факультетские.`,
    icon: "🚩",
    style: "Факультет",
    weight: 6,
  },
};

export interface OfferContext {
  hasFaculty: boolean;
  stabilityRatio: number;
  windActive: boolean;
}

export function offerBonuses(rng: Rng, ctx: OfferContext, count: number): BonusId[] {
  const pool = (Object.keys(BONUSES) as BonusId[]).filter((id) => id !== "facultySpirit" || ctx.hasFaculty);
  const out: BonusId[] = [];
  while (out.length < count && pool.length > 0) {
    const id = rng.weighted(pool, (b) => {
      let w = BONUSES[b].weight;
      if (b === "builderTea" && ctx.stabilityRatio < 0.5) w *= 3;
      if (b === "windbreak" && ctx.windActive) w *= 2.5;
      return w;
    });
    out.push(id);
    pool.splice(pool.indexOf(id), 1);
  }
  return out;
}

export function isBonusFloor(floor: number): boolean {
  const list = BALANCE.bonuses.floors as readonly number[];
  if (list.includes(floor)) return true;
  const last = list[list.length - 1];
  return floor > last && (floor - last) % BALANCE.bonuses.gapAfter === 0;
}
