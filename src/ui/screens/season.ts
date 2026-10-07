// Season pass: free track for everyone, premium track unlocked with in-game $SHAI.

import { SEASON_PREMIUM_PRICE, buySeasonPremium } from "../../economy/shop";
import { claimSeason, SEASON, SEASON_TIERS, seasonTier } from "../../retention/season";
import type { App, Screen } from "../app";
import { bar, button, toast } from "../components/common";
import { hub } from "../components/shell";
import { fmt, h } from "../dom";

export function seasonScreen(app: App): Screen {
  const shell = hub(app, "season", "season");
  const build = () => {
    const d = app.store.data;
    const tier = seasonTier(d.season.xp);
    const inTier = d.season.xp - tier * SEASON.tierXp;
    const daysLeft = Math.max(0, Math.ceil((new Date(SEASON.ends).getTime() - Date.now()) / 86400000));
    shell.body.innerHTML = "";
    shell.body.append(
      h(
        "div.season-head",
        null,
        h("div", null, h("h2", null, SEASON.name), h("small.muted", null, `До конца сезона: ${daysLeft} дн.`)),
        h(
          "div.season-progress",
          null,
          h("b", null, `Уровень ${tier}/${SEASON_TIERS.length}`),
          bar(tier >= SEASON_TIERS.length ? 1 : inTier, tier >= SEASON_TIERS.length ? 1 : SEASON.tierXp, "linear-gradient(90deg,#f2b84b,#ffd75e)"),
          h("small.muted", null, tier >= SEASON_TIERS.length ? "Сезон пройден!" : `${inTier}/${SEASON.tierXp} очков сезона до следующего уровня`),
        ),
      ),
      d.season.premium
        ? h("div.callout.gold", null, "🎓 Студенческий абонемент активен — премиум-ветка открыта.")
        : h(
            "div.callout",
            null,
            h("span", null, "🎓 Студенческий абонемент открывает премиум-ветку (косметика и материалы). Только за игровую валюту."),
            button(`🪙 ${fmt(SEASON_PREMIUM_PRICE)}`, () => {
              if (buySeasonPremium(app.store)) {
                app.sound.reward();
                toast("Абонемент активирован!", "reward", "🎓");
                app.analytics.track("purchase_soft", { item: "season_premium" });
              }
            }, { kind: d.shai >= SEASON_PREMIUM_PRICE ? "gold" : "ghost", disabled: d.shai < SEASON_PREMIUM_PRICE }),
          ),
      h("p.muted", null, "Очки сезона: высота и «Идеально» в раундах, коворкинги, инновации и задания."),
    );
    const ladder = h("div.season-ladder");
    for (const row of SEASON_TIERS) {
      const reached = tier >= row.tier;
      const cell = (track: "free" | "premium") => {
        const r = track === "free" ? row.free : row.premium;
        const claimed = (track === "free" ? d.season.claimedFree : d.season.claimedPremium).includes(row.tier);
        const locked = track === "premium" && !d.season.premium;
        return h(
          `div.season-cell.${track}${claimed ? ".claimed" : ""}${reached && !claimed && !locked ? ".ready" : ""}`,
          null,
          h("span.big-icon", null, r.icon),
          h("small", null, r.label),
          claimed
            ? h("span.chip.done", null, "✓")
            : reached && !locked
              ? button("Забрать", () => {
                  if (claimSeason(app.store, row.tier, track)) {
                    app.sound.reward();
                    toast(`Сезон: ${r.label}`, "reward", r.icon);
                  }
                }, { kind: "gold" })
              : h("span.chip", null, locked ? "🔒" : `ур. ${row.tier}`),
        );
      };
      ladder.appendChild(h(`div.season-row${reached ? ".reached" : ""}`, null, h("div.tier-num", null, String(row.tier)), cell("free"), cell("premium")));
    }
    shell.body.append(h("div.season-cols", null, h("span", null, ""), h("b", null, "Бесплатно"), h("b", null, "Абонемент")), ladder);
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
