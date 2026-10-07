// Double-mint protection: a mint whose confirmation timed out is checked on chain before any retry,
// and a prepared transaction is re-simulated once its blockhash gets old.
import { describe, expect, it, vi } from "vitest";
import { defaultSave, migrate } from "../src/core/save";

const chain = vi.hoisted(() => ({
  account: null as null | { owner: string },
  status: null as null | { err: unknown; confirmationStatus?: string },
  height: 0,
}));

vi.mock("../src/solana/rpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/solana/rpc")>();
  const conn = {
    getAccountInfo: async () => (chain.account ? { owner: { toBase58: () => chain.account!.owner } } : null),
    getSignatureStatuses: async () => ({ value: [chain.status] }),
    getBlockHeight: async () => chain.height,
  };
  return { ...actual, rpc: { connection: async () => conn } };
});

const { checkPendingMint, isStale, PREPARED_TTL_MS } = await import("../src/solana/nft");
const { SOLANA } = await import("../src/solana/config");

const pending = { asset: "11111111111111111111111111111111", signature: "sig", lastValidBlockHeight: 1000 };

describe("pending mint check (no double mint)", () => {
  it("treats an existing Core asset account as landed", async () => {
    Object.assign(chain, { account: { owner: SOLANA.coreProgramId }, status: null, height: 2000 });
    expect(await checkPendingMint(pending)).toBe("landed");
  });

  it("keeps waiting while the blockhash is still valid", async () => {
    Object.assign(chain, { account: null, status: null, height: 999 });
    expect(await checkPendingMint(pending)).toBe("pending");
  });

  it("allows a new mint only once the old transaction can no longer land", async () => {
    Object.assign(chain, { account: null, status: null, height: 1001 });
    expect(await checkPendingMint(pending)).toBe("expired");
    Object.assign(chain, { account: null, status: { err: { InstructionError: [0, "Custom"] } }, height: 10 });
    expect(await checkPendingMint(pending)).toBe("failed");
  });
});

describe("prepared mint freshness", () => {
  it("marks a prepared mint stale after the TTL", () => {
    const p = { preparedAt: 1_000 } as Parameters<typeof isStale>[0];
    expect(isStale(p, 1_000 + PREPARED_TTL_MS - 1)).toBe(false);
    expect(isStale(p, 1_000 + PREPARED_TTL_MS + 1)).toBe(true);
    expect(isStale(undefined)).toBe(false);
  });

  it("adds an empty pending-mint list to older v3 saves", () => {
    const old = defaultSave() as unknown as { wallet: Record<string, unknown> };
    delete old.wallet.pendingMints;
    expect(migrate(old).wallet.pendingMints).toEqual({});
  });
});
