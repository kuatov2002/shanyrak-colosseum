// Backend seam. The game talks to this interface only; LocalBackend works fully offline, and
// IdosBackend (./idos.ts) maps the same calls onto the iDos Games SDK. Swapping storage/servers
// never touches gameplay or UI code.

export interface BoardRow {
  userId: string;
  name: string;
  score: number;
  rank: number;
}

export type BoardResult = { ok: true; rows: BoardRow[]; total: number } | { ok: false; error: string };

export interface Backend {
  readonly kind: "local" | "idos";
  readonly online: boolean;
  readonly userId: string | null;
  readonly titleId: string | null;
  connect(): Promise<{ ok: boolean; error?: string }>;
  submitScore(boardId: string, score: number): Promise<{ ok: boolean; error?: string }>;
  getBoard(boardId: string): Promise<BoardResult>;
  setName(name: string): Promise<void>;
  /**
   * Link a Solana wallet to the signed-in profile (iDos challenge → wallet signMessage → verify).
   * No transaction, no fee.
   */
  linkWallet(address: string, signMessage: (msg: Uint8Array) => Promise<Uint8Array>): Promise<{ ok: boolean; error?: string }>;
  logEvent(name: string, params?: Record<string, string | number | boolean>, value?: number): void;
}

/** Offline backend: everything is local; boards come from the save (see social/leaderboards). */
export class LocalBackend implements Backend {
  readonly kind = "local" as const;
  readonly online = false;
  readonly userId = null;
  readonly titleId = null;
  async connect(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "offline" };
  }
  async submitScore(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "offline" };
  }
  async getBoard(): Promise<BoardResult> {
    return { ok: false, error: "offline" };
  }
  async setName(): Promise<void> {}
  async linkWallet(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "Нужен онлайн-режим: включите «Онлайн-рейтинги» в настройках и проверьте сеть." };
  }
  logEvent(): void {}
}
