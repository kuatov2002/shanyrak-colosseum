// Round result: what you built, what you earned, what moved forward — then "again" in one tap.
// The optional Solana invitation appears only after a few real rounds (never after the tutorial),
// or when a new badge-eligible achievement was just earned.

import { MODES, MISSIONS } from "../../gameplay/modes";
import { applyMetrics, WEEKLY_QUESTS } from "../../retention/quests";
import { FACULTIES } from "../../social/faculties";
import { MINTABLE_IDS } from "../../solana/nft";
import type { App, Screen } from "../app";
import { button, ornamentDivider, rarityBadge, toast } from "../components/common";
import { fmt, h } from "../dom";
import { reducedMotion, tweenNumber } from "../motion";

const REASON_TEXT: Record<string, string> = {
  crown: "Вы сами увенчали кампус шаныраком — бонус +25% $SHAI!",
  goal: "Цель достигнута — шанырак завершил кампус.",
  collapse: "Верхние этажи осели, но кампус выстоял и получил свой шанырак.",
  lives: "Каски закончились — шанырак собрал всех под одной крышей.",
  quit: "Раунд завершён досрочно.",
};

export function resultScreen(app: App): Screen {
  const sum = app.lastSummary;
  const el = h("div.result-screen.scroll");
  if (!sum) {
    el.append(h("p", null, "Нет результата"), button("В кампус", () => app.router.go("home"), { kind: "gold" }));
    return { el, backdrop: "tower" };
  }
  const r = sum.result;
  const d = app.store.data;
  if (!d.firstResultSeen) app.store.mutate((s) => (s.firstResultSeen = true));

  const title =
    r.mode === "tutorial"
      ? "Первый кампус готов!"
      : r.mode === "campaign"
        ? r.missionSuccess
          ? `Миссия пройдена: ${MISSIONS[r.missionIndex ?? 0].title}`
          : "Миссия не выполнена"
        : r.reason === "quit"
          ? "Раунд завершён"
          : "Кампус завершён шаныраком";

  const stats = h(
    "div.result-stats",
    null,
    stat("🏛️", `${r.height}`, "этажей", r.height),
    stat("✨", fmt(r.score), "очков", r.score),
    stat("🎓", fmt(r.students), "студентов", r.students),
    stat("🎯", `${r.perfects}`, "идеально", r.perfects),
    stat("🔥", `×${r.bestCombo}`, "лучшее комбо"),
  );

  const rewards = h(
    "div.reward-list",
    null,
    sum.lines.map((l, i) => h("div.reward-line", { style: { animationDelay: `${0.25 + i * 0.12}s` } }, h("span", null, l.icon), h("span", null, l.label), h("b", null, l.value))),
  );

  const extra: Node[] = [];
  if (sum.newBestHeight) extra.push(h("div.callout.gold", null, `🏆 Новый рекорд высоты: ${r.height} этажей!`));
  if (r.mode === "campaign" && r.missionSuccess) extra.push(h("div.callout", null, `${"★".repeat(r.missionStars)}${"☆".repeat(3 - r.missionStars)}${sum.missionReward ? ` · Награда: ${sum.missionReward}` : ""}`));
  if (sum.found) extra.push(h("div.callout", null, "🎁 Находка: ", h("b", null, sum.found.name), " ", rarityBadge(sum.found.rarity)));
  if (sum.questsDone.length)
    extra.push(
      h(
        "div.callout.green",
        null,
        h("span", null, `📜 Выполнено заданий: ${sum.questsDone.length}`, h("small.muted", { style: { display: "block" } }, sum.questsDone.join(" · "))),
        button("Забрать", () => app.router.go("quests"), { kind: "gold" }),
      ),
    );
  for (const a of sum.achievements) extra.push(h("div.callout.gold", null, `${a.icon} Достижение: ${a.title}`));
  if (sum.seasonTierAfter > sum.seasonTierBefore) extra.push(h("div.callout", null, `⭐ Новый уровень сезона: ${sum.seasonTierAfter}`));

  const rankLine = h("div.rank-line.muted", null, r.mode === "daily" ? "Считаем место в ежедневной башне…" : "");
  if (r.mode === "daily") {
    void app.leaderboards.board("daily_tower").then((b) => {
      if (b.myRank) {
        rankLine.textContent = `Ваше место в ежедневной башне: #${b.myRank} (${b.source === "online" ? "онлайн" : "оффлайн + демо"})`;
        if (b.myRank <= 10) {
          app.store.mutate((s) => {
            applyMetrics(WEEKLY_QUESTS, s.weekly.quests, { dailyRank: 1 });
          });
        }
      } else rankLine.textContent = "";
    });
  }

  const newBadge = sum.achievements.some((a) => MINTABLE_IDS.includes(a.id));
  const walletCard =
    r.mode !== "tutorial" && !d.walletPromptDismissed && !app.wallet.address && d.stats.rounds >= 3 && d.stats.rounds <= 6
      ? h(
          "div.wallet-invite",
          null,
          h("b", null, "◎ Solana — по желанию"),
          h("p", null, "Кошелёк для игры не нужен. С ним можно выпустить значок-NFT за достижение — он останется у вас навсегда."),
          h(
            "div.row",
            null,
            button("Узнать больше", () => app.router.go("wallet"), { kind: "primary" }),
            button("Не сейчас", () => {
              app.store.mutate((s) => (s.walletPromptDismissed = true));
              (document.querySelector(".wallet-invite") as HTMLElement | null)?.remove();
            }, { kind: "ghost" }),
          ),
        )
      : newBadge && r.mode !== "tutorial"
        ? h(
            "div.wallet-invite.small",
            null,
            h("span", null, "🏅 За это достижение можно выпустить значок-NFT (по желанию)"),
            button("Открыть", () => app.router.go("wallet"), { kind: "primary" }),
          )
        : null;

  const afterTutorial = r.mode === "tutorial";
  const next = () => {
    if (afterTutorial) app.router.go(d.player.faculty ? "home" : "faculty");
    else app.router.go("home");
  };
  const again = () => {
    if (r.mode === "campaign") {
      const nextIdx = r.missionSuccess ? Math.min(MISSIONS.length - 1, (r.missionIndex ?? 0) + 1) : (r.missionIndex ?? 0);
      app.startRound("campaign", { missionIndex: nextIdx });
    } else app.startRound(afterTutorial ? "quick" : r.mode);
  };

  el.append(
    h(
      "div.result-card",
      null,
      h("div.result-head", null, h("small.muted", null, MODES[r.mode].name), h("h1", null, title), h("p.muted", null, REASON_TEXT[r.reason] ?? "")),
      ornamentDivider(),
      stats,
      rewards,
      h(
        "div.result-actions",
        null,
        button(
          afterTutorial ? "Дальше →" : r.mode === "campaign" && r.missionSuccess && (r.missionIndex ?? 0) < MISSIONS.length - 1 ? "Следующая миссия ▶" : "▶ Ещё раз",
          afterTutorial ? next : again,
          { kind: "gold", big: true },
        ),
        afterTutorial ? null : button("В кампус", next, { kind: "soft" }),
        button("📋 Поделиться", () => {
          const text = `Шанырак: Кампус-Башня — ${r.height} этажей, ${fmt(r.score)} очков, ${fmt(r.students)} студентов! ${MODES[r.mode].name}.`;
          void navigator.clipboard?.writeText(text).then(
            () => toast("Текст результата скопирован", "success", "📋"),
            () => toast(text, "info"),
          );
        }, { kind: "ghost" }),
      ),
      extra,
      rankLine,
      d.player.faculty && r.facultyPts > 0 ? h("p.muted.center", null, `🚩 +${r.facultyPts} в копилку «${FACULTIES[d.player.faculty].name}»`) : null,
      walletCard,
    ),
  );
  app.sound.reward();
  return { el, backdrop: "tower" };
}

/** A result stat; numeric ones count up from zero as the card lands (300–400 ms). */
function stat(icon: string, value: string, label: string, count?: number): HTMLElement {
  const b = h("b.tween-num", null, value);
  if (count !== undefined && count > 0 && !reducedMotion()) {
    b.dataset.n = "0";
    b.textContent = "0";
    setTimeout(() => tweenNumber(b, count, fmt, count > 40 ? 400 : 300), 180);
  }
  return h("div.stat", null, h("span.stat-icon", null, icon), b, h("small", null, label));
}
