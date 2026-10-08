// Leaderboards and the weekly faculty war. Every board explains where its rows come from.

import { formatCountdown, weekProgress } from "../../core/time";
import { FACULTIES } from "../../social/faculties";
import { BOARD_INFO, type BoardId, type BoardView } from "../../social/leaderboards";
import type { App, Screen } from "../app";
import { button, emptyState, screenIntro } from "../components/common";
import { hub } from "../components/shell";
import { fmt, h } from "../dom";

type Tab = BoardId | "faculties";

export function leaderboardsScreen(app: App, params: Record<string, unknown>): Screen {
  const shell = hub(app, "leaderboards", "leaderboards");
  let tab: Tab = (params.tab as Tab) ?? "daily_tower";
  let alive = true;

  const build = () => {
    shell.body.innerHTML = "";
    shell.body.appendChild(screenIntro("🏆", "Рейтинг", "Таблицы рекордов. Ваш лучший результат попадает сюда сам после раунда — кошелёк не нужен."));
    const tabs: [Tab, string][] = [
      ["daily_tower", "День"],
      ["best_height", "Высота"],
      ["weekly_score", "Неделя"],
      ["faculties", "Факультеты"],
    ];
    shell.body.appendChild(
      h("div.tabs", null, tabs.map(([id, label]) => h(`button.tab${tab === id ? ".active" : ""}`, { type: "button", onclick: () => { tab = id; build(); } }, label))),
    );
    const body = h("div.tab-body", null, h("div.loading", null, "Загружаем таблицу…"));
    shell.body.appendChild(body);

    if (tab === "faculties") {
      void app.leaderboards.faculties().then(({ standings }) => {
        if (!alive) return;
        body.innerHTML = "";
        const max = Math.max(1, ...standings.map((s) => s.points));
        const my = app.store.data.player.faculty;
        const msLeft = (1 - weekProgress()) * 7 * 86400000;
        body.append(
          h("p.muted", null, `Война факультетов · неделя закончится через ${formatCountdown(msLeft)}. Победитель получает флаг, значок и 200 $SHAI каждому участнику.`),
          h(
            "div.war",
            null,
            standings.map((s, i) => {
              const f = FACULTIES[s.id];
              return h(
                `div.war-row${s.id === my ? ".mine" : ""}`,
                null,
                h("span.war-rank", null, `#${i + 1}`),
                h("span.fac-flag.small", { style: { background: f.color } }, f.emblem),
                h(
                  "div.war-bar-wrap",
                  null,
                  h("b", null, `«${f.name}»`, s.id === my ? h("small", null, " — ваш") : null),
                  h("div.bar", null, h("div.bar-fill", { style: { width: `${(s.points / max) * 100}%`, background: f.color } })),
                  h("small.muted", null, `${fmt(s.points)} очков`),
                ),
              );
            }),
          ),
          my ? button("🚩 Сыграть за факультет", () => app.startRound("faculty"), { kind: "gold" }) : button("Выбрать факультет", () => app.router.go("faculty"), { kind: "gold" }),
        );
      });
      return;
    }

    const playMode = tab === "daily_tower" ? "daily" : "quick";
    void app.leaderboards.board(tab).then((view: BoardView) => {
      if (!alive) return;
      body.innerHTML = "";
      const info = BOARD_INFO[tab as BoardId];
      if (!view.rows.length) {
        body.append(
          h("p.muted", null, info.desc),
          emptyState("trophy", "Пока здесь никого", "Сыграйте раунд — ваш результат появится в таблице первым.", {
            label: "▶ Сыграть",
            onClick: () => app.startRound(playMode),
          }),
        );
        return;
      }
      body.append(
        h("p.muted", null, info.desc),
        h(`p.note${view.source === "online" ? ".online" : ""}`, null, view.source === "online" ? "🟢 " : "⚪ ", view.note),
        h(
          "div.board",
          null,
          view.rows.slice(0, 30).map((r) =>
            h(
              `div.board-row${r.me ? ".me" : ""}${r.demo ? ".demo" : ""}`,
              null,
              h("span.board-rank", null, r.rank ? (r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`) : "·"),
              h("span.board-name", null, r.name, r.sub ? h("small", null, r.sub) : null),
              h("b.board-score", null, `${fmt(r.score)} ${tab === "best_height" ? "эт." : ""}`),
            ),
          ),
        ),
        tab === "daily_tower" ? button("📅 Сыграть ежедневную башню", () => app.startRound("daily"), { kind: "gold" }) : "",
      );
    }).catch(() => {
      if (!alive) return;
      body.innerHTML = "";
      body.append(emptyState("cloud", "Таблица не загрузилась", "Похоже, нет связи. Проверьте интернет и попробуйте ещё раз.", { label: "↻ Повторить", onClick: build, kind: "soft" }));
    });
  };
  build();
  return {
    el: shell.el,
    backdrop: "dim",
    refresh() {
      shell.refreshChrome();
    },
    destroy() {
      alive = false;
    },
  };
}
