// Profile as a student ID card ("студенческий билет"): name, faculty, stats, wallet signature.

import { FACULTIES } from "../../social/faculties";
import { shortAddress } from "../../social/leaderboards";
import { SEASON_TIERS, seasonTier } from "../../retention/season";
import type { App, Screen } from "../app";
import { button, modal, toast } from "../components/common";
import { AVATARS, hub } from "../components/shell";
import { fmt, h } from "../dom";

export function profileScreen(app: App): Screen {
  const shell = hub(app, "home", "profile");
  const build = () => {
    const d = app.store.data;
    const fac = d.player.faculty ? FACULTIES[d.player.faculty] : null;
    const addr = app.wallet.address ?? d.wallet.address;
    shell.body.innerHTML = "";
    const card = h(
      "div.student-card",
      { style: { "--fac": fac?.color ?? "#3a3f7a" } as unknown as Partial<CSSStyleDeclaration> },
      h("div.sc-head", null, h("span", null, "СТУДЕНЧЕСКИЙ БИЛЕТ"), h("span", null, "Кампус «Шанырак»")),
      h(
        "div.sc-body",
        null,
        h("button.sc-avatar", { type: "button", title: "Сменить аватар", onclick: () => app.store.mutate((s) => (s.player.avatar = (s.player.avatar + 1) % AVATARS.length)) }, AVATARS[d.player.avatar % AVATARS.length]),
        h(
          "div.sc-fields",
          null,
          field("Имя", d.player.name),
          field("Факультет", fac ? `«${fac.name}» — ${fac.field}` : "не выбран"),
          field("ID", d.player.id.slice(0, 10).toUpperCase()),
          field("Кошелёк", addr ? shortAddress(addr) : "гостевой режим"),
          field("Подпись", d.wallet.studentIdSig ? `✓ ${d.wallet.studentIdSig.slice(0, 10)}…` : "—"),
        ),
      ),
      h("div.sc-foot", null, `Поступил(а): ${new Date(d.createdAt).toLocaleDateString("ru-RU")} · Сезон: ур. ${seasonTier(d.season.xp)}/${SEASON_TIERS.length}`),
    );
    const st = d.stats;
    shell.body.append(
      h("div.back-row", null, button("← Кампус", () => app.router.go("home"), { kind: "ghost" })),
      card,
      h(
        "div.row.wrap",
        null,
        button("✏️ Изменить имя", () => renameDialog(app), { kind: "soft" }),
        button("🚩 Сменить факультет", () => app.router.go("faculty", { next: "profile" }), { kind: "soft" }),
        button(addr ? "◎ Кошелёк" : "◎ Подключить кошелёк", () => app.router.go("wallet"), { kind: "primary" }),
      ),
      h(
        "div.stat-grid",
        null,
        statBox("Раундов", fmt(st.rounds)),
        statBox("Рекорд высоты", `${st.bestHeight} эт.`),
        statBox("Лучший счёт", fmt(st.bestScore)),
        statBox("Студентов", fmt(st.totalStudents)),
        statBox("«Идеально»", fmt(st.totalPerfects)),
        statBox("Серия идеальных", `${st.bestPerfectStreak}`),
        statBox("Шаныраков", fmt(st.shanyraks)),
        statBox("Очки факультета", fmt(st.facultyPoints)),
        statBox("Заработано $SHAI", fmt(st.shaiEarned)),
        statBox("Достижений", `${Object.keys(d.achievements).length}/8`),
      ),
    );
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

function field(label: string, value: string): HTMLElement {
  return h("div.sc-field", null, h("small", null, label), h("b", null, value));
}

function statBox(label: string, value: string): HTMLElement {
  return h("div.stat-box", null, h("b", null, value), h("small", null, label));
}

function renameDialog(app: App): void {
  modal("Имя студента", (body, close) => {
    const input = h("input.text-input", { value: app.store.data.player.name, maxlength: "18", "aria-label": "Имя" }) as HTMLInputElement;
    body.append(
      input,
      h("small.muted", null, "2–18 символов. Имя видно в рейтингах."),
      button("Сохранить", () => {
        const name = input.value.trim().replace(/\s+/g, " ");
        if (name.length < 2) {
          toast("Слишком короткое имя", "warn");
          return;
        }
        app.store.mutate((s) => (s.player.name = name));
        void app.backend().setName(name);
        close();
      }, { kind: "gold" }),
    );
    setTimeout(() => input.focus(), 50);
  });
}
