// Round screen. The world AND the HUD are drawn by PixiJS (see render/hud/hud.ts); this DOM layer
// only hosts the pause modal and a visually hidden live region that describes the round for screen
// readers (the canvas itself is aria-hidden). The container is pointer-events: none so every tap
// reaches the game field.

import { BONUSES } from "../../gameplay/bonuses";
import { EVENTS } from "../../gameplay/events";
import { MODES } from "../../gameplay/modes";
import type { Round } from "../../gameplay/round";
import { QUALITY_LABEL, type RoundEvent } from "../../gameplay/types";
import type { App, Screen } from "../app";
import { button, modal, type ModalHandle } from "../components/common";
import { openGuide } from "../components/guide";
import { fmt, h } from "../dom";

export function roundScreen(app: App): Screen {
  const round = app.round as Round;
  const cfg = round.cfg;
  const isTutorial = cfg.mode === "tutorial";
  const live = h("div.sr-only", { role: "status", "aria-live": "polite" });
  const el = h(
    "div.round-screen",
    null,
    h("h1.sr-only", null, `${MODES[cfg.mode].name}. Нажмите пробел или тапните, чтобы сбросить комнату; Esc или P — пауза, Esc в паузе — продолжить.`),
    live,
  );
  const say = (t: string) => {
    live.textContent = t;
  };

  let pauseModal: ModalHandle | null = null;

  const skipTutorial = () => {
    app.analytics.track("tutorial_done", { skipped: true });
    app.store.mutate((d) => {
      d.tutorialDone = true;
    });
    app.endRoundEarly();
    app.router.go(app.store.data.player.faculty ? "home" : "faculty");
  };

  const openPause = () => {
    if (round.phase === "done" || pauseModal) return;
    round.paused = true;
    app.sound.setPaused(true);
    let resume = () => {};
    pauseModal = modal("Пауза", (body, close) => {
      const d = app.store.data;
      resume = () => {
        close();
        pauseModal = null;
        round.paused = false;
        app.sound.setPaused(false);
      };
      body.append(
        h("p.muted.center", null, `${MODES[cfg.mode].name} · ${round.height} эт. · ${fmt(round.score)} очков`),
        button("▶ Продолжить", resume, { kind: "gold", big: true }),
        button(d.settings.music > 0 ? "🔇 Выключить музыку" : "🎵 Включить музыку", () => {
          app.store.mutate((s) => {
            s.settings.music = s.settings.music > 0 ? 0 : 0.5;
          });
          app.sound.setVolumes(app.store.data.settings.sfx, app.store.data.settings.music);
          resume();
        }),
        button("❓ Как играть", () => openGuide(app, { inRound: true }), { kind: "soft" }),
        button("🏛️ Завершить раунд", () => {
          close();
          pauseModal = null;
          round.paused = false;
          app.sound.setPaused(false);
          if (isTutorial) skipTutorial();
          else round.quit();
        }, { kind: "danger" }),
      );
      (body.querySelector("button") as HTMLButtonElement | null)?.focus();
    }, { dismissable: false, onEscape: () => resume() });
  };

  app.renderer.hudUi.attach(round, {
    onPause: openPause,
    onSkipTutorial: skipTutorial,
    onPickBonus: (id) => {
      round.pickBonus(id);
      app.analytics.track("bonus_pick", { bonus: id, floor: round.height });
      say(`Выбран бонус: ${BONUSES[id].name}. ${BONUSES[id].desc}`);
    },
    onCrown: () => {
      if (round.requestCrown()) app.analytics.track("crown_voluntary", { height: round.height });
    },
  });

  const off = round.events.on((e: RoundEvent) => {
    switch (e.k) {
      case "land":
        say(`Этаж ${e.floor}: ${QUALITY_LABEL[e.q]}. Устойчивость ${Math.round(round.stability)}. Комбо ${round.combo}.${e.synergy.length ? ` ${e.synergy.join(". ")}` : ""}`);
        break;
      case "miss":
        say(`Комната упала. Осталось касок: ${round.lives}.`);
        break;
      case "event":
        if (e.on) say(`Событие: ${EVENTS[e.id].name}. ${EVENTS[e.id].desc}`);
        break;
      case "bonusOffer":
        say(`Выберите бонус клавишами 1–${e.options.length}: ${e.options.map((id, i) => `${i + 1} — ${BONUSES[id].name}`).join(", ")}.`);
        break;
      case "crownStart":
        say("Шанырак завершает кампус.");
        break;
      case "hint":
        if (e.text) say(e.text);
        break;
      default:
        break;
    }
  });

  return {
    el,
    backdrop: "game",
    destroy() {
      off();
      app.renderer.hudUi.detach();
      pauseModal?.close();
    },
  };
}
