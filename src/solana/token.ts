// $SHAI token configuration. Mirrors the iDos title JE8W0Z54 currency config:
//   CryptoCurrencies.Main  → "Shai", network "solana", mint below, 0 decimals
//   VirtualCurrencies.Main_IOU → "Shai (IOU)" — the unbacked in-game reward currency
// In this build the in-game $SHAI balance is local soft currency. The on-chain token is displayed
// read-only; deposits/withdrawals are the job of the iDos blockchain module (client.blockchain)
// once server-side granting is configured — see README "Как расширить до реальной сети".

import { SOLANA } from "./config";

export const SHAI_TOKEN = {
  symbol: "$SHAI",
  name: "Shai",
  mint: "AQWXMcm2Km4kNz6sd4Ec3gf251DswN7KiGw1Mq3Bidos",
  /** On-chain mint decimals (verified via getAccountInfo). The iDos network config lists 0 — see KNOWN_ISSUES. */
  decimals: 6,
  network: "Solana mainnet",
  idosCryptoCurrencyId: "Main",
  idosIouCurrencyId: "Main_IOU",
  disclaimer:
    "$SHAI — игровая валюта кампуса. Игра не обещает дохода и не является инвестицией; ончейн-токен показывается только для информации.",
};

export type BalanceResult = { ok: true; amount: number } | { ok: false; error: string };

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

/**
 * Read the wallet's on-chain $SHAI balance (mainnet, read-only). Only non-indexed RPC calls are used
 * (getAccountInfo on the mint and on the owner's associated token account): public RPCs refuse
 * getTokenAccountsByOwner from browsers.
 */
export async function fetchShaiBalance(owner: string): Promise<BalanceResult> {
  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const conn = new Connection(SOLANA.mainnetRpc, "confirmed");
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

export async function fetchSolBalance(owner: string): Promise<BalanceResult> {
  try {
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
    const conn = new Connection(SOLANA.devnetRpc, "confirmed");
    const lamports = await conn.getBalance(new PublicKey(owner));
    return { ok: true, amount: lamports / LAMPORTS_PER_SOL };
  } catch (err) {
    return { ok: false, error: describeRpcError(err) };
  }
}

export function describeRpcError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/403|forbidden/i.test(msg)) return "Публичный RPC отклонил запрос (лимит). Укажите свой RPC в VITE_SOLANA_MAINNET_RPC.";
  if (/429|too many/i.test(msg)) return "Слишком много запросов к RPC. Повторите через минуту.";
  if (/fetch|network|Failed to/i.test(msg)) return "Сеть Solana недоступна. Игра продолжает работать — повторите позже.";
  return msg.length > 140 ? `${msg.slice(0, 140)}…` : msg;
}
