// The game as a mountable unit: mountGame(host) builds the app context, wires round ↔ renderer ↔
// audio ↔ UI and starts the loop. src/main.ts mounts it on the page; an iDos module mounts it from
// EngineScene.mount(ctx.host) (see idos/shanyrak). First launch goes straight into the 30-second
// tutorial; no wallet, no login screen.

import "./styles.css";
import { Analytics } from "./analytics/events";
import { Sound } from "./audio/sound";
import { GameLoop } from "./core/loop";
import { dailySeed, hashString, Rng } from "./core/rng";
import { LocalSaveStore } from "./core/save";
import { Store } from "./core/state";
import { dayKey } from "./core/time";
import { Round } from "./gameplay/round";
import type { ModeId, RoundEvent, RoundResult } from "./gameplay/types";
import { applyRoundResult, checkAchievements, rememberTower } from "./meta/progression";
import { LocalBackend, type Backend } from "./platform/backend";
import { IdosBackend } from "./platform/idos";
import { MenuScene } from "./render/menuScene";
import { Renderer } from "./render/renderer";
import { ensureDaily, streakClaimable, touchStreak } from "./retention/daily";
import { ensureSeason } from "./retention/season";
import { ensureWeekly } from "./retention/weekly";
import { Leaderboards } from "./social/leaderboards";
import { SolanaActions } from "./solana/actions";
import { WalletManager } from "./solana/wallet";
import { Router, type App, type ScreenId, type StartOptions } from "./ui/app";
import { toast } from "./ui/components/common";
import { h } from "./ui/dom";
import { campaignScreen } from "./ui/screens/campaign";
import { facultyScreen } from "./ui/screens/faculty";
import { homeScreen, openStreak } from "./ui/screens/home";
import { leaderboardsScreen } from "./ui/screens/leaderboards";
import { profileScreen } from "./ui/screens/profile";
import { questsScreen } from "./ui/screens/quests";
import { resultScreen } from "./ui/screens/result";
import { roundScreen } from "./ui/screens/round";
import { seasonScreen } from "./ui/screens/season";
import { settingsScreen } from "./ui/screens/settings";
import { walletScreen } from "./ui/screens/wallet";
import { workshopScreen } from "./ui/screens/workshop";

export interface MountOptions {
  /** An already signed-in iDos client (inside an iDos host). Without it the game signs in as a guest itself. */
  idosClient?: import("@idosgames/core").IDosGamesClient;
  /** Start the tutorial automatically on the first launch (default true). */
  autoTutorial?: boolean;
}

export interface GameHandle {
  setRunning(running: boolean): void;
  capture(): Promise<Blob | null>;
  drop(): boolean;
  state(): Record<string, unknown>;
  destroy(): void;
}

export function mountGame(root: HTMLElement, opts: MountOptions = {}): GameHandle {
  root.classList.add("shanyrak-root");

  // ── State & services ───────────────────────────────────────────────────────
  const store = new Store(new LocalSaveStore());
  ensureDaily(store);
  const weeklyNotice = ensureWeekly(store);
  ensureSeason(store);
  touchStreak(store);

  const sound = new Sound();
  sound.setVolumes(store.data.settings.sfx, store.data.settings.music);
  sound.setTheme(store.data.equipped.music as "mus_campus");

  const renderer = new Renderer(root);
  const uiRoot = h("div#ui");
  root.appendChild(uiRoot);
  const menuScene = new MenuScene(store.data.lastTower, store.data.player.faculty, { ...store.data.equipped });
  renderer.view = menuScene;

  let backend: Backend = new LocalBackend();
  const idos = new IdosBackend(opts.idosClient);
  const analytics = new Analytics(() => backend);
  analytics.enabled = store.data.settings.analytics;
  const leaderboards = new Leaderboards(store, () => backend);
  const wallet = new WalletManager();
  const actions = new SolanaActions(store, wallet, (n, p) => analytics.track(n, p));
  const router = new Router(uiRoot);

  let detachRound: (() => void)[] = [];

  const app: App = {
    store,
    sound,
    renderer,
    menuScene,
    backend: () => backend,
    leaderboards,
    wallet,
    actions,
    analytics,
    router,
    round: null,
    lastSummary: null,
    startRound,
    endRoundEarly,
    goOnline,
    refreshMenuScene,
  };
  router.app = app;

  router.register("home", homeScreen);
  router.register("campaign", campaignScreen);
  router.register("faculty", facultyScreen);
  router.register("round", roundScreen);
  router.register("result", resultScreen);
  router.register("workshop", workshopScreen);
  router.register("season", seasonScreen);
  router.register("leaderboards", leaderboardsScreen);
  router.register("quests", questsScreen);
  router.register("profile", profileScreen);
  router.register("settings", settingsScreen);
  router.register("wallet", walletScreen);


  router.onNavigate = (id: ScreenId) => {
    const inGame = id === "round" || id === "result";
    if (!inGame && app.round) {
      for (const off of detachRound) off();
      detachRound = [];
      app.round = null;
    }
    if (!inGame || !app.round) {
      renderer.view = menuScene;
      renderer.opts.menu = true;
    }
    renderer.focus = id === "home" || id === "result" ? (window.innerWidth > 980 ? 0.68 : 0.5) : 0.5;
    sound.setWind(0);
  };

  store.changed.on(() => {
    router.queueRefresh();
    renderer.opts.reducedMotion = store.data.settings.reducedMotion;
    renderer.opts.guide = store.data.settings.guide;
    document.body.classList.toggle("reduced-motion", store.data.settings.reducedMotion);
  });
  renderer.opts.reducedMotion = store.data.settings.reducedMotion;
  renderer.opts.guide = store.data.settings.guide;
  document.body.classList.toggle("reduced-motion", store.data.settings.reducedMotion);

  function refreshMenuScene(): void {
    menuScene.cfg.faculty = store.data.player.faculty;
    menuScene.cfg.cosmetics = { ...store.data.equipped };
    menuScene.rebuild(store.data.lastTower);
  }

  // ── Rounds ────────────────────────────────────────────────────────────────

  function startRound(mode: ModeId, opts: StartOptions = {}): void {
    sound.unlock();
    if (app.round) {
      for (const off of detachRound) off();
      detachRound = [];
    }
    const d = store.data;
    const seed = mode === "daily" ? dailySeed(dayKey()) : (hashString(`${Date.now()}-${Math.random()}`) >>> 0);
    const wRng = new Rng(hashString(`weather:${seed}`));
    const roll = wRng.next();
    const weather = mode === "tutorial" || mode === "campaign" ? "clear" : roll < 0.7 ? "clear" : roll < 0.85 ? "rain" : "snow";
    const round = new Round({
      mode,
      seed,
      missionIndex: opts.missionIndex,
      faculty: d.player.faculty,
      upgrades: { ...d.upgrades },
      unlockedRooms: [...d.unlockedRooms],
      cosmetics: { ...d.equipped },
      boosterShields: mode === "tutorial" ? 0 : d.boosters.shield,
      weather,
    });
    app.round = round;
    renderer.particles.clear();
    renderer.view = round;
    renderer.opts.menu = false;
    detachRound.push(renderer.attach(round.events, round.cfg.cosmetics));
    detachRound.push(round.events.on((e) => onRoundEvent(round, e)));
    analytics.track("round_start", { mode, faculty: d.player.faculty ?? "none" });
    router.go("round");
    if (d.settings.music > 0) sound.startMusic(d.equipped.music as "mus_campus");
  }

  function endRoundEarly(): void {
    for (const off of detachRound) off();
    detachRound = [];
    app.round = null;
    renderer.view = menuScene;
    renderer.opts.menu = true;
  }

  function onRoundEvent(round: Round, e: RoundEvent): void {
    const vib = store.data.settings.vibration;
    switch (e.k) {
      case "drop":
        sound.drop();
        break;
      case "land":
        if (e.q === "perfect") sound.perfect(round.combo);
        else if (e.q === "good") sound.good();
        else if (e.q === "normal") sound.thud();
        else {
          sound.bad();
          if (vib) sound.vibrate(60);
        }
        if (e.shai > 0 && e.q === "perfect") setTimeout(() => sound.coin(), 120);
        break;
      case "miss":
        sound.miss();
        if (vib) sound.vibrate([40, 40, 80]);
        break;
      case "combo":
        sound.coin();
        break;
      case "shabyt":
        if (e.on) {
          sound.shabyt();
          analytics.track("perfect_streak", { level: e.level });
        }
        break;
      case "event":
        if (e.on) sound.event();
        if (e.id === "nauryz") sound.setTheme(e.on ? "mus_nauryz" : (store.data.equipped.music as "mus_campus"));
        if (e.id === "session") sound.setTheme(e.on ? "mus_session" : (store.data.equipped.music as "mus_campus"));
        break;
      case "bonusOffer":
        sound.bonus();
        break;
      case "danger":
        if (e.on) sound.warning();
        break;
      case "collapse":
        sound.collapse();
        if (vib) sound.vibrate([80, 60, 160]);
        break;
      case "crowned":
        sound.crown();
        break;
      case "material":
        sound.coin();
        break;
      case "end":
        onRoundEnd(round, e.result);
        break;
      default:
        break;
    }
  }

  function onRoundEnd(round: Round, result: RoundResult): void {
    sound.setWind(0);
    sound.setTheme(store.data.equipped.music as "mus_campus");
    if (result.height >= 3) rememberTower(store, round.tower.blocks.map((b) => b.type));
    const summary = applyRoundResult(store, result);
    app.lastSummary = summary;
    void leaderboards.submitRound(result);
    analytics.track("round_end", { mode: result.mode, reason: result.reason, score: result.score }, result.height);
    if (result.mode === "tutorial") analytics.track("tutorial_done", { skipped: false });
    for (const a of summary.achievements) toast(`Достижение: ${a.title}`, "reward", a.icon);
    refreshMenuScene();
    setTimeout(() => {
      if (app.round === round) router.go("result");
    }, 650);
  }

  // ── Online (iDos) ─────────────────────────────────────────────────────────

  async function goOnline(): Promise<void> {
    if (!store.data.settings.online) return;
    store.setSession({ online: "connecting", onlineError: null });
    const res = await idos.connect();
    if (res.ok) {
      backend = idos;
      store.setSession({ online: "online", userId: idos.userId, onlineError: null });
      void idos.setName(store.data.player.name);
    } else {
      backend = new LocalBackend();
      store.setSession({ online: "offline", onlineError: res.error ?? null });
      console.info("[idos] offline mode:", res.error);
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  const listeners: [EventTarget, string, EventListener][] = [];
  const listen = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) => {
    target.addEventListener(type, fn as EventListener);
    listeners.push([target, type, fn as EventListener]);
  };

  listen<KeyboardEvent>(window, "keydown", (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (router.current?.id !== "round" || !app.round) return;
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (document.querySelector(".modal-backdrop")) return;
      sound.unlock();
      app.round.drop();
    } else if (e.code === "Escape" || e.code === "KeyP") {
      (document.querySelector(".pause-btn") as HTMLButtonElement | null)?.click();
    }
  });

  listen(document, "pointerdown", () => {
    sound.unlock();
    if (store.data.settings.music > 0) sound.startMusic(store.data.equipped.music as "mus_campus");
  });
  listen<MouseEvent>(document, "click", (e) => {
    const btn = (e.target as HTMLElement | null)?.closest("button");
    if (btn && !btn.disabled) sound.click();
  });
  listen(document, "visibilitychange", () => {
    if (document.hidden && app.round && router.current?.id === "round" && app.round.phase !== "done" && !app.round.paused) {
      (document.querySelector(".pause-btn") as HTMLButtonElement | null)?.click();
    }
  });

  // ── Loop ──────────────────────────────────────────────────────────────────

  const loop = new GameLoop({
    update(dt) {
      if (app.round && renderer.view === app.round) app.round.update(dt);
      menuScene.update(dt);
    },
    render(_alpha, frameDt) {
      renderer.update(frameDt);
      renderer.render();
      if (app.round && renderer.view === app.round) sound.setWind(app.round.wind);
    },
  });
  loop.start();

  // iDos "Shot" button / debugging surface
  (window as unknown as { __shanyrak?: unknown }).__shanyrak = {
    app,
    capture: () => renderer.capture(),
    state: () => ({
      screen: router.current?.id,
      round: app.round ? { mode: app.round.cfg.mode, phase: app.round.phase, height: app.round.height, score: app.round.score, stability: app.round.stability } : null,
      online: store.session.online,
      shai: store.data.shai,
    }),
  };

  // ── Boot ──────────────────────────────────────────────────────────────────

  checkAchievements(store);
  if (!store.data.tutorialDone && opts.autoTutorial !== false) {
    startRound("tutorial");
  } else {
    router.go("home");
    if (streakClaimable(store)) setTimeout(() => openStreak(app), 700);
    if (weeklyNotice) setTimeout(() => toast(weeklyNotice.text, weeklyNotice.kind === "war-won" ? "reward" : "info", "🚩"), 1200);
  }
  void goOnline();
  listen(window, "beforeunload", () => store.flush());
  document.getElementById("boot")?.remove();

  return {
    setRunning(running: boolean) {
      if (running) loop.start();
      else {
        loop.stop(true);
        if (app.round && router.current?.id === "round" && !app.round.paused) (root.querySelector(".pause-btn") as HTMLButtonElement | null)?.click();
      }
    },
    capture: () => renderer.capture(),
    drop: () => app.round?.drop() ?? false,
    state: () => ({
      screen: router.current?.id,
      round: app.round ? { mode: app.round.cfg.mode, phase: app.round.phase, height: app.round.height, score: app.round.score } : null,
      online: store.session.online,
    }),
    destroy() {
      store.flush();
      loop.dispose();
      sound.stopMusic();
      for (const off of detachRound) off();
      for (const [t, type, fn] of listeners) t.removeEventListener(type, fn);
      renderer.dispose();
      root.innerHTML = "";
      root.classList.remove("shanyrak-root");
    },
  };
}
