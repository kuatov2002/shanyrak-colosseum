// Plain-language help: "how to play" (the round + the campus loop between rounds) and short
// explanations behind every currency pill. The one place a newcomer can always come back to.

import type { App } from "../app";
import { h } from "../dom";
import { button, modal } from "./common";

interface Point {
  icon: string;
  title: string;
  text: string;
}

const ROUND: Point[] = [
  { icon: "👆", title: "Одна кнопка", text: "Тап, клик или пробел — комната падает с крана. Цельтесь в центр башни." },
  { icon: "🎯", title: "«Идеально» и комбо", text: "Ровные укладки подряд растят комбо. На ×5 включается «Шабыт»: очки ×1.5, башня светится." },
  { icon: "🟩", title: "Устойчивость", text: "Зелёная полоса вверху. Неровные укладки её снижают; на нуле верхние этажи осыпаются." },
  { icon: "⛑️", title: "Каски", text: "Три права на промах. Кончились каски — раунд завершается шаныраком." },
  { icon: "🏘️", title: "Соседи", text: "Комнаты дружат с соседями сверху и снизу: чайхана у общаги даёт $SHAI, спортзал укрепляет башню, сад гасит ветер. Карточка «Далее» справа показывает следующую комнату." },
  { icon: "🃏", title: "Бонусы и события", text: "Каждые 5–8 этажей выбираете бонус. События (ветер, дедлайн, экзамен, Наурыз) меняют правила на несколько этажей." },
  { icon: "🏛️", title: "Шанырак", text: "Купол юрты завершает башню. С 8-го этажа можно завершить сами — кнопка внизу даёт +25% $SHAI." },
];

const CAMPUS: Point[] = [
  { icon: "🪙", title: "$SHAI — игровые монеты", text: "Даются за раунды. Тратятся в Мастерской на улучшения и украшения. Это не криптовалюта и не покупается за деньги." },
  { icon: "🧱", title: "Материалы", text: "Кирпич, войлок и нить выпадают за «Идеально», в Шабыте и за задания. Нужны для крафта украшений." },
  { icon: "📜", title: "Задания и ⭐ сезон", text: "Цели на день и неделю, уровни сезона. Прогресс идёт сам во время игры — заходите забирать награды." },
  { icon: "🚩", title: "Факультет", text: "Ваша команда. Очки из раундов идут в недельное соревновение факультетов. На силу не влияет." },
  { icon: "🏆", title: "Рейтинг", text: "Онлайн-таблицы: день, неделя, рекорд высоты. Результат попадает туда сам, кошелёк не нужен." },
  { icon: "◎", title: "Solana — по желанию", text: "Кошелёк не нужен для игры. С ним можно выпустить значок-NFT за одно из четырёх достижений." },
];

function points(list: Point[]): HTMLElement {
  return h(
    "ul.guide-list",
    null,
    list.map((p) => h("li", null, h("span.gl-icon", { "aria-hidden": "true" }, p.icon), h("span", null, h("b", null, p.title), h("small", null, p.text)))),
  );
}

/** The full "how to play". `welcome` is the one-time version right after the tutorial. */
export function openGuide(app: App, opts: { welcome?: boolean; inRound?: boolean } = {}): void {
  if (!app.store.data.guideSeen) app.store.mutate((s) => (s.guideSeen = true));
  modal(opts.welcome ? "Добро пожаловать в кампус!" : "Как играть", (body, close) => {
    if (opts.welcome) body.appendChild(h("p.guide-lead", null, "Коротко о том, как всё устроено. Это окно всегда можно открыть снова кнопкой «?» на главной."));
    // Right after the tutorial the round is fresh in mind: the campus loop comes first then.
    const round = [h("h4.guide-h", null, "В раунде"), points(ROUND)];
    const campus = [h("h4.guide-h", null, "Между раундами"), points(CAMPUS)];
    body.append(...(opts.welcome ? [...campus, ...round] : [...round, ...campus]));
    body.appendChild(
      h(
        "div.row.center.guide-actions",
        null,
        opts.inRound
          ? button("Вернуться к паузе", close, { kind: "gold" })
          : button("▶ Играть", () => {
              close();
              app.startRound("quick");
            }, { kind: "gold", big: true }),
        opts.inRound ? null : button(opts.welcome ? "Осмотреться" : "Закрыть", close, { kind: "ghost" }),
      ),
    );
  }, { cls: "guide-modal" });
}

export type InfoTopic = "shai" | "materials" | "online";

/** Short explanation behind a top-bar pill, with a button to where it matters. */
export function openInfo(app: App, topic: InfoTopic): void {
  const d = app.store.data;
  const content: Record<InfoTopic, { title: string; lines: string[]; cta?: [string, () => void] }> = {
    shai: {
      title: `🪙 $SHAI: ${d.shai.toLocaleString("ru-RU")}`,
      lines: [
        "Игровые монеты кампуса. Даются за каждый раунд, задания, серию входов и сезон.",
        "Тратятся в Мастерской: постоянные улучшения, комнаты и украшения.",
        "Это не криптовалюта: монеты нельзя купить за деньги или вывести.",
      ],
      cta: ["В Мастерскую", () => app.router.go("workshop")],
    },
    materials: {
      title: `Материалы: 🧱 ${d.materials.brick} · 🟫 ${d.materials.felt} · 🧵 ${d.materials.thread}`,
      lines: [
        "🧱 Кирпич, 🟫 войлок и 🧵 нить выпадают за «Идеально», в Шабыте, на Наурызе, за задания и сезон.",
        "Из них в Мастерской крафтятся украшения: орнаменты, фасады, шаныраки.",
      ],
      cta: ["К крафту", () => app.router.go("workshop", { tab: "craft" })],
    },
    online: {
      title: app.store.session.online === "online" ? "Онлайн" : "Оффлайн",
      lines:
        app.store.session.online === "online"
          ? ["Вы вошли как гость: результаты попадают в онлайн-рейтинги.", "Прогресс хранится на этом устройстве."]
          : ["Нет связи с сервером. Играть можно как обычно: всё сохраняется на этом устройстве.", "Онлайн-рейтинги вернутся, когда игра подключится к сети."],
    },
  };
  const c = content[topic];
  modal(c.title, (body, close) => {
    for (const l of c.lines) body.appendChild(h("p", null, l));
    if (c.cta) {
      const [label, go] = c.cta;
      body.appendChild(h("div.row.center", null, button(label, () => { close(); go(); }, { kind: "gold" }), button("Понятно", close, { kind: "ghost" })));
    } else body.appendChild(h("div.row.center", null, button("Понятно", close, { kind: "ghost" })));
  }, { cls: "info-modal" });
}
