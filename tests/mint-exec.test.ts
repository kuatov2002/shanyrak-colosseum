// Mint execution against a fake wallet + RPC: fresh blockhash at signing, the one-time asset key
// co-signs, wallets with signAndSendTransaction broadcast themselves, expiry is reported honestly.
import { describe, expect, it, vi } from "vitest";
import * as web3 from "@solana/web3.js";

const net = vi.hoisted(() => ({
  blockhashCalls: 0,
  height: 100,
  lastValid: 250,
  status: null as null | { err: unknown; confirmationStatus?: string },
  sent: 0,
}));

vi.mock("../src/solana/rpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/solana/rpc")>();
  const conn = {
    getLatestBlockhash: async () => {
      net.blockhashCalls++;
      return { blockhash: web3.Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: net.lastValid };
    },
    getSignatureStatuses: async () => ({ value: [net.status] }),
    getBlockHeight: async () => net.height,
    getAccountInfo: async () => null,
    sendRawTransaction: async (raw: Uint8Array) => {
      net.sent++;
      const tx = web3.Transaction.from(raw);
      return (await import("bs58")).default.encode(tx.signatures[0].signature!);
    },
  };
  return { ...actual, rpc: { connection: async () => conn } };
});

const { executeMint, MintError } = await import("../src/solana/nft");

function prepared(payer: web3.PublicKey) {
  const asset = web3.Keypair.generate();
  const ix = new web3.TransactionInstruction({
    programId: new web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
    keys: [
      { pubkey: asset.publicKey, isSigner: true, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
    ],
    data: new Uint8Array([0]) as unknown as import("buffer").Buffer,
  });
  return {
    id: "a_first",
    name: "x",
    uri: "u",
    asset: asset.publicKey.toBase58(),
    payer: payer.toBase58(),
    instructions: [ix],
    rentLamports: 1,
    feeLamports: 1,
    priorityLamports: 1,
    balanceLamports: 10,
    affordable: true,
    lastValidBlockHeight: 0,
    simulated: true,
    unitsConsumed: 1,
    logs: [],
    preparedAt: Date.now(),
    _assetSecret: asset.secretKey,
    assetKey: asset,
  };
}

describe("executeMint", () => {
  it("co-signs with the asset key and lets the wallet broadcast (signAndSendTransaction)", async () => {
    const payer = web3.Keypair.generate();
    const p = prepared(payer.publicKey);
    Object.assign(net, { blockhashCalls: 0, status: { err: null, confirmationStatus: "confirmed" }, sent: 0 });
    let seen: web3.Transaction | null = null;
    const adapter = {
      option: { id: "t", name: "t", icon: null, kind: "standard" as const },
      connect: async () => payer.publicKey.toBase58(),
      disconnect: async () => undefined,
      signMessage: async () => new Uint8Array(),
      signTransaction: async () => new Uint8Array(),
      signAndSendTransaction: async (tx: unknown) => {
        seen = tx as web3.Transaction;
        return "walletSig";
      },
    };
    const sig = await executeMint(p, adapter, () => undefined);
    expect(sig).toBe("walletSig");
    expect(net.blockhashCalls).toBe(1); // fresh blockhash at signing time
    expect(net.sent).toBe(0); // the wallet sent it, not the game
    const sigs = seen!.signatures.map((s) => ({ key: s.publicKey.toBase58(), signed: !!s.signature }));
    expect(sigs.find((s) => s.key === p.asset)?.signed).toBe(true);
    expect(sigs.find((s) => s.key === p.payer)?.signed).toBe(false);
    expect(p._assetSecret.every((b) => b === 0)).toBe(true); // one-time key wiped
    expect(p.lastValidBlockHeight).toBe(net.lastValid);
  });

  it("reports an expired transaction without claiming success (signTransaction fallback)", async () => {
    const payer = web3.Keypair.generate();
    const p = prepared(payer.publicKey);
    Object.assign(net, { status: null, height: 999, lastValid: 250, sent: 0 });
    const adapter = {
      option: { id: "t", name: "t", icon: null, kind: "injected" as const },
      connect: async () => payer.publicKey.toBase58(),
      disconnect: async () => undefined,
      signMessage: async () => new Uint8Array(),
      signTransaction: async (tx: unknown) => {
        const t = tx as web3.Transaction;
        t.partialSign(payer);
        return t.serialize({ requireAllSignatures: false });
      },
    };
    const err = await executeMint(p, adapter, () => undefined).catch((e) => e);
    expect(err).toBeInstanceOf(MintError);
    expect(err.kind).toBe("expired");
    expect(err.signature).toBeTruthy();
    expect(net.sent).toBeGreaterThanOrEqual(1);
  });
});
