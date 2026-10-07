// "Мастерская кампуса": upgrades, shop, crafting and the collection — one screen, four tabs.

import { craft, RECIPES, recipeDone } from "../../economy/crafting";
import { canAfford, formatCost, MATERIAL_INFO } from "../../economy/shai";
import { BOOSTER_SHIELD_PRICE, buyCosmetic, buyRoom, buyShieldBooster, buyUpgrade, roomUnlocks, shopCosmetics } from "../../economy/shop";
import { CATEGORY_LABEL, COSMETICS, sourceLabel, type CosmeticCategory } from "../../meta/collection";
import { checkAchievements } from "../../meta/progression";
import { PLAYABLE_ROOMS, ROOMS } from "../../meta/rooms";
import { UPGRADES } from "../../meta/upgrades";
import { roomThumb } from "../../render/rooms";
import type { App, Screen } from "../app";
import { bar, button, rarityBadge, toast } from "../components/common";
import { hub } from "../components/shell";
import { fmt, h } from "../dom";

type Tab = "upgrades" | "shop" | "craft" | "collection";

export function workshopScreen(app: App, params: Record<string, unknown>): Screen {
  const shell = hub(app, "workshop", "workshop");
  let tab: Tab = (params.tab as Tab) ?? "upgrades";

  const afterPurchase = (label: string, item: string) => {
    app.sound.coin();
    toast(label, "success", "✅");
    app.analytics.track("purchase_soft", { item });
    for (const a of checkAchievements(app.store)) toast(`Достижение: ${a.title}`, "reward", a.icon);
  };

  const build = () => {
    const d = app.store.data;
    const s = app.store;
    shell.body.innerHTML = "";
    const tabs: [Tab, string][] = [
      ["upgrades", "Улучшения"],
      ["shop", "Магазин"],
      ["craft", "Крафт"],
      ["collection", "Коллекция"],
    ];
    shell.body.appendChild(
      h(
        "div.tabs",
        null,
        tabs.map(([id, label]) => h(`button.tab${tab === id ? ".active" : ""}`, { type: "button", onclick: () => { tab = id; build(); } }, label)),
      ),
    );
    const wrap = h("div.tab-body");
    shell.body.appendChild(wrap);

    if (tab === "upgrades") {
      wrap.appendChild(h("p.muted", null, "Постоянные улучшения за $SHAI, заработанные игрой. Первые доступны после 2–3 раундов."));
      for (const u of UPGRADES) {
        const lvl = d.upgrades[u.id];
        const maxed = lvl >= u.maxLevel;
        const cost = maxed ? 0 : u.cost(lvl + 1);
        wrap.appendChild(
          h(
            "div.list-card",
            null,
            h("span.lc-icon", null, u.icon),
            h(
              "div.lc-text",
              null,
              h("b", null, u.name, h("small.muted", null, `  ур. ${lvl}/${u.maxLevel}`)),
              h("small", null, lvl > 0 ? `Сейчас: ${u.effect(lvl)}` : "Не изучено"),
              maxed ? null : h("small.muted", null, `Далее: ${u.effect(lvl + 1)}`),
              bar(lvl, u.maxLevel, "var(--turq)"),
            ),
            maxed
              ? h("span.chip.done", null, "MAX")
              : button(`🪙 ${fmt(cost)}`, () => buyUpgrade(s, u.id) && afterPurchase(`${u.name}: уровень ${lvl + 1}`, u.id), {
                  kind: d.shai >= cost ? "gold" : "ghost",
                  disabled: d.shai < cost,
                }),
          ),
        );
      }
    }

    if (tab === "shop") {
      wrap.appendChild(h("p.muted", null, "Всё — за игровую валюту $SHAI. Никаких покупок за деньги и платной силы."));
      wrap.appendChild(h("h3", null, "Комнаты"));
      const rooms = h("div.grid-cards");
      for (const id of roomUnlocks()) {
        const def = ROOMS[id];
        const owned = d.unlockedRooms.includes(id);
        const cost = def.unlock.kind === "shai" ? def.unlock.cost : 0;
        rooms.appendChild(
          h(
            `div.item-card${owned ? ".owned" : ""}`,
            null,
            h("img.room-img", { src: roomThumb(id, d.player.faculty), alt: def.name }),
            h("b", null, def.name),
            rarityBadge(def.rarity),
            h("small", null, def.role),
            owned ? h("span.chip.done", null, "Открыта") : button(`🪙 ${fmt(cost)}`, () => buyRoom(s, id) && afterPurchase(`Открыта комната «${def.name}»`, id), { kind: d.shai >= cost ? "gold" : "ghost", disabled: d.shai < cost }),
          ),
        );
      }
      wrap.appendChild(rooms);
      wrap.appendChild(h("h3", null, "Бустер"));
      wrap.appendChild(
        h(
          "div.list-card",
          null,
          h("span.lc-icon", null, "⛑️"),
          h("div.lc-text", null, h("b", null, "Каска на один раунд"), h("small", null, "+1 щит в следующем раунде. Не больше одной за раз.")),
          d.boosters.shield
            ? h("span.chip.done", null, "Куплено")
            : button(`🪙 ${BOOSTER_SHIELD_PRICE}`, () => buyShieldBooster(s) && afterPurchase("Каска готова к следующему раунду", "booster_shield"), { kind: "gold", disabled: d.shai < BOOSTER_SHIELD_PRICE }),
        ),
      );
      wrap.appendChild(h("h3", null, "Косметика"));
      const cos = h("div.grid-cards");
      for (const c of shopCosmetics()) {
        const owned = d.owned.includes(c.id);
        const price = c.source.kind === "shop" ? c.source.price : 0;
        cos.appendChild(
          h(
            `div.item-card${owned ? ".owned" : ""}`,
            null,
            h("span.big-icon", null, catIcon(c.cat)),
            h("b", null, c.name),
            rarityBadge(c.rarity),
            h("small", null, `${CATEGORY_LABEL[c.cat]} · ${c.desc}`),
            owned ? h("span.chip.done", null, "Есть") : button(`🪙 ${fmt(price)}`, () => buyCosmetic(s, c) && afterPurchase(`Куплено: ${c.name}`, c.id), { kind: d.shai >= price ? "gold" : "ghost", disabled: d.shai < price }),
          ),
        );
      }
      wrap.appendChild(cos);
    }

    if (tab === "craft") {
      wrap.appendChild(
        h("div.mats-row", null, (Object.keys(MATERIAL_INFO) as (keyof typeof MATERIAL_INFO)[]).map((m) => h("span.pill", null, `${MATERIAL_INFO[m].icon} ${MATERIAL_INFO[m].name}: ${d.materials[m]}`))),
      );
      wrap.appendChild(h("p.muted", null, "Материалы падают за «Идеально», в Шабыте, на Наурызе, за задания и сезон."));
      for (const r of RECIPES) {
        const done = recipeDone(s, r);
        const ok = canAfford(s, r.cost);
        wrap.appendChild(
          h(
            `div.list-card${done ? ".owned" : ""}`,
            null,
            r.result.room ? h("img.room-img.small", { src: roomThumb(r.result.room, d.player.faculty), alt: "" }) : h("span.lc-icon", null, r.result.cosmetic ? "🎨" : "🔁"),
            h("div.lc-text", null, h("b", null, r.name), h("small", null, r.desc), h("small.muted", null, `Нужно: ${formatCost(r.cost)}`)),
            done ? h("span.chip.done", null, "Готово") : button("Создать", () => craft(s, r) && afterPurchase(`Создано: ${r.name}`, r.id), { kind: ok ? "gold" : "ghost", disabled: !ok }),
          ),
        );
      }
    }

    if (tab === "collection") {
      wrap.appendChild(h("h3", null, `Комнаты · ${d.unlockedRooms.filter((r) => r !== "foundation").length + (d.player.faculty ? 1 : 0)}/${PLAYABLE_ROOMS.length}`));
      const rooms = h("div.grid-cards");
      for (const id of PLAYABLE_ROOMS) {
        const def = ROOMS[id];
        const owned = id === "faculty" ? !!d.player.faculty : d.unlockedRooms.includes(id);
        rooms.appendChild(
          h(
            `div.item-card${owned ? "" : ".locked"}`,
            null,
            h("img.room-img", { src: roomThumb(id, d.player.faculty, d.equipped.facade, d.equipped.ornament), alt: def.name }),
            h("b", null, def.name),
            rarityBadge(def.rarity),
            h("small", null, def.synergy),
            owned ? null : h("small.muted", null, def.unlock.kind === "shai" ? "Магазин" : def.unlock.kind === "craft" ? "Крафт / серия входов" : def.unlock.kind === "faculty" ? "Выберите факультет" : ""),
          ),
        );
      }
      wrap.appendChild(rooms);
      const cats = Object.keys(CATEGORY_LABEL) as CosmeticCategory[];
      for (const cat of cats) {
        const items = COSMETICS.filter((c) => c.cat === cat);
        wrap.appendChild(h("h3", null, `${CATEGORY_LABEL[cat]} · ${items.filter((c) => d.owned.includes(c.id)).length}/${items.length}`));
        const grid = h("div.grid-cards.compact");
        for (const c of items) {
          const owned = d.owned.includes(c.id);
          const equipped = d.equipped[cat] === c.id;
          grid.appendChild(
            h(
              `div.item-card${owned ? "" : ".locked"}${equipped ? ".equipped" : ""}`,
              null,
              h("span.big-icon", null, catIcon(cat)),
              h("b", null, c.name),
              rarityBadge(c.rarity),
              h("small.muted", null, owned ? c.desc : sourceLabel(c)),
              c.onchain ? h("small.nft", { title: "Предмет спроектирован для будущего NFT (см. README)" }, "◎ NFT-ready") : null,
              owned
                ? equipped
                  ? h("span.chip.done", null, "Надето")
                  : button("Надеть", () => {
                      s.mutate((x) => {
                        x.equipped[cat] = c.id;
                      });
                      if (cat === "music") app.sound.setTheme(c.id as "mus_campus");
                      app.refreshMenuScene();
                      app.sound.click();
                    }, { kind: "soft" })
                : null,
            ),
          );
        }
        wrap.appendChild(grid);
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

function catIcon(cat: CosmeticCategory): string {
  return { ornament: "🌀", facade: "🧱", background: "🏔️", student: "🎓", flag: "🚩", shanyrak: "🏛️", effect: "✨", music: "🎵" }[cat];
}
