// $SHAI — the in-game currency. Source of truth is the local ledger (SaveData.shai). It is soft
// currency only: it cannot be bought with money in this build and the game never promises
// earnings. The on-chain $SHAI token (iDos title JE8W0Z54, currency "Main") is shown read-only in
// the wallet screen; bridging goes through the iDos blockchain module (see docs/GAME.md).

import type { Store } from "../core/state";
import type { Materials } from "../core/save";

export type MaterialId = keyof Materials;

export const MATERIAL_INFO: Record<MaterialId, { name: string; icon: string }> = {
  brick: { name: "Кирпич", icon: "🧱" },
  felt: { name: "Войлок", icon: "🟫" },
  thread: { name: "Нить орнамента", icon: "🧵" },
};

export interface Cost {
  shai?: number;
  materials?: Partial<Materials>;
}

export function canAfford(store: Store, cost: Cost): boolean {
  const d = store.data;
  if ((cost.shai ?? 0) > d.shai) return false;
  for (const [k, v] of Object.entries(cost.materials ?? {})) {
    if ((v ?? 0) > d.materials[k as MaterialId]) return false;
  }
  return true;
}

/** Spend atomically; returns false (and changes nothing) when the player cannot afford it. */
export function spend(store: Store, cost: Cost): boolean {
  if (!canAfford(store, cost)) return false;
  store.mutate((d) => {
    d.shai -= cost.shai ?? 0;
    for (const [k, v] of Object.entries(cost.materials ?? {})) d.materials[k as MaterialId] -= v ?? 0;
  });
  return true;
}

export function grant(store: Store, shai: number, materials: Partial<Materials> = {}): void {
  store.mutate((d) => {
    d.shai += Math.max(0, Math.round(shai));
    d.stats.shaiEarned += Math.max(0, Math.round(shai));
    for (const [k, v] of Object.entries(materials)) d.materials[k as MaterialId] += Math.max(0, v ?? 0);
  });
}

export function formatCost(cost: Cost): string {
  const parts: string[] = [];
  if (cost.shai) parts.push(`${cost.shai} $SHAI`);
  for (const [k, v] of Object.entries(cost.materials ?? {})) {
    if (v) parts.push(`${MATERIAL_INFO[k as MaterialId].icon}${v}`);
  }
  return parts.join(" + ");
}
