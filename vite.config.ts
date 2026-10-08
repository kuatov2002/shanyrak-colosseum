import { defineConfig, type Plugin } from "vite";
import badges from "./src/solana/nft-badges.json" with { type: "json" };

/**
 * Emits nft/<id>.json metadata for the achievement badges. When the build is made with the iDos
 * versioned asset base (https://static.idos.games/drive/app/<title>/v/<buildId>/), image URIs are
 * absolute and immutable for that build — minted NFTs keep working after later deploys.
 */
function nftMetadata(): Plugin {
  let base = "./";
  return {
    name: "shanyrak-nft-metadata",
    configResolved(c) {
      base = c.base;
    },
    generateBundle() {
      const abs = /^https:\/\//.test(base) ? base : "";
      for (const b of badges.badges) {
        const image = `${abs}nft/${b.id}.png`;
        const json = {
          name: b.name,
          symbol: badges.symbol,
          description: b.description,
          image,
          external_url: "https://je8w0z54.idos.games/",
          attributes: [
            { trait_type: "Достижение", value: b.trait },
            { trait_type: "Редкость", value: b.tier },
            { trait_type: "Игра", value: "Шанырак: Кампус-Башня" },
          ],
          properties: { category: "image", files: [{ uri: image, type: "image/png" }] },
        };
        this.emitFile({ type: "asset", fileName: `nft/${b.id}.json`, source: JSON.stringify(json, null, 2) });
      }
    },
  };
}

/**
 * Dev-only: POST /__save-badge?id=<badge id> with a PNG body writes public/nft/<id>.png.
 * Used once to export badge art drawn by src/solana/nftArt.ts (see scripts/export-badges.md).
 */
function badgeExport(): Plugin {
  const ids = new Set(badges.badges.map((b) => b.id));
  return {
    name: "shanyrak-badge-export",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__save-badge", (req, res) => {
        const id = new URL(req.url ?? "", "http://x").searchParams.get("id") ?? "";
        if (req.method !== "POST" || !ids.has(id)) {
          res.statusCode = 400;
          res.end("bad request");
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", async () => {
          const { mkdir, writeFile } = await import("node:fs/promises");
          await mkdir("public/nft", { recursive: true });
          await writeFile(`public/nft/${id}.png`, Buffer.concat(chunks));
          res.end("ok");
        });
      });
    },
  };
}

// Relative base by default: the same build runs on localhost and on {titleid}.idos.games.
// For an iDos release pass the version's AssetBase: `vite build --base=<AssetBase>`.
export default defineConfig({
  base: "./",
  plugins: [nftMetadata(), badgeExport()],
  server: { port: 5190, host: true },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: "node",
  },
} as Parameters<typeof defineConfig>[0]);
