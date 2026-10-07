import type { Equipped } from "../meta/collection";
import type { RoomId } from "../meta/rooms";
import type { UpgradeLevels } from "../meta/upgrades";
import type { FacultyId } from "../social/faculties";

export type Quality = "perfect" | "good" | "normal" | "bad" | "critical";

export const QUALITY_LABEL: Record<Quality, string> = {
  perfect: "ИДЕАЛЬНО!",
  good: "Хорошо",
  normal: "Нормально",
  bad: "Плохо",
  critical: "Критично!",
};

export const QUALITY_COLOR: Record<Quality, string> = {
  perfect: "#ffd75e",
  good: "#8ef0a5",
  normal: "#e9e2d0",
  bad: "#ff9d5c",
  critical: "#ff5a5a",
};

export type ModeId = "tutorial" | "quick" | "campaign" | "daily" | "faculty" | "endless";

export type EventId = "wind" | "deadline" | "exam" | "nauryz" | "session" | "festival";

export type BonusId =
  | "teaBreak"
  | "wideCrane"
  | "reinforce"
  | "magnet"
  | "windbreak"
  | "antiDeadline"
  | "balcony"
  | "garland"
  | "builderTea"
  | "facultySpirit";

export interface PlacedBlock {
  id: number;
  type: RoomId;
  /** Base horizontal offset (tower sway is added on top when drawing). */
  x: number;
  w: number;
  floor: number;
  quality: Quality;
  students: number;
  /** Students already visible in the windows (animated towards `students`). */
  shown: number;
  bornAt: number;
  crack: number;
  tilt: number;
  squash: number;
  feastAwarded?: boolean;
}

export interface Debris {
  type: RoomId;
  w: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  life: number;
}

export interface FloatText {
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  t: number;
  life: number;
}

export interface RoundConfig {
  mode: ModeId;
  seed: number;
  missionIndex?: number;
  faculty: FacultyId | null;
  upgrades: UpgradeLevels;
  unlockedRooms: RoomId[];
  cosmetics: Equipped;
  /** Extra shields bought as boosters (in-game $SHAI only). */
  boosterShields: number;
  /** Weather picked by the seed: rain/snow particles on top of the day–night cycle. */
  weather?: "clear" | "rain" | "snow";
}

export type EndReason = "crown" | "goal" | "collapse" | "lives" | "quit";

export interface RoundResult {
  mode: ModeId;
  missionIndex?: number;
  missionSuccess: boolean;
  missionStars: number;
  reason: EndReason;
  height: number;
  maxHeight: number;
  score: number;
  students: number;
  perfects: number;
  bestCombo: number;
  bestPerfectStreak: number;
  shai: number;
  materials: { brick: number; felt: number; thread: number };
  seasonPts: number;
  facultyPts: number;
  innovation: number;
  typesPlaced: RoomId[];
  chaiDorm: boolean;
  deadlinesSurvived: number;
  bonusesUsed: number;
  rarePlaced: boolean;
  shabyt: boolean;
  livesLost: number;
  durationSec: number;
  seed: number;
}

export type RoundEvent =
  | { k: "spawn"; type: RoomId; next: RoomId }
  | { k: "drop" }
  | {
      k: "land";
      q: Quality;
      floor: number;
      x: number;
      y: number;
      w: number;
      type: RoomId;
      score: number;
      shai: number;
      students: number;
      synergy: string[];
      shielded: boolean;
    }
  | { k: "miss"; x: number; y: number; type: RoomId }
  | { k: "combo"; n: number }
  | { k: "shabyt"; on: boolean; level: number }
  | { k: "event"; id: EventId; on: boolean }
  | { k: "bonusOffer"; options: BonusId[] }
  | { k: "bonusApplied"; id: BonusId }
  | { k: "material"; id: "brick" | "felt" | "thread"; x: number; y: number }
  | { k: "danger"; on: boolean }
  | { k: "collapse"; fallen: number }
  | { k: "crownStart" }
  | { k: "crowned" }
  | { k: "hint"; text: string; key: string }
  | { k: "mission"; text: string; done: boolean }
  | { k: "examPassed"; students: number }
  | { k: "fireworks"; x: number; y: number }
  | { k: "end"; result: RoundResult };
