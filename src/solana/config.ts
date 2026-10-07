// Solana settings — mainnet-beta only. The game uses Solana for exactly three things:
//   1) reading the $SHAI balance (read-only RPC),
//   2) linking the wallet to the iDos profile (signMessage of the iDos challenge, no transaction),
//   3) optional achievement-badge mints (Metaplex Core, a transaction the player signs and pays).
// Leaderboards are off-chain on iDos and never touch Solana.

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const SOLANA = {
  cluster: "mainnet-beta" as const,
  /** Wallet Standard chain id. */
  chain: "solana:mainnet" as const,
  /** iDos NetworkID of the title's Solana network (Blockchain.Networks.solana). */
  idosNetworkId: "solana",
  /** RPC endpoints in priority order; the pool fails over on error/timeout. */
  rpcEndpoints: [
    env.VITE_SOLANA_RPC || "https://solana-rpc.publicnode.com",
    "https://api.mainnet-beta.solana.com",
    "https://rpc.extrnode.com/solana-mainnet",
  ],
  /** Minimum spacing between two requests to the same endpoint. */
  rpcMinIntervalMs: 200,
  rpcTimeoutMs: 8000,
  /** Metaplex Core program. */
  coreProgramId: "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
  explorerTx(sig: string): string {
    return `https://explorer.solana.com/tx/${sig}`;
  },
  explorerAddress(addr: string): string {
    return `https://explorer.solana.com/address/${addr}`;
  },
};
