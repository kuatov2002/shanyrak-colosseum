// Badge-mint dialog: simulate first, show the exact rent deposit and network fee, then ask the
// wallet to sign. Every error explains what happened and offers a way back to the game.

import { fmtSol, metadataBase } from "../../solana/nft";
import { badgeDataUrl, badgeInfo } from "../../solana/nftArt";
import { STATUS_LABEL } from "../../solana/actions";
import type { App } from "../app";
import { h } from "../dom";
import { button, modal } from "./common";

export function openMintDialog(app: App, id: string): void {
  const key = `mint:${id}`;
  const info = badgeInfo(id);
  modal(`Значок-NFT: ${info?.trait ?? id}`, (body, close) => {
    const content = h("div.mint-dialog");
    body.appendChild(content);
    const render = () => {
      const st = app.actions.get(key);
      const p = st.prepared;
      content.innerHTML = "";
      content.append(
        h("img.badge-img", { src: badgeDataUrl(id, 200), alt: info?.name ?? id, width: "160", height: "160" }),
        h("p.center", null, info?.description ?? ""),
        h("div.status-line", null, h("span.status-chip", { class: `st-${st.status}` }, STATUS_LABEL[st.status])),
      );
      if (p && (st.status === "ready" || st.status === "awaiting-wallet" || st.status === "sending")) {
        content.append(
          h(
            "div.cost-table",
            null,
            h("div", null, h("span", null, "Возвратный депозит за хранение (rent)"), h("b", null, fmtSol(p.rentLamports))),
            h("small.muted", null, "Лежит на аккаунте значка. Почти весь возвращается, если значок сжечь (burn)."),
            h("div", null, h("span", null, "Комиссия сети"), h("b", null, fmtSol(p.feeLamports))),
            h("small.muted", null, `Платится валидаторам Solana и не возвращается. Включает приоритет ${fmtSol(p.priorityLamports)}, чтобы транзакция не потерялась в загруженной сети.`),
            h("div.total", null, h("span", null, "Итого спишется сейчас"), h("b", null, fmtSol(p.rentLamports + p.feeLamports))),
            h("small.muted", null, `На кошельке: ${fmtSol(p.balanceLamports)} · транзакция проверена симуляцией в mainnet`),
          ),
        );
      }
      if (st.message) content.append(h(`p.ac-msg${st.status === "error" ? ".error" : ""}`, null, st.message));
      if (st.explorer) content.append(h("a.link", { href: st.explorer, target: "_blank", rel: "noopener" }, "Открыть транзакцию в Solana Explorer ↗"));
      const row = h("div.row.center");
      if (st.status === "ready") {
        row.append(
          button("Подписать в кошельке", () => void app.actions.confirmBadge(id), { kind: "gold" }),
          button("Отмена", () => {
            app.actions.reset(key);
            close();
          }, { kind: "ghost" }),
        );
      } else if (st.status === "error") {
        row.append(
          button("↻ Повторить", () => void app.actions.prepareBadge(id), { kind: "primary" }),
          button("Вернуться в игру", () => {
            app.actions.reset(key);
            close();
          }, { kind: "ghost" }),
        );
      } else if (st.status === "success") {
        row.append(button("Готово", () => {
          app.actions.reset(key);
          close();
        }, { kind: "gold" }));
      } else {
        row.append(button("Свернуть", close, { kind: "ghost" }));
      }
      content.append(row);
    };
    const off = app.actions.changed.on(render);
    const observer = new MutationObserver(() => {
      if (!document.body.contains(content)) {
        off();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true });
    render();
    // Re-opened after a while: re-simulate so the shown amount and balance are current.
    const st = app.actions.get(key).status;
    if (st === "idle" || st === "error" || st === "success" || app.actions.stale(key)) void app.actions.prepareBadge(id);
  });
}

export function mintAvailability(app: App, id: string): { can: boolean; reason: string } {
  const d = app.store.data;
  if (d.wallet.minted[id]) return { can: false, reason: "Уже выпущен" };
  if (!d.achievements[id]) return { can: false, reason: "Сначала получите достижение" };
  if (!metadataBase()) return { can: false, reason: "Работает в опубликованной версии на iDos" };
  if (!app.wallet.address) return { can: false, reason: "Подключите кошелёк" };
  return { can: true, reason: "" };
}
