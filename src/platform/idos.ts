// iDos Games backend for title JE8W0Z54 via the official SDK (@idosgames/core 0.21.2).
// Used for: silent guest (device-id) login, server-authoritative leaderboards and custom
// analytics events. Every call is best-effort: on any failure the game keeps running offline.
//
// SDK calls used here (verified against the package's type definitions):
//   createIDosGamesClient({ titleID, throttleMs })
//   client.auth.autoLogin() / client.auth.loginWithDeviceID() / client.auth.context?.userID
//   client.leaderboard.submitScore(id, score) / client.leaderboard.getLeaderboard(id)
//   client.user.changeUsername(name)
//   client.auth.linkWallet(address, "solana", signature?)  (two-step challenge → signature)
//   client.analytics.logEvent(name, params, value)

import type { Backend, BoardResult } from "./backend";

type IdosClient = import("@idosgames/core").IDosGamesClient;

const BAKED_TITLE_ID = "JE8W0Z54";

/** Same resolution order as the iDos host scaffold (src/config.ts), minus the platform-only parts. */
export function resolveTitleId(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const m = host.match(/^([a-z0-9]{8})(-dev)?\.idos\.games$/);
  if (m) return m[2] ? `${m[1].toUpperCase()}-DEV` : m[1].toUpperCase();
  const id = env.VITE_IDOS_TITLE_ID || BAKED_TITLE_ID;
  return env.VITE_IDOS_ENV === "dev" && !id.endsWith("-DEV") ? `${id}-DEV` : id;
}

export class IdosBackend implements Backend {
  readonly kind = "idos" as const;
  private client: IdosClient | null = null;
  private connected = false;
  /**
   * iDos rate-limits leaderboard calls: back-to-back requests get 429 and the SDK retries ~2 s later
   * (bursts stall up to ~13 s). Spaced at least GAP_MS apart they answer in ~0.3 s, so reads and
   * submits share one queue with that spacing.
   */
  private queue: Promise<unknown> = Promise.resolve();
  private lastStart = 0;
  private inflight = new Map<string, Promise<BoardResult>>();

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.lastStart + GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastStart = Date.now();
      return task();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
  readonly titleId: string;

  /** Pass the host's signed-in client inside an iDos app; standalone builds create their own. */
  constructor(client?: IdosClient) {
    this.client = client ?? null;
    this.titleId = resolveTitleId();
  }

  get online(): boolean {
    return this.connected;
  }

  get userId(): string | null {
    return this.client?.auth.context?.userID ?? null;
  }

  async connect(): Promise<{ ok: boolean; error?: string }> {
    try {
      if (!this.client) {
        const { createIDosGamesClient } = await import("@idosgames/core");
        this.client = createIDosGamesClient({ titleID: this.titleId, throttleMs: 0 });
      }
      const client = this.client;
      if (client.auth.isLoggedIn) {
        this.connected = true;
        return { ok: true };
      }
      const auto = await withTimeout(client.auth.autoLogin(), 8000);
      if (auto && auto.ok) {
        this.connected = true;
        return { ok: true };
      }
      const guest = await withTimeout(client.auth.loginWithDeviceID(), 10000);
      if (guest && guest.ok) {
        this.connected = true;
        return { ok: true };
      }
      return { ok: false, error: guest && !guest.ok ? guest.error : "timeout" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async submitScore(boardId: string, score: number): Promise<{ ok: boolean; error?: string }> {
    if (!this.client || !this.connected) return { ok: false, error: "offline" };
    const s = Math.round(score);
    if (s <= 0) return { ok: true };
    const client = this.client;
    try {
      // a hung call must not block the queue for everything after it
      const res = await this.serial(() => withTimeout(client.leaderboard.submitScore(boardId, s), 8000));
      if (!res) return { ok: false, error: "timeout" };
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  getBoard(boardId: string): Promise<BoardResult> {
    if (!this.client || !this.connected) return Promise.resolve({ ok: false, error: "offline" });
    const pending = this.inflight.get(boardId);
    if (pending) return pending;
    const run = this.serial(() => this.fetchBoard(boardId));
    this.inflight.set(boardId, run);
    void run.finally(() => this.inflight.delete(boardId));
    return run;
  }

  private async fetchBoard(boardId: string): Promise<BoardResult> {
    if (!this.client || !this.connected) return { ok: false, error: "offline" };
    try {
      const res = await withTimeout(this.client.leaderboard.getLeaderboard(boardId), 8000);
      if (!res) return { ok: false, error: "timeout" };
      if (!res.ok) return { ok: false, error: res.error };
      const rows = (res.data.TopUsers ?? []).map((u, i) => ({
        userId: u.UserID,
        name: (u.PublicProfile?.Username as string | null | undefined) || `Студент ${u.UserID.slice(-4)}`,
        score: Number(u.Score ?? 0),
        rank: Number(u.Rank ?? i + 1),
      }));
      return { ok: true, rows, total: Number(res.data.TotalParticipants ?? rows.length) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async setName(name: string): Promise<void> {
    if (!this.client || !this.connected) return;
    try {
      await this.client.user.changeUsername(name);
    } catch {
      /* name stays local */
    }
  }

  async linkWallet(address: string, signMessage: (msg: Uint8Array) => Promise<Uint8Array>): Promise<{ ok: boolean; error?: string }> {
    if (!this.client || !this.connected) return { ok: false, error: "Нет связи с сервером. Повторите, когда игра будет онлайн." };
    const step1 = await this.client.auth.linkWallet(address, "solana");
    if (!step1.ok) return { ok: false, error: step1.error };
    if (step1.data.Linked) return { ok: true };
    const challenge = step1.data.Challenge;
    if (!challenge) return { ok: false, error: "Сервер не ответил. Повторите позже." };
    const sig = await signMessage(new TextEncoder().encode(challenge));
    // Same encoding as @idosgames/wallet: 0x-prefixed hex of the raw signature bytes.
    const hex = "0x" + Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
    const step2 = await this.client.auth.linkWallet(address, "solana", hex);
    return step2.ok ? { ok: true } : { ok: false, error: step2.error };
  }

  logEvent(name: string, params?: Record<string, string | number | boolean>, value?: number): void {
    if (!this.client || !this.connected) return;
    try {
      this.client.analytics.logEvent(name, params, value);
    } catch {
      /* analytics is optional */
    }
  }
}

/** Minimum spacing between the starts of two leaderboard calls (measured: 0.4 s already avoids 429). */
const GAP_MS = 700;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}
