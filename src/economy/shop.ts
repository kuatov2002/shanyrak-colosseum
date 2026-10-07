// Shop: everything is priced in in-game $SHAI earned by playing. No real-money offers, no
// gameplay power for sale beyond a single, capped convenience booster (one extra shield per round).

import type { Store } from "../core/state";
import { COSMETICS, type Cosmetic } from "../meta/collection";
import { ROOMS, type RoomId } from "../meta/rooms";
import { UPGRADE_BY_ID, type UpgradeId } from "../meta/upgrades";
import { spend } from "./shai";

export const SEASON_PREMIUM_PRICE = 1500;
export const BOOSTER_SHIELD_PRICE = 60;

export function shopCosmetics(): Cosmetic[] {
  return COSMETICS.filter((c) => c.source.kind === "shop");
}

export function roomUnlocks(): RoomId[] {
  return (Object.keys(ROOMS) as RoomId[]).filter((id) => ROOMS[id].unlock.kind === "shai");
}

export function buyCosmetic(store: Store, c: Cosmetic): boolean {
  if (c.source.kind !== "shop" || store.data.owned.includes(c.id)) return false;
  if (!spend(store, { shai: c.source.price })) return false;
  store.mutate((d) => d.owned.push(c.id));
  return true;
}

export function buyRoom(store: Store, id: RoomId): boolean {
  const rule = ROOMS[id].unlock;
  if (rule.kind !== "shai" || store.data.unlockedRooms.includes(id)) return false;
  if (!spend(store, { shai: rule.cost })) return false;
  store.mutate((d) => d.unlockedRooms.push(id));
  return true;
}

export function buyUpgrade(store: Store, id: UpgradeId): boolean {
  const def = UPGRADE_BY_ID[id];
  const lvl = store.data.upgrades[id];
  if (lvl >= def.maxLevel) return false;
  if (!spend(store, { shai: def.cost(lvl + 1) })) return false;
  store.mutate((d) => {
    d.upgrades[id] = lvl + 1;
  });
  return true;
}

export function buyShieldBooster(store: Store): boolean {
  if (store.data.boosters.shield >= 1) return false;
  if (!spend(store, { shai: BOOSTER_SHIELD_PRICE })) return false;
  store.mutate((d) => {
    d.boosters.shield = 1;
  });
  return true;
}

export function buySeasonPremium(store: Store): boolean {
  if (store.data.season.premium) return false;
  if (!spend(store, { shai: SEASON_PREMIUM_PRICE })) return false;
  store.mutate((d) => {
    d.season.premium = true;
  });
  return true;
}
