// Solana screen (mainnet), written for players who have never used a wallet: three numbered steps
// (connect → mint a badge → optionally link to the profile), technical details folded away.
// Guest mode is the default; every on-chain action starts with a button.

import { SOLANA } from "../../solana/config";
import { MINTABLE_IDS, metadataBase } from "../../solana/nft";
import { badgeDataUrl, badgeInfo } from "../../solana/nftArt";
import { fetchShaiBalance, fetchSolBalance, SHAI_TOKEN } from "../../solana/token";
import { shortAddress } from "../../social/leaderboards";
import type { App, Screen } from "../app";
import { button, screenIntro, toast } from "../components/common";
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
    const connected = w.status === "connected" && !!w.address;
    shell.body.innerHTML = "";
    shell.body.append(
      h("div.back-row", null, button("← Кампус", () => app.router.go("home"), { kind: "ghost" })),
      screenIntro(
        "◎",
        "Solana — по желанию",
        "Играть можно без кошелька: рейтинги, задания и прогресс работают и так. Кошелёк нужен только, чтобы выпустить значок-NFT за достижение — он останется у вас навсегда.",
      ),
    );

    // ① Connect
    const step1 = h(`div.wallet-step${connected ? ".done" : ""}`, null, h("span.ws-num", null, connected ? "✓" : "1"));
    if (connected && w.address) {
      step1.appendChild(
        h(
          "div.ws-body",
          null,
          h("b", null, `Кошелёк подключён: ${w.adapter?.option.name ?? "кошелёк"}`),
          h("span.mono", null, shortAddress(w.address)),
          h("div.balances", null, h("span", null, `SOL: ${solBalance}`), h("span", null, `$SHAI в сети: ${shaiBalance}`)),
          h(
            "div.row",
            null,
            button("↻ Обновить баланс", () => void refreshBalances(), { kind: "soft" }),
            button("Отключить", () => {
              void w.disconnect();
              toast("Кошелёк отключён. Игра продолжается без него.", "info");
            }, { kind: "ghost" }),
          ),
        ),
      );
    } else {
      const options = w.options();
      step1.appendChild(
        h(
          "div.ws-body",
          null,
          h("b", null, w.status === "connecting" ? "Подтвердите подключение в окне кошелька…" : "Подключите кошелёк"),
          h("small.muted", null, "Phantom, Solflare или Backpack, сеть Solana mainnet. Подключение ничего не списывает."),
          w.error ? h("p.ac-msg.error", null, w.error) : "",
          h(
            "div.wallet-options",
            null,
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
                h("span", null, h("b", null, o.name)),
              ),
            ),
          ),
          options.length === 0
            ? h(
                "p.muted",
                null,
                "Кошелёк не найден. Установите расширение ",
                h("a.link", { href: "https://phantom.com/download", target: "_blank", rel: "noopener" }, "Phantom"),
                " или ",
                h("a.link", { href: "https://solflare.com/download", target: "_blank", rel: "noopener" }, "Solflare"),
                " и обновите страницу. Если игра открыта внутри idosgames.com, откройте её по прямому адресу: кошельки во фрейме могут не работать.",
              )
            : "",
        ),
      );
    }

    // ② Badges
    const base = metadataBase();
    const step2 = h(
      "div.wallet-step",
      null,
      h("span.ws-num", null, "2"),
      h(
        "div.ws-body",
        null,
        h("b", null, "Выпустите значок за достижение"),
        h(
          "small.muted",
          null,
          "Значок — NFT в Solana с картинкой достижения. Стоит около 0.0018 SOL: почти всё это возвратный депозит за хранение, комиссия сети — тысячные доли цента. Точная сумма видна до подписи.",
        ),
        base ? "" : h("p.note", null, "Выпуск значков работает в опубликованной версии игры на iDos."),
        h(
          "div.grid-cards.badges",
          null,
          MINTABLE_IDS.map((id) => {
            const info = badgeInfo(id);
            const minted = d.wallet.minted[id];
            const avail = mintAvailability(app, id);
            const earned = !!d.achievements[id];
            return h(
              `div.item-card${earned ? "" : ".locked"}`,
              null,
              h("img.badge-img.small", { src: badgeDataUrl(id, 128), alt: info?.name ?? id, width: "96", height: "96" }),
              h("b", null, info?.trait ?? id),
              h("small", null, earned ? "Достижение получено" : info?.description ?? ""),
              minted
                ? h("a.link", { href: SOLANA.explorerAddress(minted.asset), target: "_blank", rel: "noopener" }, "✅ В кошельке ↗")
                : button("◎ Выпустить", () => openMintDialog(app, id), { kind: avail.can ? "gold" : "ghost", disabled: !avail.can, title: avail.reason }),
              !minted && !avail.can ? h("small.muted", null, avail.reason) : "",
            );
          }),
        ),
      ),
    );

    // ③ Optional profile link
    const link = app.actions.get("link");
    const linked = d.wallet.linkedToProfile && d.wallet.address === w.address;
    const step3 = h(
      `div.wallet-step${linked ? ".done" : ""}`,
      null,
      h("span.ws-num", null, linked ? "✓" : "3"),
      h(
        "div.ws-body",
        null,
        h("b", null, "Необязательно: привяжите кошелёк к профилю"),
        h("small.muted", null, "Бесплатная подпись сообщения (не транзакция): iDos запомнит, что этот кошелёк ваш. Пригодится для будущих наград по кошельку."),
        link.message ? h(`p.ac-msg${link.status === "error" ? ".error" : ""}`, null, link.message) : "",
        h(
          "div.row",
          null,
          linked
            ? h("span.status-chip.st-success", null, "✅ Привязан")
            : button(link.status === "error" ? "↻ Повторить" : "Подписать и привязать", () => void app.actions.linkProfile(), {
                kind: "primary",
                disabled: !w.address || app.actions.busy("link"),
              }),
          !w.address ? h("small.muted", null, "Сначала подключите кошелёк") : app.store.session.online !== "online" ? h("small.muted", null, "Нужно подключение к iDos") : "",
        ),
      ),
    );

    shell.body.append(h("div.wallet-steps", null, step1, step2, step3));

    // Details for the curious: safety, the token, history
    shell.body.appendChild(
      h(
        "details.wallet-details",
        null,
        h("summary", null, "Подробнее: безопасность, токен и история"),
        h(
          "ul.safety",
          null,
          h("li", null, "Мы никогда не просим seed-фразу или приватный ключ. Каждая подпись — только по вашей кнопке, в окне вашего кошелька."),
          h("li", null, "Перед подписью транзакция проверяется симуляцией в mainnet, сумма показывается заранее."),
          h("li", null, "Игра не берёт комиссий и ничего не переводит себе: платите вы только сети Solana."),
        ),
        h(
          "div.token-card",
          null,
          h("p", null, h("b", null, `Токен ${SHAI_TOKEN.symbol}`), ` · ${SHAI_TOKEN.network}`),
          h("p.mono.small", null, SHAI_TOKEN.mint),
          h("a.link", { href: SOLANA.explorerAddress(SHAI_TOKEN.mint), target: "_blank", rel: "noopener" }, "Открыть в Solana Explorer ↗"),
          h("p.muted", null, "Монеты $SHAI в игре — игровые и с токеном не связаны: в этой версии ввод и вывод токена выключены."),
          h("p.note", null, SHAI_TOKEN.disclaimer),
        ),
        h("h4", null, "История"),
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
          : h("p.muted", null, "Пока пусто — здесь появятся выпущенные значки и привязка профиля."),
      ),
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
