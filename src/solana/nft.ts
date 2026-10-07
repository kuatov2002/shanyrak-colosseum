// Achievement badges as standalone Metaplex Core assets (mainnet).
//
// Who signs: the PLAYER (payer + owner + update authority) and a ONE-TIME keypair for the new
// asset account, generated in the browser for this mint and discarded right after. There is no
// collection, so no collection authority and no project key anywhere in the bundle.
//
// Safety: the transaction is always simulated before the wallet is asked to sign; the exact rent
// deposit and network fee are computed from the simulation and shown to the player. Metadata and
// images live at the versioned iDos CDN path of the build (…/v/<buildId>/nft/…), so URIs of minted
// assets stay valid after later deploys.

import badges from "./nft-badges.json";
import { SOLANA } from "./config";
import { rpc } from "./rpc";
import type { SignableTx, WalletAdapter } from "./wallet";

export const MINTABLE_IDS = badges.badges.map((b) => b.id);

/** Versioned absolute base of this build on the iDos CDN, or null in local/dev builds. */
export function metadataBase(): string | null {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "";
  return /^https:\/\/static\.idos\.games\/drive\/app\/[^/]+\/v\/[^/]+\/$/.test(base) ? base : null;
}

export function metadataUri(id: string): string | null {
  const base = metadataBase();
  return base ? `${base}nft/${id}.json` : null;
}

// ── Instruction encoding (Metaplex Core CreateV1, Borsh) ─────────────────────

function borshString(s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  const out = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length, true);
  out.set(bytes, 4);
  return out;
}

/** CreateV1 { data_state: AccountState, name, uri, plugins: None } */
export function encodeCreateV1(name: string, uri: string): Uint8Array {
  const parts = [Uint8Array.of(0), Uint8Array.of(0), borshString(name), borshString(uri), Uint8Array.of(0)];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Expected asset account size (key + owner + update authority + name + uri + seq), for estimates. */
export function estimateAssetSize(name: string, uri: string): number {
  const enc = new TextEncoder();
  return 1 + 32 + 33 + 4 + enc.encode(name).length + 4 + enc.encode(uri).length + 1;
}

/** Buffer from the `buffer` package, robust to CJS/ESM interop differences between dev and build. */
async function loadBuffer(): Promise<typeof import("buffer").Buffer> {
  const mod = (await import("buffer")) as unknown as { Buffer?: typeof import("buffer").Buffer; default?: { Buffer?: typeof import("buffer").Buffer } };
  const B = mod.Buffer ?? mod.default?.Buffer;
  if (!B) throw new MintError("Не удалось загрузить модуль Buffer.", "config");
  return B;
}

function base64Length(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

// ── Prepare (simulate) → sign → send → confirm ─────────────────────────────

export interface PreparedMint {
  id: string;
  name: string;
  uri: string;
  asset: string;
  tx: SignableTx;
  rentLamports: number;
  feeLamports: number;
  balanceLamports: number;
  affordable: boolean;
  blockhash: string;
  lastValidBlockHeight: number;
  /** Simulation ran and succeeded (false when the payer cannot even cover the fee). */
  simulated: boolean;
  logs: string[];
  /** When the blockhash was fetched; a prepared mint older than ~45 s is re-simulated before signing. */
  preparedAt: number;
  /** Internal: the asset keypair (kept in memory only for this mint). */
  _assetSecret: Uint8Array;
}

/** A prepared mint goes stale long before its blockhash formally expires (~60–90 s). */
export const PREPARED_TTL_MS = 45_000;

export function isStale(p: PreparedMint | undefined, now = Date.now()): boolean {
  return !!p && now - p.preparedAt > PREPARED_TTL_MS;
}

export class MintError extends Error {
  constructor(
    message: string,
    readonly kind: "funds" | "rejected" | "rpc" | "program" | "expired" | "config",
    /** Set when the transaction was already sent: it must be checked on chain before any retry. */
    readonly signature?: string,
  ) {
    super(message);
  }
}

export const LAMPORTS = 1_000_000_000;
export const fmtSol = (lamports: number) => `${(lamports / LAMPORTS).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} SOL`;

export async function prepareMint(owner: string, id: string): Promise<PreparedMint> {
  const badge = badges.badges.find((b) => b.id === id);
  if (!badge) throw new MintError("Этот значок нельзя сминтить.", "config");
  const uri = metadataUri(id);
  if (!uri) throw new MintError("Минт доступен только в опубликованной на iDos версии игры (нужен постоянный адрес метаданных).", "config");
  const web3 = await import("@solana/web3.js");
  const Buffer = await loadBuffer();
  const conn = await rpc.connection();
  const payer = new web3.PublicKey(owner);
  const core = new web3.PublicKey(SOLANA.coreProgramId);
  const asset = web3.Keypair.generate();
  const none = { pubkey: core, isSigner: false, isWritable: false };
  const ix = new web3.TransactionInstruction({
    programId: core,
    keys: [
      { pubkey: asset.publicKey, isSigner: true, isWritable: true },
      none, // collection
      none, // authority (defaults to payer)
      { pubkey: payer, isSigner: true, isWritable: true },
      none, // owner (defaults to payer)
      none, // update authority (defaults to payer)
      { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      none, // log wrapper
    ],
    data: Buffer.from(encodeCreateV1(badge.name, uri)),
  });
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new web3.Transaction({ feePayer: payer, blockhash, lastValidBlockHeight }).add(ix);
  const message = tx.compileMessage();
  const balanceLamports = await conn.getBalance(payer);
  const feeLamports = (await conn.getFeeForMessage(message, "confirmed")).value ?? 5000;

  let size = estimateAssetSize(badge.name, uri);
  let simulated = false;
  let logs: string[] = [];
  const sim = await conn.simulateTransaction(new web3.VersionedTransaction(message), {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
    accounts: { encoding: "base64", addresses: [asset.publicKey.toBase58()] },
  });
  logs = sim.value.logs ?? [];
  const errText = sim.value.err ? JSON.stringify(sim.value.err) : "";
  if (!sim.value.err) {
    simulated = true;
    const acc = sim.value.accounts?.[0];
    if (acc?.data?.[0]) size = base64Length(acc.data[0]);
  } else if (!/AccountNotFound|InsufficientFunds|insufficient/i.test(errText + logs.join(" "))) {
    throw new MintError(`Симуляция отклонила транзакцию: ${errText.slice(0, 120)}. Ничего не отправлено.`, "program");
  }
  const rentLamports = await conn.getMinimumBalanceForRentExemption(size);
  const affordable = simulated && balanceLamports >= rentLamports + feeLamports;
  return {
    id,
    name: badge.name,
    uri,
    asset: asset.publicKey.toBase58(),
    tx,
    rentLamports,
    feeLamports,
    balanceLamports,
    affordable,
    blockhash,
    lastValidBlockHeight,
    simulated,
    logs,
    preparedAt: Date.now(),
    _assetSecret: asset.secretKey,
  };
}

/** Ask the wallet to sign, co-sign with the one-time asset key, send and wait for confirmation. */
export async function executeMint(p: PreparedMint, adapter: WalletAdapter, onSending: () => void): Promise<string> {
  if (!p.affordable) throw new MintError("Недостаточно SOL для депозита и комиссии.", "funds");
  const web3 = await import("@solana/web3.js");
  const conn = await rpc.connection();
  const signedBytes = await adapter.signTransaction(p.tx);
  const tx = web3.Transaction.from(signedBytes);
  tx.partialSign(web3.Keypair.fromSecretKey(p._assetSecret));
  p._assetSecret.fill(0);
  onSending();
  const raw = tx.serialize();
  const signature = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3, preflightCommitment: "confirmed" });
  // Poll for confirmation (no websocket: works behind iframe/CSP restrictions)
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    const st = await conn.getSignatureStatuses([signature]);
    const s = st.value[0];
    if (s?.err) throw new MintError(`Транзакция отклонена сетью: ${JSON.stringify(s.err).slice(0, 100)}`, "program");
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return signature;
    const height = await conn.getBlockHeight("confirmed");
    if (height > p.lastValidBlockHeight) {
      throw new MintError("Транзакция не подтвердилась вовремя. Перед повтором игра сама проверит её в сети, ссылка на Explorer ниже.", "expired", signature);
    }
    await new Promise((r) => setTimeout(r, 1800));
  }
  throw new MintError("Подтверждение затянулось. Перед повтором игра сама проверит транзакцию в сети, ссылка на Explorer ниже.", "expired", signature);
}

/**
 * Outcome of an earlier mint whose confirmation timed out. The asset account is the ground truth
 * (works without transaction history on the RPC); the block height tells whether the transaction
 * can still land.
 */
export async function checkPendingMint(p: { asset: string; signature: string; lastValidBlockHeight: number }): Promise<"landed" | "failed" | "expired" | "pending"> {
  const web3 = await import("@solana/web3.js");
  const conn = await rpc.connection();
  const acc = await conn.getAccountInfo(new web3.PublicKey(p.asset), "confirmed");
  if (acc && acc.owner.toBase58() === SOLANA.coreProgramId) return "landed";
  const st = (await conn.getSignatureStatuses([p.signature], { searchTransactionHistory: true })).value[0];
  if (st?.err) return "failed";
  if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return "landed";
  const height = await conn.getBlockHeight("confirmed");
  return height > p.lastValidBlockHeight ? "expired" : "pending";
}
