// Versioned save. Everything the player owns lives here; the storage behind it is swappable
// (SaveStore): localStorage today, an API (iDos UserCustomData / CloudCode) tomorrow.

import { DEFAULT_EQUIPPED, DEFAULT_OWNED, type Equipped } from "../meta/collection";
import { START_ROOMS, type RoomId } from "../meta/rooms";
import { emptyUpgrades, type UpgradeLevels } from "../meta/upgrades";
import type { FacultyId } from "../social/faculties";

export const SAVE_VERSION = 3;

export interface QuestProgress {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface LocalScore {
  board: string;
  score: number;
  height: number;
  at: number;
  day: string;
  week: string;
}

/** Solana actions on mainnet (wallet ↔ profile link, achievement-badge mints). */
export interface OnchainRecord {
  kind: "wallet-link" | "nft-mint";
  signature: string;
  at: number;
  note: string;
}

export interface MintedBadge {
  asset: string;
  signature: string;
  at: number;
}

/** A sent mint whose confirmation timed out. Checked on chain before any retry (no double mint). */
export interface PendingMint {
  asset: string;
  signature: string;
  lastValidBlockHeight: number;
  at: number;
}

export interface Materials {
  brick: number;
  felt: number;
  thread: number;
}

export interface Settings {
  music: number;
  sfx: number;
  vibration: boolean;
  reducedMotion: boolean;
  guide: boolean;
  online: boolean;
  analytics: boolean;
}

export interface SaveData {
  version: number;
  createdAt: number;
  player: { id: string; name: string; faculty: FacultyId | null; avatar: number };
  tutorialDone: boolean;
  firstResultSeen: boolean;
  walletPromptDismissed: boolean;
  /** The "how the campus works" guide was shown once after the tutorial. */
  guideSeen: boolean;
  shai: number;
  materials: Materials;
  upgrades: UpgradeLevels;
  unlockedRooms: RoomId[];
  owned: string[];
  equipped: Equipped;
  boosters: { shield: number };
  stats: {
    rounds: number;
    bestHeight: number;
    bestScore: number;
    totalStudents: number;
    totalPerfects: number;
    bestPerfectStreak: number;
    shanyraks: number;
    deadlinesSurvived: number;
    bonusesUsed: number;
    facultyPoints: number;
    placedTypes: RoomId[];
    chaiDorm: boolean;
    shaiEarned: number;
  };
  daily: { day: string; quests: QuestProgress[]; best: number; attempts: number; allClaimed: boolean };
  weekly: { week: string; quests: QuestProgress[]; facultyContrib: number; lastWeekContrib: number };
  streak: { lastDay: string; count: number; claimedDay: number };
  achievements: Record<string, number>;
  season: { id: string; xp: number; premium: boolean; claimedFree: number[]; claimedPremium: number[] };
  campaign: { stars: Record<string, number> };
  scores: LocalScore[];
  /** Rooms of the last crowned tower — shown as the menu backdrop. */
  lastTower: RoomId[];
  war: { lastRewardWeek: string };
  settings: Settings;
  wallet: {
    address: string | null;
    walletName: string | null;
    /** Linked to the iDos profile via auth.linkWallet (server-verified signature). */
    linkedToProfile: boolean;
    records: OnchainRecord[];
    minted: Record<string, MintedBadge>;
    pendingMints: Record<string, PendingMint>;
  };
}

function randomId(): string {
  const a = new Uint8Array(8);
  (globalThis.crypto ?? { getRandomValues: (x: Uint8Array) => x.map(() => Math.random() * 255) }).getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

const STUDENT_NAMES = ["Айдана", "Нурлан", "Асель", "Ерлан", "Мадина", "Тимур", "Алия", "Арман", "Дана", "Санжар"];

export function defaultSave(): SaveData {
  const id = randomId();
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    player: {
      id,
      name: `${STUDENT_NAMES[parseInt(id.slice(0, 2), 16) % STUDENT_NAMES.length]}-${id.slice(2, 5).toUpperCase()}`,
      faculty: null,
      avatar: parseInt(id.slice(5, 7), 16) % 6,
    },
    tutorialDone: false,
    firstResultSeen: false,
    walletPromptDismissed: false,
    guideSeen: false,
    shai: 0,
    materials: { brick: 0, felt: 0, thread: 0 },
    upgrades: emptyUpgrades(),
    unlockedRooms: [...START_ROOMS],
    owned: [...DEFAULT_OWNED],
    equipped: { ...DEFAULT_EQUIPPED },
    boosters: { shield: 0 },
    stats: {
      rounds: 0,
      bestHeight: 0,
      bestScore: 0,
      totalStudents: 0,
      totalPerfects: 0,
      bestPerfectStreak: 0,
      shanyraks: 0,
      deadlinesSurvived: 0,
      bonusesUsed: 0,
      facultyPoints: 0,
      placedTypes: [],
      chaiDorm: false,
      shaiEarned: 0,
    },
    daily: { day: "", quests: [], best: 0, attempts: 0, allClaimed: false },
    weekly: { week: "", quests: [], facultyContrib: 0, lastWeekContrib: 0 },
    streak: { lastDay: "", count: 0, claimedDay: 0 },
    achievements: {},
    season: { id: "", xp: 0, premium: false, claimedFree: [], claimedPremium: [] },
    campaign: { stars: {} },
    scores: [],
    lastTower: [],
    war: { lastRewardWeek: "" },
    settings: { music: 0.5, sfx: 0.8, vibration: true, reducedMotion: false, guide: true, online: true, analytics: true },
    wallet: { address: null, walletName: null, linkedToProfile: false, records: [], minted: {}, pendingMints: {} },
  };
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Index i migrates version i+1 → i+2. Add a function when SaveData changes shape. */
const MIGRATIONS: Migration[] = [
  // v1 → v2: settings.online / settings.analytics, boosters
  (d) => {
    const settings = (d.settings ?? {}) as Record<string, unknown>;
    return {
      ...d,
      settings: { online: true, analytics: true, ...settings },
      boosters: d.boosters ?? { shield: 0 },
      version: 2,
    };
  },
  // v2 → v3: Solana is mainnet-only. Old test-network memo/airdrop/demo records and the local-only
  // student-ID signature are dropped; badge mints and the iDos profile link are tracked instead.
  (d) => {
    const wallet = (d.wallet ?? {}) as Record<string, unknown>;
    const scores = Array.isArray(d.scores) ? (d.scores as Record<string, unknown>[]) : [];
    return {
      ...d,
      // The demo wallet is gone: its fake address must not look like a real one.
      wallet: wallet.walletName === "Демо-кошелёк"
        ? { address: null, walletName: null, linkedToProfile: false, records: [], minted: {}, pendingMints: {} }
        : { address: wallet.address ?? null, walletName: wallet.walletName ?? null, linkedToProfile: false, records: [], minted: {}, pendingMints: {} },
      scores: scores.map(({ wallet: _w, verifiedTx: _v, ...rest }) => rest),
      version: 3,
    };
  },
];

/** Deep-merge loaded data over defaults so new fields always exist. */
function mergeDefaults<T>(def: T, loaded: unknown): T {
  if (Array.isArray(def)) return (Array.isArray(loaded) ? loaded : def) as T;
  if (def && typeof def === "object") {
    const out: Record<string, unknown> = { ...(def as Record<string, unknown>) };
    if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
      for (const [k, v] of Object.entries(loaded as Record<string, unknown>)) {
        const dv = (def as Record<string, unknown>)[k];
        out[k] = dv !== undefined && dv !== null && typeof dv === "object" ? mergeDefaults(dv, v) : v;
      }
    }
    return out as T;
  }
  return (loaded === undefined ? def : loaded) as T;
}

export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== "object") return defaultSave();
  let data = raw as Record<string, unknown>;
  let v = typeof data.version === "number" ? data.version : 1;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v - 1];
    if (!step) break;
    data = step(data);
    v = typeof data.version === "number" ? data.version : v + 1;
  }
  const merged = mergeDefaults(defaultSave(), data);
  merged.version = SAVE_VERSION;
  return merged;
}

export interface SaveStore {
  load(): SaveData | null;
  save(data: SaveData): void;
  clear(): void;
}

const KEY = "shanyrak.save";

export class LocalSaveStore implements SaveStore {
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (err) {
      console.warn("[save] corrupted save, starting fresh", err);
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) localStorage.setItem(`${KEY}.broken.${Date.now()}`, raw);
      } catch {
        /* storage unavailable */
      }
      return null;
    }
  }
  save(data: SaveData): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.warn("[save] could not persist", err);
    }
  }
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

/** In-memory store for tests and private browsing fallbacks. */
export class MemorySaveStore implements SaveStore {
  private data: SaveData | null = null;
  load(): SaveData | null {
    return this.data ? migrate(JSON.parse(JSON.stringify(this.data))) : null;
  }
  save(data: SaveData): void {
    this.data = JSON.parse(JSON.stringify(data));
  }
  clear(): void {
    this.data = null;
  }
}
