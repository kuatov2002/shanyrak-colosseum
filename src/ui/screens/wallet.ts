// Solana screen. Guest mode is the default; connecting is optional and only offered after the
// first result. Every action is a button the player presses, with a visible status and Retry.

import { SOLANA } from "../../solana/config";
import { STATUS_LABEL, type ActionId } from "../../solana/actions";
import { fetchShaiBalance, fetchSolBalance, SHAI_TOKEN } from "../../solana/token";
import { shortAddress } from "../../social/leaderboards";
import type { App, Screen } from "../app";
import { button, toast } from "../components/common";
import { hub } from "../components/shell";
import { fmt, h } from "../dom";

export function walletScreen(app: App): Screen {
  const shell = hub(app, "home", "wallet-screen");
  let solBalance: string = "—";
  let shaiBalance: string = "—";
  let alive = true;

  const refreshBalances = async () => {
    const addr = app.wallet.address;
    if (!addr || app.wallet.isMock) return;
    solBalance = "…";
    shaiBalance = "…";
    build();
    const [sol, shai] = await Promise.all([fetchSolBalance(addr), fetchShaiBalance(addr)]);
    if (!alive) return;
    solBalance = sol.ok ? `${sol.amount.toFixed(3)} SOL (devnet)` : `ошибка: ${sol.error}`;
    shaiBalance = shai.ok ? `${fmt(shai.amount)} $SHAI` : `ошибка: ${shai.error}`;
    build();
  };

  const actionCard = (id: ActionId, title: string, desc: string, run: () => void, cta: string) => {
    const st = app.actions.state[id];
    const busy = st.status === "awaiting-wallet" || st.status === "sending";
    return h(
      `div.action-card.status-${st.status}`,
      null,
      h("div.ac-head", null, h("b", null, title), h("span.status-chip", null, busy ? "⏳ " : st.status === "success" ? "✅ " : st.status === "error" ? "⚠️ " : "", STATUS_LABEL[st.status])),
      h("small", null, desc),
      st.message ? h("p.ac-msg", null, st.message) : null,
      st.signature ? h("small.mono", null, `Подпись: ${st.signature.slice(0, 18)}…`) : null,
      st.explorer ? h("a.link", { href: st.explorer, target: "_blank", rel: "noopener" }, "Открыть в Solana Explorer ↗") : null,
      h(
        "div.row",
        null,
        st.status === "error"
          ? button("↻ Повторить", run, { kind: "primary" })
          : button(cta, run, { kind: "primary", disabled: busy || !app.wallet.address }),
        st.status === "success" || st.status === "error" ? button("Сбросить", () => app.actions.reset(id), { kind: "ghost" }) : null,
      ),
    );
  };

  const build = () => {
    const d = app.store.data;
    const w = app.wallet;
    shell.body.innerHTML = "";
    shell.body.appendChild(h("div.back-row", null, button("← Кампус", () => app.router.go("home"), { kind: "ghost" })));
    shell.body.appendChild(
      h(
        "div.wallet-hero",
        null,
        h("h2", null, "◎ Solana"),
        h("p", null, "Кошелёк не нужен, чтобы играть. Подключение добровольное: студенческий билет, запись рекордов в devnet и витрина токена $SHAI."),
        h("ul.safety", null, h("li", null, "Мы никогда не просим seed-фразу или приватный ключ."), h("li", null, "Каждая подпись — только по вашей кнопке, в окне кошелька."), h("li", null, "Транзакции — только в devnet (тестовые SOL). Реальные деньги не списываются.")),
      ),
    );

    // Connection
    if (w.status === "connected" && w.address) {
      shell.body.appendChild(
        h(
          "div.connected-card",
          null,
          h("div", null, h("small.muted", null, w.isMock ? "Демо-кошелёк (имитация, без сети)" : `Подключён: ${w.adapter?.option.name}`), h("b.mono", null, shortAddress(w.address))),
          h(
            "div.row",
            null,
            w.isMock ? null : button("↻ Балансы", () => void refreshBalances(), { kind: "soft" }),
            button("Отключить", () => {
              void w.disconnect();
              toast("Кошелёк отключён. Игра продолжается в гостевом режиме.", "info");
            }, { kind: "ghost" }),
          ),
          w.isMock ? null : h("div.balances", null, h("span", null, `Devnet: ${solBalance}`), h("span", null, `$SHAI (mainnet): ${shaiBalance}`)),
        ),
      );
    } else {
      const options = w.options();
      shell.body.appendChild(
        h(
          "div.connect-list",
          null,
          h("b", null, w.status === "connecting" ? "Ожидание кошелька… подтвердите подключение" : "Подключить кошелёк"),
          w.error ? h("p.ac-msg.error", null, w.error) : null,
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
                      s.wallet.address = w.address;
                      s.wallet.walletName = o.name;
                    });
                    app.analytics.track("wallet_connect", { kind: o.kind });
                    toast(o.kind === "mock" ? "Демо-кошелёк подключён (без сети)" : "Кошелёк подключён", "success", "◎");
                    void refreshBalances();
                  }
                },
              },
              o.icon ? h("img", { src: o.icon, alt: "", width: "24", height: "24" }) : h("span.wo-icon", null, o.kind === "mock" ? "🧪" : "◎"),
              h("span", null, h("b", null, o.name), h("small", null, o.kind === "mock" ? "Без расширения — покажет весь путь, ничего не отправляя" : o.kind === "standard" ? "Wallet Standard" : "Встроенный провайдер")),
            ),
          ),
          options.length === 1 ? h("small.muted", null, "Расширения Solana не найдены. Установите Phantom/Solflare/Backpack или попробуйте демо-кошелёк.") : null,
        ),
      );
    }

    // Actions
    const best = Math.max(d.stats.bestScore, 0);
    shell.body.append(
      h("h3", null, "Действия"),
      actionCard("studentId", "🎓 Студенческий билет", "Бесплатная подпись сообщения: связывает профиль с кошельком. Транзакции нет.", () => void app.actions.linkStudentId(), "Подписать билет"),
      actionCard(
        "recordScore",
        "🏆 Рекорд в Solana devnet",
        `Memo-транзакция с вашим лучшим счётом (${fmt(best)} очков, ${d.stats.bestHeight} эт.). Комиссия — тестовые devnet SOL.`,
        () => void app.actions.recordScore(best, d.stats.bestHeight),
        "Записать рекорд",
      ),
      w.isMock ? "" : actionCard("airdrop", "🚰 Тестовые SOL", "Бесплатный airdrop 0.5 SOL в devnet для комиссий. Сеть может ограничивать частоту.", () => void app.actions.airdrop(), "Получить тестовые SOL"),
    );

    // Token & treasury
    shell.body.append(
      h("h3", null, "Токен $SHAI"),
      h(
        "div.token-card",
        null,
        h("p", null, h("b", null, `${SHAI_TOKEN.name} (${SHAI_TOKEN.symbol})`), ` · ${SHAI_TOKEN.network} · decimals ${SHAI_TOKEN.decimals}`),
        h("p.mono.small", null, SHAI_TOKEN.mint),
        h("a.link", { href: SOLANA.explorerAddress(SHAI_TOKEN.mint, "mainnet"), target: "_blank", rel: "noopener" }, "Mint в Solana Explorer ↗"),
        h("p.muted", null, `Внутри игры $SHAI — локальная игровая валюта (iDos: ${SHAI_TOKEN.idosIouCurrencyId} / ${SHAI_TOKEN.idosCryptoCurrencyId}). Вывод/депозит токена — через блокчейн-модуль iDos, в этой сборке не включён.`),
        h("p.note", null, SHAI_TOKEN.disclaimer),
      ),
      h("h3", null, "Казна проекта"),
      h("div.token-card", null, h("p", null, SOLANA.treasury ? h("span.mono", null, SOLANA.treasury) : "Адрес казны ещё не задан."), h("p.muted", null, "Казна предназначена для будущих комиссий (например, опциональный минт косметики в NFT). Сейчас ни одно действие игры не переводит в неё средства.")),
      h("h3", null, "История"),
      d.wallet.records.length
        ? h(
            "div.board",
            null,
            d.wallet.records.slice(0, 10).map((r) =>
              h(
                "div.board-row",
                null,
                h("span.board-rank", null, r.kind === "student-id" ? "🎓" : r.kind === "airdrop" ? "🚰" : "🏆"),
                h("span.board-name", null, r.note, h("small", null, `${new Date(r.at).toLocaleString("ru-RU")} · ${r.cluster}`)),
                r.cluster === "devnet" ? h("a.link", { href: SOLANA.explorerTx(r.signature, "devnet"), target: "_blank", rel: "noopener" }, "↗") : h("small.mono", null, r.signature.slice(0, 8)),
              ),
            ),
          )
        : h("p.muted", null, "Пока пусто — здесь появятся подписи и транзакции."),
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
