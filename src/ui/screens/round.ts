// In-round HUD. The canvas draws the world; this layer shows numbers, the next room, the combo,
// events, bonus cards and hints. Tap/click anywhere (or Space) drops the room.

import { BONUSES } from "../../gameplay/bonuses";
import { EVENTS } from "../../gameplay/events";
import { MODES, MISSIONS } from "../../gameplay/modes";
import type { Round } from "../../gameplay/round";
import type { BonusId, RoundEvent } from "../../gameplay/types";
import { ROOMS } from "../../meta/rooms";
import { MATERIAL_INFO } from "../../economy/shai";
import { roomThumb } from "../../render/rooms";
import type { App, Screen } from "../app";
import { button, modal, type ModalHandle } from "../components/common";
import { fmt, h } from "../dom";

export function roundScreen(app: App): Screen {
  const round = app.round as Round;
  const cfg = round.cfg;
  const isTutorial = cfg.mode === "tutorial";

  const heightEl = h("b", null, "0");
  const scoreEl = h("small", null, "0 очков");
  const shaiEl = h("span", null, "0");
  const studentsEl = h("span", null, "0");
  const stabFill = h("div.bar-fill");
  const stabBar = h("div.bar.stab-bar", null, stabFill);
  const stabNum = h("span.stab-num", null, "100");
  const livesEl = h("span.lives");
  const shieldsEl = h("span.shields");
  const nextImg = h("img.next-img", { alt: "" }) as HTMLImageElement;
  const nextName = h("small", null, "");
  const comboEl = h("div.hud-combo", null);
  const eventChip = h("div.event-chip.hidden");
  const missionChip = h("div.mission-chip.hidden");
  const bonusesEl = h("div.hud-bonuses");
  const hintEl = h("div.hud-hint.hidden");
  const bannerEl = h("div.hud-banner.hidden");
  const synergyEl = h("div.hud-synergy");
  const crownBtn = button("🏛️ Завершить шаныраком (+25% $SHAI)", () => {
    if (round.requestCrown()) app.analytics.track("crown_voluntary", { height: round.height });
  }, { kind: "gold", cls: "crown-btn hidden" });

  let pauseModal: ModalHandle | null = null;
  const pauseBtn = h("button.icon-btn.pause-btn", { type: "button", "aria-label": "Пауза", onclick: (e: Event) => { e.stopPropagation(); openPause(); } }, "⏸");

  const tapLayer = h("div.tap-layer", {
    onpointerdown: (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      app.sound.unlock();
      round.drop();
    },
  });

  const modeLabel = cfg.mode === "campaign" && cfg.missionIndex !== undefined ? `Миссия ${cfg.missionIndex + 1}: ${MISSIONS[cfg.missionIndex].title}` : MODES[cfg.mode].name;

  const el = h(
    "div.hud",
    null,
    tapLayer,
    h(
      "div.hud-top",
      null,
      h("div.hud-height", null, heightEl, h("span", null, "этаж"), scoreEl),
      h("div.hud-mid", null, h("small.mode-label", null, modeLabel), eventChip, missionChip),
      h(
        "div.hud-right",
        null,
        h("span.pill", { title: "$SHAI за раунд" }, h("i", null, "🪙"), shaiEl),
        h("span.pill", { title: "Студенты" }, h("i", null, "🎓"), studentsEl),
        pauseBtn,
      ),
    ),
    h("div.hud-stab", null, h("span.stab-label", null, "Устойчивость"), stabBar, stabNum, shieldsEl, livesEl),
    h("div.hud-next", null, h("small.muted", null, "Далее"), nextImg, nextName),
    comboEl,
    synergyEl,
    bonusesEl,
    hintEl,
    bannerEl,
    crownBtn,
    isTutorial
      ? button("Пропустить обучение", () => skipTutorial(), { kind: "ghost", cls: "skip-btn" })
      : null,
  );

  const skipTutorial = () => {
    app.analytics.track("tutorial_done", { skipped: true });
    app.store.mutate((d) => {
      d.tutorialDone = true;
    });
    app.endRoundEarly();
    app.router.go(app.store.data.player.faculty ? "home" : "faculty");
  };

  // ── event reactions ─────────────────────────────────────────────────────
  let bannerTimer: ReturnType<typeof setTimeout> | null = null;
  const banner = (title: string, sub: string, color = "var(--gold)", ms = 2400) => {
    bannerEl.innerHTML = "";
    bannerEl.append(h("b", { style: { color } }, title), sub ? h("small", null, sub) : "");
    bannerEl.classList.remove("hidden", "pop");
    void bannerEl.offsetWidth;
    bannerEl.classList.add("pop");
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => bannerEl.classList.add("hidden"), ms);
  };

  const flashSynergy = (text: string) => {
    const pill = h("span.syn-pill", null, text);
    synergyEl.appendChild(pill);
    setTimeout(() => pill.remove(), 1800);
  };

  let offerModal: ModalHandle | null = null;
  const showOffer = (options: BonusId[]) => {
    offerModal = modal("Выберите бонус", (body, close) => {
      body.appendChild(h("p.muted.center", null, "Один бонус — до конца раунда или на несколько этажей."));
      const row = h("div.bonus-row");
      for (const id of options) {
        const b = BONUSES[id];
        row.appendChild(
          h(
            "button.bonus-card",
            {
              type: "button",
              onclick: () => {
                close();
                offerModal = null;
                round.pickBonus(id);
                app.analytics.track("bonus_pick", { bonus: id, floor: round.height });
              },
            },
            h("span.bonus-icon", null, b.icon),
            h("b", null, b.name),
            h("small", null, b.desc),
            h("span.style-tag", null, b.style),
          ),
        );
      }
      body.appendChild(row);
    }, { dismissable: false, cls: "bonus-modal" });
  };

  const off = round.events.on((e: RoundEvent) => {
    switch (e.k) {
      case "land":
        if (e.synergy.length) e.synergy.forEach((s, i) => setTimeout(() => flashSynergy(s), i * 250));
        if (e.q === "perfect") el.classList.add("perfect-flash");
        setTimeout(() => el.classList.remove("perfect-flash"), 260);
        break;
      case "shabyt":
        if (e.on) banner(e.level === 2 ? "ШАБЫТ ×2!" : "ШАБЫТ!", "Вдохновение: очки растут, башня сияет", "#ffd75e", 1800);
        break;
      case "event": {
        const ev = EVENTS[e.id];
        if (e.on) banner(`${ev.icon} ${ev.name}`, ev.desc, ev.color, 3000);
        break;
      }
      case "bonusOffer":
        setTimeout(() => showOffer(e.options), 250);
        break;
      case "material":
        flashSynergy(`+1 ${MATERIAL_INFO[e.id].icon} ${MATERIAL_INFO[e.id].name}`);
        break;
      case "mission":
        if (e.done) banner("🎯 Цель миссии выполнена!", "Шанырак завершает кампус", "#8ef0a5", 2600);
        break;
      case "examPassed":
        flashSynergy(`📝 Экзамен сдан: +${e.students} студентов`);
        break;
      case "collapse":
        banner("Башня осела", `${e.fallen} верхних этажа упали — но кампус стоит`, "#ff9d5c", 2400);
        break;
      case "crownStart":
        banner("Шанырак завершает кампус", round.endReason === "lives" ? "Каски закончились — время собрать всех под одной крышей" : "", "#fff3c4", 2600);
        break;
      case "hint":
        if (e.text) {
          hintEl.textContent = e.text;
          hintEl.classList.remove("hidden");
        } else hintEl.classList.add("hidden");
        break;
      case "drop":
        if (!isTutorial) hintEl.classList.add("hidden");
        break;
      default:
        break;
    }
  });

  if (isTutorial && round.height === 0) {
    hintEl.textContent = "Нажмите, тапните или пробел — сбросить комнату";
    hintEl.classList.remove("hidden");
  }

  // ── per-frame HUD values ─────────────────────────────────────────────────
  let raf = 0;
  const last: Record<string, string> = {};
  const setText = (key: string, node: HTMLElement, text: string) => {
    if (last[key] === text) return;
    last[key] = text;
    node.textContent = text;
  };
  const tick = () => {
    const r = round;
    setText("h", heightEl, String(r.height));
    setText("s", scoreEl, `${fmt(r.score)} очков`);
    setText("shai", shaiEl, fmt(r.shai));
    setText("st", studentsEl, fmt(r.students));
    const pct = Math.max(0, Math.min(100, (r.stability / r.maxStability) * 100));
    stabFill.style.width = `${pct}%`;
    stabFill.style.background = pct > 60 ? "linear-gradient(90deg,#4fd08a,#8ef0a5)" : pct > 30 ? "linear-gradient(90deg,#f2b84b,#ffd75e)" : "linear-gradient(90deg,#e04848,#ff7a5a)";
    stabBar.classList.toggle("danger", r.danger);
    setText("sn", stabNum, `${Math.round(r.stability)}`);
    setText("lives", livesEl, "⛑".repeat(Math.max(0, r.lives)) + "·".repeat(Math.max(0, 3 - r.lives)));
    setText("shields", shieldsEl, r.shields > 0 ? `🛡×${r.shields}` : "");
    const nextKey = `${r.nextType}`;
    if (last.next !== nextKey) {
      last.next = nextKey;
      nextImg.src = roomThumb(r.nextType, cfg.faculty, cfg.cosmetics.facade, cfg.cosmetics.ornament);
      nextName.textContent = ROOMS[r.nextType].name;
    }
    const comboText = r.combo >= 2 ? `×${r.combo}` : "";
    if (last.combo !== comboText) {
      last.combo = comboText;
      comboEl.innerHTML = "";
      if (comboText) {
        comboEl.append(h("b", null, comboText), h("small", null, r.shabytLevel > 0 ? "ШАБЫТ" : "КОМБО"));
        comboEl.classList.remove("pop");
        void comboEl.offsetWidth;
        comboEl.classList.add("pop");
      }
    }
    comboEl.classList.toggle("shabyt", r.shabytLevel > 0);
    // event chip
    const evText = r.event ? `${EVENTS[r.event.id].icon} ${EVENTS[r.event.id].name} · ещё ${r.event.left}` : r.mission?.constantWind ? "🌬️ Ветреный день" : "";
    setText("ev", eventChip, evText);
    eventChip.classList.toggle("hidden", !evText);
    if (r.mission) {
      const res = r.mission.check(r);
      setText("mi", missionChip, `🎯 ${res.progress}`);
      missionChip.classList.remove("hidden");
    }
    // active bonuses
    const chips: string[] = [];
    if (r.eff.teaBreak) chips.push(`🍵${r.eff.teaBreak}`);
    if (r.eff.wideCrane) chips.push(`🏗️${r.eff.wideCrane}`);
    if (r.eff.magnet) chips.push(`🧲${r.eff.magnet}`);
    if (r.eff.garland) chips.push(`🏮${r.eff.garland}`);
    if (r.eff.facultySpirit) chips.push(`🚩${r.eff.facultySpirit}`);
    if (r.eff.windbreak) chips.push("🌲");
    if (r.eff.antiDeadline) chips.push("📅");
    if (r.eff.balcony) chips.push("🏛️");
    setText("bon", bonusesEl, chips.join("  "));
    crownBtn.classList.toggle("hidden", !r.canCrown);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const openPause = () => {
    if (round.phase === "done" || pauseModal) return;
    round.paused = true;
    pauseModal = modal("Пауза", (body, close) => {
      const d = app.store.data;
      const resume = () => {
        close();
        pauseModal = null;
        round.paused = false;
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
        button("🏛️ Завершить раунд", () => {
          close();
          pauseModal = null;
          round.paused = false;
          if (isTutorial) skipTutorial();
          else round.quit();
        }, { kind: "danger" }),
      );
    }, { dismissable: false });
  };

  return {
    el,
    backdrop: "game",
    destroy() {
      cancelAnimationFrame(raf);
      off();
      offerModal?.close();
      pauseModal?.close();
      if (bannerTimer) clearTimeout(bannerTimer);
    },
  };
}
