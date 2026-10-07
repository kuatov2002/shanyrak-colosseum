// Opt-in Solana actions (mainnet). Each has an explicit status the UI shows:
// idle → checking (simulation) → awaiting-wallet (sign in your wallet) → sending → success | error
// (with "Повторить"). None of them is required for gameplay.

import { Emitter } from "../core/emitter";
import type { Store } from "../core/state";
import type { Backend } from "../platform/backend";
import { SOLANA } from "./config";
import { checkPendingMint, executeMint, fmtSol, isStale, MintError, prepareMint, type PreparedMint } from "./nft";
import { describeRpcError } from "./token";
import { describeWalletError, type WalletManager } from "./wallet";

export type ActionStatus = "idle" | "checking" | "ready" | "awaiting-wallet" | "sending" | "success" | "error";

export interface ActionState {
  status: ActionStatus;
  message: string;
  signature?: string;
  explorer?: string;
  prepared?: PreparedMint;
}

export const STATUS_LABEL: Record<ActionStatus, string> = {
  idle: "Готово к действию",
  checking: "Проверяем транзакцию (симуляция)…",
  ready: "Проверено — можно подписать",
  "awaiting-wallet": "Ожидание кошелька — подтвердите в окне кошелька",
  sending: "Отправка в сеть…",
  success: "Успех",
  error: "Ошибка",
};

export class SolanaActions {
  readonly changed = new Emitter<void>();
  readonly state: Record<string, ActionState> = { link: { status: "idle", message: "" } };

  constructor(
    private store: Store,
    private wallet: WalletManager,
    private backend: () => Backend,
    private track: (name: string, params: Record<string, string | number | boolean>) => void,
  ) {}

  get(id: string): ActionState {
    return this.state[id] ?? (this.state[id] = { status: "idle", message: "" });
  }

  private set(id: string, s: Partial<ActionState>): void {
    this.state[id] = { ...this.get(id), ...s };
    this.changed.emit();
    if (s.status === "success" || s.status === "error") this.track("onchain_action", { action: id, status: s.status });
  }

  /** A prepared mint whose simulated amount and balance are too old to show as current. */
  stale(id: string): boolean {
    const st = this.get(id);
    return st.status === "ready" && isStale(st.prepared);
  }

  busy(id: string): boolean {
    const st = this.get(id).status;
    return st === "checking" || st === "awaiting-wallet" || st === "sending";
  }

  /** Link the wallet to the iDos profile: iDos challenge → wallet signMessage → iDos verifies. */
  async linkProfile(): Promise<void> {
    const adapter = this.wallet.adapter;
    const address = this.wallet.address;
    if (this.busy("link")) return;
    if (!adapter || !address) {
      this.set("link", { status: "error", message: "Сначала подключите кошелёк." });
      return;
    }
    this.set("link", { status: "awaiting-wallet", message: "Подпишите сообщение iDos в кошельке. Это бесплатно и не создаёт транзакцию." });
    try {
      const res = await this.backend().linkWallet(address, (msg) => adapter.signMessage(msg));
      if (!res.ok) {
        this.set("link", { status: "error", message: `iDos не привязал кошелёк: ${res.error ?? "неизвестная ошибка"}` });
        return;
      }
      this.store.mutate((s) => {
        s.wallet.address = address;
        s.wallet.walletName = adapter.option.name;
        s.wallet.linkedToProfile = true;
        s.wallet.records.unshift({ kind: "wallet-link", signature: "", at: Date.now(), note: "Кошелёк привязан к профилю iDos" });
      });
      this.set("link", { status: "success", message: "Кошелёк привязан к вашему профилю iDos." });
    } catch (err) {
      this.set("link", { status: "error", message: describeWalletError(err) });
    }
  }

  /** Step 1: simulate the badge mint and compute the exact deposit and fee. */
  async prepareBadge(id: string): Promise<void> {
    const key = `mint:${id}`;
    const address = this.wallet.address;
    if (this.busy(key)) return;
    if (!address) {
      this.set(key, { status: "error", message: "Сначала подключите кошелёк." });
      return;
    }
    // An earlier attempt timed out after sending: find out what happened before minting again.
    const pending = this.store.data.wallet.pendingMints[id];
    if (pending) {
      this.set(key, { status: "checking", message: "Проверяем в сети прошлую транзакцию…", prepared: undefined });
      try {
        const outcome = await checkPendingMint(pending);
        if (outcome === "landed") {
          this.store.mutate((s) => {
            s.wallet.minted[id] = { asset: pending.asset, signature: pending.signature, at: pending.at };
            s.wallet.records.unshift({ kind: "nft-mint", signature: pending.signature, at: pending.at, note: `Значок ${id} · ${pending.asset.slice(0, 6)}… (подтверждён позже)` });
            delete s.wallet.pendingMints[id];
          });
          this.set(key, { status: "success", signature: pending.signature, explorer: SOLANA.explorerTx(pending.signature), message: "Прошлая транзакция всё-таки прошла — значок уже ваш. Повторный минт не нужен." });
          return;
        }
        if (outcome === "pending") {
          this.set(key, {
            status: "error",
            signature: pending.signature,
            explorer: SOLANA.explorerTx(pending.signature),
            message: "Прошлая транзакция ещё может пройти. Подождите минуту и нажмите «Повторить» — игра проверит её снова.",
          });
          return;
        }
        // failed or expired: it can never land, a new mint is safe
        this.store.mutate((s) => {
          delete s.wallet.pendingMints[id];
        });
      } catch (err) {
        this.set(key, { status: "error", message: describeRpcError(err) });
        return;
      }
    }
    this.set(key, { status: "checking", message: "Симулируем транзакцию в Solana mainnet…", prepared: undefined, signature: undefined, explorer: undefined });
    try {
      const p = await prepareMint(address, id);
      const total = p.rentLamports + p.feeLamports;
      if (!p.affordable) {
        this.set(key, {
          status: "error",
          prepared: p,
          message: `Нужно ≈ ${fmtSol(total)}, на кошельке ${fmtSol(p.balanceLamports)}. Пополните SOL или вернитесь к игре — значок можно сминтить позже.`,
        });
        return;
      }
      this.set(key, { status: "ready", prepared: p, message: "" });
    } catch (err) {
      this.set(key, { status: "error", message: err instanceof MintError ? err.message : describeRpcError(err) });
    }
  }

  /** Step 2: the player confirmed the cost — sign in the wallet, send, confirm. */
  async confirmBadge(id: string): Promise<void> {
    const key = `mint:${id}`;
    const st = this.get(key);
    const adapter = this.wallet.adapter;
    const p = st.prepared;
    if (!p || st.status !== "ready" || !adapter) return;
    if (isStale(p)) {
      // The shown amount is old: re-simulate and let the player confirm the fresh one.
      await this.prepareBadge(id);
      if (this.get(key).status === "ready") this.set(key, { message: "Данные сети обновились — проверьте сумму и подпишите ещё раз." });
      return;
    }
    this.set(key, { status: "awaiting-wallet", message: "Подтвердите транзакцию в кошельке." });
    try {
      const signature = await executeMint(p, adapter, () => this.set(key, { status: "sending", message: "Транзакция отправлена. Обычно сеть подтверждает её за 5–20 секунд…" }));
      this.store.mutate((s) => {
        delete s.wallet.pendingMints[id];
        s.wallet.minted[id] = { asset: p.asset, signature, at: Date.now() };
        s.wallet.records.unshift({ kind: "nft-mint", signature, at: Date.now(), note: `Значок «${p.name}» · ${p.asset.slice(0, 6)}…` });
      });
      this.set(key, { status: "success", signature, explorer: SOLANA.explorerTx(signature), prepared: undefined, message: `Значок сминчен. Asset: ${p.asset.slice(0, 8)}…` });
    } catch (err) {
      if (err instanceof MintError && err.kind === "expired" && err.signature) {
        const signature = err.signature;
        this.store.mutate((s) => {
          s.wallet.pendingMints[id] = { asset: p.asset, signature, lastValidBlockHeight: p.lastValidBlockHeight, at: Date.now() };
        });
        this.set(key, { status: "error", message: err.message, signature, explorer: SOLANA.explorerTx(signature), prepared: undefined });
        return;
      }
      const msg =
        err instanceof MintError
          ? err.message
          : /reject|denied|cancel|4001/i.test(String((err as Error)?.message ?? err)) || (err as { code?: number })?.code === 4001
            ? "Вы отменили подпись. Ничего не списано — можно вернуться к игре."
            : /insufficient|0x1\b|debit/i.test(String((err as Error)?.message ?? err))
              ? "Недостаточно SOL для депозита и комиссии. Ничего не списано."
              : describeRpcError(err);
      this.set(key, { status: "error", message: msg, prepared: undefined });
    }
  }

  reset(id: string): void {
    this.set(id, { status: "idle", message: "", signature: undefined, explorer: undefined, prepared: undefined });
  }
}
