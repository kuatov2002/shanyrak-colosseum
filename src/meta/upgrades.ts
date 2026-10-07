// "Мастерская кампуса" — permanent upgrades bought with in-game $SHAI only. Each level is a small,
// readable edge; costs are tuned so the first purchase is possible after 2–3 rounds and the full
// tree takes weeks, never a paywall.

export type UpgradeId =
  | "stability"
  | "slowSwing"
  | "wideBase"
  | "students"
  | "rareChance"
  | "shaiBoost"
  | "shield"
  | "startBonus";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  maxLevel: number;
  /** Human text for a given level (1-based). */
  effect: (level: number) => string;
  cost: (nextLevel: number) => number;
}

const curve = (base: number, growth: number) => (lvl: number) =>
  Math.round((base * Math.pow(growth, lvl - 1)) / 10) * 10;

export const UPGRADES: UpgradeDef[] = [
  {
    id: "stability",
    name: "Крепкий каркас",
    icon: "🧱",
    maxLevel: 5,
    effect: (l) => `+${l * 6} к стартовой устойчивости`,
    cost: curve(100, 1.7),
  },
  {
    id: "slowSwing",
    name: "Плавный трос",
    icon: "🪝",
    maxLevel: 5,
    effect: (l) => `Качание медленнее на ${l * 5}%`,
    cost: curve(120, 1.75),
  },
  {
    id: "wideBase",
    name: "Широкий фундамент",
    icon: "📐",
    maxLevel: 4,
    effect: (l) => `Фундамент шире на ${l * 7}%, первые 3 комнаты на ${l * 4}%`,
    cost: curve(110, 1.8),
  },
  {
    id: "students",
    name: "Приёмная комиссия",
    icon: "🎓",
    maxLevel: 5,
    effect: (l) => `+${l * 10}% студентов`,
    cost: curve(130, 1.7),
  },
  {
    id: "rareChance",
    name: "Связи в деканате",
    icon: "🍀",
    maxLevel: 5,
    effect: (l) => `Редкие комнаты чаще на ${l * 15}%`,
    cost: curve(160, 1.75),
  },
  {
    id: "shaiBoost",
    name: "Казначей кампуса",
    icon: "🪙",
    maxLevel: 5,
    effect: (l) => `+${l * 8}% $SHAI за раунд`,
    cost: curve(150, 1.8),
  },
  {
    id: "shield",
    name: "Каска прораба",
    icon: "⛑️",
    maxLevel: 2,
    effect: (l) => `${l} щит(а) от плохой укладки в начале раунда`,
    cost: curve(300, 2.5),
  },
  {
    id: "startBonus",
    name: "Стартовый бонус",
    icon: "🎁",
    maxLevel: 2,
    effect: (l) => (l === 1 ? "Выбор бонуса в начале раунда" : "Стартовый бонус из 4 карт"),
    cost: curve(400, 2.2),
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<
  UpgradeId,
  UpgradeDef
>;

export type UpgradeLevels = Record<UpgradeId, number>;

export function emptyUpgrades(): UpgradeLevels {
  return {
    stability: 0,
    slowSwing: 0,
    wideBase: 0,
    students: 0,
    rareChance: 0,
    shaiBoost: 0,
    shield: 0,
    startBonus: 0,
  };
}
