// Hub chrome: the top bar (profile, $SHAI, materials, wallet, settings) and the bottom navigation.

import { DAILY_QUESTS, isComplete, WEEKLY_QUESTS } from "../../retention/quests";
import { streakClaimable } from "../../retention/daily";
import { unclaimedSeasonCount } from "../../retention/season";
import { FACULTIES } from "../../social/faculties";
import { shortAddress } from "../../social/leaderboards";
import type { App, ScreenId } from "../app";
import { fmt, h } from "../dom";
import { tweenNumber } from "../motion";
import { openInfo } from "./guide";

export const AVATARS = ["🦅", "🐎", "🐆", "🦉", "🐺", "🦌"];

export function questBadge(app: App): number {
  const d = app.store.data;
  let n = 0;
  for (const q of DAILY_QUESTS) {
    const p = d.daily.quests.find((x) => x.id === q.id);
    if (p && isComplete(q, p) && !p.claimed) n++;
  }
  for (const q of WEEKLY_QUESTS) {
    const p = d.weekly.quests.find((x) => x.id === q.id);
    if (p && isComplete(q, p) && !p.claimed) n++;
  }
  if (streakClaimable(app.store)) n++;
  return n;
}

// The topbar is rebuilt on every refresh; remember what it last showed so $SHAI counts up/down
// from there instead of jumping.
let shaiShown: number | null = null;
function shaiCount(value: number): HTMLElement {
  const from = shaiShown ?? value;
  shaiShown = value;
  const el = h("span.pill-num", { "data-n": String(from) }, fmt(from));
  if (from !== value) tweenNumber(el, value, (n) => fmt(Math.round(n)), 360);
  return el;
}

/** "Войти" when nobody is signed in (online mode), a quieter "Гость · Войти" for guests. */
function accountChip(app: App): HTMLElement | null {
  const s = app.store.session;
  if (!app.store.data.settings.online || s.online === "connecting") return null;
  const guest = s.account?.kind === "guest";
  if (s.account && !guest) return null;
  return h(
    `button.account-chip${guest ? ".guest" : ""}`,
    { type: "button", onclick: () => app.router.go("login", guest ? { upgrade: true } : {}), title: "Войти: кошелёк, iDos Games или почта" },
    guest ? "Гость · Войти" : "◎ Войти",
  );
}

export function topBar(app: App): HTMLElement {
  const d = app.store.data;
  const fac = d.player.faculty ? FACULTIES[d.player.faculty] : null;
  const online = app.store.session.online;
  const walletAddr = app.wallet.address ?? d.wallet.address;
  return h(
    "header.topbar",
    null,
    h(
      "button.profile-chip",
      { type: "button", onclick: () => app.router.go("profile"), "aria-label": "Профиль" },
      h("span.avatar", { style: { background: fac?.color ?? "#3a3f7a" } }, AVATARS[d.player.avatar % AVATARS.length]),
      h("span.pc-text", null, h("b", null, d.player.name), h("small", null, fac ? `«${fac.name}»` : "Факультет не выбран")),
    ),
    h(
      "div.topbar-right",
      null,
      accountChip(app),
      h(
        "button.net-dot",
        {
          type: "button",
          onclick: () => openInfo(app, "online"),
          title: online === "online" ? "Онлайн: рейтинги работают" : online === "connecting" ? "Подключение…" : "Оффлайн: прогресс сохраняется на устройстве",
          class: `net-${online}`,
        },
        online === "online" ? "онлайн" : online === "connecting" ? "…" : "оффлайн",
      ),
      h(
        "button.pill.pill-shai",
        { type: "button", onclick: () => openInfo(app, "shai"), title: "$SHAI — игровые монеты. Нажмите, чтобы узнать больше", "aria-label": `$SHAI: ${fmt(d.shai)}. Что это?` },
        h("i", null, "🪙"),
        shaiCount(d.shai),
        h("small.pill-label", null, "$SHAI"),
      ),
      h(
        "button.pill.pill-mats",
        { type: "button", onclick: () => openInfo(app, "materials"), title: "Материалы для крафта. Нажмите, чтобы узнать больше", "aria-label": `Материалы: кирпич ${d.materials.brick}, войлок ${d.materials.felt}, нить ${d.materials.thread}. Что это?` },
        `🧱${d.materials.brick} 🟫${d.materials.felt} 🧵${d.materials.thread}`,
      ),
      h(
        "button.pill.pill-wallet",
        { type: "button", onclick: () => app.router.go("wallet"), title: "Solana-кошелёк (необязательно)" },
        h("i", null, "◎"),
        walletAddr ? shortAddress(walletAddr) : "Кошелёк",
      ),
      h("button.icon-btn", { type: "button", onclick: () => app.router.go("settings"), "aria-label": "Настройки" }, "⚙️"),
    ),
  );
}

export function bottomNav(app: App, active: ScreenId): HTMLElement {
  const items: { id: ScreenId; icon: string; label: string; badge?: number }[] = [
    { id: "home", icon: "🏛️", label: "Кампус" },
    { id: "quests", icon: "📜", label: "Задания", badge: questBadge(app) },
    { id: "season", icon: "⭐", label: "Сезон", badge: unclaimedSeasonCount(app.store) },
    { id: "workshop", icon: "🛠️", label: "Мастерская" },
    { id: "leaderboards", icon: "🏆", label: "Рейтинг" },
  ];
  return h(
    "nav.bottom-nav",
    null,
    items.map((it) =>
      h(
        `button.nav-item${it.id === active ? ".active" : ""}`,
        { type: "button", onclick: () => it.id !== active && app.router.go(it.id) },
        h("span.nav-medal", null, h("span.nav-icon", null, it.icon)),
        h("span.nav-label", null, it.label),
        it.badge ? h("span.badge", null, String(it.badge)) : null,
      ),
    ),
  );
}

/** Standard hub screen: top bar + scrollable content + bottom nav. */
export function hub(app: App, active: ScreenId, cls: string): { el: HTMLElement; body: HTMLElement; refreshChrome(): void } {
  const body = h("div.hub-body");
  const scroll = h("main.scroll", null, body);
  const el = h(`div.hub.${cls}`, null, topBar(app), scroll, bottomNav(app, active));
  return {
    el,
    body,
    refreshChrome() {
      el.replaceChild(topBar(app), el.firstChild as Node);
      el.replaceChild(bottomNav(app, active), el.lastChild as Node);
    },
  };
}
