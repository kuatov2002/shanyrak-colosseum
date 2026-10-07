// iDos host module template for "Шанырак: Кампус-Башня".
//
// How to use inside an iDos host project (created with the registry's get_host_scaffold):
//   1. Copy this repo's src/ into the host as src/modules/shanyrak/game/ (keep folder layout).
//   2. Copy this folder's files into src/modules/shanyrak/ and fix the import below to "./game/game".
//   3. Register `shanyrakModule` in src/modules.ts.
// Not compiled in this repository (it needs @idosgames/module-sdk from the host).
//
// Contract mapping (idosgames-module-contract skill):
//   EngineScene.mount(ctx.host)  → mountGame(host, { idosClient: ctx.client })  (already signed in)
//   activate / suspend           → setRunning(true / false)  (only the active mode ticks)
//   destroy                      → destroy()
//   capture                      → canvas PNG for the platform's "Shot" button

import { defineModule, type Module } from "@idosgames/module-sdk";
import { mountGame, type GameHandle } from "../../src/game";

export const shanyrakModule: Module = defineModule({
  id: "shanyrak",
  meta: { name: "Шанырак: Кампус-Башня", type: "game", genre: "arcade", engine: "dom" },
  setup(ctx) {
    let game: GameHandle | null = null;
    ctx.registerRoute({ id: "shanyrak", label: "Шанырак", icon: "🏛️" });
    ctx.registerScene({
      surface: "fullbleed-canvas",
      mount(m) {
        game = mountGame(m.host, { idosClient: ctx.client });
      },
      activate() {
        game?.setRunning(true);
      },
      suspend() {
        game?.setRunning(false);
      },
      destroy() {
        game?.destroy();
        game = null;
      },
      capture() {
        return game ? game.capture() : Promise.resolve(null);
      },
    });
    // The canvas is invisible to DOM readers — publish the game state for the AI Coder / reviewers.
    ctx.exposeToAgent({
      state: () => ({ ...(game?.state() ?? {}), mode: ctx.modes.current() }),
      describeActions: {},
    });
  },
});
