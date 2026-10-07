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
import type { TransactionInstruction } from "@solana/web3.js";
import type { WalletAdapter } from "./wallet";

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

/**
 * Landing: CreateV1 uses ~9.3k compute units on mainnet (simulated), so a tight limit plus a fixed
 * priority price costs ~0.000006 SOL and keeps the transaction from being dropped under load.
 * Public RPCs report recent priority fees as 0, so a dynamic estimate would not help.
 */
export const MINT_CU_LIMIT = 12_000;
export const MINT_CU_PRICE_MICROLAMPORTS = 500_000;

export interface PreparedMint {
  id: string;
  name: string;
  uri: string;
  asset: string;
  payer: string;
  /** Compute budget + CreateV1. The transaction itself is rebuilt with a fresh blockhash at signing. */
  instructions: TransactionInstruction[];
  rentLamports: number;
  /** Total network fee: 2 signatures + priority. */
  feeLamports: number;
  priorityLamports: number;
  balanceLamports: number;
  affordable: boolean;
  /** Valid-until height of the blockhash the transaction was actually signed with. */
  lastValidBlockHeight: number;
  /** Simulation ran and succeeded (false when the payer cannot even cover the fee). */
  simulated: boolean;
  unitsConsumed: number;
  logs: string[];
  /** When the cost was simulated; older than PREPARED_TTL_MS is re-simulated so the amount stays honest. */
  preparedAt: number;
  /** Internal: the asset keypair (kept in memory only for this mint). */
  _assetSecret: Uint8Array;
}

/** The shown amount and balance are re-checked if the player waits longer than this before signing. */
export const PREPARED_TTL_MS = 120_000;

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
  const create = new web3.TransactionInstruction({
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
  const instructions = [
    web3.ComputeBudgetProgram.setComputeUnitLimit({ units: MINT_CU_LIMIT }),
    web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: MINT_CU_PRICE_MICROLAMPORTS }),
    create,
  ];
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const message = new web3.Transaction({ feePayer: payer, blockhash, lastValidBlockHeight }).add(...instructions).compileMessage();
  const balanceLamports = await conn.getBalance(payer);
  const priorityLamports = Math.ceil((MINT_CU_LIMIT * MINT_CU_PRICE_MICROLAMPORTS) / 1_000_000);
  const feeLamports = (await conn.getFeeForMessage(message, "confirmed")).value ?? 10_000 + priorityLamports;

  let size = estimateAssetSize(badge.name, uri);
  let simulated = false;
  let unitsConsumed = 0;
  const sim = await conn.simulateTransaction(new web3.VersionedTransaction(message), {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
    accounts: { encoding: "base64", addresses: [asset.publicKey.toBase58()] },
  });
  const logs = sim.value.logs ?? [];
  const errText = sim.value.err ? JSON.stringify(sim.value.err) : "";
  if (!sim.value.err) {
    simulated = true;
    unitsConsumed = sim.value.unitsConsumed ?? 0;
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
    payer: owner,
    instructions,
    rentLamports,
    feeLamports,
    priorityLamports,
    balanceLamports,
    affordable,
    lastValidBlockHeight,
    simulated,
    unitsConsumed,
    logs,
    preparedAt: Date.now(),
    _assetSecret: asset.secretKey,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sign and send the mint, then wait for the network.
 * 1. Fresh blockhash right before the wallet opens (time spent reading the cost does not age it).
 * 2. Wallets with signAndSendTransaction (Phantom, Solflare…) broadcast through their own
 *    infrastructure; the one-time asset key co-signs first (injected wallets accept pre-signed
 *    transactions). Otherwise: the wallet signs, the asset key co-signs, the game sends and
 *    re-broadcasts every 2 s until confirmed or the blockhash expires.
 * 3. The asset account on chain is the ground truth for success.
 */
export async function executeMint(p: PreparedMint, adapter: WalletAdapter, onSending: () => void): Promise<string> {
  if (!p.affordable) throw new MintError("Недостаточно SOL для депозита и комиссии.", "funds");
  const web3 = await import("@solana/web3.js");
  const conn = await rpc.connection();
  const assetKey = web3.Keypair.fromSecretKey(p._assetSecret);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  p.lastValidBlockHeight = lastValidBlockHeight;
  const tx = new web3.Transaction({ feePayer: new web3.PublicKey(p.payer), blockhash, lastValidBlockHeight }).add(...p.instructions);

  let signature: string;
  let raw: Uint8Array | null = null;
  try {
    if (adapter.signAndSendTransaction) {
      tx.partialSign(assetKey);
      signature = await adapter.signAndSendTransaction(tx);
      onSending();
    } else {
      const signed = web3.Transaction.from(await adapter.signTransaction(tx));
      signed.partialSign(assetKey);
      raw = signed.serialize();
      onSending();
      signature = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 0, preflightCommitment: "confirmed" });
    }
  } finally {
    p._assetSecret.fill(0);
  }

  // Poll (no websocket: works behind iframe/CSP restrictions), re-broadcasting our own send.
  const assetPk = new web3.PublicKey(p.asset);
  const landed = async () => {
    const acc = await conn.getAccountInfo(assetPk, "confirmed").catch(() => null);
    return !!acc && acc.owner.toBase58() === SOLANA.coreProgramId;
  };
  const started = Date.now();
  let lastSend = Date.now();
  for (let i = 0; Date.now() - started < 150_000; i++) {
    await sleep(i === 0 ? 1200 : 1600);
    const s = (await conn.getSignatureStatuses([signature])).value[0];
    if (s?.err) throw new MintError(`Транзакция отклонена сетью: ${JSON.stringify(s.err).slice(0, 100)}. Списана только комиссия сети.`, "program");
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return signature;
    if (i % 3 === 2 && (await landed())) return signature;
    if (raw && Date.now() - lastSend > 2000) {
      lastSend = Date.now();
      void conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => undefined);
    }
    const height = await conn.getBlockHeight("confirmed");
    if (height > lastValidBlockHeight) {
      if (await landed()) return signature;
      throw new MintError("Сеть не включила транзакцию в блок, и её срок действия истёк. Значок не создан, депозит не списан. Можно повторить.", "expired", signature);
    }
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
