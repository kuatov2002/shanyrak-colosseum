// Room catalogue: every block the crane can carry. Pure data + neighbour rules; drawing lives in
// render/rooms.ts, balance numbers in config/balance.ts.

export type RoomId =
  | "foundation"
  | "dorm"
  | "chaikhana"
  | "library"
  | "itlab"
  | "coworking"
  | "gym"
  | "hall"
  | "garden"
  | "canteen"
  | "nauryz"
  | "faculty";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "обычная",
  uncommon: "необычная",
  rare: "редкая",
  epic: "эпическая",
  legendary: "легендарная",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#cfc6b8",
  uncommon: "#5fd08a",
  rare: "#4fb6ff",
  epic: "#c27dff",
  legendary: "#ffc94d",
};

export type Glyph =
  | "door"
  | "bed"
  | "teapot"
  | "books"
  | "monitor"
  | "laptop"
  | "dumbbell"
  | "columns"
  | "leaf"
  | "bowl"
  | "sun"
  | "flag";

export interface RoomColors {
  body: string;
  trim: string;
  accent: string;
  glass: string;
}

export type UnlockRule =
  | { kind: "start" }
  | { kind: "shai"; cost: number }
  | { kind: "craft" }
  | { kind: "faculty" };

export interface RoomDef {
  id: RoomId;
  name: string;
  /** One-line role shown on cards. */
  role: string;
  /** What neighbours it likes — shown in the collection and the hint after placing. */
  synergy: string;
  widthK: number;
  rarity: Rarity;
  colors: RoomColors;
  glyph: Glyph;
  /** Students settled on an "ordinary" landing before modifiers. */
  students: number;
  /** $SHAI on an ordinary landing before modifiers. */
  shai: number;
  unlock: UnlockRule;
}

export const ROOMS: Record<RoomId, RoomDef> = {
  foundation: {
    id: "foundation",
    name: "Фундамент",
    role: "Основа кампуса",
    synergy: "Шире фундамент — устойчивее башня (улучшение в Мастерской).",
    widthK: 1.3,
    rarity: "common",
    colors: { body: "#8c7b6b", trim: "#5d4e43", accent: "#f2b84b", glass: "#ffd98a" },
    glyph: "door",
    students: 0,
    shai: 0,
    unlock: { kind: "start" },
  },
  dorm: {
    id: "dorm",
    name: "Общага",
    role: "Заселяет больше всего студентов",
    synergy: "Рядом с чайханой или столовой: +3 студента.",
    widthK: 1.0,
    rarity: "common",
    colors: { body: "#c8643b", trim: "#8e3f25", accent: "#f2b84b", glass: "#ffd27a" },
    glyph: "bed",
    students: 5,
    shai: 1,
    unlock: { kind: "start" },
  },
  chaikhana: {
    id: "chaikhana",
    name: "Чайхана",
    role: "Приносит $SHAI",
    synergy: "Рядом с общагой: +5 $SHAI и душистый пар.",
    widthK: 0.95,
    rarity: "common",
    colors: { body: "#2aa79a", trim: "#1b7369", accent: "#f2b84b", glass: "#ffe2a0" },
    glyph: "teapot",
    students: 1,
    shai: 3,
    unlock: { kind: "start" },
  },
  library: {
    id: "library",
    name: "Библиотека",
    role: "Идеальные укладки над ней ценнее",
    synergy: "Два этажа выше: ×1.5 очков за «Идеально».",
    widthK: 1.05,
    rarity: "common",
    colors: { body: "#2f4c8c", trim: "#1d3060", accent: "#f2b84b", glass: "#ffd98a" },
    glyph: "books",
    students: 2,
    shai: 1,
    unlock: { kind: "start" },
  },
  itlab: {
    id: "itlab",
    name: "IT-лаборатория",
    role: "Даёт очки инноваций",
    synergy: "Рядом с библиотекой или коворкингом: инновации ×2.",
    widthK: 0.95,
    rarity: "rare",
    colors: { body: "#26364a", trim: "#152131", accent: "#45e0ff", glass: "#7cefff" },
    glyph: "monitor",
    students: 2,
    shai: 2,
    unlock: { kind: "shai", cost: 900 },
  },
  coworking: {
    id: "coworking",
    name: "Коворкинг",
    role: "Превращает студентов в очки сезона",
    synergy: "20% студентов этажа ниже → очки сезона.",
    widthK: 1.0,
    rarity: "uncommon",
    colors: { body: "#d9a043", trim: "#9c6f22", accent: "#2d4a8a", glass: "#fff0c2" },
    glyph: "laptop",
    students: 2,
    shai: 2,
    unlock: { kind: "shai", cost: 600 },
  },
  gym: {
    id: "gym",
    name: "Спортзал",
    role: "Укрепляет башню",
    synergy: "+12 устойчивости и +10 к её максимуму.",
    widthK: 1.1,
    rarity: "common",
    colors: { body: "#8e2f3c", trim: "#5e1c27", accent: "#f2b84b", glass: "#ffd27a" },
    glyph: "dumbbell",
    students: 2,
    shai: 1,
    unlock: { kind: "start" },
  },
  hall: {
    id: "hall",
    name: "Актовый зал",
    role: "Устраивает фестивали",
    synergy: "Открывает «Студенческий фестиваль»: толпа и бонусные студенты.",
    widthK: 1.12,
    rarity: "uncommon",
    colors: { body: "#ece0c4", trim: "#b3955f", accent: "#b8323f", glass: "#ffd27a" },
    glyph: "columns",
    students: 3,
    shai: 2,
    unlock: { kind: "shai", cost: 400 },
  },
  garden: {
    id: "garden",
    name: "Сад-оранжерея",
    role: "Гасит ветер",
    synergy: "Каждый сад ослабляет ветер на 25% (до 60%).",
    widthK: 0.95,
    rarity: "common",
    colors: { body: "#3c6e4f", trim: "#244833", accent: "#f2b84b", glass: "#9fdcc0" },
    glyph: "leaf",
    students: 1,
    shai: 1,
    unlock: { kind: "start" },
  },
  canteen: {
    id: "canteen",
    name: "Столовая",
    role: "Кормит и приносит $SHAI",
    synergy: "Рядом общага и актовый зал (в 2 этажах): +8 $SHAI.",
    widthK: 1.05,
    rarity: "common",
    colors: { body: "#d9804a", trim: "#9c5224", accent: "#f2b84b", glass: "#ffe2a0" },
    glyph: "bowl",
    students: 3,
    shai: 2,
    unlock: { kind: "start" },
  },
  nauryz: {
    id: "nauryz",
    name: "Наурыз-площадь",
    role: "Праздник весны: большой бонус",
    synergy: "+20 $SHAI, +10 студентов, праздничный салют.",
    widthK: 1.15,
    rarity: "legendary",
    colors: { body: "#f2b84b", trim: "#b3741b", accent: "#c0392b", glass: "#fff3c4" },
    glyph: "sun",
    students: 10,
    shai: 20,
    unlock: { kind: "craft" },
  },
  faculty: {
    id: "faculty",
    name: "Факультетский блок",
    role: "Очки в рейтинг факультета",
    synergy: "+10 очков факультета, ×2 за «Идеально».",
    widthK: 1.0,
    rarity: "rare",
    colors: { body: "#2aa79a", trim: "#1b7369", accent: "#f2b84b", glass: "#ffe2a0" },
    glyph: "flag",
    students: 3,
    shai: 2,
    unlock: { kind: "faculty" },
  },
};

export const PLAYABLE_ROOMS: RoomId[] = [
  "dorm",
  "chaikhana",
  "library",
  "canteen",
  "gym",
  "garden",
  "hall",
  "coworking",
  "itlab",
  "faculty",
  "nauryz",
];

export const START_ROOMS: RoomId[] = ["dorm", "chaikhana", "library", "canteen", "gym", "garden"];

/** Pairs that count as "neighbours" for synergy: directly above/below in the tower. */
export function areNeighbours(a: RoomId, b: RoomId, x: RoomId, y: RoomId): boolean {
  return (a === x && b === y) || (a === y && b === x);
}
