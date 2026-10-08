// "Семестр": eight missions from the first foundation to the final shanyrak.

import { MISSIONS } from "../../gameplay/modes";
import { COSMETIC_BY_ID } from "../../meta/collection";
import { ROOMS } from "../../meta/rooms";
import type { App, Screen } from "../app";
import { button, screenIntro } from "../components/common";
import { hub } from "../components/shell";
import { h } from "../dom";

export function campaignScreen(app: App): Screen {
  const shell = hub(app, "home", "campaign");
  const build = () => {
    const d = app.store.data;
    shell.body.innerHTML = "";
    shell.body.append(
      h("div.back-row", null, button("← Кампус", () => app.router.go("home"), { kind: "ghost" })),
      screenIntro("📚", "Кампания «Семестр»", "Каждая миссия учит новой механике. Первое прохождение даёт награду."),
    );
    const list = h("div.mission-list");
    MISSIONS.forEach((m, i) => {
      const stars = d.campaign.stars[String(i)] ?? 0;
      const unlocked = i === 0 || (d.campaign.stars[String(i - 1)] ?? 0) > 0;
      const reward = [
        `${m.reward.shai} $SHAI`,
        m.reward.unlockRoom ? `комната «${ROOMS[m.reward.unlockRoom].name}»` : "",
        m.reward.cosmetic ? `«${COSMETIC_BY_ID[m.reward.cosmetic]?.name}»` : "",
        m.reward.materials ? "материалы" : "",
      ].filter(Boolean).join(" · ");
      list.appendChild(
        h(
          `div.mission${unlocked ? "" : ".locked"}${stars ? ".cleared" : ""}`,
          null,
          h("div.mission-num", null, String(i + 1)),
          h(
            "div.mission-text",
            null,
            h("b", null, m.title),
            h("p", null, m.story),
            h("small", null, `🎯 ${m.goal}`),
            h("small.muted", null, stars ? "Награда получена" : `Награда: ${reward}`),
          ),
          h(
            "div.mission-side",
            null,
            h("div.stars", null, [1, 2, 3].map((k) => h(`span${k <= stars ? ".on" : ""}`, null, "★"))),
            button(unlocked ? (stars ? "Ещё раз" : "Начать") : "🔒", () => app.startRound("campaign", { missionIndex: i }), {
              kind: unlocked ? (stars ? "soft" : "gold") : "ghost",
              disabled: !unlocked,
            }),
          ),
        ),
      );
    });
    shell.body.appendChild(list);
    shell.body.appendChild(h("p.muted.center", null, "★ — миссия пройдена · ★★ — много «Идеально» · ★★★ — без потерянных касок"));
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
