import { describe, expect, it } from "vitest";
import { RpcPool, RpcUnavailableError } from "../src/solana/rpc";
import { encodeCreateV1, estimateAssetSize } from "../src/solana/nft";
import { defaultSave, migrate, SAVE_VERSION } from "../src/core/save";

const ok = () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: 1 }), { status: 200 });

describe("RPC pool", () => {
  it("fails over to the next endpoint on 403/429/5xx and network errors", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      if (url.includes("a.test")) return new Response("forbidden", { status: 403 });
      if (url.includes("b.test")) throw new TypeError("Failed to fetch");
      return ok();
    }) as unknown as typeof fetch;
    const pool = new RpcPool(["https://a.test", "https://b.test", "https://c.test"], 0, 1000, fake);
    const res = await pool.fetch("ignored", { method: "POST", body: "{}" });
    expect(res.status).toBe(200);
    expect(calls).toEqual(["https://a.test", "https://b.test", "https://c.test"]);
    expect(pool.lastUrl).toBe("https://c.test");
    // failed endpoints are cooled down: the next call goes straight to the healthy one
    calls.length = 0;
    await pool.fetch("ignored", {});
    expect(calls[0]).toBe("https://c.test");
  });

  it("times out a hanging endpoint and reports when all are down", async () => {
    const fake = ((_url: string, init?: RequestInit) =>
      new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as unknown as typeof fetch;
    const pool = new RpcPool(["https://slow.test"], 0, 30, fake);
    await expect(pool.fetch("x", {})).rejects.toBeInstanceOf(RpcUnavailableError);
  });

  it("spaces requests to one endpoint by at least the minimum interval", async () => {
    const times: number[] = [];
    const fake = (async () => {
      times.push(Date.now());
      return ok();
    }) as unknown as typeof fetch;
    const pool = new RpcPool(["https://one.test"], 200, 1000, fake);
    await Promise.all([pool.fetch("x", {}), pool.fetch("x", {}), pool.fetch("x", {})]);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(190);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(190);
  });
});

describe("Metaplex Core CreateV1 encoding", () => {
  it("encodes discriminator, data state, borsh strings and no plugins", () => {
    const data = encodeCreateV1("AB", "xyz");
    expect(Array.from(data)).toEqual([0, 0, 2, 0, 0, 0, 65, 66, 3, 0, 0, 0, 120, 121, 122, 0]);
  });

  it("estimates the asset account size (verified 187 bytes on mainnet simulation)", () => {
    expect(estimateAssetSize("Шанырак · Первая башня", "https://static.idos.games/drive/app/JE8W0Z54/v/bldtest/nft/a_first.json")).toBe(187);
  });
});

describe("save v3 migration", () => {
  it("drops old test-network wallet records and keeps the address", () => {
    const v2 = {
      ...defaultSave(),
      version: 2,
      wallet: { address: "Abc", walletName: "Phantom", studentIdSig: "sig", records: [{ kind: "score-memo", signature: "x", at: 1, cluster: "devnet", note: "n" }] },
      scores: [{ board: "quick", score: 10, height: 2, at: 1, day: "d", week: "w", wallet: "Abc", verifiedTx: "x" }],
    } as unknown as Record<string, unknown>;
    const m = migrate(v2);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.wallet.address).toBe("Abc");
    expect(m.wallet.records).toEqual([]);
    expect(m.wallet.minted).toEqual({});
    expect(m.wallet.linkedToProfile).toBe(false);
    expect("verifiedTx" in m.scores[0]).toBe(false);
  });
});
