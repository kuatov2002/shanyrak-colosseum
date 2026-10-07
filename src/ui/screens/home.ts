// Home: the campus. The decorative tower stays visible in the middle. One big "Play" (the quick
// tower), "all modes" next to it, a "what next" hint and the "how to play" guide for newcomers.

import { formatCountdown, msToNextDay } from "../../core/time";
import { MISSIONS, MODES } from "../../gameplay/modes";
import type { ModeId } from "../../gameplay/types";
import { claimStreak } from "../../meta/progression";
import { STREAK_REWARDS, streakClaimable } from "../../retention/daily";
import { unclaimedSeasonCount } from "../../retention/season";
import { UPGRADES } from "../../meta/upgrades";
import { FACULTIES } from "../../social/faculties";
import type { App, Screen } from "../app";
import { button, modal, ornamentDivider, shanyrakEmblem, toast } from "../components/common";
import { openGuide } from "../components/guide";
import { hub, questBadge } from "../components/shell";
import { fmt, h } from "../dom";

export function openModes(app: App): void {
  const d = app.store.data;
  modal("Выберите режим", (body, close) => {
    body.appendChild(h("p.muted", null, "Правила везде одни: ставьте комнаты ровно. Режимы отличаются целью."));
    const order: ModeId[] = ["quick", "daily", "campaign", "faculty", "endless"];
    for (const id of order) {
      const m = MODES[id];
      let sub = m.desc;
      if (id === "daily") sub += d.daily.attempts ? ` · сыграно сегодня: ${d.daily.attempts}` : "";
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
        "🎓 Пройти обучение ещё раз (30 секунд)",
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

/** The single most useful next step for this player right now (or null when there is nothing to nudge). */
function nextStep(app: App): { icon: string; text: string; cta: string; go: () => void } | null {
  const d = app.store.data;
  if (streakClaimable(app.store)) return { icon: "🎁", text: "Подарок за ежедневный вход ждёт вас.", cta: "Забрать", go: () => openStreak(app) };
  const quests = questBadge(app) - (streakClaimable(app.store) ? 1 : 0);
  if (quests > 0) return { icon: "📜", text: `Выполнено заданий: ${quests}. Заберите награды.`, cta: "К заданиям", go: () => app.router.go("quests") };
  if (unclaimedSeasonCount(app.store) > 0) return { icon: "⭐", text: "Открыт новый уровень сезона — заберите награду.", cta: "К сезону", go: () => app.router.go("season") };
  const upgrade = UPGRADES.find((u) => d.upgrades[u.id] < u.maxLevel && d.shai >= u.cost(d.upgrades[u.id] + 1));
  if (upgrade && d.stats.rounds >= 2)
    return { icon: "🛠️", text: `Хватает $SHAI на улучшение «${upgrade.name}».`, cta: "В Мастерскую", go: () => app.router.go("workshop") };
  if (!Object.keys(d.campaign.stars).length && d.stats.rounds >= 1)
    return { icon: "📚", text: "«Семестр» — 8 коротких миссий, каждая учит новой механике.", cta: "Начать", go: () => app.router.go("campaign") };
  if (!d.daily.attempts && d.stats.rounds >= 2)
    return { icon: "📅", text: "Ежедневная башня: сегодня она одна для всех — сравните результат в рейтинге дня.", cta: "Сыграть", go: () => app.startRound("daily") };
  return null;
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

    const dailyLeft = h("small.muted", null, `Новая башня через ${formatCountdown(msToNextDay())}`);
    timer = setInterval(() => (dailyLeft.textContent = `Новая башня через ${formatCountdown(msToNextDay())}`), 1000);

    const cards = h(
      "div.home-cards",
      null,
      h(
        "button.home-card.daily",
        { type: "button", onclick: () => app.startRound("daily") },
        h("span.hc-icon", null, "📅"),
        h("b", null, "Ежедневная башня"),
        h("small", null, d.daily.best ? `Ваш лучший сегодня: ${fmt(d.daily.best)}` : "Одна башня для всех на сегодня · ×1.5 $SHAI"),
        dailyLeft,
      ),
      h(
        "button.home-card",
        { type: "button", onclick: () => app.router.go("campaign") },
        h("span.hc-icon", null, "📚"),
        h("b", null, "Семестр"),
        h("small", null, `8 миссий с особыми условиями · пройдено ${Object.keys(d.campaign.stars).length}/${MISSIONS.length}`),
      ),
      h(
        "button.home-card",
        { type: "button", onclick: () => (d.player.faculty ? app.startRound("faculty") : app.router.go("faculty", { next: "faculty-mode" })) },
        h("span.hc-icon", null, "🚩"),
        h("b", null, "За факультет"),
        h("small", null, fac ? `Очки в зачёт «${fac.name}» · +${fmt(d.weekly.facultyContrib)} за неделю` : "Выберите команду для недельного соревнования"),
      ),
    );

    const streak = streakClaimable(app.store);
    const streakBtn = h(
      `button.streak-chip${streak ? ".glow" : ""}`,
      { type: "button", onclick: () => openStreak(app), title: "Серия ежедневных входов" },
      `🔥 Серия: ${d.streak.count} ${streak ? "· подарок!" : ""}`,
    );
    const helpBtn = h("button.help-chip", { type: "button", onclick: () => openGuide(app), "aria-label": "Как играть" }, "? Как играть");

    const step = nextStep(app);
    const stepCard = step
      ? h(
          "div.next-step",
          null,
          h("span.ns-icon", { "aria-hidden": "true" }, step.icon),
          h("span.ns-text", null, h("small", null, "Что дальше"), h("b", null, step.text)),
          button(step.cta, step.go, { kind: "soft" }),
        )
      : null;

    shell.body.append(
      h("div.home-top", null, logo, h("div.home-chips", null, helpBtn, streakBtn)),
      h("p.home-tagline", null, "Ставьте комнаты ровно одной кнопкой и завершите кампус шаныраком."),
      h("div.home-spacer"),
      h(
        "div.home-bottom",
        null,
        stepCard,
        h(
          "div.play-row",
          null,
          button([h("span.pb-main", null, "▶ Играть"), h("small.pb-sub", null, "Быстрая башня · 2–3 минуты")], () => app.startRound("quick"), {
            kind: "gold",
            big: true,
            cls: "play-btn",
          }),
          button("☰ Все режимы", () => openModes(app), { kind: "primary", cls: "quick-btn" }),
        ),
        ornamentDivider(),
        cards,
      ),
    );
  };

  build();
  // First visit after the tutorial: one short "how the campus works" guide.
  if (app.store.data.tutorialDone && !app.store.data.guideSeen) setTimeout(() => {
    if (app.router.current?.id === "home" && !document.querySelector(".modal-backdrop")) openGuide(app, { welcome: true });
  }, 500);
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
