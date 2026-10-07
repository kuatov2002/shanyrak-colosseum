// Game modes and the "Семестр" campaign.

import type { RoomId } from "../meta/rooms";
import type { EventId, ModeId } from "./types";
import type { Round } from "./round";

export interface ModeDef {
  id: ModeId;
  name: string;
  desc: string;
  icon: string;
}

export const MODES: Record<ModeId, ModeDef> = {
  tutorial: { id: "tutorial", name: "Обучение", desc: "Пять этажей и первый шанырак — 30 секунд.", icon: "🎓" },
  quick: { id: "quick", name: "Быстрая башня", desc: "Один раунд до падения или до 30 этажей.", icon: "⚡" },
  campaign: { id: "campaign", name: "Семестр", desc: "8 миссий: от фундамента до финального шанырака.", icon: "📚" },
  daily: { id: "daily", name: "Ежедневная башня", desc: "Один сид на день для всех. Отдельный рейтинг и ×1.5 $SHAI.", icon: "📅" },
  faculty: { id: "faculty", name: "Башня факультета", desc: "Очки идут в недельную войну факультетов.", icon: "🚩" },
  endless: { id: "endless", name: "Бесконечный шанырак", desc: "Без потолка. Сложность растёт, редкие комнаты чаще.", icon: "♾️" },
};

export interface MissionReward {
  shai: number;
  materials?: Partial<Record<"brick" | "felt" | "thread", number>>;
  cosmetic?: string;
  unlockRoom?: RoomId;
}

export interface MissionDef {
  index: number;
  title: string;
  story: string;
  goal: string;
  deck?: RoomId[];
  extraRooms?: RoomId[];
  boost?: Partial<Record<RoomId, number>>;
  forcedEvents?: { floor: number; id: EventId }[];
  randomEvents: boolean;
  constantWind?: boolean;
  check(r: Round): { done: boolean; progress: string };
  reward: MissionReward;
}

const floorsOf = (r: Round) => r.tower.floors - 1;

function hasAdjacent(r: Round, a: RoomId, b: RoomId, minFloor = 0): boolean {
  const bl = r.tower.blocks;
  for (let i = Math.max(1, minFloor); i < bl.length; i++) {
    if (bl[i].type !== a) continue;
    if (bl[i - 1]?.type === b || bl[i + 1]?.type === b) return true;
  }
  return false;
}

export const MISSIONS: MissionDef[] = [
  {
    index: 0,
    title: "Первый фундамент",
    story: "Первокурсники приедут через неделю. Заложите кампус!",
    goal: "Постройте 6 этажей",
    deck: ["dorm", "canteen", "chaikhana", "library", "gym", "dorm"],
    randomEvents: false,
    check: (r) => ({ done: floorsOf(r) >= 6, progress: `${Math.min(6, floorsOf(r))}/6 этажей` }),
    reward: { shai: 80 },
  },
  {
    index: 1,
    title: "Общага для первокурсников",
    story: "Все хотят жить в кампусе. Нужны общежития!",
    goal: "Заселите 40 студентов",
    boost: { dorm: 2.2 },
    randomEvents: false,
    check: (r) => ({ done: r.students >= 40, progress: `${Math.min(40, r.students)}/40 студентов` }),
    reward: { shai: 100, materials: { brick: 2 } },
  },
  {
    index: 2,
    title: "Чайхана на пятом этаже",
    story: "Студенты просят чай поближе к комнатам.",
    goal: "Чайхана на 5-м этаже или выше рядом с общагой",
    deck: ["library", "canteen", "gym", "dorm", "chaikhana", "dorm"],
    boost: { chaikhana: 2, dorm: 1.6 },
    randomEvents: false,
    check: (r) => {
      const done = hasAdjacent(r, "chaikhana", "dorm", 5);
      return { done, progress: done ? "Чай подан!" : "Чайхана ↔ общага, этаж ≥ 5" };
    },
    reward: { shai: 120, materials: { felt: 2 } },
  },
  {
    index: 3,
    title: "Библиотека и IT-лаборатория",
    story: "Наука и код — лучшие соседи.",
    goal: "Поставьте IT-лабораторию рядом с библиотекой",
    deck: ["dorm", "library", "itlab"],
    extraRooms: ["itlab"],
    boost: { itlab: 2.5, library: 2 },
    randomEvents: false,
    check: (r) => {
      const done = hasAdjacent(r, "itlab", "library");
      return { done, progress: done ? "Лаборатория открыта!" : "IT-лаборатория ↔ библиотека" };
    },
    reward: { shai: 150, unlockRoom: "itlab" },
  },
  {
    index: 4,
    title: "Ветреный день",
    story: "С гор дует весь день. Сады помогут!",
    goal: "Постройте 12 этажей на ветру",
    constantWind: true,
    boost: { garden: 1.8 },
    randomEvents: false,
    check: (r) => ({ done: floorsOf(r) >= 12, progress: `${Math.min(12, floorsOf(r))}/12 этажей` }),
    reward: { shai: 180, materials: { thread: 2 } },
  },
  {
    index: 5,
    title: "Дедлайн-тряска",
    story: "Конец семестра. Всё дрожит, но вы справитесь.",
    goal: "Переживите 2 дедлайна и постройте 14 этажей",
    forcedEvents: [
      { floor: 4, id: "deadline" },
      { floor: 9, id: "deadline" },
    ],
    randomEvents: false,
    boost: { gym: 1.8 },
    check: (r) => ({
      done: r.deadlinesSurvived >= 2 && floorsOf(r) >= 14,
      progress: `Дедлайны ${Math.min(2, r.deadlinesSurvived)}/2 · ${Math.min(14, floorsOf(r))}/14 этажей`,
    }),
    reward: { shai: 200, materials: { brick: 3 } },
  },
  {
    index: 6,
    title: "Наурыз-фестиваль",
    story: "Весна! Кампус празднует Наурыз всем миром.",
    goal: "Поставьте Наурыз-площадь и заселите 120 студентов",
    deck: ["dorm", "hall", "canteen", "nauryz"],
    extraRooms: ["hall", "nauryz"],
    forcedEvents: [
      { floor: 3, id: "nauryz" },
      { floor: 8, id: "festival" },
    ],
    randomEvents: false,
    boost: { dorm: 1.5 },
    check: (r) => {
      const plaza = r.tower.countType("nauryz") > 0;
      return {
        done: plaza && r.students >= 120,
        progress: `${plaza ? "Площадь ✓" : "Площадь —"} · ${Math.min(120, r.students)}/120 студентов`,
      };
    },
    reward: { shai: 250, materials: { felt: 3, thread: 3 } },
  },
  {
    index: 7,
    title: "Финальный шанырак",
    story: "Кампус готов стать домом. Завершите его шаныраком.",
    goal: "Постройте 25 этажей",
    randomEvents: true,
    check: (r) => ({ done: floorsOf(r) >= 25, progress: `${Math.min(25, floorsOf(r))}/25 этажей` }),
    reward: { shai: 400, cosmetic: "sh_gold" },
  },
];

export function missionStars(r: Round): number {
  let s = 1;
  if (r.perfects >= Math.max(3, Math.floor((r.tower.floors - 1) * 0.4))) s++;
  if (r.livesLost === 0) s++;
  return s;
}
