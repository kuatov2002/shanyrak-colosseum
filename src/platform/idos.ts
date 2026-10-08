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

import { explainAuthError, kindOf, walletLogin, type AccountInfo, type AuthResult } from "./account";
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

  /** The SDK client, created on first use (the SDK chunk loads lazily). */
  async sdk(): Promise<IdosClient> {
    if (!this.client) {
      const { createIDosGamesClient } = await import("@idosgames/core");
      this.client = createIDosGamesClient({ titleID: this.titleId, throttleMs: 0 });
    }
    return this.client;
  }

  /** The signed-in account, as the SDK remembers it. */
  get account(): AccountInfo | null {
    if (!this.client || !this.connected) return null;
    const kind = kindOf(this.client.auth.lastAuthType);
    return kind ? { kind } : null;
  }

  /**
   * Restore a session without asking the player: an SSO code from idosgames.com first, then the
   * remembered session (refresh token / replayable method). Never creates a guest by itself:
   * needsLogin means the player has to pick a method on the sign-in screen.
   */
  async resume(): Promise<{ ok: true; account: AccountInfo } | { ok: false; needsLogin: boolean; error?: string }> {
    try {
      const client = await this.sdk();
      const { readSsoCodeFromUrl } = await import("@idosgames/core");
      const sso = readSsoCodeFromUrl();
      if (sso) {
        const res = await withTimeout(client.auth.loginWithSsoCode(sso.code), 10000);
        if (res && res.ok) return this.signedIn({ kind: "idos" });
        return { ok: false, needsLogin: true, error: explainAuthError(res ? res.error : "timeout") };
      }
      if (client.auth.isLoggedIn) return this.signedIn({ kind: kindOf(client.auth.lastAuthType) ?? "guest" });
      if (client.auth.lastAuthType === "None") return { ok: false, needsLogin: true };
      // a few quick retries on a flaky connection before giving up on the remembered session
      let res = await withTimeout(client.auth.autoLogin(), 8000);
      for (const wait of [1200, 2500]) {
        if (!res || res.ok || res.reason !== "connection") break;
        await new Promise((r) => setTimeout(r, wait));
        res = await withTimeout(client.auth.autoLogin(), 8000);
      }
      if (res && res.ok) return this.signedIn({ kind: kindOf(client.auth.lastAuthType) ?? "guest" });
      const offline = !res || res.reason === "connection";
      return { ok: false, needsLogin: !offline, error: explainAuthError(res ? res.error : "timeout") };
    } catch (err) {
      return { ok: false, needsLogin: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Backend interface: connect = resume (there is no silent guest any more). */
  async connect(): Promise<{ ok: boolean; error?: string }> {
    const res = await this.resume();
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }

  private signedIn(account: AccountInfo): { ok: true; account: AccountInfo } {
    this.connected = true;
    return { ok: true, account };
  }

  private async run(remember: boolean, login: (c: IdosClient) => Promise<{ ok: boolean; error?: string }>, account: AccountInfo): Promise<AuthResult> {
    try {
      const client = await this.sdk();
      client.auth.setRememberSession(remember);
      const res = await withTimeout(login(client), 20000);
      if (!res) return { ok: false, error: explainAuthError("timeout") };
      if (!res.ok) return { ok: false, error: explainAuthError(res.error) };
      this.connected = true;
      return { ok: true, account };
    } catch (err) {
      return { ok: false, error: explainAuthError(err instanceof Error ? err.message : String(err)) };
    }
  }

  loginGuest(remember: boolean): Promise<AuthResult> {
    return this.run(remember, (c) => c.auth.loginWithDeviceID(), { kind: "guest" });
  }

  loginEmail(email: string, password: string, remember: boolean): Promise<AuthResult> {
    return this.run(remember, (c) => c.auth.loginWithEmail(email, password), { kind: "email" });
  }

  confirmEmail(email: string, code: string, remember: boolean): Promise<AuthResult> {
    return this.run(remember, (c) => c.auth.confirmEmailRegistration(email, code.trim()), { kind: "email" });
  }

  loginTelegram(remember: boolean): Promise<AuthResult> {
    return this.run(remember, (c) => c.auth.loginWithTelegram(), { kind: "telegram" });
  }

  /** Start an e-mail registration: the server mails a code; the account appears on confirmEmail. */
  async registerEmail(email: string, password: string, remember: boolean): Promise<{ ok: true; resendIn: number } | { ok: false; error: string }> {
    try {
      const client = await this.sdk();
      client.auth.setRememberSession(remember);
      const res = await client.auth.registerWithEmail(email, password);
      if (!res.ok) return { ok: false, error: explainAuthError(res.error) };
      const data = res.data as { resendCooldownSeconds?: number };
      return { ok: true, resendIn: data.resendCooldownSeconds && data.resendCooldownSeconds > 0 ? data.resendCooldownSeconds : 60 };
    } catch (err) {
      return { ok: false, error: explainAuthError(err instanceof Error ? err.message : String(err)) };
    }
  }

  async resendCode(email: string): Promise<string | null> {
    const res = await (await this.sdk()).auth.resendVerificationCode(email);
    return res.ok ? null : explainAuthError(res.error);
  }

  async forgotPassword(email: string): Promise<string | null> {
    const res = await (await this.sdk()).auth.forgotPassword(email);
    return !res.ok && res.error === "EMAIL_SENDER_NOT_CONFIGURED" ? explainAuthError(res.error) : null;
  }

  async resetPassword(email: string, code: string, password: string): Promise<string | null> {
    const res = await (await this.sdk()).auth.resetPassword(email, code.trim(), password);
    return res.ok ? null : explainAuthError(res.error);
  }

  /** Solana wallet sign-in (see platform/account.ts). */
  async loginWallet(wallet: { address: string; signMessage: (m: Uint8Array) => Promise<Uint8Array> } | null, remember: boolean): Promise<AuthResult> {
    const client = await this.sdk();
    client.auth.setRememberSession(remember);
    const res = await walletLogin(client, wallet);
    if (res.ok) this.connected = true;
    return res;
  }

  /**
   * «Войти через iDos Games»: resume a live platform session if there is one, otherwise go to
   * idosgames.com/sso, which comes back here with a one-time code (handled by resume()).
   */
  async loginIdos(remember: boolean): Promise<AuthResult | "redirecting"> {
    const client = await this.sdk();
    client.auth.setRememberSession(remember);
    if (client.auth.lastAuthType === "iDosGames") {
      const res = await withTimeout(client.auth.autoLogin(), 8000);
      if (res && res.ok) return this.signedIn({ kind: "idos" });
    }
    const { beginSsoRedirect } = await import("@idosgames/core");
    beginSsoRedirect({ titleID: client.titleID });
    return "redirecting";
  }

  /** Sign out: the next launch opens the sign-in screen. */
  logout(): void {
    this.client?.auth.logout();
    this.connected = false;
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
