// The app context every screen receives, plus the screen router with smooth transitions.

import type { Analytics } from "../analytics/events";
import type { Sound } from "../audio/sound";
import type { Store } from "../core/state";
import type { Round } from "../gameplay/round";
import type { ModeId } from "../gameplay/types";
import type { RoundSummary } from "../meta/progression";
import type { Backend } from "../platform/backend";
import type { MenuScene } from "../render/menuScene";
import type { PixiRenderer } from "../render/world";
import type { Leaderboards } from "../social/leaderboards";
import type { SolanaActions } from "../solana/actions";
import type { WalletManager } from "../solana/wallet";
import { clear, h } from "./dom";

export type ScreenId =
  | "home"
  | "campaign"
  | "faculty"
  | "round"
  | "result"
  | "workshop"
  | "season"
  | "leaderboards"
  | "quests"
  | "profile"
  | "settings"
  | "wallet";

export interface StartOptions {
  missionIndex?: number;
}

export interface App {
  store: Store;
  sound: Sound;
  renderer: PixiRenderer;
  menuScene: MenuScene;
  backend(): Backend;
  leaderboards: Leaderboards;
  wallet: WalletManager;
  actions: SolanaActions;
  analytics: Analytics;
  router: Router;
  round: Round | null;
  lastSummary: RoundSummary | null;
  startRound(mode: ModeId, opts?: StartOptions): void;
  endRoundEarly(): void;
  goOnline(): Promise<void>;
  refreshMenuScene(): void;
}

export interface Screen {
  el: HTMLElement;
  /** Re-render after state changes (optional). */
  refresh?(): void;
  destroy?(): void;
  /** Hub screens show the decorative tower; others may dim it. */
  backdrop?: "tower" | "dim" | "game";
}

export type ScreenFactory = (app: App, params: Record<string, unknown>) => Screen;

export class Router {
  current: { id: ScreenId; screen: Screen } | null = null;
  private factories = new Map<ScreenId, ScreenFactory>();
  private refreshQueued = false;
  app!: App;
  onNavigate?: (id: ScreenId) => void;

  constructor(private root: HTMLElement) {}

  register(id: ScreenId, f: ScreenFactory): void {
    this.factories.set(id, f);
  }

  go(id: ScreenId, params: Record<string, unknown> = {}): void {
    const f = this.factories.get(id);
    if (!f) throw new Error(`Unknown screen ${id}`);
    const old = this.current;
    if (old) {
      old.screen.destroy?.();
      const el = old.screen.el;
      el.classList.add("screen-leave");
      setTimeout(() => el.remove(), 200);
    }
    this.onNavigate?.(id);
    const screen = f(this.app, params);
    screen.el.classList.add("screen", "screen-enter");
    this.root.appendChild(screen.el);
    requestAnimationFrame(() => screen.el.classList.remove("screen-enter"));
    this.current = { id, screen };
    document.body.dataset.screen = id;
    document.body.dataset.backdrop = screen.backdrop ?? "tower";
    this.app.analytics.track("screen_view", { screen: id });
  }

  queueRefresh(): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    requestAnimationFrame(() => {
      this.refreshQueued = false;
      const cur = this.current;
      if (!cur?.screen.refresh) return;
      const scrollers = Array.from(cur.screen.el.querySelectorAll<HTMLElement>(".scroll"));
      if (cur.screen.el.classList.contains("scroll")) scrollers.unshift(cur.screen.el);
      const tops = scrollers.map((el) => el.scrollTop);
      cur.screen.refresh();
      const after = Array.from(cur.screen.el.querySelectorAll<HTMLElement>(".scroll"));
      if (cur.screen.el.classList.contains("scroll")) after.unshift(cur.screen.el);
      after.forEach((el, i) => {
        if (tops[i] !== undefined) el.scrollTop = tops[i];
      });
    });
  }
}

/** Replace children of a container while keeping its scroll position. */
export function rerender(container: HTMLElement, build: () => Node | Node[]): void {
  const scroller = container.closest(".scroll") as HTMLElement | null;
  const top = scroller?.scrollTop ?? 0;
  clear(container);
  const out = build();
  if (Array.isArray(out)) out.forEach((n) => container.appendChild(n));
  else container.appendChild(out);
  if (scroller) scroller.scrollTop = top;
}

export function screenRoot(cls: string): HTMLElement {
  return h(`div.${cls}`);
}
