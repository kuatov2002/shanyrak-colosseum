// Leaderboards and the weekly faculty war. Boards open instantly from the device cache (or the
// local standings) and refresh in the background; faculty bars glide to the fresh values.

import { formatCountdown, weekProgress } from "../../core/time";
import { FACULTIES, type FacultyId, type FacultyStanding } from "../../social/faculties";
import { BOARD_INFO, type BoardId, type BoardView } from "../../social/leaderboards";
import type { App, Screen } from "../app";
import { button, emptyState, screenIntro } from "../components/common";
import { hub } from "../components/shell";
import { fmt, h } from "../dom";
import { tweenNumber } from "../motion";

type Tab = BoardId | "faculties";

export function leaderboardsScreen(app: App, params: Record<string, unknown>): Screen {
  const shell = hub(app, "leaderboards", "leaderboards");
  let tab: Tab = (params.tab as Tab) ?? "daily_tower";
  let alive = true;
  let seq = 0;

  const build = () => {
    const my = ++seq;
    const current = () => alive && my === seq;
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
    const body = h("div.tab-body");
    shell.body.appendChild(body);
    const online = app.store.session.online === "online";

    if (tab === "faculties") {
      const war = facultyWar(app, body);
      war.update(app.leaderboards.facultiesNow(), false);
      if (online && !app.leaderboards.isFresh("faculties")) {
        war.setRefreshing(true);
        void app.leaderboards.faculties().then(({ standings }) => {
          if (current()) war.update(standings, true);
        }).finally(() => current() && war.setRefreshing(false));
      }
      return;
    }

    const board = tab;
    const cached = app.leaderboards.cachedBoard(board);
    if (cached) renderBoard(app, body, board, cached, online && !app.leaderboards.isFresh(board));
    else body.append(...skeleton(6));
    if (cached && app.leaderboards.isFresh(board)) return;
    void app.leaderboards.board(board).then((view) => {
      if (current()) renderBoard(app, body, board, view, false);
    }).catch(() => {
      if (!current() || cached) return;
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

function skeleton(n: number): HTMLElement[] {
  return Array.from({ length: n }, (_, i) => h("div.skel-row", { style: { opacity: String(1 - i * 0.12) }, "aria-hidden": "true" }));
}

function renderBoard(app: App, body: HTMLElement, tab: BoardId, view: BoardView, refreshing: boolean): void {
  body.innerHTML = "";
  const info = BOARD_INFO[tab];
  const playMode = tab === "daily_tower" ? "daily" : "quick";
  if (!view.rows.length) {
    body.append(
      h("p.muted", null, info.desc),
      emptyState("trophy", "Пока здесь никого", "Сыграйте раунд — ваш результат появится в таблице первым.", { label: "▶ Сыграть", onClick: () => app.startRound(playMode) }),
    );
    return;
  }
  body.append(
    h("p.muted", null, info.desc),
    h(
      "p.board-note",
      null,
      view.source === "online" ? "🟢 " : "⚪ ",
      h("span", null, view.note),
      refreshing ? h("span.refreshing", null, "обновляем") : null,
    ),
    h(
      "div.board",
      null,
      view.rows.slice(0, 30).map((r) =>
        h(
          `div.board-row${r.me ? ".me" : ""}${r.demo ? ".demo" : ""}`,
          null,
          h("span.board-rank", null, r.rank ? (r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `${r.rank}`) : "·"),
          h("span.board-name", null, r.name, r.sub ? h("small", null, r.sub) : null),
          h("b.board-score", null, `${fmt(r.score)}${tab === "best_height" ? " эт." : ""}`),
        ),
      ),
    ),
    tab === "daily_tower" ? button("📅 Сыграть ежедневную башню", () => app.startRound("daily"), { kind: "gold" }) : "",
  );
}

/** The faculty war, built once and then updated in place (bars glide, points count, rows reorder). */
function facultyWar(app: App, body: HTMLElement): { update(s: FacultyStanding[], animate: boolean): void; setRefreshing(on: boolean): void } {
  const my = app.store.data.player.faculty;
  const msLeft = (1 - weekProgress()) * 7 * 86400000;
  const status = h("span.refreshing", { hidden: true }, "обновляем");
  const list = h("div.war");
  const rows = new Map<FacultyId, { row: HTMLElement; rank: HTMLElement; fill: HTMLElement; pts: HTMLElement }>();
  body.append(
    h("p.muted", null, `Война факультетов · неделя закончится через ${formatCountdown(msLeft)}. Победитель получает флаг, значок и 200 $SHAI каждому участнику. `, status),
    list,
    my ? button("🚩 Сыграть за факультет", () => app.startRound("faculty"), { kind: "gold" }) : button("Выбрать факультет", () => app.router.go("faculty"), { kind: "gold" }),
  );
  return {
    setRefreshing(on) {
      status.hidden = !on;
    },
    update(standings, animate) {
      const max = Math.max(1, ...standings.map((s) => s.points));
      standings.forEach((s, i) => {
        let r = rows.get(s.id);
        if (!r) {
          const f = FACULTIES[s.id];
          const rank = h("span.war-rank");
          const fill = h("div.bar-fill", { style: { width: "0%", background: f.color } });
          const pts = h("small.muted.tween-num");
          const row = h(
            `div.war-row${s.id === my ? ".mine" : ""}`,
            null,
            rank,
            h("span.fac-flag.small", { style: { background: f.color } }, f.emblem),
            h("div.war-bar-wrap", null, h("b", null, `«${f.name}»`, s.id === my ? h("small", null, " — ваш") : null), h("div.bar", null, fill), pts),
          );
          r = { row, rank, fill, pts };
          rows.set(s.id, r);
        }
        const entry = r;
        entry.rank.textContent = String(i + 1);
        list.appendChild(entry.row); // appending an existing node moves it: rows follow the new order
        const width = `${(s.points / max) * 100}%`;
        if (animate) requestAnimationFrame(() => (entry.fill.style.width = width));
        else entry.fill.style.width = width;
        if (animate) tweenNumber(entry.pts, s.points, (n) => `${fmt(n)} очков`, 600);
        else {
          entry.pts.dataset.n = String(s.points);
          entry.pts.textContent = `${fmt(s.points)} очков`;
        }
      });
    },
  };
}
