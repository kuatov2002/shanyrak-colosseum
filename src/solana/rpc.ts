// Mainnet RPC pool: priority-ordered endpoints, automatic failover on network error / timeout /
// 403 / 429 / 5xx, and a per-endpoint rate limit (≥ 200 ms between requests). web3.js Connection
// is created with this pool as its `fetch`, so every RPC call in the game goes through it.

import type { Connection } from "@solana/web3.js";
import { SOLANA } from "./config";

interface Endpoint {
  url: string;
  nextAt: number;
  cooldownUntil: number;
  failures: number;
}

export class RpcUnavailableError extends Error {
  constructor(detail: string) {
    super(`Сеть Solana недоступна (${detail}). Игра продолжает работать — повторите позже.`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class RpcPool {
  private endpoints: Endpoint[];
  private conn: Connection | null = null;
  /** Last endpoint that answered (for diagnostics). */
  lastUrl: string | null = null;

  constructor(
    urls: string[] = SOLANA.rpcEndpoints,
    private readonly minIntervalMs = SOLANA.rpcMinIntervalMs,
    private readonly timeoutMs = SOLANA.rpcTimeoutMs,
    private readonly doFetch: typeof fetch = (...a) => fetch(...a),
  ) {
    this.endpoints = [...new Set(urls.filter(Boolean))].map((url) => ({ url, nextAt: 0, cooldownUntil: 0, failures: 0 }));
  }

  /** Reserve a slot on the endpoint respecting the minimum interval; resolves when it is our turn. */
  private async slot(ep: Endpoint): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, ep.nextAt);
    ep.nextAt = at + this.minIntervalMs;
    if (at > now) await sleep(at - now);
  }

  /** fetch-compatible: the URL argument is ignored, the pool picks the endpoint. */
  readonly fetch = async (_input: unknown, init?: RequestInit): Promise<Response> => {
    const errors: string[] = [];
    const now = Date.now();
    const order = [...this.endpoints].sort((a, b) => Number(a.cooldownUntil > now) - Number(b.cooldownUntil > now));
    for (const ep of order) {
      await this.slot(ep);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await this.doFetch(ep.url, { ...init, signal: ctrl.signal });
        if (res.status === 403 || res.status === 429 || res.status >= 500) {
          throw new Error(`HTTP ${res.status}`);
        }
        ep.failures = 0;
        this.lastUrl = ep.url;
        return res;
      } catch (err) {
        ep.failures++;
        ep.cooldownUntil = Date.now() + Math.min(60_000, 5_000 * ep.failures);
        errors.push(`${new URL(ep.url).host}: ${err instanceof Error ? (err.name === "AbortError" ? "таймаут" : err.message) : String(err)}`);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new RpcUnavailableError(errors.join("; "));
  };

  async connection(): Promise<Connection> {
    if (this.conn) return this.conn;
    const { Connection } = await import("@solana/web3.js");
    this.conn = new Connection(this.endpoints[0].url, {
      commitment: "confirmed",
      fetch: this.fetch as unknown as typeof fetch,
      disableRetryOnRateLimit: true,
    });
    return this.conn;
  }
}

/** Shared pool for the whole game. */
export const rpc = new RpcPool();
