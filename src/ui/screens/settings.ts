// Settings: sound, motion, guide, online mode, analytics transparency, tutorial replay, reset.

import type { App, Screen } from "../app";
import { button, modal, toast } from "../components/common";
import { hub } from "../components/shell";
import { h } from "../dom";

export function settingsScreen(app: App): Screen {
  const shell = hub(app, "home", "settings");
  const build = () => {
    const d = app.store.data;
    const s = d.settings;
    shell.body.innerHTML = "";
    const slider = (label: string, value: number, set: (v: number) => void) =>
      h(
        "label.setting",
        null,
        h("span", null, label),
        h("input", {
          type: "range",
          min: "0",
          max: "1",
          step: "0.05",
          value: String(value),
          oninput: (e: Event) => set(Number((e.target as HTMLInputElement).value)),
        }),
      );
    const toggle = (label: string, hint: string, value: boolean, set: (v: boolean) => void) =>
      h(
        "label.setting.toggle",
        null,
        h("span", null, h("b", null, label), h("small.muted", null, hint)),
        h("input", { type: "checkbox", checked: value, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }),
      );
    shell.body.append(
      h("div.back-row", null, button("← Кампус", () => app.router.go("home"), { kind: "ghost" })),
      h("h2", null, "Настройки"),
      slider("🎵 Музыка", s.music, (v) => {
        app.store.mutate((x) => (x.settings.music = v));
        app.sound.setVolumes(app.store.data.settings.sfx, v);
      }),
      slider("🔊 Звуки", s.sfx, (v) => {
        app.store.mutate((x) => (x.settings.sfx = v));
        app.sound.setVolumes(v, app.store.data.settings.music);
        app.sound.click();
      }),
      toggle("Вибрация", "На телефонах при укладке и обрушении", s.vibration, (v) => app.store.mutate((x) => (x.settings.vibration = v))),
      toggle("Меньше движения", "Без тряски экрана и вспышек, меньше частиц", s.reducedMotion, (v) => app.store.mutate((x) => (x.settings.reducedMotion = v))),
      toggle("Направляющая", "Пунктир от комнаты к башне на первых этажах", s.guide, (v) => app.store.mutate((x) => (x.settings.guide = v))),
      toggle("Онлайн-рейтинги (iDos)", "Гостевой вход в iDos Games для общих лидербордов. Без него всё работает оффлайн.", s.online, (v) => {
        app.store.mutate((x) => (x.settings.online = v));
        if (v) void app.goOnline();
        else app.store.setSession({ online: "offline" });
      }),
      toggle("Анонимная аналитика", "События игры (без личных данных) помогают улучшать баланс", s.analytics, (v) => {
        app.store.mutate((x) => (x.settings.analytics = v));
        app.analytics.enabled = v;
      }),
      h(
        "div.row.wrap",
        null,
        button("🎓 Пройти обучение", () => app.startRound("tutorial"), { kind: "soft" }),
        button("📊 Журнал событий", () => {
          modal("Журнал аналитики", (body) => {
            body.appendChild(h("p.muted", null, app.analytics.enabled ? "Эти события отправляются в iDos Analytics (если онлайн)." : "Аналитика выключена — события только локально."));
            const list = h("div.log");
            for (const e of app.analytics.log.slice(0, 25)) list.appendChild(h("div", null, h("b", null, e.name), h("small", null, ` ${JSON.stringify(e.params)}`)));
            body.appendChild(list);
          });
        }, { kind: "soft" }),
        button("🗑️ Сбросить прогресс", () => {
          modal("Сбросить прогресс?", (body, close) => {
            body.append(
              h("p", null, "Все $SHAI, улучшения, коллекция и задания будут удалены с этого устройства. Это необратимо."),
              h("div.row", null, button("Отмена", close, { kind: "soft" }), button("Да, сбросить", () => {
                app.store.reset();
                close();
                toast("Прогресс сброшен", "info");
                location.reload();
              }, { kind: "danger" })),
            );
          });
        }, { kind: "danger" }),
      ),
      h(
        "div.about",
        null,
        h("p", null, h("b", null, "Шанырак: Кампус-Башня"), " · v0.1 · iDos Games × Solana Superteam Kazakhstan"),
        h("p.muted", null, `Тайтл iDos: ${app.backend().titleId ?? "оффлайн"} · Состояние: ${app.store.session.online}${app.store.session.onlineError ? ` (${app.store.session.onlineError})` : ""}`),
        h("p.muted", null, "Сохранение: локально на устройстве (версия сохранений 2). Шанырак в игре — символ завершения и общности."),
      ),
    );
  };
  build();
  return {
    el: shell.el,
    backdrop: "dim",
    refresh() {
      shell.refreshChrome();
    },
  };
}
