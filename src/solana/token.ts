// $SHAI token configuration. Mirrors the iDos title JE8W0Z54 currency config:
//   CryptoCurrencies.Main  → "Shai", network "solana", mint below
//   VirtualCurrencies.Main_IOU → "Shai (IOU)" — the unbacked in-game reward currency
// In this build the in-game $SHAI balance is local soft currency. The on-chain token is displayed
// read-only (mainnet RPC, no transaction); deposits/withdrawals are the job of the iDos blockchain
// module (client.blockchain) once server-side granting is configured — see docs/GAME.md.

import { RpcUnavailableError, rpc } from "./rpc";

export const SHAI_TOKEN = {
  symbol: "$SHAI",
  name: "Shai",
  mint: "AQWXMcm2Km4kNz6sd4Ec3gf251DswN7KiGw1Mq3Bidos",
  /** On-chain mint decimals (verified via getAccountInfo). The iDos network config lists 0 — see docs/KNOWN_ISSUES.md. */
  decimals: 6,
  network: "Solana mainnet-beta",
  idosCryptoCurrencyId: "Main",
  idosIouCurrencyId: "Main_IOU",
  disclaimer:
    "$SHAI — игровая валюта кампуса. Игра не обещает дохода и не является инвестицией; ончейн-токен показывается только для информации.",
};

export type BalanceResult = { ok: true; amount: number } | { ok: false; error: string };

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

/**
 * Read the wallet's on-chain $SHAI balance (read-only). Only non-indexed RPC calls are used
 * (getAccountInfo on the mint and on the owner's associated token account): public RPCs refuse
 * getTokenAccountsByOwner from browsers.
 */
export async function fetchShaiBalance(owner: string): Promise<BalanceResult> {
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const conn = await rpc.connection();
    const mint = new PublicKey(SHAI_TOKEN.mint);
    const mintInfo = await conn.getAccountInfo(mint);
    const program = mintInfo?.owner ?? new PublicKey(TOKEN_PROGRAM);
    const [ata] = PublicKey.findProgramAddressSync(
      [new PublicKey(owner).toBuffer(), program.toBuffer(), mint.toBuffer()],
      new PublicKey(ATA_PROGRAM),
    );
    const acc = await conn.getParsedAccountInfo(ata);
    if (!acc.value) return { ok: true, amount: 0 };
    const data = acc.value.data as { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } } };
    return { ok: true, amount: Number(data.parsed?.info?.tokenAmount?.uiAmount ?? 0) };
  } catch (err) {
    return { ok: false, error: describeRpcError(err) };
  }
}

/** SOL balance on mainnet (read-only) — shown before a mint so the player knows if it is affordable. */
export async function fetchSolBalance(owner: string): Promise<BalanceResult> {
  try {
    const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
    const conn = await rpc.connection();
    const lamports = await conn.getBalance(new PublicKey(owner));
    return { ok: true, amount: lamports / LAMPORTS_PER_SOL };
  } catch (err) {
    return { ok: false, error: describeRpcError(err) };
  }
}

export function describeRpcError(err: unknown): string {
  if (err instanceof RpcUnavailableError) return err.message;
  const msg = err instanceof Error ? err.message : String(err);
  if (/403|forbidden/i.test(msg)) return "Сеть Solana отклонила запрос. Повторите позже — игра продолжает работать.";
  if (/429|too many/i.test(msg)) return "Сеть Solana перегружена. Повторите через минуту.";
  if (/fetch|network|Failed to|недоступна/i.test(msg)) return "Сеть Solana недоступна. Игра продолжает работать — повторите позже.";
  return msg.length > 140 ? `${msg.slice(0, 140)}…` : msg;
}
