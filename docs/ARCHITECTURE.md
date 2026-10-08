# Architecture

Shanyrak is a static web build (TypeScript + Vite) hosted on the iDos Games CDN. There is no game server of our own: the backend is the iDos title `JE8W0Z54`, and the only on-chain writes are player-signed Metaplex Core mints on Solana mainnet.

## Source layout

```
src/
  core/        fixed-step loop on the Pixi ticker · store · versioned save (v3, migrations) · deterministic RNG · time
  config/      balance.ts — every gameplay number in one place
  gameplay/    round (pure simulation) · crane · block (judging) · tower · stability · students · events · bonuses · deck · modes
  meta/        rooms (12 types, synergies) · collection · upgrades · progression (round → rewards)
  economy/     $SHAI soft currency · shop · crafting
  retention/   daily & weekly quests · login streak · season pass · achievements
  social/      faculties (weekly war) · leaderboards (iDos + labelled offline fallback)
  platform/    backend interface · idos (SDK) · local (offline)
  solana/      config · rpc (pool) · wallet · token (read-only balance) · nft (Metaplex Core) · nftArt · actions (statuses)
  render/      world (PixiRenderer) · characters (vector rig) · hud/ (Pixi HUD) · textures (baking) · roomExtras · warmGrade (GLSL) · menuScene
  design/      skin — one 9-slice design system for Pixi textures and CSS border-image · glyphs — one icon set, baked for the HUD and inline SVG for menus · icons
  visuals/     particles (ParticleContainer pools, one atlas)
  audio/       WebAudio: buses → convolution room → limiter (sound) · Karplus–Strong dombra (dsp) · themes (music) · layered SFX (voices)
  ui/          router · DOM helpers · components (dialogs, guide, mint) · screens (hub, round, result, wallet…)
  game.ts      mountGame(host) — wires everything; main.ts mounts it on the page
tests/         vitest: round, meta, solana (RPC pool, CreateV1 encoding, migrations), mint safety, mint execution
scripts/       export-badges.md (how the badge art was exported)
idos/          template for running the game as an iDos host module
```

## Simulation ↔ rendering

- `Round` is a plain class: it advances on a fixed 1/120 s step, holds all state (crane, falling room, tower, stability, combo, event, bonus offer) and emits typed `RoundEvent`s (`drop`, `land`, `combo`, `shabyt`, `event`, `bonusOffer`, `crowned`, `end`…).
- `PixiRenderer` reads that state every frame and subscribes to events for one-shot effects (particles, zoom blur, floating text). The Pixi `Hud` subscribes too. Audio and analytics are just more subscribers in `game.ts`.
- Because the simulation never touches the DOM or WebGL, tests can play whole rounds headlessly.

## Rendering (PixiJS 8, WebGL)

- Layers: sky gradient and stars → parallax mountains/hills/city lights (TilingSprites) → the world camera (plaza, tower, fog, falling room, shanyrak, particles, floating text) → foreground grass → screen effects → HUD.
- Room art is drawn procedurally once per (type, width, facade, ornament, scale) into canvas textures and reused; window lights, students, extras (lanterns, server LEDs, flags) animate on top.
- Filters: drop shadow on the tower, glow in Shabyt and on the crown, a custom GLSL warm-night grade on the world, short zoom-blur bursts on milestones. Ambient particles are spawned per second (not per frame) with a budget, so 120/240 Hz screens look the same and feedback bursts always have room.
- The round screen is Pixi end to end (world + HUD + bonus cards); DOM is used only for dialogs and a screen-reader live region. Menus are DOM, styled with the same 9-slice textures through CSS `border-image`.
- WebGL context loss pauses the round and explains; Pixi re-uploads textures on restore.

## iDos Games

`src/platform/idos.ts` uses the official `@idosgames/core` SDK: `auth.autoLogin` / `loginWithDeviceID` (silent guest), `leaderboard.submitScore` / `getLeaderboard` (daily tower, best height, weekly score, five faculty boards), `user.changeUsername`, `analytics.logEvent`, and `auth.linkWallet` for the optional wallet ↔ profile link (iDos challenge → `signMessage` → server verification). If iDos is unreachable the game switches to a local backend and labels everything that is simulated.

Builds are hosted by iDos under versioned CDN paths (`vite build --base=<AssetBase>`), which is also where the badge metadata lives.

## Solana (mainnet-beta only)

### RPC pool — `src/solana/rpc.ts`
A priority list (`VITE_SOLANA_RPC` → publicnode → api.mainnet-beta → extrnode) behind a custom `fetch` passed to `Connection`. Requests to one endpoint are serialized and spaced by at least 200 ms of *measured* time; 403/429/5xx, timeouts and network errors cool an endpoint down and fail over to the next.

### Badge mint — `src/solana/nft.ts`, `src/solana/actions.ts`

```
prepare (dialog opens)
  ├─ build: ComputeBudget(limit 12 000 CU, price) + Metaplex Core CreateV1 (hand-encoded Borsh)
  ├─ simulate on mainnet (sigVerify off, replaceRecentBlockhash) → real account size, units
  └─ rent = getMinimumBalanceForRentExemption(size), fee = getFeeForMessage → shown to the player
confirm (player presses "sign")
  ├─ fresh blockhash right now (reading the dialog never ages the transaction)
  ├─ wallet has signAndSendTransaction → one-time asset key co-signs first, wallet signs & broadcasts
  │  otherwise → wallet signs, asset key co-signs, the game sends and re-broadcasts every 2 s
  ├─ poll getSignatureStatuses; the asset account owned by Core is the ground truth
  └─ blockhash expired and no asset → "not created, nothing charged, retry"
timeout (rare)
  └─ signature stored as pending; "retry" first checks the asset account and block height → no double mint
```

Signers are the player (payer, owner, update authority) and a keypair generated in the browser for this one asset, zeroed after signing. No project keys exist in the bundle; there is no collection authority and no treasury. Metadata JSON and images are emitted into the build and referenced by the versioned iDos CDN path, so a later deploy never changes the URI of an already minted badge.

## Persistence

Local, versioned save (`localStorage`, v3) with step-by-step migrations and default-merging for new fields. The `SaveStore` interface is separate from storage so cloud saves (iDos UserCustomData) can be added without touching game code.

## Tests

`npm test` runs vitest: deterministic rounds and missions, economy, save migrations, RPC failover/timeout/spacing, Metaplex Core encoding, pending-mint safety and the mint flow against a fake wallet and RPC.
