// The game as a mountable unit: mountGame(host) builds the app context, wires round ↔ renderer ↔
// audio ↔ UI and starts the loop. src/main.ts mounts it on the page; an iDos module mounts it from
// EngineScene.mount(ctx.host) (see idos/shanyrak). First launch goes straight into the 30-second
// tutorial; no wallet, no login screen.

import "./styles.css";
import "./ui/theme.css";
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
import { embeddedInPlatform, explainAuthError, ssoCodePending, type AccountInfo, type AuthResult } from "./platform/account";
import { IdosBackend } from "./platform/idos";
import { MenuScene } from "./render/menuScene";
import { PixiRenderer } from "./render/world";
import { ensureDaily, streakClaimable, touchStreak } from "./retention/daily";
import { ensureSeason } from "./retention/season";
import { ensureWeekly } from "./retention/weekly";
import { Leaderboards } from "./social/leaderboards";
import { SolanaActions } from "./solana/actions";
import { WalletManager } from "./solana/wallet";
import { Router, type AccountApi, type App, type ScreenId, type StartOptions } from "./ui/app";
import { button, toast } from "./ui/components/common";
import { bootDone, bootProgress } from "./ui/boot";
import { h } from "./ui/dom";
import { campaignScreen } from "./ui/screens/campaign";
import { facultyScreen } from "./ui/screens/faculty";
import { homeScreen, openStreak } from "./ui/screens/home";
import { leaderboardsScreen } from "./ui/screens/leaderboards";
import { loginScreen } from "./ui/screens/login";
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

/**
 * Mount the game into a host element. WebGL (PixiJS) starts asynchronously; the handle works right
 * away and forwards to the game once it is ready.
 */
function osReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function mountGame(root: HTMLElement, opts: MountOptions = {}): GameHandle {
  let inner: GameHandle | null = null;
  let destroyed = false;
  let running = true;
  root.classList.add("shanyrak-root");
  bootGame(root, opts)
    .then((g) => {
      if (destroyed) g.destroy();
      else {
        inner = g;
        if (!running) g.setRunning(false);
      }
    })
    .catch((err) => {
      console.error("[shanyrak] boot failed", err);
      const boot = document.getElementById("boot");
      const msg = "Не удалось запустить WebGL. Обновите браузер или включите аппаратное ускорение.";
      if (boot) boot.textContent = msg;
      else root.textContent = msg;
    });
  return {
    setRunning(r) {
      running = r;
      inner?.setRunning(r);
    },
    capture: () => inner?.capture() ?? Promise.resolve(null),
    drop: () => inner?.drop() ?? false,
    state: () => inner?.state() ?? { booting: true },
    destroy() {
      destroyed = true;
      inner?.destroy();
    },
  };
}

async function bootGame(root: HTMLElement, opts: MountOptions): Promise<GameHandle> {

  // ── State & services ───────────────────────────────────────────────────────
  const store = new Store(new LocalSaveStore());
  ensureDaily(store);
  const weeklyNotice = ensureWeekly(store);
  ensureSeason(store);
  touchStreak(store);

  const sound = new Sound();
  sound.setVolumes(store.data.settings.sfx, store.data.settings.music, store.data.settings.ambient);
  sound.setTheme(store.data.equipped.music as "mus_campus");

  const renderer = await PixiRenderer.create(root, bootProgress);
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
  const actions = new SolanaActions(store, wallet, () => backend, (n, p) => analytics.track(n, p));
  const router = new Router(uiRoot);

  let detachRound: (() => void)[] = [];

  // ── Account: sign-in methods for the login screen (see platform/account.ts) ─────────────
  const withSignIn = async (res: Promise<AuthResult>): Promise<AuthResult> => {
    const r = await res;
    if (r.ok) onSignedIn(r.account);
    return r;
  };
  const enableOnline = () => {
    if (!store.data.settings.online) store.mutate((s) => (s.settings.online = true));
  };
  const accountApi: AccountApi = {
    async wallet(optionId, remember) {
      enableOnline();
      let signer: { address: string; signMessage: (m: Uint8Array) => Promise<Uint8Array> } | null = null;
      if (!(await embeddedInPlatform())) {
        if (!optionId) return { ok: false, error: explainAuthError("NO_WALLET") };
        const connected = await wallet.connect(optionId);
        const adapter = wallet.adapter;
        if (!connected || !adapter || !wallet.address) return { ok: false, error: wallet.error ?? explainAuthError("NO_WALLET") };
        signer = { address: wallet.address, signMessage: (m) => adapter.signMessage(m) };
      }
      const r = await idos.loginWallet(signer, remember);
      if (r.ok) {
        const address = signer?.address;
        onSignedIn({ kind: "wallet", address });
        // the wallet IS the account: it is linked to the profile by this very signature
        if (address) store.mutate((s) => { s.wallet.address = address; s.wallet.linkedToProfile = true; });
      }
      return r;
    },
    async idos(remember) {
      enableOnline();
      const r = await idos.loginIdos(remember);
      if (r !== "redirecting" && r.ok) onSignedIn(r.account);
      return r;
    },
    email: (email, password, remember) => (enableOnline(), withSignIn(idos.loginEmail(email, password, remember))),
    register: (email, password, remember) => (enableOnline(), idos.registerEmail(email, password, remember)),
    confirm: (email, code, remember) => withSignIn(idos.confirmEmail(email, code, remember)),
    resend: (email) => idos.resendCode(email),
    forgot: (email) => idos.forgotPassword(email),
    reset: (email, code, password) => idos.resetPassword(email, code, password),
    telegram: (remember) => (enableOnline(), withSignIn(idos.loginTelegram(remember))),
    async guest(remember) {
      if (store.session.account?.kind === "guest") return { ok: true, account: { kind: "guest" } };
      const r = await withSignIn(idos.loginGuest(remember));
      if (r.ok) return r;
      // no network: a guest can always play — progress is on this device, boards come later
      store.mutate((s) => (s.account = { kind: "guest", at: Date.now() }));
      toast("Нет связи — играем без сети. Войти можно позже в профиле.", "info");
      return { ok: true, account: { kind: "guest" } };
    },
    proceed() {
      if (!store.data.account) store.mutate((s) => (s.account = { kind: "guest", at: Date.now() }));
      if (!store.data.tutorialDone && opts.autoTutorial !== false) startRound("tutorial");
      else router.go("home");
    },
    logout() {
      idos.logout();
      backend = new LocalBackend();
      store.setSession({ online: "offline", userId: null, account: null, onlineError: null });
      store.mutate((s) => (s.account = null));
      void wallet.disconnect();
      router.go("login");
    },
  };

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
    account: accountApi,
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
  router.register("login", loginScreen);


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

  const offStore = store.changed.on(() => {
    router.queueRefresh();
    renderer.opts.reducedMotion = store.data.settings.reducedMotion || osReducedMotion();
    renderer.opts.guide = store.data.settings.guide;
    document.body.classList.toggle("reduced-motion", store.data.settings.reducedMotion);
  });
  // OS-level "reduce motion" also lowers particles, blur and screen shake.
  const osReduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.opts.reducedMotion = store.data.settings.reducedMotion || osReduced;
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

  // Haptics: a short tick (10–25 ms) on phones only, and only when the player keeps it on.
  const coarsePointer = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const buzz = (ms: number) => {
    if (coarsePointer && store.data.settings.vibration) sound.vibrate(ms);
  };

  function onRoundEvent(round: Round, e: RoundEvent): void {
    switch (e.k) {
      case "drop":
        sound.drop();
        break;
      case "land":
        if (e.q === "perfect") {
          sound.perfect(round.combo);
          buzz(12);
        } else if (e.q === "good") sound.good();
        else if (e.q === "normal") sound.thud();
        else {
          sound.bad();
          buzz(18);
        }
        if (e.shai > 0 && e.q === "perfect") setTimeout(() => sound.coin(), 120);
        break;
      case "miss":
        sound.miss();
        buzz(22);
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
        buzz(25);
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

  /** Restore the session (SSO code from idosgames.com, remembered session); never a silent guest. */
  async function goOnline(): Promise<void> {
    if (!store.data.settings.online) return;
    store.setSession({ online: "connecting", onlineError: null });
    const res = await idos.resume();
    if (res.ok) {
      onSignedIn(res.account);
      // signed in already (e.g. came from idosgames.com): the sign-in screen has nothing to ask
      if (router.current?.id === "login" && res.account.kind !== "guest") accountApi.proceed();
      return;
    }
    backend = new LocalBackend();
    store.setSession({ online: "offline", account: null, onlineError: res.error ?? null });
    // the remembered session is gone (expired, signed out elsewhere): ask again, never mid-round
    if (res.needsLogin && store.data.account && store.data.account.kind !== "guest" && router.current?.id === "home") {
      router.go("login", { notice: "Сессия завершилась — войдите снова." });
    }
  }

  const GUEST_INVITE_MS = 24 * 3600 * 1000;
  function onSignedIn(account: AccountInfo): void {
    backend = idos;
    store.setSession({ online: "online", userId: idos.userId, onlineError: null, account });
    const prev = store.data.account;
    store.mutate((s) => {
      s.account = { kind: account.kind, address: account.address ?? (account.kind === prev?.kind ? prev?.address : undefined), at: Date.now(), invitedAt: prev?.invitedAt };
    });
    void idos.setName(store.data.player.name);
    analytics.track("login", { method: account.kind });
    // warm the board cache in the background so the Rating screen opens instantly
    setTimeout(() => void leaderboards.prefetch(), 2500);
    // guests get a gentle invitation to sign in properly, at most once a day, only on the hub
    const invited = store.data.account?.invitedAt ?? 0;
    if (account.kind === "guest" && Date.now() - invited > GUEST_INVITE_MS) {
      setTimeout(() => {
        if (router.current?.id !== "home" || document.querySelector(".modal-backdrop")) return;
        store.mutate((s) => { if (s.account) s.account.invitedAt = Date.now(); });
        router.go("login", { upgrade: true });
      }, 1500);
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  const listeners: [EventTarget, string, EventListener][] = [];
  const listen = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) => {
    target.addEventListener(type, fn as EventListener);
    listeners.push([target, type, fn as EventListener]);
  };

  renderer.onTap = () => {
    if (!app.round || router.current?.id !== "round" || renderer.hudUi.offerOpen || document.querySelector(".modal-backdrop")) return;
    sound.unlock();
    app.round.drop();
  };

  listen<KeyboardEvent>(window, "keydown", (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (router.current?.id !== "round" || !app.round) return;
    if (!document.querySelector(".modal-backdrop") && renderer.hudUi.handleKey(e.code)) {
      e.preventDefault();
      return;
    }
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (document.querySelector(".modal-backdrop")) return;
      sound.unlock();
      app.round.drop();
    } else if (e.code === "Escape" || e.code === "KeyP") {
      if (document.querySelector(".modal-backdrop")) return;
      e.preventDefault();
      renderer.hudUi.requestPause();
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
    if (document.hidden && router.current?.id === "round") renderer.hudUi.requestPause();
  });

  // WebGL context loss: pause the round (nothing is visible) and explain; offer a reload if the
  // browser does not hand the context back. Progress is saved, so reloading is safe.
  let glNotice: HTMLElement | null = null;
  let glTimer = 0;
  renderer.onContextChange = (lost) => {
    clearTimeout(glTimer);
    glNotice?.remove();
    glNotice = null;
    if (!lost) return;
    if (router.current?.id === "round") renderer.hudUi.requestPause();
    store.flush();
    const msg = h("p", null, "Браузер временно отключил графику. Восстанавливаем…");
    glNotice = h("div.gl-notice", { role: "alert" }, msg);
    root.appendChild(glNotice);
    glTimer = window.setTimeout(() => {
      msg.textContent = "Графика не вернулась. Прогресс сохранён — перезагрузите игру.";
      glNotice?.append(button("↻ Перезагрузить", () => location.reload(), { kind: "gold" }));
    }, 5000);
  };

  // ── Loop ──────────────────────────────────────────────────────────────────

  const loop = new GameLoop({
    update(dt) {
      if (app.round && renderer.view === app.round) app.round.update(dt);
      menuScene.update(dt);
    },
    frame(_alpha, frameDt) {
      renderer.update(frameDt);
      // audio follows the scene: wind and the busier arrangement only while a round is on screen
      const r = app.round && renderer.view === app.round ? app.round : null;
      sound.setScene(r ? "round" : "menu");
      sound.setIntensity(r && (r.combo >= 3 || r.shabytLevel > 0 || r.height >= 10) ? 1 : 0);
      if (r) sound.setWind(r.wind);
    },
  }, renderer.app.ticker);
  loop.start();

  // One resize handler drives the WebGL canvas and the DOM layout together.
  const resize = () => {
    const w = root.clientWidth || window.innerWidth;
    const hh = root.clientHeight || window.innerHeight;
    renderer.resize(w, hh);
    root.style.setProperty("--app-w", `${w}px`);
    root.style.setProperty("--app-h", `${hh}px`);
  };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(root);
  else listen(window, "resize", resize);
  resize();

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
  // The first launch (or a player who never chose) opens on the sign-in screen — unless a sign-in
  // code from idosgames.com is waiting, which resume() turns into the iDos Games account.
  if (store.data.settings.online && !store.data.account && !ssoCodePending()) {
    router.go("login", { first: true });
  } else if (!store.data.tutorialDone && opts.autoTutorial !== false) {
    startRound("tutorial");
  } else {
    router.go("home");
    // Only on the hub: never pop the streak dialog over a round the player already started.
    setTimeout(() => {
      if (router.current?.id === "home" && !document.querySelector(".modal-backdrop") && streakClaimable(store)) openStreak(app);
    }, 700);
    if (weeklyNotice) setTimeout(() => toast(weeklyNotice.text, weeklyNotice.kind === "war-won" ? "reward" : "info", "🚩"), 1200);
  }
  void goOnline();
  listen(window, "beforeunload", () => store.flush());
  // First frame on screen before the loader fades (the ticker may not have drawn yet).
  bootProgress(0.92, "Первый кадр…");
  renderer.update(0);
  renderer.app.render();
  bootDone();

  return {
    setRunning(running: boolean) {
      if (running) loop.start();
      else {
        loop.stop(true);
        if (router.current?.id === "round") renderer.hudUi.requestPause();
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
      offStore();
      clearTimeout(glTimer);
      loop.dispose();
      ro?.disconnect();
      sound.stopMusic();
      sound.dispose();
      for (const off of detachRound) off();
      for (const [t, type, fn] of listeners) t.removeEventListener(type, fn);
      renderer.dispose();
      root.innerHTML = "";
      root.classList.remove("shanyrak-root");
    },
  };
}
