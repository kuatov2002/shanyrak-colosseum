// One round of building. Pure simulation: no DOM, no canvas, no audio. The renderer reads its
// fields, the HUD listens to `events`. Input is a single action: drop().

import { BALANCE } from "../config/balance";
import { Emitter } from "../core/emitter";
import { Rng, streamSeed } from "../core/rng";
import { ROOMS, type RoomId } from "../meta/rooms";
import { evaluateLanding, nudgeOffset } from "./block";
import { BONUSES, isBonusFloor, offerBonuses } from "./bonuses";
import { Crane } from "./crane";
import { drawRoom } from "./deck";
import { EVENTS, eventDuration, nextEventGap, pickEvent } from "./events";
import { MISSIONS, missionStars, type MissionDef } from "./modes";
import { collapseCount, stabilityDelta, startStability } from "./stability";
import { settleStudents } from "./students";
import { Tower } from "./tower";
import type {
  BonusId,
  Debris,
  EndReason,
  EventId,
  FloatText,
  PlacedBlock,
  Quality,
  RoundConfig,
  RoundEvent,
  RoundResult,
} from "./types";
import { QUALITY_COLOR, QUALITY_LABEL } from "./types";

type Phase = "intro" | "swing" | "falling" | "settle" | "bonus" | "collapsing" | "crowning" | "done";

export interface ActiveEvent {
  id: EventId;
  left: number;
  t: number;
}

const TUTORIAL_DECK: RoomId[] = ["dorm", "chaikhana", "library", "canteen", "gym"];
const DAILY_POOL: RoomId[] = ["dorm", "chaikhana", "library", "canteen", "gym", "garden", "hall", "coworking", "itlab", "faculty"];
export const CROWN_DURATION = 2.6;

export class Round {
  readonly events = new Emitter<RoundEvent>();
  readonly mission: MissionDef | null;
  t = 0;
  phase: Phase = "intro";
  phaseT = 0;
  paused = false;

  readonly tower = new Tower();
  readonly crane = new Crane();
  hanging: { type: RoomId; w: number } | null = null;
  falling: { type: RoomId; w: number; x: number; y: number; vx: number; vy: number; rot: number } | null = null;
  debris: Debris[] = [];
  floats: FloatText[] = [];
  nextType: RoomId = "dorm";
  history: RoomId[] = [];

  stability: number;
  maxStability: number;
  lives: number = BALANCE.lives;
  livesLost = 0;
  combo = 0;
  bestCombo = 0;
  perfectStreak = 0;
  bestPerfectStreak = 0;
  shabytLevel = 0;
  shabytReached = false;

  score = 0;
  shai = 0;
  students = 0;
  innovation = 0;
  seasonPts = 0;
  facultyPts = 0;
  materials = { brick: 0, felt: 0, thread: 0 };
  perfects = 0;

  event: ActiveEvent | null = null;
  private lastEvent: EventId | null = null;
  private nextEventFloor: number;
  private examPending: { block: PlacedBlock; n: number }[] = [];
  offer: BonusId[] | null = null;
  eff = {
    teaBreak: 0,
    wideCrane: 0,
    magnet: 0,
    garland: 0,
    facultySpirit: 0,
    windbreak: false,
    antiDeadline: false,
    balcony: false,
  };
  shields: number;
  usedBonuses: BonusId[] = [];

  deadlinesSurvived = 0;
  typesPlaced = new Set<RoomId>();
  chaiDorm = false;
  rarePlaced = false;
  maxHeight = 0;

  wind = 0;
  windDir = 1;
  danger = false;
  shake = 0;
  flash = 0;
  crownT = 0;
  crowned = false;
  missionDone = false;
  voluntaryCrown = false;
  private crownRequested = false;
  endReason: EndReason | null = null;
  result: RoundResult | null = null;

  private readonly rngDeck: Rng;
  private readonly rngEvents: Rng;
  private readonly rngBonus: Rng;
  private readonly rngLoot: Rng;
  private readonly rngMisc: Rng;
  private deckIndex = 0;
  private readonly pool: RoomId[];
  private pendingStartOffer: boolean;
  private tutorialLanded = 0;

  constructor(readonly cfg: RoundConfig) {
    this.rngDeck = new Rng(streamSeed(cfg.seed, "deck"));
    this.rngEvents = new Rng(streamSeed(cfg.seed, "events"));
    this.rngBonus = new Rng(streamSeed(cfg.seed, "bonus"));
    this.rngLoot = new Rng(streamSeed(cfg.seed, "loot"));
    this.rngMisc = new Rng(streamSeed(cfg.seed, "misc"));
    this.windDir = this.rngMisc.chance(0.5) ? 1 : -1;

    this.mission = cfg.mode === "campaign" ? (MISSIONS[cfg.missionIndex ?? 0] ?? MISSIONS[0]) : null;

    const st = startStability(cfg.upgrades.stability);
    this.stability = st.value;
    this.maxStability = st.max;
    this.shields = cfg.upgrades.shield + cfg.boosterShields;

    const pool = cfg.mode === "daily" ? [...DAILY_POOL] : [...cfg.unlockedRooms];
    for (const r of this.mission?.extraRooms ?? []) if (!pool.includes(r)) pool.push(r);
    if (cfg.faculty && !pool.includes("faculty")) pool.push("faculty");
    this.pool = pool.filter((r) => r !== "foundation" && (r !== "nauryz" || cfg.mode !== "daily"));

    const isTutorial = cfg.mode === "tutorial";
    const randomEvents = !isTutorial && (this.mission ? this.mission.randomEvents : true);
    this.nextEventFloor = randomEvents ? BALANCE.events.firstFloor + this.rngEvents.int(0, 2) : Number.POSITIVE_INFINITY;

    const fw = BALANCE.world.foundationW * (1 + 0.07 * cfg.upgrades.wideBase);
    this.tower.add("foundation", 0, Math.round(fw), "perfect", 0, 0);
    this.tower.blocks[0].squash = 0;

    this.pendingStartOffer = cfg.upgrades.startBonus > 0 && !isTutorial && cfg.mode !== "campaign";
    this.nextType = this.drawNext();
    this.spawnHanging();
    this.phase = "intro";
  }

  // ── public API ───────────────────────────────────────────────────────────

  get height(): number {
    return this.tower.floors - 1;
  }

  get isTutorial(): boolean {
    return this.cfg.mode === "tutorial";
  }

  /** Whether the player may crown the campus now (button visible). */
  get canCrown(): boolean {
    return (
      (this.phase === "swing" || this.phase === "falling" || this.phase === "settle") &&
      !this.crownRequested &&
      this.height >= BALANCE.modes.crownMinFloors &&
      (this.cfg.mode === "quick" || this.cfg.mode === "endless" || this.cfg.mode === "faculty" || this.cfg.mode === "daily")
    );
  }

  get windActive(): boolean {
    return this.wind > 0.05;
  }

  drop(): boolean {
    if (this.paused || this.phase !== "swing" || !this.hanging) return false;
    const h = this.hanging;
    const drift = this.wind * this.windDir * BALANCE.events.windDrift;
    this.falling = {
      type: h.type,
      w: h.w,
      x: this.crane.x,
      y: this.tower.topY + BALANCE.world.hangAbove,
      vx: drift,
      vy: 0,
      rot: this.crane.tilt,
    };
    this.hanging = null;
    if (this.eff.teaBreak > 0) this.eff.teaBreak--;
    if (this.eff.facultySpirit > 0 && h.type === "faculty") this.eff.facultySpirit--;
    this.setPhase("falling");
    this.emit({ k: "drop" });
    if (this.isTutorial && this.tutorialLanded === 0) this.emit({ k: "hint", text: "", key: "tap" });
    return true;
  }

  pickBonus(id: BonusId): void {
    if (this.phase !== "bonus" || !this.offer?.includes(id)) return;
    this.applyBonus(id);
    this.offer = null;
    this.usedBonuses.push(id);
    this.emit({ k: "bonusApplied", id });
    this.spawnHanging();
  }

  requestCrown(): boolean {
    if (!this.canCrown) return false;
    this.voluntaryCrown = true;
    if (this.phase === "swing") this.startCrown("crown");
    else this.crownRequested = true; // finish the drop in flight, then crown
    return true;
  }

  quit(): void {
    if (this.phase === "done") return;
    this.endReason = "quit";
    this.finish();
  }

  // ── simulation ───────────────────────────────────────────────────────────

  update(dt: number): void {
    if (this.paused || this.phase === "done") return;
    this.t += dt;
    this.phaseT += dt;

    this.updateWind(dt);
    const lean = this.tower.leanRatio();
    const swayTarget =
      (this.isTutorial ? 0 : 1) * (lean * 22 + this.wind * 16 + (this.danger ? 7 : 0) + Math.min(8, this.height * 0.25));
    const jitterTarget = this.event?.id === "deadline" ? 3.2 : this.danger ? 1.2 : 0;
    this.tower.update(dt, swayTarget, jitterTarget);

    if (this.event?.id === "deadline" && (this.phase === "swing" || this.phase === "falling")) {
      const drain = BALANCE.stability.deadlineDrainPerSec * (this.eff.antiDeadline ? BALANCE.stability.antiDeadlineK : 1);
      this.stability -= drain * dt;
      if (this.stability <= 0) {
        this.stability = 0;
        this.collapse();
      }
    }
    const danger = this.stability < BALANCE.stability.danger && this.phase !== "crowning";
    if (danger !== this.danger) {
      this.danger = danger;
      this.emit({ k: "danger", on: danger });
    }

    switch (this.phase) {
      case "intro":
        this.swingCrane(dt);
        if (this.phaseT > 0.35) {
          if (this.pendingStartOffer) {
            this.pendingStartOffer = false;
            this.makeOffer(this.cfg.upgrades.startBonus >= 2 ? 4 : 3);
          } else {
            this.setPhase("swing");
          }
        }
        break;
      case "swing":
        this.swingCrane(dt);
        break;
      case "falling":
        this.updateFalling(dt);
        break;
      case "settle":
        if (this.phaseT >= 0.22) this.afterLanding();
        break;
      case "collapsing":
        if (this.phaseT > 1.3) this.startCrown(this.endReason ?? "collapse");
        break;
      case "crowning":
        this.crownT += dt;
        if (!this.crowned && this.crownT >= CROWN_DURATION * 0.62) {
          this.crowned = true;
          this.flash = 1;
          this.emit({ k: "crowned" });
        }
        if (this.crownT >= CROWN_DURATION + 0.9) this.finish();
        break;
      default:
        break;
    }

    for (const d of this.debris) {
      d.vy -= BALANCE.world.gravity * 0.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vrot * dt;
      d.life -= dt;
    }
    this.debris = this.debris.filter((d) => d.life > 0);
    for (const f of this.floats) {
      f.t += dt;
      f.y += 38 * dt;
    }
    this.floats = this.floats.filter((f) => f.t < f.life);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  private updateWind(dt: number): void {
    let target = 0;
    if (this.event?.id === "wind") target = 0.9;
    if (this.mission?.constantWind && this.height >= 2) target = 0.85;
    if (target > 0) {
      const gardens = this.tower.countType("garden");
      target *= 1 - Math.min(BALANCE.events.gardenCap, gardens * BALANCE.events.gardenK);
      if (this.eff.windbreak) target *= BALANCE.events.windbreakK;
    }
    this.wind += (target - this.wind) * Math.min(1, dt * 1.2);
  }

  private swingCrane(dt: number): void {
    const top = this.tower.top;
    const target = this.tower.visualX(top);
    this.crane.center += (target - this.crane.center) * Math.min(1, dt * 3);
    this.crane.update(dt, this.wind, this.windDir);
  }

  private updateFalling(dt: number): void {
    const f = this.falling;
    if (!f) return;
    f.vy -= BALANCE.world.gravity * dt;
    f.y += f.vy * dt;
    f.x += f.vx * dt;
    f.rot *= Math.pow(0.02, dt);
    if (f.y <= this.tower.topY) {
      f.y = this.tower.topY;
      this.land();
    }
  }

  private land(): void {
    const f = this.falling;
    if (!f) return;
    this.falling = null;
    const top = this.tower.top;
    const topX = this.tower.visualX(top);
    let dx = f.x - topX;
    const newFloor = this.tower.floors;
    const gentle = this.isTutorial || newFloor <= BALANCE.crane.gentleFloors;
    let q: Quality = evaluateLanding({ dx, w: f.w, topW: top.w, gentle, balcony: this.eff.balcony });
    let shielded = false;

    if (q === "critical" && gentle) {
      q = "bad";
      dx = nudgeOffset(dx, f.w, top.w);
      this.emit({ k: "hint", text: "Почти! Цельтесь в центр башни", key: "nudge" });
    }
    if ((q === "bad" || q === "critical") && this.shields > 0) {
      this.shields--;
      q = "normal";
      dx = Math.sign(dx || 1) * Math.min(Math.abs(dx), 0.2 * Math.min(f.w, top.w));
      shielded = true;
    }

    if (q === "critical") {
      this.miss(f, dx);
      return;
    }

    const visualX = q === "perfect" ? topX : topX + dx;
    const baseX = visualX - this.tower.swayAt(newFloor);
    const type = f.type;
    const room = ROOMS[type];
    const below = top;
    const session = this.event?.id === "session";
    const exam = this.event?.id === "exam";
    const festival = this.event?.id === "festival";
    const nauryzEv = this.event?.id === "nauryz";
    const synergy: string[] = [];

    // Combo & Shabyt
    if (q === "perfect") {
      this.combo++;
      this.perfectStreak++;
      this.perfects++;
    } else if (q !== "good") {
      this.combo = 0;
      this.perfectStreak = 0;
    }
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.bestPerfectStreak = Math.max(this.bestPerfectStreak, this.perfectStreak);
    const sc = BALANCE.score;
    const newShabyt = this.combo >= sc.shabyt2At ? 2 : this.combo >= sc.shabytAt ? 1 : 0;
    if (newShabyt !== this.shabytLevel) {
      this.shabytLevel = newShabyt;
      if (newShabyt > 0) this.shabytReached = true;
      this.emit({ k: "shabyt", on: newShabyt > 0, level: newShabyt });
    }

    // Students
    let studentsN = settleStudents(type, q, {
      magnet: this.eff.magnet > 0,
      upgradeLevel: this.cfg.upgrades.students,
      festival,
    });
    let extraShai = 0;
    let extraSeason = 0;

    // Neighbour synergies (new room ↔ the room it lands on)
    const pair = (a: RoomId, b: RoomId) => (type === a && below.type === b) || (type === b && below.type === a);
    if (pair("dorm", "chaikhana")) {
      extraShai += BALANCE.shai.chaiDorm;
      studentsN += BALANCE.students.synergyDorm;
      this.chaiDorm = true;
      synergy.push("Чай для общаги!");
    } else if (pair("dorm", "canteen")) {
      studentsN += BALANCE.students.synergyDorm;
      extraShai += 2;
      synergy.push("Обед рядом!");
    }
    let innovation = type === "itlab" ? 5 : 0;
    if (type === "itlab" && (below.type === "library" || below.type === "coworking")) {
      innovation *= 2;
      synergy.push("Наука + код!");
    } else if ((type === "library" || type === "coworking") && below.type === "itlab") {
      innovation += 5;
      synergy.push("Наука + код!");
    }
    if (type === "coworking") {
      extraSeason += Math.ceil(below.students * BALANCE.season.coworkingShare) * 3;
      if (below.students > 0) synergy.push("Коворкинг: студенты → сезон");
    }
    if (type === "nauryz") synergy.push("Наурыз құтты болсын!");

    // Score
    const qBonus = { perfect: sc.perfect, good: sc.good, normal: sc.normal, bad: sc.bad, critical: 0 }[q];
    let pts = sc.base + qBonus;
    pts *= 1 + sc.comboStep * Math.min(sc.comboCap, this.combo);
    if (this.shabytLevel === 2) pts *= sc.shabyt2K;
    else if (this.shabytLevel === 1) pts *= sc.shabytK;
    const blocks = this.tower.blocks;
    const libNear = blocks[newFloor - 1]?.type === "library" || blocks[newFloor - 2]?.type === "library";
    if (q === "perfect" && libNear) {
      pts *= sc.libraryK;
      synergy.push("Библиотека: ×1.5");
    }
    if (exam) pts *= sc.examK;
    if (session) pts *= sc.sessionK;
    if (this.eff.garland > 0) pts *= sc.garlandK;
    pts = Math.round(pts);

    // $SHAI
    let shai = room.shai + (q === "perfect" ? BALANCE.shai.perfect : 0) + extraShai;
    if (q === "perfect" && this.combo > 0 && this.combo % 5 === 0) {
      shai += BALANCE.shai.comboMilestone;
      this.emit({ k: "combo", n: this.combo });
    }
    if (nauryzEv) shai *= BALANCE.shai.nauryzK;
    if (session) shai *= BALANCE.shai.sessionK;
    shai = Math.round(shai);

    // Place it
    const block = this.tower.add(type, baseX, f.w, q, exam ? 0 : studentsN, this.t);
    if (exam) this.examPending.push({ block, n: studentsN });
    else this.students += studentsN;
    this.score += pts;
    this.shai += shai;
    this.innovation += innovation;
    this.seasonPts += extraSeason;

    // Room effects
    if (type === "gym") {
      this.maxStability = Math.min(BALANCE.stability.maxCap, this.maxStability + BALANCE.stability.gymMax);
      this.stability += BALANCE.stability.gym;
      synergy.push("Спортзал: +устойчивость");
    }
    if (type === "faculty" && this.cfg.faculty) {
      this.facultyPts += BALANCE.faculty.perBlock * (q === "perfect" ? BALANCE.faculty.perfectK : 1);
    }
    if (type === "nauryz") this.emit({ k: "fireworks", x: visualX, y: this.tower.topY });
    if (ROOMS[type].rarity !== "common" && ROOMS[type].rarity !== "uncommon") this.rarePlaced = true;
    this.typesPlaced.add(type);
    this.checkFeast();

    // Stability
    const delta = stabilityDelta(q, { gentle, session, lean: this.tower.leanRatio() });
    this.stability = Math.max(0, Math.min(this.maxStability, this.stability + delta));
    if (this.event?.id === "deadline" && q === "perfect") {
      this.deadlinesSurvived++;
      this.floats.push(this.float("Дедлайн сдан!", visualX, this.tower.topY + 60, "#8ef0a5", 26));
      this.endEvent(true);
    }

    // Loot
    this.rollLoot(q, visualX);

    // Feedback
    this.floats.push(this.float(QUALITY_LABEL[q], visualX, this.tower.topY + 20, QUALITY_COLOR[q], q === "perfect" ? 34 : 24));
    if (shielded) this.floats.push(this.float("🛡 Щит!", visualX, this.tower.topY + 64, "#9fd8ff", 22));
    if (q === "perfect") this.flash = Math.max(this.flash, 0.6);
    if (q === "bad") this.shake = Math.max(this.shake, 0.45);
    this.emit({
      k: "land",
      q,
      floor: newFloor,
      x: visualX,
      y: this.tower.topY,
      w: f.w,
      type,
      score: pts,
      shai,
      students: exam ? 0 : studentsN,
      synergy,
      shielded,
    });

    // Countdowns
    if (this.eff.magnet > 0) this.eff.magnet--;
    if (this.eff.garland > 0) this.eff.garland--;
    if (this.eff.wideCrane > 0) this.eff.wideCrane--;
    if (this.event) {
      this.event.left--;
      if (this.event.left <= 0) this.endEvent(false);
    }
    this.maxHeight = Math.max(this.maxHeight, this.height);

    if (this.isTutorial) this.tutorialHint(q);

    if (this.stability <= 0) {
      this.collapse();
      return;
    }
    this.setPhase("settle");
  }

  private miss(f: NonNullable<Round["falling"]>, dx: number): void {
    const dir = Math.sign(dx || 1);
    this.debris.push({
      type: f.type,
      w: f.w,
      x: f.x,
      y: this.tower.topY,
      vx: dir * 140,
      vy: 120,
      rot: 0,
      vrot: dir * 2.4,
      life: 2.5,
    });
    this.lives--;
    this.livesLost++;
    this.combo = 0;
    this.perfectStreak = 0;
    if (this.shabytLevel > 0) {
      this.shabytLevel = 0;
      this.emit({ k: "shabyt", on: false, level: 0 });
    }
    const delta = stabilityDelta("critical", { gentle: false, session: this.event?.id === "session", lean: 0 });
    this.stability = Math.max(0, this.stability + delta);
    this.shake = 1;
    this.floats.push(this.float(QUALITY_LABEL.critical, f.x, this.tower.topY + 30, QUALITY_COLOR.critical, 30));
    this.emit({ k: "miss", x: f.x, y: this.tower.topY, type: f.type });
    if (this.lives <= 0) {
      this.endReason = "lives";
      this.startCrown("lives");
      return;
    }
    if (this.stability <= 0) {
      this.collapse();
      return;
    }
    this.setPhase("settle");
  }

  private afterLanding(): void {
    if (this.phase !== "settle") return;
    if (this.crownRequested) {
      this.startCrown("crown");
      return;
    }
    if (this.mission) {
      const res = this.mission.check(this);
      this.emit({ k: "mission", text: res.progress, done: res.done });
      if (res.done) {
        this.missionDone = true;
        this.startCrown("goal");
        return;
      }
    }
    if (this.isTutorial && this.height >= TUTORIAL_DECK.length) {
      this.startCrown("goal");
      return;
    }
    if (this.cfg.mode === "quick" && this.height >= BALANCE.modes.quickGoal) {
      this.startCrown("goal");
      return;
    }

    const forced = this.mission?.forcedEvents?.find((e) => e.floor === this.height);
    if (forced && !this.event) this.startEvent(forced.id);
    else if (!this.event && this.height >= this.nextEventFloor) {
      this.startEvent(pickEvent(this.rngEvents, { hasHall: this.tower.countType("hall") > 0, previous: this.lastEvent }));
    }

    if (!this.isTutorial && isBonusFloor(this.height)) {
      this.makeOffer(3);
      return;
    }
    this.spawnHanging();
  }

  private makeOffer(count: number): void {
    this.offer = offerBonuses(
      this.rngBonus,
      {
        hasFaculty: !!this.cfg.faculty,
        stabilityRatio: this.stability / this.maxStability,
        windActive: this.windActive || !!this.mission?.constantWind,
      },
      count,
    );
    this.setPhase("bonus");
    this.emit({ k: "bonusOffer", options: [...this.offer] });
  }

  private applyBonus(id: BonusId): void {
    const b = BALANCE.bonuses;
    switch (id) {
      case "teaBreak":
        this.eff.teaBreak += b.teaBreakBlocks;
        break;
      case "wideCrane":
        this.eff.wideCrane += b.wideCraneBlocks;
        break;
      case "reinforce":
        this.shields++;
        break;
      case "magnet":
        this.eff.magnet += b.magnetBlocks;
        break;
      case "windbreak":
        this.eff.windbreak = true;
        break;
      case "antiDeadline":
        this.eff.antiDeadline = true;
        break;
      case "balcony":
        this.eff.balcony = true;
        break;
      case "garland":
        this.eff.garland += b.garlandBlocks;
        break;
      case "builderTea":
        this.stability = Math.min(this.maxStability, this.stability + BALANCE.stability.builderTea);
        break;
      case "facultySpirit":
        this.eff.facultySpirit += b.facultySpiritBlocks;
        break;
    }
    this.floats.push(
      this.float(`${BONUSES[id].icon} ${BONUSES[id].name}`, this.tower.visualX(this.tower.top), this.tower.topY + 90, "#ffe9a8", 24),
    );
  }

  private startEvent(id: EventId): void {
    this.event = { id, left: eventDuration(id), t: 0 };
    this.lastEvent = id;
    this.nextEventFloor = this.height + eventDuration(id) + nextEventGap(this.rngEvents);
    this.emit({ k: "event", id, on: true });
    if (id === "nauryz") this.emit({ k: "fireworks", x: 0, y: this.tower.topY + 120 });
  }

  private endEvent(resolved: boolean): void {
    const ev = this.event;
    if (!ev) return;
    this.event = null;
    if (ev.id === "exam" && this.examPending.length) {
      let n = 0;
      for (const p of this.examPending) {
        p.block.students = p.n;
        n += p.n;
      }
      this.examPending = [];
      this.students += n;
      this.emit({ k: "examPassed", students: n });
      this.floats.push(this.float(`Экзамен сдан! +${n} 🎓`, this.tower.visualX(this.tower.top), this.tower.topY + 80, "#c9b8ff", 24));
    }
    if (ev.id === "deadline" && !resolved && this.stability > 0) this.deadlinesSurvived++;
    this.emit({ k: "event", id: ev.id, on: false });
  }

  private checkFeast(): void {
    const bl = this.tower.blocks;
    for (let i = Math.max(1, bl.length - 3); i < bl.length; i++) {
      const c = bl[i];
      if (c.type !== "canteen" || c.feastAwarded) continue;
      const dormNear = bl[i - 1]?.type === "dorm" || bl[i + 1]?.type === "dorm";
      let hallNear = false;
      for (let j = i - 2; j <= i + 2; j++) if (j !== i && bl[j]?.type === "hall") hallNear = true;
      if (dormNear && hallNear) {
        c.feastAwarded = true;
        this.shai += BALANCE.shai.canteenBonus;
        this.floats.push(this.float(`Пир кампуса! +${BALANCE.shai.canteenBonus} $SHAI`, this.tower.visualX(c), (i + 1) * BALANCE.world.blockH, "#ffd27a", 22));
      }
    }
  }

  private rollLoot(q: Quality, x: number): void {
    const l = BALANCE.loot;
    let p = 0;
    if (q === "perfect") p += l.materialOnPerfect;
    if (this.event?.id === "nauryz") p += l.materialNauryz;
    if (this.shabytLevel > 0) p += l.materialShabyt;
    if (p === 0) return;
    p += l.perUpgrade * this.cfg.upgrades.rareChance;
    if (this.cfg.mode === "endless") p *= 1.5;
    if (!this.rngLoot.chance(p)) return;
    const id = this.rngLoot.weighted(["brick", "felt", "thread"] as const, (m) => (m === "brick" ? 5 : m === "felt" ? 3 : 1.5));
    this.materials[id]++;
    this.emit({ k: "material", id, x, y: this.tower.topY });
  }

  private collapse(): void {
    if (this.phase === "collapsing" || this.phase === "crowning" || this.phase === "done") return;
    const n = collapseCount(this.tower.floors);
    const dir = this.tower.leanDir();
    const removed = this.tower.removeTop(n);
    removed.forEach((b, i) => {
      this.debris.push({
        type: b.type,
        w: b.w,
        x: this.tower.visualX(b),
        y: b.floor * BALANCE.world.blockH,
        vx: dir * (80 + i * 50) + (this.rngMisc.next() - 0.5) * 60,
        vy: 150 + i * 40,
        rot: b.tilt,
        vrot: dir * (1 + i * 0.6),
        life: 3,
      });
    });
    if (this.falling) {
      const f = this.falling;
      this.debris.push({ type: f.type, w: f.w, x: f.x, y: f.y, vx: dir * 60, vy: 0, rot: f.rot, vrot: dir, life: 3 });
      this.falling = null;
    }
    this.hanging = null;
    this.examPending = [];
    if (this.event) this.endEvent(false);
    this.endReason = "collapse";
    this.shake = 1.4;
    this.emit({ k: "collapse", fallen: removed.length });
    this.setPhase("collapsing");
  }

  private startCrown(reason: EndReason): void {
    if (this.phase === "crowning" || this.phase === "done") return;
    this.endReason = this.endReason ?? reason;
    this.hanging = null;
    this.falling = null;
    this.offer = null;
    if (this.event) this.endEvent(false);
    this.crownT = 0;
    this.setPhase("crowning");
    this.emit({ k: "crownStart" });
  }

  private finish(): void {
    if (this.phase === "done") return;
    const height = this.height;
    this.setPhase("done");
    const s = BALANCE.season;
    this.seasonPts += height * s.perFloor + this.perfects * s.perPerfect + Math.floor(this.innovation / s.innovationDiv);
    if (this.cfg.faculty && this.cfg.mode === "faculty") this.facultyPts += height * BALANCE.faculty.perFloorInFacultyMode;
    this.score += height * 15;
    this.materials.brick += Math.floor(height / 10);
    this.result = {
      mode: this.cfg.mode,
      missionIndex: this.mission?.index,
      missionSuccess: this.missionDone,
      missionStars: this.missionDone ? missionStars(this) : 0,
      reason: this.endReason ?? "crown",
      height,
      maxHeight: Math.max(this.maxHeight, height),
      score: this.score,
      students: this.students,
      perfects: this.perfects,
      bestCombo: this.bestCombo,
      bestPerfectStreak: this.bestPerfectStreak,
      shai: this.shai,
      materials: { ...this.materials },
      seasonPts: this.seasonPts,
      facultyPts: this.facultyPts,
      innovation: this.innovation,
      typesPlaced: [...this.typesPlaced],
      chaiDorm: this.chaiDorm,
      deadlinesSurvived: this.deadlinesSurvived,
      bonusesUsed: this.usedBonuses.length,
      rarePlaced: this.rarePlaced,
      shabyt: this.shabytReached,
      livesLost: this.livesLost,
      durationSec: Math.round(this.t),
      seed: this.cfg.seed,
    };
    this.emit({ k: "end", result: this.result });
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private drawNext(): RoomId {
    if (this.isTutorial) return TUTORIAL_DECK[Math.min(this.deckIndex++, TUTORIAL_DECK.length - 1)];
    const scripted = this.mission?.deck;
    if (scripted && this.deckIndex < scripted.length) return scripted[this.deckIndex++];
    this.deckIndex++;
    return drawRoom(this.rngDeck, {
      pool: this.pool,
      history: this.history,
      rareLevel: this.cfg.upgrades.rareChance + (this.cfg.mode === "endless" ? 2 : 0),
      facultyMode: this.cfg.mode === "faculty",
      hasFaculty: !!this.cfg.faculty,
      nauryzEvent: this.event?.id === "nauryz",
      forceFaculty: this.eff.facultySpirit > 0,
      boost: this.mission?.boost,
    });
  }

  private roomWidth(type: RoomId): number {
    let w = BALANCE.world.baseRoomW * ROOMS[type].widthK;
    if (this.eff.wideCrane > 0) w *= BALANCE.bonuses.wideCraneK;
    if (this.tower.floors <= 3) w *= 1 + 0.04 * this.cfg.upgrades.wideBase;
    if (this.isTutorial) w *= 1.08;
    if (this.cfg.mode === "endless") w *= Math.max(0.82, 1 - 0.004 * this.tower.floors);
    return Math.round(w);
  }

  private spawnHanging(): void {
    if (this.eff.facultySpirit > 0 && this.cfg.faculty) this.nextType = "faculty";
    const type = this.nextType;
    this.history.push(type);
    this.nextType = this.drawNext();
    this.hanging = { type, w: this.roomWidth(type) };
    this.crane.configure({
      floor: this.tower.floors,
      endless: this.cfg.mode === "endless",
      slowSwingLevel: this.cfg.upgrades.slowSwing,
      teaBreak: this.eff.teaBreak > 0,
      wind: this.wind,
      tutorial: this.isTutorial,
    });
    this.crane.reset(this.tower.visualX(this.tower.top), this.rngMisc.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    if (this.phase !== "intro") this.setPhase("swing");
    this.emit({ k: "spawn", type, next: this.nextType });
    if (this.isTutorial && this.tutorialLanded === 0) {
      this.emit({ k: "hint", text: "Нажмите, тапните или пробел — сбросить комнату", key: "tap" });
    }
  }

  private tutorialHint(q: Quality): void {
    this.tutorialLanded++;
    const n = this.tutorialLanded;
    const texts: Record<number, string> = {
      1: q === "perfect" ? "Идеально! Ровные укладки подряд растят комбо" : "Цельтесь в центр — ровная башня устойчивее",
      2: "Чайхана над общагой — бонус соседства!",
      3: "Комнаты заселяют студентов и приносят $SHAI",
      4: "Ещё одна — и шанырак завершит кампус!",
    };
    const text = texts[n];
    if (text) this.emit({ k: "hint", text, key: `t${n}` });
    else this.emit({ k: "hint", text: "", key: "done" });
  }

  private float(text: string, x: number, y: number, color: string, size: number): FloatText {
    return { text, x, y, color, size, t: 0, life: 1.3 };
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  private emit(e: RoundEvent): void {
    this.events.emit(e);
  }
}

export { EVENTS };
