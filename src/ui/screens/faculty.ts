// Faculty choice: shown after the first round (and from the profile). Changing later is free but
// the weekly contribution stays with the faculty it was earned for.

import { FACULTIES, FACULTY_IDS, type FacultyId } from "../../social/faculties";
import type { App, Screen } from "../app";
import { button, ornamentDivider, toast } from "../components/common";
import { h } from "../dom";

export function facultyScreen(app: App, params: Record<string, unknown>): Screen {
  const el = h("div.faculty-screen.scroll");
  let picked: FacultyId | null = app.store.data.player.faculty;
  const next = params.next as string | undefined;

  const build = () => {
    el.innerHTML = "";
    const grid = h("div.faculty-grid");
    for (const id of FACULTY_IDS) {
      const f = FACULTIES[id];
      grid.appendChild(
        h(
          `button.faculty-card${picked === id ? ".picked" : ""}`,
          { type: "button", style: { "--fac": f.color } as unknown as Partial<CSSStyleDeclaration>, onclick: () => { picked = id; app.sound.click(); build(); } },
          h("span.fac-flag", { style: { background: f.color } }, f.emblem),
          h("b", null, `«${f.name}»`),
          h("small", null, f.field),
          h("em", null, f.motto),
        ),
      );
    }
    el.append(
      h(
        "div.faculty-wrap",
        null,
        h("h1.title", null, "Выберите факультет"),
        h("p.muted.center", null, "Факультет — ваша команда. Очки из ваших раундов идут в недельное соревновение факультетов; победители получают флаг, значок и $SHAI. На силу в игре выбор не влияет, сменить можно в профиле."),
        ornamentDivider(),
        grid,
        h(
          "div.row.center",
          null,
          button(picked ? `Вступить в «${FACULTIES[picked].name}»` : "Выберите карточку", () => {
            if (!picked) return;
            const id = picked;
            app.store.mutate((d) => {
              d.player.faculty = id;
            });
            app.analytics.track("faculty_pick", { faculty: id });
            toast(`Добро пожаловать в «${FACULTIES[id].name}»!`, "success", "🚩");
            app.refreshMenuScene();
            if (next === "faculty-mode") app.startRound("faculty");
            else app.router.go(next === "profile" ? "profile" : "home");
          }, { kind: "gold", big: true, disabled: !picked }),
          next === "profile" || app.store.data.player.faculty ? button("Назад", () => app.router.go(next === "profile" ? "profile" : "home"), { kind: "ghost" }) : button("Позже", () => app.router.go("home"), { kind: "ghost" }),
        ),
      ),
    );
  };
  build();
  return { el, backdrop: "dim" };
}
