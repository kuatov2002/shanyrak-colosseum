// Opt-in on-chain actions. Each has an explicit status the UI shows:
// idle → awaiting-wallet (sign in your wallet) → sending → success | error (with "Повторить").
// None of them is required for gameplay; none moves value except paying a devnet fee.

import bs58 from "bs58";
import { Emitter } from "../core/emitter";
import type { Store } from "../core/state";
import { dayKey } from "../core/time";
import { SOLANA } from "./config";
import { describeRpcError } from "./token";
import { describeWalletError, sleep, type WalletManager } from "./wallet";

export type ActionId = "studentId" | "recordScore" | "airdrop";
export type ActionStatus = "idle" | "awaiting-wallet" | "sending" | "success" | "error";

export interface ActionState {
  status: ActionStatus;
  message: string;
  signature?: string;
  explorer?: string;
}

export const STATUS_LABEL: Record<ActionStatus, string> = {
  idle: "Готово к действию",
  "awaiting-wallet": "Ожидание кошелька — подтвердите в окне кошелька",
  sending: "Отправка в сеть…",
  success: "Успех",
  error: "Ошибка",
};

export class SolanaActions {
  readonly changed = new Emitter<void>();
  readonly state: Record<ActionId, ActionState> = {
    studentId: { status: "idle", message: "" },
    recordScore: { status: "idle", message: "" },
    airdrop: { status: "idle", message: "" },
  };

  constructor(
    private store: Store,
    private wallet: WalletManager,
    private track: (name: string, params: Record<string, string | number | boolean>) => void,
  ) {}

  private set(id: ActionId, s: Partial<ActionState>): void {
    this.state[id] = { ...this.state[id], ...s };
    this.changed.emit();
    if (s.status === "success" || s.status === "error") this.track("onchain_action", { action: id, status: s.status, mock: this.wallet.isMock });
  }

  private busy(id: ActionId): boolean {
    const st = this.state[id].status;
    return st === "awaiting-wallet" || st === "sending";
  }

  /** Student ID: an off-chain signature proving the player owns the wallet. Free, no transaction. */
  async linkStudentId(): Promise<void> {
    const adapter = this.wallet.adapter;
    const address = this.wallet.address;
    if (this.busy("studentId")) return;
    if (!adapter || !address) {
      this.set("studentId", { status: "error", message: "Сначала подключите кошелёк." });
      return;
    }
    const d = this.store.data;
    const text = [
      "Шанырак: Кампус-Башня — студенческий билет",
      `Игрок: ${d.player.name}`,
      `Факультет: ${d.player.faculty ?? "не выбран"}`,
      `Кошелёк: ${address}`,
      `Дата: ${new Date().toISOString()}`,
      "Эта подпись бесплатна и не создаёт транзакцию.",
    ].join("\n");
    this.set("studentId", { status: "awaiting-wallet", message: "Подпишите сообщение в кошельке (бесплатно)." });
    try {
      const sig = await adapter.signMessage(new TextEncoder().encode(text));
      const signature = bs58.encode(sig);
      this.store.mutate((s) => {
        s.wallet.address = address;
        s.wallet.walletName = adapter.option.name;
        s.wallet.studentIdSig = signature;
        s.wallet.records.unshift({ kind: "student-id", signature, at: Date.now(), cluster: this.wallet.isMock ? "mock" : "mainnet", note: "Подпись студенческого билета" });
      });
      this.set("studentId", { status: "success", message: this.wallet.isMock ? "Билет подписан демо-кошельком (имитация)." : "Студенческий билет подписан вашим кошельком.", signature });
    } catch (err) {
      this.set("studentId", { status: "error", message: describeWalletError(err) });
    }
  }

  /** Record the best result as a Memo transaction on devnet (player pays a devnet fee). */
  async recordScore(score: number, height: number): Promise<void> {
    const adapter = this.wallet.adapter;
    const address = this.wallet.address;
    if (this.busy("recordScore")) return;
    if (!adapter || !address) {
      this.set("recordScore", { status: "error", message: "Сначала подключите кошелёк." });
      return;
    }
    if (score <= 0) {
      this.set("recordScore", { status: "error", message: "Сначала сыграйте раунд — записывать пока нечего." });
      return;
    }
    const d = this.store.data;
    const memo = JSON.stringify({ g: "shanyrak", v: 1, t: "JE8W0Z54", s: score, h: height, f: d.player.faculty, d: dayKey() });

    if (this.wallet.isMock) {
      this.set("recordScore", { status: "awaiting-wallet", message: "Демо-кошелёк «подписывает»…" });
      await sleep(800);
      this.set("recordScore", { status: "sending", message: "Имитация отправки (в сеть ничего не уходит)…" });
      await sleep(1100);
      const signature = `mock-${Math.random().toString(36).slice(2, 12)}`;
      this.store.mutate((s) => {
        s.wallet.records.unshift({ kind: "score-memo", signature, at: Date.now(), cluster: "mock", note: `Рекорд ${score} очков / ${height} эт. (демо)` });
        const best = s.scores.find((x) => x.score === score);
        if (best) best.verifiedTx = signature;
      });
      this.set("recordScore", { status: "success", message: "Демо: так выглядит подтверждённая запись. Подключите настоящий кошелёк для devnet.", signature });
      return;
    }

    this.set("recordScore", { status: "awaiting-wallet", message: "Подтвердите транзакцию в кошельке (devnet, комиссия в тестовых SOL)." });
    try {
      const web3 = await import("@solana/web3.js");
      const { Buffer } = await import("buffer");
      const conn = new web3.Connection(SOLANA.devnetRpc, "confirmed");
      const payer = new web3.PublicKey(address);
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
      const tx = new web3.Transaction({ feePayer: payer, blockhash, lastValidBlockHeight }).add(
        new web3.TransactionInstruction({
          programId: new web3.PublicKey(SOLANA.memoProgramId),
          keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
          data: Buffer.from(memo, "utf8"),
        }),
      );
      const signed = await adapter.signTransaction(tx);
      this.set("recordScore", { status: "sending", message: "Отправляем в Solana devnet…" });
      const signature = await conn.sendRawTransaction(signed, { skipPreflight: false });
      await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      const explorer = SOLANA.explorerTx(signature, "devnet");
      this.store.mutate((s) => {
        s.wallet.records.unshift({ kind: "score-memo", signature, at: Date.now(), cluster: "devnet", note: `Рекорд ${score} очков / ${height} эт.` });
        const best = s.scores.find((x) => x.score === score);
        if (best) best.verifiedTx = signature;
      });
      this.set("recordScore", { status: "success", message: "Рекорд записан в Solana devnet.", signature, explorer });
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      let message = describeWalletError(err);
      if (/insufficient|no record of a prior credit|0x1\b/i.test(msg)) message = "Недостаточно devnet SOL для комиссии. Нажмите «Получить тестовые SOL» и повторите.";
      else if (/fetch|network|blockhash/i.test(msg)) message = describeRpcError(err);
      this.set("recordScore", { status: "error", message });
    }
  }

  /** Devnet airdrop of test SOL to pay devnet fees (free, rate-limited by Solana). */
  async airdrop(): Promise<void> {
    const address = this.wallet.address;
    if (this.busy("airdrop")) return;
    if (!address || this.wallet.isMock) {
      this.set("airdrop", { status: "error", message: this.wallet.isMock ? "Демо-кошельку тестовые SOL не нужны." : "Сначала подключите кошелёк." });
      return;
    }
    this.set("airdrop", { status: "sending", message: "Запрашиваем 0.5 тестовых SOL в devnet…" });
    try {
      const web3 = await import("@solana/web3.js");
      const conn = new web3.Connection(SOLANA.devnetRpc, "confirmed");
      const signature = await conn.requestAirdrop(new web3.PublicKey(address), 0.5 * web3.LAMPORTS_PER_SOL);
      const bh = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature, ...bh }, "confirmed");
      this.store.mutate((s) => {
        s.wallet.records.unshift({ kind: "airdrop", signature, at: Date.now(), cluster: "devnet", note: "0.5 тестовых SOL" });
      });
      this.set("airdrop", { status: "success", message: "Начислено 0.5 devnet SOL.", signature, explorer: SOLANA.explorerTx(signature, "devnet") });
    } catch (err) {
      const msg = describeRpcError(err);
      this.set("airdrop", {
        status: "error",
        message: /429|лимит|Too many/i.test(msg) ? "Кран devnet перегружен. Попробуйте позже или faucet.solana.com." : msg,
      });
    }
  }

  reset(id: ActionId): void {
    this.set(id, { status: "idle", message: "", signature: undefined, explorer: undefined });
  }
}
