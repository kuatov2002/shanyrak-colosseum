// Quests: daily, weekly, achievements and the login streak.

import { formatCountdown, msToNextDay, weekProgress } from "../../core/time";
import { claimDailyAllBonus, claimQuest } from "../../meta/progression";
import { STREAK_REWARDS, streakClaimable } from "../../retention/daily";
import { ACHIEVEMENTS, DAILY_ALL_BONUS, DAILY_QUESTS, isComplete, WEEKLY_QUESTS, type QuestDef, type QuestReward } from "../../retention/quests";
import type { QuestProgress } from "../../core/save";
import type { App, Screen } from "../app";
import { bar, button, toast } from "../components/common";
import { hub } from "../components/shell";
import { h } from "../dom";
import { openStreak } from "./home";
import { MINTABLE_IDS } from "../../solana/nft";
import { mintAvailability, openMintDialog } from "../components/mint";

type Tab = "daily" | "weekly" | "achievements";

function rewardText(r: QuestReward): string {
  const p: string[] = [];
  if (r.shai) p.push(`🪙${r.shai}`);
  if (r.materials?.brick) p.push(`🧱${r.materials.brick}`);
  if (r.materials?.felt) p.push(`🟫${r.materials.felt}`);
  if (r.materials?.thread) p.push(`🧵${r.materials.thread}`);
  if (r.season) p.push(`⭐${r.season}`);
  return p.join(" ");
}

export function questsScreen(app: App): Screen {
  const shell = hub(app, "quests", "quests");
  let tab: Tab = "daily";
  const build = () => {
    const d = app.store.data;
    shell.body.innerHTML = "";
    const streak = streakClaimable(app.store);
    shell.body.appendChild(
      h(
        `button.streak-banner${streak ? ".glow" : ""}`,
        { type: "button", onclick: () => openStreak(app) },
        h("span.big-icon", null, "🔥"),
        h("span", null, h("b", null, `Серия входов: ${d.streak.count} ${d.streak.count === 1 ? "день" : "дн."}`), h("small", null, `Сегодня: ${STREAK_REWARDS[Math.max(0, d.streak.count - 1)]?.label ?? ""}`)),
        h("span.chip", null, streak ? "Забрать!" : "✓"),
      ),
    );
    const tabs: [Tab, string][] = [
      ["daily", "Ежедневные"],
      ["weekly", "Недельные"],
      ["achievements", "Достижения"],
    ];
    shell.body.appendChild(h("div.tabs", null, tabs.map(([id, label]) => h(`button.tab${tab === id ? ".active" : ""}`, { type: "button", onclick: () => { tab = id; build(); } }, label))));
    const body = h("div.tab-body");
    shell.body.appendChild(body);

    const questRow = (kind: "daily" | "weekly", q: QuestDef, p: QuestProgress | undefined) => {
      const done = isComplete(q, p);
      const claimed = !!p?.claimed;
      return h(
        `div.list-card${claimed ? ".owned" : ""}`,
        null,
        h("span.lc-icon", null, claimed ? "✅" : done ? "🎁" : "📜"),
        h("div.lc-text", null, h("b", null, q.title), h("small.muted", null, `Награда: ${rewardText(q.reward)}`), bar(p?.progress ?? 0, q.target, done ? "var(--green)" : "var(--gold)"), h("small", null, `${Math.min(p?.progress ?? 0, q.target)}/${q.target}`)),
        claimed
          ? h("span.chip.done", null, "Получено")
          : button("Забрать", () => {
              if (claimQuest(app.store, kind, q.id)) {
                app.sound.reward();
                toast(`Награда: ${rewardText(q.reward)}`, "reward", "🎁");
                app.analytics.track("quest_claim", { quest: q.id });
              }
            }, { kind: done ? "gold" : "ghost", disabled: !done }),
      );
    };

    if (tab === "daily") {
      body.appendChild(h("p.muted", null, `Обновятся через ${formatCountdown(msToNextDay())} (00:00 UTC).`));
      for (const q of DAILY_QUESTS) body.appendChild(questRow("daily", q, d.daily.quests.find((x) => x.id === q.id)));
      const allClaimed = DAILY_QUESTS.every((q) => d.daily.quests.find((x) => x.id === q.id)?.claimed);
      body.appendChild(
        h(
          `div.list-card.bonus${d.daily.allClaimed ? ".owned" : ""}`,
          null,
          h("span.lc-icon", null, "🧺"),
          h("div.lc-text", null, h("b", null, "Все задания дня"), h("small.muted", null, `Бонус: ${rewardText(DAILY_ALL_BONUS)}`)),
          d.daily.allClaimed
            ? h("span.chip.done", null, "Получено")
            : button("Забрать", () => {
                if (claimDailyAllBonus(app.store)) {
                  app.sound.reward();
                  toast("Бонус дня получен!", "reward", "🧺");
                }
              }, { kind: allClaimed ? "gold" : "ghost", disabled: !allClaimed }),
        ),
      );
    } else if (tab === "weekly") {
      const left = (1 - weekProgress()) * 7 * 86400000;
      body.appendChild(h("p.muted", null, `Неделя закончится через ${formatCountdown(left)}.`));
      for (const q of WEEKLY_QUESTS) body.appendChild(questRow("weekly", q, d.weekly.quests.find((x) => x.id === q.id)));
    } else {
      for (const a of ACHIEVEMENTS) {
        const got = !!d.achievements[a.id];
        body.appendChild(
          h(
            `div.list-card${got ? ".owned" : ".locked"}`,
            null,
            h("span.lc-icon", null, got ? a.icon : "🔒"),
            h("div.lc-text", null, h("b", null, a.title), h("small", null, a.desc), h("small.muted", null, `Награда: ${rewardText(a.reward)}${a.reward.cosmetic ? " + косметика" : ""}`)),
            got ? h("span.chip.done", null, new Date(d.achievements[a.id]).toLocaleDateString("ru-RU")) : null,
            got && MINTABLE_IDS.includes(a.id)
              ? d.wallet.minted[a.id]
                ? h("span.chip.done", null, "🏅 NFT")
                : button("◎ Значок", () => (mintAvailability(app, a.id).can ? openMintDialog(app, a.id) : app.router.go("wallet")), { kind: "soft", title: "Сминтить значок-NFT (по желанию)" })
              : null,
          ),
        );
      }
    }
  };
  build();
  return {
    el: shell.el,
    backdrop: "dim",
    refresh() {
      shell.refreshChrome();
      build();
    },
  };
}
