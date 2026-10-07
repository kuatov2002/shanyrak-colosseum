// Crafting: materials earned by building (perfect drops, events, quests) turn into rare rooms and
// cosmetics. The Nauryz plaza is the long-term goal — several days of play for a casual player.

import type { Store } from "../core/state";
import { COSMETIC_BY_ID } from "../meta/collection";
import type { RoomId } from "../meta/rooms";
import { spend, type Cost } from "./shai";

export interface Recipe {
  id: string;
  name: string;
  desc: string;
  cost: Cost;
  result: { room?: RoomId; cosmetic?: string; materials?: { thread?: number; felt?: number } };
  repeatable?: boolean;
}

export const RECIPES: Recipe[] = [
  {
    id: "r_nauryz",
    name: "Наурыз-площадь",
    desc: "Легендарная комната: +20 $SHAI, +10 студентов и салют.",
    cost: { materials: { brick: 8, felt: 6, thread: 4 }, shai: 300 },
    result: { room: "nauryz" },
  },
  {
    id: "r_gul",
    name: "Орнамент «Гүл»",
    desc: "Эпический орнамент-розетка для всех этажей.",
    cost: { materials: { thread: 5, felt: 2 } },
    result: { cosmetic: "orn_gul" },
  },
  {
    id: "r_felt",
    name: "Фасад «Киіз»",
    desc: "Мягкий войлочный фасад.",
    cost: { materials: { felt: 5, brick: 3 } },
    result: { cosmetic: "fac_felt" },
  },
  {
    id: "r_thread",
    name: "Скрутить нить",
    desc: "3 кирпича → 1 нить орнамента (обмен с мастером).",
    cost: { materials: { brick: 3 } },
    result: { materials: { thread: 1 } },
    repeatable: true,
  },
  {
    id: "r_feltwork",
    name: "Свалять войлок",
    desc: "2 кирпича + 20 $SHAI → 1 войлок.",
    cost: { materials: { brick: 2 }, shai: 20 },
    result: { materials: { felt: 1 } },
    repeatable: true,
  },
];

export function recipeDone(store: Store, r: Recipe): boolean {
  if (r.repeatable) return false;
  if (r.result.room) return store.data.unlockedRooms.includes(r.result.room);
  if (r.result.cosmetic) return store.data.owned.includes(r.result.cosmetic);
  return false;
}

export function craft(store: Store, r: Recipe): boolean {
  if (recipeDone(store, r)) return false;
  if (!spend(store, r.cost)) return false;
  store.mutate((d) => {
    if (r.result.room && !d.unlockedRooms.includes(r.result.room)) d.unlockedRooms.push(r.result.room);
    if (r.result.cosmetic && COSMETIC_BY_ID[r.result.cosmetic] && !d.owned.includes(r.result.cosmetic)) d.owned.push(r.result.cosmetic);
    if (r.result.materials) {
      d.materials.thread += r.result.materials.thread ?? 0;
      d.materials.felt += r.result.materials.felt ?? 0;
    }
  });
  return true;
}
