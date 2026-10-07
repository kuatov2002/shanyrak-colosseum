// iDos Games backend for title JE8W0Z54 via the official SDK (@idosgames/core 0.21.2).
// Used for: silent guest (device-id) login, server-authoritative leaderboards and custom
// analytics events. Every call is best-effort: on any failure the game keeps running offline.
//
// SDK calls used here (verified against the package's type definitions):
//   createIDosGamesClient({ titleID, throttleMs })
//   client.auth.autoLogin() / client.auth.loginWithDeviceID() / client.auth.context?.userID
//   client.leaderboard.submitScore(id, score) / client.leaderboard.getLeaderboard(id)
//   client.user.changeUsername(name)
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
    try {
      const res = await this.client.leaderboard.submitScore(boardId, s);
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async getBoard(boardId: string): Promise<BoardResult> {
    if (!this.client || !this.connected) return { ok: false, error: "offline" };
    try {
      const res = await this.client.leaderboard.getLeaderboard(boardId);
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

  logEvent(name: string, params?: Record<string, string | number | boolean>, value?: number): void {
    if (!this.client || !this.connected) return;
    try {
      this.client.analytics.logEvent(name, params, value);
    } catch {
      /* analytics is optional */
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}
