# ШАНЫРАК — Campus Tower

[![CI](https://github.com/kuatov2002/shanyrak-colosseum/actions/workflows/ci.yml/badge.svg)](https://github.com/kuatov2002/shanyrak-colosseum/actions/workflows/ci.yml)
[![Solana](https://img.shields.io/badge/Solana-mainnet-9945FF)](https://solana.com)
[![Metaplex Core](https://img.shields.io/badge/Metaplex-Core-14F195)](https://developers.metaplex.com/core)
[![PixiJS](https://img.shields.io/badge/PixiJS-8%20WebGL-E72264)](https://pixijs.com)
[![iDos Games](https://img.shields.io/badge/built%20on-iDos%20Games-F5C451)](https://idosgames.com/app/JE8W0Z54/)
[![Hackathon](https://img.shields.io/badge/Colosseum-2026-14F195)](https://colosseum.org)

> A **one-button stacking arcade** about building a Kazakh student campus: drop the dorm, the chaikhana, the library and
> the IT lab onto a swaying tower, chain perfect drops into combos, survive wind and exam-week deadlines — and crown every
> round with a **shanyrak**, the yurt's crown and the symbol of home. Solana is **optional and honest**: a player can turn
> an achievement into a **Metaplex Core** badge in their own wallet, with the exact cost shown before they sign.

[**Play now**](https://je8w0z54.idos.games/) · [Trailer (40 s)](docs/media/trailer.mp4) · [Judges' guide](docs/JUDGES.md) · [Architecture](docs/ARCHITECTURE.md) · [Об игре (RU)](docs/GAME.md) · [Platform page](https://idosgames.com/app/JE8W0Z54/)

---

![Shanyrak — the crowned campus tower](docs/img/hero.jpg)

---

## Submission to the iDos Games × Solana hackathon (Colosseum 2026)

| Name | Role | Contact |
|------|------|---------|
| Alikhan Kuatov | Solo developer | [GitHub](https://github.com/kuatov2002) |

---

## Problem and Solution

### 1. Web3 games lose casual players at the wallet wall
- **Problem:** many on-chain games ask for a wallet, a signature or a deposit before the first second of fun.
- **Shanyrak:** the game opens straight into a 30-second tutorial. Guest login is silent (iDos device id), and every mode, quest, season tier and leaderboard works **without a wallet**. Solana appears only later, as a choice.

### 2. "Ownership" that is just a row in someone's database
- **Problem:** achievements live on the developer's server and disappear with it.
- **Shanyrak:** four achievements can be written into the player's wallet as **standalone Metaplex Core assets**. The player is payer, owner and update authority; the only other signer is a one-time asset keypair generated in the browser and wiped right after. There is **no project key in the bundle** and no collection authority to trust.

### 3. Hidden costs and dark patterns around transactions
- **Problem:** players sign transactions they don't understand.
- **Shanyrak:** every mint is **simulated on mainnet first**; the dialog shows the refundable rent deposit, the network fee and the total *before* the wallet opens. No seed phrases, no earnings promises, no pay-to-win. If something fails (no SOL, wallet closed, RPC down) the player gets a plain message and a way back to the game.

### 4. Retention needs a backend that a hackathon team can't build
- **Problem:** leaderboards, analytics and accounts are months of server work.
- **Shanyrak:** the whole backend is the **iDos Games** title `JE8W0Z54`: silent guest auth, server leaderboards (daily tower, best height, weekly score, five faculties), analytics events — all configured through the iDos MCP, with an offline fallback.

### 5. Games that could be from anywhere
- **Shanyrak:** a Kazakh campus — chaikhana next to the dorm, Nauryz fireworks, dombra music, қошқар мүйіз ornaments, Alatau on the horizon. The shanyrak is treated with respect: it never falls, it always **completes** what was built.

---

## Why Solana

- **Cheap enough to be a reward, not a purchase** — a badge costs ≈ **0.00176 SOL**, and ≈ 0.00174 of it is a *refundable* rent deposit; the network fee incl. priority is 0.000016 SOL.
- **One account per asset** — Metaplex Core `CreateV1` is a single ~190-byte account (≈ 9.3k compute units), no token accounts or metadata programs.
- **Seconds to confirm** — the badge lands while the player is still on the result screen.
- **Wallets players already have** — Phantom, Solflare and Backpack via the Wallet Standard, plus iDos wallet ↔ profile linking with a free message signature.

---

## Summary of Features

- **Core loop:** crane swing → drop → five-grade judging (Perfect … Critical) → combo → **Shabyt** at ×5 (score ×1.5, the tower glows) → stability, tilt, collapse, three helmets → the shanyrak crowns the tower.
- **12 room types** with neighbour synergies, **6 events** (mountain wind, deadline shake, exam, Nauryz, session night, student festival), **10 bonus cards** every 5–8 floors.
- **5 modes:** quick tower, 8-mission campaign «Семестр», a **daily seeded tower** (same rooms and events for everyone), faculty tower, endless.
- **Meta:** workshop upgrades, shop & crafting from materials, cosmetics collection, daily/weekly quests, 7-day login streak, 20-tier season pass (premium track for in-game coins only), achievements, weekly **faculty war**.
- **Onboarding:** auto tutorial, a "how to play" guide, a "what next" hint on the hub, plain explanations behind every currency pill.
- **Solana mainnet:** wallet connect, iDos profile linking (signMessage), achievement badges as Metaplex Core assets (simulation, priority fee, wallet `signAndSendTransaction`, on-chain confirmation by the asset account), read-only $SHAI balance, an RPC pool with failover and a 200 ms rate limit.
- **Rendering:** PixiJS 8 WebGL — parallax sky, baked room textures, GLSL colour grade, glow/shadow/zoom-blur filters, particle containers, a Pixi HUD sharing a 9-slice design system with the DOM menus.
- **Accessible:** keyboard play and dialogs (focus trap, Esc), screen-reader live region, reduced motion/transparency, portrait and landscape phones.

| Round | Bonus cards | Badges |
|---|---|---|
| ![Round with combo](docs/img/round.jpg) | ![Bonus choice](docs/img/bonus.jpg) | ![Solana badges](docs/img/badges.jpg) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Game & UI | TypeScript, Vite 8, PixiJS 8 (WebGL), pixi-filters, DOM menus without a framework |
| Audio | WebAudio — procedural SFX and a generative dombra loop (no audio files) |
| Backend | iDos Games (`@idosgames/core` 0.21): guest auth, leaderboards, analytics, wallet ↔ profile link |
| Blockchain | Solana mainnet-beta, `@solana/web3.js`, Wallet Standard, Metaplex Core `CreateV1` (hand-encoded, Borsh) |
| Hosting | iDos build hosting (versioned CDN paths keep NFT metadata URIs immutable) |
| Tests | Vitest — round simulation, determinism, missions, saves, economy, RPC pool, mint flow with fake wallet/RPC |

---

## Architecture

```
            ┌────────────── browser (static build on the iDos CDN) ──────────────┐
 player ──► │  DOM menus ──┐                                                       │
            │              ├─► Round (pure simulation, fixed 120 Hz) ──events──┐   │
 tap/space ►│  Pixi HUD ───┘                                                    ▼   │
            │                     PixiRenderer (world, HUD, particles, filters)     │
            │  Store (versioned local save) ── progression / quests / season        │
            └───────┬───────────────────────────────┬───────────────────────────────┘
                    │ @idosgames/core                │ web3.js + Wallet Standard
                    ▼                                ▼
          iDos title JE8W0Z54                Solana mainnet-beta
          guest auth · leaderboards          RPC pool (failover, 200 ms/endpoint)
          analytics · linkWallet             Metaplex Core badge (player-signed)
```

The simulation knows nothing about rendering: `Round` holds state and emits events; the renderer and HUD read state and react to events. That is why the whole game can be played by a bot in tests and why the trailer below was rendered frame by frame from real rounds. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Quick Start

```bash
git clone https://github.com/kuatov2002/shanyrak-colosseum.git
cd shanyrak-colosseum
npm install
npm run dev          # http://localhost:5190
npm test             # 27 tests
npm run build        # typecheck + production bundle in dist/
```

Optional `.env` (see `.env.example`): `VITE_IDOS_TITLE_ID` (default `JE8W0Z54`), `VITE_IDOS_ENV`, `VITE_SOLANA_RPC` (primary mainnet RPC; fallbacks are automatic).
Badge minting needs the published build: metadata lives at the versioned iDos CDN path of that build (`vite build --base=<AssetBase>`).

---

## Status

**Verified:** all 5 modes and 8 missions played to the crown by a bot on the live build; online iDos leaderboards and analytics; mainnet simulation of the badge mint from the live origin (≈ 9.3k CU, rent 0.00174244 SOL, fee 0.000016 SOL); iDos wallet-link challenge; WebGL context loss & restore; no listener leaks over 10 simulated minutes; JS bundle 479 KB gzip in total (≈ 265 KB before the first frame).

**Not verified in this environment:** a real wallet signature after the latest mint fix (the first live attempts timed out — fixed with a fresh blockhash at signing, priority fee and wallet-side sending, see [KNOWN_ISSUES](docs/KNOWN_ISSUES.md)); real phones (emulation only). The full honest post-mortem is in [docs/AUDIT.md](docs/AUDIT.md).

---

## Roadmap

- [x] One-button core loop, 12 rooms, events, bonuses, 5 modes, 8-mission campaign
- [x] iDos backend: guest auth, 8 leaderboards, analytics, wallet ↔ profile link
- [x] PixiJS WebGL renderer, Pixi HUD, shared design system, mobile portrait & landscape
- [x] Metaplex Core achievement badges on mainnet with simulation and honest pricing
- [x] Onboarding pass: guide, "what next", plain-language wallet screen
- [ ] Server-side validation of round results and rewards (iDos CloudCode)
- [ ] Cloud saves (iDos UserCustomData)
- [ ] Verified badge collection via a serverless collection signer
- [ ] Faculty tournaments → inter-university leagues; Kazakh and English localisation

---

## Resources

- **Live game:** https://je8w0z54.idos.games/ · **Platform page:** https://idosgames.com/app/JE8W0Z54/
- **Trailer:** [docs/media/trailer.mp4](docs/media/trailer.mp4)
- **Docs (RU):** [Об игре](docs/GAME.md) · [Питч](docs/PITCH.md) · [Сценарий демо](docs/DEMO_SCRIPT.md) · [Известные ограничения](docs/KNOWN_ISSUES.md) · [Аудит](docs/AUDIT.md)

---

## Коротко по-русски

**Шанырак: Кампус-Башня** — аркада одной кнопки: сбрасываете с крана комнаты студенческого кампуса, ловите «Идеально» и комбо, переживаете ветер и дедлайны, а каждый раунд венчает шанырак. Играть можно сразу и без кошелька; онлайн-рейтинги и аналитика — на iDos Games. Solana — по желанию: значок-NFT за достижение (Metaplex Core, mainnet) с точной ценой до подписи. Подробно — в [docs/GAME.md](docs/GAME.md).
