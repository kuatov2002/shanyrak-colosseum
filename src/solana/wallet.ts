// Wallet layer. Discovers wallets through the Wallet Standard (Phantom, Solflare, Backpack… all
// register themselves) and falls back to legacy injected providers. A clearly labelled demo wallet
// lets judges try the flow without an extension. No private keys or seed phrases ever touch the game:
// every signature happens inside the wallet, after the player presses a button.

import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { Emitter } from "../core/emitter";

export type WalletKind = "standard" | "injected" | "mock";

export interface WalletOption {
  id: string;
  name: string;
  icon: string | null;
  kind: WalletKind;
}

/** Minimal transaction surface the actions need (a @solana/web3.js Transaction). */
export interface SignableTx {
  serialize(opts?: { requireAllSignatures?: boolean; verifySignatures?: boolean }): Uint8Array;
}

export interface WalletAdapter {
  readonly option: WalletOption;
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  /** Signs a transaction and returns the fully signed wire bytes. */
  signTransaction(tx: SignableTx): Promise<Uint8Array>;
}

// ── Wallet Standard ────────────────────────────────────────────────────────

type ConnectFeature = { connect(input?: { silent?: boolean }): Promise<{ accounts: readonly WalletAccount[] }> };
type DisconnectFeature = { disconnect(): Promise<void> };
type SignMessageFeature = { signMessage(...inputs: { account: WalletAccount; message: Uint8Array }[]): Promise<{ signature: Uint8Array }[]> };
type SignTxFeature = {
  signTransaction(...inputs: { account: WalletAccount; transaction: Uint8Array; chain?: string }[]): Promise<{ signedTransaction: Uint8Array }[]>;
};

class StandardAdapter implements WalletAdapter {
  private account: WalletAccount | null = null;
  readonly option: WalletOption;
  constructor(private wallet: Wallet) {
    this.option = { id: `std:${wallet.name}`, name: wallet.name, icon: wallet.icon, kind: "standard" };
  }
  private feature<T>(name: string): T {
    const f = (this.wallet.features as Record<string, unknown>)[name];
    if (!f) throw new Error(`Кошелёк не поддерживает ${name}`);
    return f as T;
  }
  async connect(): Promise<string> {
    const { accounts } = await this.feature<ConnectFeature>("standard:connect").connect();
    const acc = accounts.find((a) => a.chains.some((c) => c.startsWith("solana:"))) ?? accounts[0];
    if (!acc) throw new Error("Кошелёк не вернул аккаунт");
    this.account = acc;
    return acc.address;
  }
  async disconnect(): Promise<void> {
    const f = (this.wallet.features as Record<string, unknown>)["standard:disconnect"] as DisconnectFeature | undefined;
    await f?.disconnect().catch(() => undefined);
    this.account = null;
  }
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.account) throw new Error("Кошелёк не подключён");
    const [out] = await this.feature<SignMessageFeature>("solana:signMessage").signMessage({ account: this.account, message });
    return out.signature;
  }
  async signTransaction(tx: SignableTx): Promise<Uint8Array> {
    if (!this.account) throw new Error("Кошелёк не подключён");
    const bytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const [out] = await this.feature<SignTxFeature>("solana:signTransaction").signTransaction({
      account: this.account,
      transaction: bytes,
      chain: "solana:devnet",
    });
    return out.signedTransaction;
  }
}

// ── Legacy injected providers (window.phantom.solana, window.solflare, window.solana) ──

interface InjectedProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey?: { toString(): string } } | void>;
  disconnect?(): Promise<void>;
  signMessage(msg: Uint8Array, display?: string): Promise<{ signature: Uint8Array } | Uint8Array>;
  signTransaction<T>(tx: T): Promise<T>;
}

class InjectedAdapter implements WalletAdapter {
  readonly option: WalletOption;
  constructor(
    private provider: InjectedProvider,
    name: string,
  ) {
    this.option = { id: `inj:${name}`, name, icon: null, kind: "injected" };
  }
  async connect(): Promise<string> {
    const res = await this.provider.connect();
    const key = (res && "publicKey" in res ? res.publicKey : null) ?? this.provider.publicKey;
    if (!key) throw new Error("Кошелёк не вернул адрес");
    return key.toString();
  }
  async disconnect(): Promise<void> {
    await this.provider.disconnect?.().catch(() => undefined);
  }
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const res = await this.provider.signMessage(message, "utf8");
    return res instanceof Uint8Array ? res : res.signature;
  }
  async signTransaction(tx: SignableTx): Promise<Uint8Array> {
    const signed = await this.provider.signTransaction(tx);
    return signed.serialize();
  }
}

// ── Demo wallet (no extension needed; nothing is sent on-chain) ──────────────

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function fakeBase58(n: number): string {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => B58[b % 58]).join("");
}

export class MockAdapter implements WalletAdapter {
  readonly option: WalletOption = { id: "mock", name: "Демо-кошелёк", icon: null, kind: "mock" };
  async connect(): Promise<string> {
    await sleep(500);
    let addr: string | null = null;
    try {
      addr = localStorage.getItem("shanyrak.mockWallet");
    } catch {
      /* ignore */
    }
    if (!addr) {
      addr = fakeBase58(44);
      try {
        localStorage.setItem("shanyrak.mockWallet", addr);
      } catch {
        /* ignore */
      }
    }
    return addr;
  }
  async disconnect(): Promise<void> {}
  async signMessage(): Promise<Uint8Array> {
    await sleep(700);
    const sig = new Uint8Array(64);
    crypto.getRandomValues(sig);
    return sig;
  }
  async signTransaction(): Promise<Uint8Array> {
    throw new Error("mock");
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Manager ───────────────────────────────────────────────────────────────

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export class WalletManager {
  status: WalletStatus = "disconnected";
  address: string | null = null;
  adapter: WalletAdapter | null = null;
  error: string | null = null;
  readonly changed = new Emitter<void>();
  private standard: Wallet[] = [];

  constructor() {
    try {
      const api = getWallets();
      const refresh = () => {
        this.standard = api.get().filter((w) => {
          const solana = w.chains.some((c) => c.startsWith("solana:"));
          return solana && "standard:connect" in w.features;
        });
        this.changed.emit();
      };
      refresh();
      api.on("register", refresh);
      api.on("unregister", refresh);
    } catch (err) {
      console.warn("[wallet] wallet-standard unavailable", err);
    }
  }

  options(): WalletOption[] {
    const list: WalletOption[] = this.standard.map((w) => new StandardAdapter(w).option);
    const names = new Set(list.map((o) => o.name.toLowerCase()));
    for (const [name] of this.injected()) if (!names.has(name.toLowerCase())) list.push({ id: `inj:${name}`, name, icon: null, kind: "injected" });
    list.push({ id: "mock", name: "Демо-кошелёк", icon: null, kind: "mock" });
    return list;
  }

  private injected(): [string, InjectedProvider][] {
    const w = window as unknown as { phantom?: { solana?: InjectedProvider }; solflare?: InjectedProvider; solana?: InjectedProvider };
    const out: [string, InjectedProvider][] = [];
    if (w.phantom?.solana) out.push(["Phantom", w.phantom.solana]);
    if (w.solflare) out.push(["Solflare", w.solflare]);
    if (w.solana && w.solana !== w.phantom?.solana && w.solana !== w.solflare) out.push(["Solana-кошелёк", w.solana]);
    return out;
  }

  private makeAdapter(id: string): WalletAdapter {
    if (id === "mock") return new MockAdapter();
    if (id.startsWith("std:")) {
      const w = this.standard.find((x) => `std:${x.name}` === id);
      if (w) return new StandardAdapter(w);
    }
    if (id.startsWith("inj:")) {
      const p = this.injected().find(([n]) => `inj:${n}` === id);
      if (p) return new InjectedAdapter(p[1], p[0]);
    }
    throw new Error("Кошелёк не найден — обновите страницу после установки расширения");
  }

  async connect(id: string): Promise<boolean> {
    this.status = "connecting";
    this.error = null;
    this.changed.emit();
    try {
      const adapter = this.makeAdapter(id);
      const address = await adapter.connect();
      this.adapter = adapter;
      this.address = address;
      this.status = "connected";
      this.changed.emit();
      return true;
    } catch (err) {
      this.status = "error";
      this.error = describeWalletError(err);
      this.changed.emit();
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.adapter?.disconnect();
    this.adapter = null;
    this.address = null;
    this.status = "disconnected";
    this.error = null;
    this.changed.emit();
  }

  get isMock(): boolean {
    return this.adapter?.option.kind === "mock";
  }
}

export function describeWalletError(err: unknown): string {
  const e = err as { code?: number; message?: string } | undefined;
  const msg = e?.message ?? String(err);
  if (e?.code === 4001 || /reject|denied|cancel/i.test(msg)) return "Вы отменили действие в кошельке. Ничего не отправлено.";
  if (/not found|не найден/i.test(msg)) return msg;
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
