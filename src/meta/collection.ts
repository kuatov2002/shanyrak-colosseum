// Cosmetic collection. Every item is purely visual/audio (no gameplay power), so nothing here can be
// pay-to-win. Items are local today; `onchain` marks the ones designed to become NFTs later (the
// id is the stable key a future mint would reference — see README "Solana").

import type { Rarity } from "./rooms";
import type { FacultyId } from "../social/faculties";

export type CosmeticCategory =
  | "ornament"
  | "facade"
  | "background"
  | "student"
  | "flag"
  | "shanyrak"
  | "effect"
  | "music";

export const CATEGORY_LABEL: Record<CosmeticCategory, string> = {
  ornament: "Орнаменты",
  facade: "Фасады",
  background: "Фоны",
  student: "Студенты",
  flag: "Флаги факультетов",
  shanyrak: "Украшения шанырака",
  effect: "Эффекты заселения",
  music: "Музыкальные темы",
};

export type CosmeticSource =
  | { kind: "default" }
  | { kind: "shop"; price: number }
  | { kind: "craft" }
  | { kind: "season" }
  | { kind: "streak" }
  | { kind: "achievement" }
  | { kind: "campaign" }
  | { kind: "faculty"; faculty: FacultyId }
  | { kind: "drop" };

export interface Cosmetic {
  id: string;
  cat: CosmeticCategory;
  name: string;
  desc: string;
  rarity: Rarity;
  source: CosmeticSource;
  onchain?: boolean;
}

export const COSMETICS: Cosmetic[] = [
  // Ornaments — the band along every room's cornice
  { id: "orn_koshkar", cat: "ornament", name: "Қошқар мүйіз", desc: "«Бараньи рога» — знак достатка.", rarity: "common", source: { kind: "default" } },
  { id: "orn_shyrmak", cat: "ornament", name: "Шырмауық", desc: "Вьющийся узор-лоза: рост и связь.", rarity: "uncommon", source: { kind: "shop", price: 250 } },
  { id: "orn_tumar", cat: "ornament", name: "Тұмар", desc: "Треугольный оберег.", rarity: "rare", source: { kind: "streak" }, onchain: true },
  { id: "orn_gul", cat: "ornament", name: "Гүл", desc: "Цветочная розетка.", rarity: "epic", source: { kind: "craft" }, onchain: true },
  // Facades — palette of the walls
  { id: "fac_classic", cat: "facade", name: "Классика кампуса", desc: "Тёплые родные цвета.", rarity: "common", source: { kind: "default" } },
  { id: "fac_turquoise", cat: "facade", name: "Бирюза", desc: "Купола Туркестана в каждом этаже.", rarity: "uncommon", source: { kind: "shop", price: 300 } },
  { id: "fac_felt", cat: "facade", name: "Киіз", desc: "Мягкий войлок, как в юрте.", rarity: "rare", source: { kind: "craft" } },
  { id: "fac_night", cat: "facade", name: "Неон сессии", desc: "Для тех, кто учится до рассвета.", rarity: "epic", source: { kind: "season" }, onchain: true },
  { id: "fac_gold", cat: "facade", name: "Алтын", desc: "Золото степи.", rarity: "legendary", source: { kind: "season" }, onchain: true },
  // Backgrounds
  { id: "bg_alatau", cat: "background", name: "Алатау", desc: "Снежные вершины над кампусом.", rarity: "common", source: { kind: "default" } },
  { id: "bg_steppe", cat: "background", name: "Степь", desc: "Бескрайний горизонт.", rarity: "uncommon", source: { kind: "shop", price: 350 } },
  { id: "bg_lake", cat: "background", name: "Горное озеро", desc: "Ели и бирюзовая вода.", rarity: "rare", source: { kind: "season" } },
  { id: "bg_city", cat: "background", name: "Огни города", desc: "Ночной мегаполис внизу.", rarity: "rare", source: { kind: "shop", price: 600 } },
  // Students
  { id: "stu_classic", cat: "student", name: "Первокурсники", desc: "Весёлые и шумные.", rarity: "common", source: { kind: "default" } },
  { id: "stu_takiya", cat: "student", name: "В тақия", desc: "Вышитые шапочки.", rarity: "uncommon", source: { kind: "shop", price: 280 } },
  { id: "stu_grad", cat: "student", name: "Выпускники", desc: "Шапочки-конфедератки.", rarity: "rare", source: { kind: "achievement" } },
  { id: "stu_sport", cat: "student", name: "Сборная", desc: "Спортивная форма.", rarity: "uncommon", source: { kind: "drop" } },
  // Faculty flags
  { id: "flag_campus", cat: "flag", name: "Флаг кампуса", desc: "Общий для всех.", rarity: "common", source: { kind: "default" } },
  { id: "flag_tulpar", cat: "flag", name: "Флаг «Тұлпар»", desc: "Чемпионы недели.", rarity: "rare", source: { kind: "faculty", faculty: "tulpar" }, onchain: true },
  { id: "flag_barys", cat: "flag", name: "Флаг «Барыс»", desc: "Чемпионы недели.", rarity: "rare", source: { kind: "faculty", faculty: "barys" }, onchain: true },
  { id: "flag_burkit", cat: "flag", name: "Флаг «Бүркіт»", desc: "Чемпионы недели.", rarity: "rare", source: { kind: "faculty", faculty: "burkit" }, onchain: true },
  { id: "flag_dombyra", cat: "flag", name: "Флаг «Домбыра»", desc: "Чемпионы недели.", rarity: "rare", source: { kind: "faculty", faculty: "dombyra" }, onchain: true },
  { id: "flag_zhuldyz", cat: "flag", name: "Флаг «Жұлдыз»", desc: "Чемпионы недели.", rarity: "rare", source: { kind: "faculty", faculty: "zhuldyz" }, onchain: true },
  // Shanyrak decorations — always respectful: colours, ribbons and light, never damage
  { id: "sh_classic", cat: "shanyrak", name: "Деревянный шанырак", desc: "Тёплое дерево и войлок.", rarity: "common", source: { kind: "default" } },
  { id: "sh_ribbons", cat: "shanyrak", name: "Ленты-тілектер", desc: "Цветные ленты добрых пожеланий.", rarity: "uncommon", source: { kind: "shop", price: 320 } },
  { id: "sh_lights", cat: "shanyrak", name: "Огни Наурыза", desc: "Гирлянда вокруг купола.", rarity: "rare", source: { kind: "season" } },
  { id: "sh_gold", cat: "shanyrak", name: "Золотой шанырак", desc: "Награда за финал «Семестра».", rarity: "legendary", source: { kind: "campaign" }, onchain: true },
  // Settle effects
  { id: "fx_sparkle", cat: "effect", name: "Искры", desc: "Золотые искры при заселении.", rarity: "common", source: { kind: "default" } },
  { id: "fx_petals", cat: "effect", name: "Лепестки", desc: "Весенние лепестки.", rarity: "uncommon", source: { kind: "shop", price: 260 } },
  { id: "fx_stars", cat: "effect", name: "Звёзды", desc: "Мерцающие звёздочки.", rarity: "rare", source: { kind: "season" } },
  { id: "fx_confetti", cat: "effect", name: "Конфетти", desc: "Праздник на каждом этаже.", rarity: "rare", source: { kind: "drop" } },
  // Music themes
  { id: "mus_campus", cat: "music", name: "Кампус", desc: "Спокойная домбра.", rarity: "common", source: { kind: "default" } },
  { id: "mus_nauryz", cat: "music", name: "Наурыз", desc: "Быстрый праздничный наигрыш.", rarity: "uncommon", source: { kind: "shop", price: 300 } },
  { id: "mus_session", cat: "music", name: "Ночь сессии", desc: "Тихая сосредоточенная мелодия.", rarity: "rare", source: { kind: "season" } },
];

export const COSMETIC_BY_ID: Record<string, Cosmetic> = Object.fromEntries(
  COSMETICS.map((c) => [c.id, c]),
);

export type Equipped = Record<CosmeticCategory, string>;

export const DEFAULT_EQUIPPED: Equipped = {
  ornament: "orn_koshkar",
  facade: "fac_classic",
  background: "bg_alatau",
  student: "stu_classic",
  flag: "flag_campus",
  shanyrak: "sh_classic",
  effect: "fx_sparkle",
  music: "mus_campus",
};

export const DEFAULT_OWNED = COSMETICS.filter((c) => c.source.kind === "default").map((c) => c.id);

export function sourceLabel(c: Cosmetic): string {
  switch (c.source.kind) {
    case "default":
      return "Есть с начала";
    case "shop":
      return `Магазин · ${c.source.price} $SHAI`;
    case "craft":
      return "Крафт";
    case "season":
      return "Сезонный пропуск";
    case "streak":
      return "Серия входов";
    case "achievement":
      return "Достижение";
    case "campaign":
      return "Кампания «Семестр»";
    case "faculty":
      return "Победа факультета в неделе";
    case "drop":
      return "Находка в раунде";
  }
}
