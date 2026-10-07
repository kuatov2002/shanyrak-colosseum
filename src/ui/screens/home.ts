// Home: the campus. The decorative tower stays visible in the middle; Play is the one big button.

import { dailySeed } from "../../core/rng";
import { dayKey, formatCountdown, msToNextDay } from "../../core/time";
import { MISSIONS, MODES } from "../../gameplay/modes";
import type { ModeId } from "../../gameplay/types";
import { claimStreak } from "../../meta/progression";
import { STREAK_REWARDS, streakClaimable } from "../../retention/daily";
import { FACULTIES } from "../../social/faculties";
import type { App, Screen } from "../app";
import { button, modal, ornamentDivider, shanyrakEmblem, toast } from "../components/common";
import { hub } from "../components/shell";
import { fmt, h } from "../dom";

export function openModes(app: App): void {
  const d = app.store.data;
  modal("Выберите режим", (body, close) => {
    const order: ModeId[] = ["quick", "daily", "campaign", "faculty", "endless"];
    for (const id of order) {
      const m = MODES[id];
      let sub = m.desc;
      if (id === "daily") sub += ` · попыток сегодня: ${d.daily.attempts}`;
      if (id === "campaign") sub += ` · пройдено ${Object.keys(d.campaign.stars).length}/${MISSIONS.length}`;
      if (id === "faculty") sub += d.player.faculty ? ` · за «${FACULTIES[d.player.faculty].name}»` : " · сначала выберите факультет";
      body.appendChild(
        h(
          "button.mode-card",
          {
            type: "button",
            onclick: () => {
              close();
              if (id === "campaign") app.router.go("campaign");
              else if (id === "faculty" && !d.player.faculty) app.router.go("faculty", { next: "faculty-mode" });
              else app.startRound(id);
            },
          },
          h("span.mode-icon", null, m.icon),
          h("span.mode-text", null, h("b", null, m.name), h("small", null, sub)),
          h("span.mode-go", null, "▶"),
        ),
      );
    }
    body.appendChild(
      h(
        "button.link-btn",
        { type: "button", onclick: () => { close(); app.startRound("tutorial"); } },
        "🎓 Пройти обучение ещё раз (30 сек)",
      ),
    );
  }, { cls: "sheet" });
}

export function openStreak(app: App): void {
  const s = app.store.data.streak;
  modal("Серия входов", (body, close) => {
    body.appendChild(h("p.muted.center", null, "Заходите каждый день — награды растут. Пропуск дня начинает серию заново."));
    const grid = h("div.streak-grid");
    STREAK_REWARDS.forEach((r) => {
      const state = r.day < s.count || (r.day === s.count && s.claimedDay >= s.count) ? "done" : r.day === s.count ? "today" : "future";
      grid.appendChild(
        h(`div.streak-day.${state}`, null, h("small", null, `День ${r.day}`), h("span.big-icon", null, r.icon), h("small", null, r.label)),
      );
    });
    body.appendChild(grid);
    const claimable = streakClaimable(app.store);
    body.appendChild(
      button(claimable ? `Забрать награду дня ${claimable}` : "Награда получена — до завтра!", () => {
        const label = claimStreak(app.store);
        if (label) {
          app.sound.reward();
          toast(`Серия входов: ${label}`, "reward", "🎁");
          app.analytics.track("streak_claim", { day: s.count });
        }
        close();
      }, { kind: claimable ? "gold" : "ghost", disabled: !claimable, big: true }),
    );
  });
}

export function homeScreen(app: App): Screen {
  const shell = hub(app, "home", "home");
  let timer: ReturnType<typeof setInterval> | null = null;

  const build = () => {
    const d = app.store.data;
    shell.body.innerHTML = "";
    const fac = d.player.faculty ? FACULTIES[d.player.faculty] : null;

    const logo = h(
      "div.logo",
      null,
      shanyrakEmblem(64),
      h("div.logo-text", null, h("h1", null, "ШАНЫРАК"), h("p", null, "Кампус-Башня")),
    );

    const dailyLeft = h("small.muted", null, `Новый сид через ${formatCountdown(msToNextDay())}`);
    timer = setInterval(() => (dailyLeft.textContent = `Новый сид через ${formatCountdown(msToNextDay())}`), 1000);

    const cards = h(
      "div.home-cards",
      null,
      h(
        "button.home-card.daily",
        { type: "button", onclick: () => app.startRound("daily") },
        h("span.hc-icon", null, "📅"),
        h("b", null, "Ежедневная башня"),
        h("small", null, d.daily.best ? `Лучший сегодня: ${fmt(d.daily.best)}` : `Сид #${dailySeed(dayKey()) % 10000} · ×1.5 $SHAI`),
        dailyLeft,
      ),
      h(
        "button.home-card",
        { type: "button", onclick: () => app.router.go("campaign") },
        h("span.hc-icon", null, "📚"),
        h("b", null, "Семестр"),
        h("small", null, `${Object.keys(d.campaign.stars).length}/${MISSIONS.length} миссий`),
      ),
      h(
        "button.home-card",
        { type: "button", onclick: () => (d.player.faculty ? app.startRound("faculty") : app.router.go("faculty", { next: "faculty-mode" })) },
        h("span.hc-icon", null, "🚩"),
        h("b", null, "Факультет"),
        h("small", null, fac ? `«${fac.name}» · +${fmt(d.weekly.facultyContrib)} за неделю` : "Выберите факультет"),
      ),
    );

    const streak = streakClaimable(app.store);
    const streakBtn = h(
      `button.streak-chip${streak ? ".glow" : ""}`,
      { type: "button", onclick: () => openStreak(app) },
      `🔥 Серия: ${d.streak.count} ${streak ? "· награда!" : ""}`,
    );

    shell.body.append(
      h("div.home-top", null, logo, streakBtn),
      h("div.home-spacer"),
      h(
        "div.home-bottom",
        null,
        h(
          "div.play-row",
          null,
          button([h("span", null, "▶"), " Играть"], () => openModes(app), { kind: "gold", big: true, cls: "play-btn" }),
          button("⚡ Быстрая башня", () => app.startRound("quick"), { kind: "primary", cls: "quick-btn" }),
        ),
        ornamentDivider(),
        cards,
      ),
    );
  };

  build();
  return {
    el: shell.el,
    backdrop: "tower",
    refresh() {
      if (timer) clearInterval(timer);
      shell.refreshChrome();
      build();
    },
    destroy() {
      if (timer) clearInterval(timer);
    },
  };
}
