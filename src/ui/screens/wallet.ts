// Solana screen (mainnet). Guest mode is the default; connecting is optional and first offered after
// the first result. Solana is used for exactly three things, each started by a button:
// reading the $SHAI balance, linking the wallet to the iDos profile, and optional badge mints.

import { SOLANA } from "../../solana/config";
import { STATUS_LABEL } from "../../solana/actions";
import { MINTABLE_IDS, metadataBase } from "../../solana/nft";
import { badgeDataUrl, badgeInfo } from "../../solana/nftArt";
import { fetchShaiBalance, fetchSolBalance, SHAI_TOKEN } from "../../solana/token";
import { shortAddress } from "../../social/leaderboards";
import type { App, Screen } from "../app";
import { button, toast } from "../components/common";
import { mintAvailability, openMintDialog } from "../components/mint";
import { hub } from "../components/shell";
import { fmt, h } from "../dom";

export function walletScreen(app: App): Screen {
  const shell = hub(app, "home", "wallet-screen");
  let solBalance = "—";
  let shaiBalance = "—";
  let alive = true;

  const refreshBalances = async () => {
    const addr = app.wallet.address;
    if (!addr) return;
    solBalance = "…";
    shaiBalance = "…";
    build();
    const [sol, shai] = await Promise.all([fetchSolBalance(addr), fetchShaiBalance(addr)]);
    if (!alive) return;
    solBalance = sol.ok ? `${sol.amount.toFixed(4)} SOL` : `нет данных: ${sol.error}`;
    shaiBalance = shai.ok ? `${fmt(shai.amount)} $SHAI` : `нет данных: ${shai.error}`;
    build();
  };

  const build = () => {
    const d = app.store.data;
    const w = app.wallet;
    shell.body.innerHTML = "";
    shell.body.append(
      h("div.back-row", null, button("← Кампус", () => app.router.go("home"), { kind: "ghost" })),
      h(
        "div.wallet-hero",
        null,
        h("h2", null, "◎ Solana"),
        h("p", null, "Кошелёк не нужен, чтобы играть: рейтинги, задания и прогресс работают без него. Solana здесь — только для трёх добровольных вещей:"),
        h(
          "ul.safety",
          null,
          h("li", null, h("b", null, "Привязка к профилю iDos"), " — бесплатная подпись сообщения, без транзакции."),
          h("li", null, h("b", null, "Значки-NFT за 4 достижения"), " — транзакция в mainnet, платит игрок (≈0.0016 SOL возвратного депозита + ≈0.00001 SOL комиссии, точная сумма до подписи)."),
          h("li", null, h("b", null, "Баланс $SHAI"), " — только чтение."),
          h("li", null, "Мы никогда не просим seed-фразу или приватный ключ. Каждая подпись — только по вашей кнопке."),
        ),
      ),
    );

    if (w.status === "connected" && w.address) {
      shell.body.appendChild(
        h(
          "div.connected-card",
          null,
          h("div", null, h("small.muted", null, `Подключён: ${w.adapter?.option.name ?? "кошелёк"} · Solana mainnet`), h("b.mono", null, shortAddress(w.address))),
          h("div.balances", null, h("span", null, `SOL: ${solBalance}`), h("span", null, `$SHAI: ${shaiBalance}`)),
          h(
            "div.row",
            null,
            button("↻ Балансы", () => void refreshBalances(), { kind: "soft" }),
            button("Отключить", () => {
              void w.disconnect();
              toast("Кошелёк отключён. Игра продолжается в гостевом режиме.", "info");
            }, { kind: "ghost" }),
          ),
        ),
      );
    } else {
      const options = w.options();
      shell.body.appendChild(
        h(
          "div.connect-list",
          null,
          h("b", null, w.status === "connecting" ? "Ожидание кошелька… подтвердите подключение" : "Подключить кошелёк"),
          w.error ? h("p.ac-msg.error", null, w.error) : "",
          options.map((o) =>
            h(
              "button.wallet-option",
              {
                type: "button",
                disabled: w.status === "connecting",
                onclick: async () => {
                  const ok = await w.connect(o.id);
                  if (ok) {
                    app.store.mutate((s) => {
                      if (s.wallet.address !== w.address) s.wallet.linkedToProfile = false;
                      s.wallet.address = w.address;
                      s.wallet.walletName = o.name;
                    });
                    app.analytics.track("wallet_connect", { kind: o.kind });
                    toast("Кошелёк подключён", "success", "◎");
                    void refreshBalances();
                  }
                },
              },
              o.icon ? h("img", { src: o.icon, alt: "", width: "24", height: "24" }) : h("span.wo-icon", null, "◎"),
              h("span", null, h("b", null, o.name), h("small", null, o.kind === "standard" ? "Wallet Standard" : "Встроенный провайдер")),
            ),
          ),
          options.length === 0
            ? h("p.muted", null, "Кошельки Solana не найдены. Установите Phantom, Solflare или Backpack и обновите страницу. Внутри iframe на idosgames.com кошелёк может быть недоступен — откройте игру по её собственному адресу.")
            : "",
        ),
      );
    }

    // Link to the iDos profile
    const link = app.actions.get("link");
    const linked = d.wallet.linkedToProfile && d.wallet.address === w.address;
    shell.body.append(
      h("h3", null, "Профиль"),
      h(
        `div.action-card.status-${linked ? "success" : link.status}`,
        null,
        h("div.ac-head", null, h("b", null, "🎓 Привязать кошелёк к профилю iDos"), h("span.status-chip", null, linked ? "✅ Привязан" : STATUS_LABEL[link.status])),
        h("small", null, "iDos выдаёт одноразовое сообщение, вы подписываете его в кошельке, сервер проверяет подпись. Без транзакции и без комиссии."),
        link.message ? h(`p.ac-msg${link.status === "error" ? ".error" : ""}`, null, link.message) : "",
        h(
          "div.row",
          null,
          button(link.status === "error" ? "↻ Повторить" : linked ? "Привязать заново" : "Подписать и привязать", () => void app.actions.linkProfile(), {
            kind: "primary",
            disabled: !w.address || app.actions.busy("link"),
          }),
          app.store.session.online !== "online" ? h("small.muted", null, "Нужен онлайн-вход iDos") : "",
        ),
      ),
    );

    // Achievement badges
    const base = metadataBase();
    shell.body.append(
      h("h3", null, "Значки-NFT за достижения"),
      h("p.muted", null, "Четыре значка — по желанию и только за реальные достижения. Игра полностью проходится без минта."),
      base ? "" : h("p.note", null, "Минт включается в опубликованной на iDos версии: метаданные значков лежат по версионированному адресу билда, чтобы ссылки NFT не ломались после обновлений."),
      h(
        "div.grid-cards.badges",
        null,
        MINTABLE_IDS.map((id) => {
          const info = badgeInfo(id);
          const minted = d.wallet.minted[id];
          const avail = mintAvailability(app, id);
          return h(
            `div.item-card${d.achievements[id] ? "" : ".locked"}`,
            null,
            h("img.badge-img.small", { src: badgeDataUrl(id, 128), alt: info?.name ?? id, width: "96", height: "96" }),
            h("b", null, info?.trait ?? id),
            h("small", null, info?.tier ?? ""),
            minted
              ? h("a.link", { href: SOLANA.explorerAddress(minted.asset), target: "_blank", rel: "noopener" }, "✅ В кошельке ↗")
              : button("◎ Сминтить", () => openMintDialog(app, id), { kind: avail.can ? "gold" : "ghost", disabled: !avail.can, title: avail.reason }),
            !minted && !avail.can ? h("small.muted", null, avail.reason) : "",
          );
        }),
      ),
    );

    // Token & treasury
    shell.body.append(
      h("h3", null, "Токен $SHAI"),
      h(
        "div.token-card",
        null,
        h("p", null, h("b", null, `${SHAI_TOKEN.name} (${SHAI_TOKEN.symbol})`), ` · ${SHAI_TOKEN.network} · decimals ${SHAI_TOKEN.decimals}`),
        h("p.mono.small", null, SHAI_TOKEN.mint),
        h("a.link", { href: SOLANA.explorerAddress(SHAI_TOKEN.mint), target: "_blank", rel: "noopener" }, "Mint в Solana Explorer ↗"),
        h("p.muted", null, `Внутри игры $SHAI — игровая валюта (iDos: ${SHAI_TOKEN.idosIouCurrencyId} / ${SHAI_TOKEN.idosCryptoCurrencyId}). Вывод и депозит токена работают через блокчейн-модуль iDos и в этой сборке не включены.`),
        h("p.note", null, SHAI_TOKEN.disclaimer),
      ),
      h("h3", null, "Казна проекта"),
      h("div.token-card", null, h("p", null, SOLANA.treasury ? h("span.mono", null, SOLANA.treasury) : "Адрес казны ещё не задан."), h("p.muted", null, "Казна нужна для будущих комиссий. Сейчас ни одно действие игры не переводит в неё средства, и ключей казны в игре нет.")),
      h("h3", null, "История"),
      d.wallet.records.length
        ? h(
            "div.board",
            null,
            d.wallet.records.slice(0, 10).map((r) =>
              h(
                "div.board-row",
                null,
                h("span.board-rank", null, r.kind === "nft-mint" ? "🏅" : "🎓"),
                h("span.board-name", null, r.note, h("small", null, new Date(r.at).toLocaleString("ru-RU"))),
                r.signature ? h("a.link", { href: SOLANA.explorerTx(r.signature), target: "_blank", rel: "noopener" }, "↗") : "",
              ),
            ),
          )
        : h("p.muted", null, "Пока пусто — здесь появятся привязка профиля и сминченные значки."),
    );
  };

  const offA = app.actions.changed.on(() => build());
  const offW = app.wallet.changed.on(() => build());
  build();
  if (app.wallet.address) void refreshBalances();
  return {
    el: shell.el,
    backdrop: "dim",
    refresh() {
      shell.refreshChrome();
    },
    destroy() {
      alive = false;
      offA();
      offW();
    },
  };
}
