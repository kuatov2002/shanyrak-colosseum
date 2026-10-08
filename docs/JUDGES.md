# Judges' guide · Гид для судей

Everything below works in a normal desktop or mobile browser. **No wallet is needed for steps 1–5.**
Всё ниже работает в обычном браузере; **для шагов 1–5 кошелёк не нужен.**

Open the game on its own domain: **https://je8w0z54.idos.games/**. The platform page https://idosgames.com/app/JE8W0Z54/ embeds the same build in an iframe, but browser wallets may be unavailable inside frames.

## 3-minute path

| # | Do | What to notice |
|---|---|---|
| 1 | The game opens straight into the **tutorial** (5 floors, ~30 s). Tap / click / `Space` when the room is above the tower. | One-button control, «ИДЕАЛЬНО!», combo, hints that explain stability and helmets, the shanyrak descending at floor 5. |
| 2 | Pick any faculty. On the hub a short **"how the campus works"** guide opens. | Plain-language onboarding; "? Как играть" brings it back any time. |
| 3 | Press **▶ Играть** (quick tower). Build 8+ floors. | Combo ×5 → **Шабыт** (tower glows), bonus cards at floor 5, neighbour synergies, events, the "crown with shanyrak (+25%)" button from floor 8. `Esc` pauses. |
| 4 | Keep building past floor 7–10, or open **☰ Все режимы → Семестр** (8 short missions, unlocked one by one). | Random events change the rules: mountain wind, deadline shake, exam, Nauryz (fireworks, bonfires, festive music), session night, student festival. |
| 5 | **Рейтинг**. | Online iDos leaderboards (day, height, week, faculties). Demo rivals are labelled and never ranked. |
| 6 | *(optional, mainnet)* **Кошелёк** → connect Phantom / Solflare → **Выпустить** the «Первая башня» badge (earned in the tutorial). | The mint is simulated on mainnet first; the dialog shows rent (≈ 0.00174 SOL, refundable), fee (0.000016 SOL incl. priority) and the total before the wallet opens. After signing: status → Explorer link → "✅ В кошельке". Without SOL the dialog says how much is needed and returns you to the game. |

## Where to look in the code

| Topic | Files |
|---|---|
| Round simulation (no rendering) | `src/gameplay/round.ts`, `crane.ts`, `block.ts`, `stability.ts`, `events.ts`, `bonuses.ts` |
| WebGL rendering & Pixi HUD | `src/render/world.ts`, `src/render/hud/hud.ts`, `src/render/textures.ts`, `src/render/warmGrade.ts` |
| Badge mint (Metaplex Core) | `src/solana/nft.ts` (encode, simulate, sign & send, confirm), `src/solana/actions.ts` (statuses, pending-mint safety) |
| RPC pool | `src/solana/rpc.ts` — failover on 403/429/5xx/timeouts, ≥ 200 ms between requests per endpoint |
| Wallets | `src/solana/wallet.ts` — Wallet Standard + injected providers, `signAndSendTransaction` when available |
| iDos backend | `src/platform/idos.ts` — guest auth, leaderboards, analytics, `auth.linkWallet` |
| Tests | `tests/*.test.ts` — `npm test` |

## Verify a badge on chain

1. On the wallet screen, the minted badge links to Solana Explorer.
2. The asset account is owned by the Metaplex Core program `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`; owner and update authority are the player.
3. Its `uri` points to the **versioned** iDos CDN path of the build that minted it (`…/drive/app/JE8W0Z54/v/<buildId>/nft/<id>.json`), so later deploys never break it.

## Known limits

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) (in Russian). The short version: scores are computed on the client (no anti-cheat yet), saves are local to the device, and the public Solana RPCs reachable from a browser are limited — a dedicated RPC can be set with `VITE_SOLANA_RPC`.
