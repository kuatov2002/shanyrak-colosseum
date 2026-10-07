// Solana settings. Opt-in actions (records, airdrop) run on DEVNET so nothing costs real money;
// the $SHAI token itself lives on mainnet and is only READ (balance display).

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const SOLANA = {
  actionCluster: "devnet" as const,
  devnetRpc: env.VITE_SOLANA_DEVNET_RPC || "https://api.devnet.solana.com",
  mainnetRpc: env.VITE_SOLANA_MAINNET_RPC || "https://solana-rpc.publicnode.com",
  memoProgramId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  /**
   * Project treasury for FUTURE fees (e.g. optional cosmetic mints). Not used by any action in this
   * build — no transfer to it exists in the code. Set it when the treasury multisig is created.
   */
  treasury: null as string | null,
  explorerTx(sig: string, cluster: "devnet" | "mainnet" = "devnet"): string {
    return `https://explorer.solana.com/tx/${sig}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
  },
  explorerAddress(addr: string, cluster: "devnet" | "mainnet" = "mainnet"): string {
    return `https://explorer.solana.com/address/${addr}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
  },
};
