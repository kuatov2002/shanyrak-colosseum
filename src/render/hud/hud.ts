// The round HUD, rendered by PixiJS. Everything that changes every frame (height, score, stability,
// combo, next room) is WebGL; per-frame updates only touch BitmapText.text, sprite transforms and
// tints. The DOM overlay during a round is reserved for the pause / settings modals.

import {
  BitmapText,
  Container,
  Graphics,
  NineSliceSprite,
  Sprite,
  type FederatedPointerEvent,
  type Texture,
} from "pixi.js";
import { GlowFilter } from "pixi-filters";
import { BONUSES } from "../../gameplay/bonuses";
import { EVENTS } from "../../gameplay/events";
import { MISSIONS, MODES } from "../../gameplay/modes";
import type { Round } from "../../gameplay/round";
import type { BonusId, RoundEvent } from "../../gameplay/types";
import { ROOMS, RARITY_COLOR } from "../../meta/rooms";
import { MATERIAL_INFO } from "../../economy/shai";
import { BONUS_ICON, EVENT_ICON, icon, type IconName } from "../../design/icons";
import { CHIP, PANEL, type Skin } from "../../design/skin";
import { hexToRgb } from "../color";
import type { TextureBank } from "../textures";
import { PixiButton } from "./button";
import { HUD_BOLD, HUD_TEXT, installHudFonts } from "./fonts";

export interface HudCallbacks {
  onPause(): void;
  onSkipTutorial(): void;
  onPickBonus(id: BonusId): void;
  onCrown(): void;
}

const hex = (c: string) => {
  const [r, g, b] = hexToRgb(c);
  return (r << 16) | (g << 8) | b;
};

function text(font: string, size: number, value = "", tint = 0xffffff): BitmapText {
  const t = new BitmapText({ text: value, style: { fontFamily: font, fontSize: size } });
  t.tint = tint;
  return t;
}

class Chip extends Container {
  readonly bg: NineSliceSprite;
  readonly caption: BitmapText;
  readonly glyph: Sprite | null;
  constructor(skin: Skin, iconName: IconName | null, size = 14, tex?: Texture) {
    super();
    this.bg = new NineSliceSprite({ texture: tex ?? skin.chip, leftWidth: CHIP.slice, rightWidth: CHIP.slice, topHeight: CHIP.slice, bottomHeight: CHIP.slice });
    this.glyph = iconName ? new Sprite(icon(iconName)) : null;
    this.caption = text(HUD_TEXT, size);
    this.addChild(this.bg);
    if (this.glyph) {
      this.glyph.anchor.set(0.5);
      this.glyph.width = 20;
      this.glyph.height = 20;
      this.addChild(this.glyph);
    }
    this.addChild(this.caption);
  }
  set(value: string, maxW = 600): void {
    if (this.caption.text !== value) this.caption.text = value;
    const iconW = this.glyph ? 22 : 0;
    const w = Math.min(maxW, iconW + this.caption.width + 22);
    const h = Math.max(26, this.caption.height + 10);
    this.bg.width = w;
    this.bg.height = h;
    if (this.glyph) this.glyph.position.set(13, h / 2);
    this.caption.position.set(11 + iconW, (h - this.caption.height) / 2);
  }
  get w(): number {
    return this.bg.width;
  }
  get h(): number {
    return this.bg.height;
  }
}

export class Hud extends Container {
  private round: Round | null = null;
  private cb: HudCallbacks | null = null;
  private unsub: (() => void) | null = null;
  private w = 0;
  private h = 0;
  private time = 0;

  private heightText!: BitmapText;
  private floorLabel!: BitmapText;
  private scoreText!: BitmapText;
  private modeLabel!: BitmapText;
  private eventChip: Chip;
  private missionChip: Chip;
  private shaiPill: Chip;
  private studentPill: Chip;
  private pauseBtn: PixiButton;
  private stab = new Container();
  private stabTrack: NineSliceSprite;
  private stabFill: NineSliceSprite;
  private stabFrame: NineSliceSprite;
  private stabLabel!: BitmapText;
  private stabNum!: BitmapText;
  private shieldIcon = new Sprite(icon("shield"));
  private shieldText!: BitmapText;
  private lives: Sprite[] = [];
  private nextCard = new Container();
  private nextBg: NineSliceSprite;
  private nextFrame: NineSliceSprite;
  private nextTitle!: BitmapText;
  private nextThumb = new Sprite();
  private nextName!: BitmapText;
  private nextKey = "";
  private combo = new Container();
  private comboText!: BitmapText;
  private comboLabel!: BitmapText;
  private comboGlow = new GlowFilter({ distance: 12, outerStrength: 2, color: 0xff8a3c, quality: 0.2 });
  private comboPop = 0;
  private lastCombo = 0;
  private pills = new Container();
  private pillPool: { c: Chip; t: number; delay: number }[] = [];
  private bonusRow = new Container();
  private bonusKey = "";
  private hint = new Container();
  private hintBg: NineSliceSprite;
  private hintText!: BitmapText;
  private banner = new Container();
  private bannerBg: NineSliceSprite;
  private bannerTitle!: BitmapText;
  private bannerSub!: BitmapText;
  private bannerT = 0;
  private bannerDur = 0;
  private crownBtn: PixiButton;
  private skipBtn: PixiButton;
  // bonus offer
  private offer = new Container();
  private offerDim = new Graphics();
  private offerTitle!: BitmapText;
  private offerSub!: BitmapText;
  private offerCards: { id: BonusId; c: Container; frame: NineSliceSprite; bg: NineSliceSprite; hover: boolean }[] = [];
  private offerFocus = -1;
  private offerT = 0;

  constructor(
    private readonly skin: Skin,
    private readonly bank: TextureBank,
  ) {
    super();
    installHudFonts();
    this.heightText = text(HUD_BOLD, 46, "0");
    this.floorLabel = text(HUD_TEXT, 12, "ЭТАЖ", 0xefe3c8);
    this.scoreText = text(HUD_BOLD, 16, "0 очков", 0xffd75e);
    this.modeLabel = text(HUD_TEXT, 12, "", 0xb9b0cf);
    this.stabLabel = text(HUD_TEXT, 12, "Устойчивость", 0xb9b0cf);
    this.stabNum = text(HUD_BOLD, 15, "100");
    this.shieldText = text(HUD_BOLD, 14, "", 0x9fd8ff);
    this.nextTitle = text(HUD_TEXT, 11, "Далее", 0xb9b0cf);
    this.nextName = text(HUD_TEXT, 12, "");
    this.comboText = text(HUD_BOLD, 56, "");
    this.comboLabel = text(HUD_TEXT, 13, "КОМБО", 0xefe3c8);
    this.hintText = text(HUD_TEXT, 15, "", 0x2a1a05);
    this.bannerTitle = text(HUD_BOLD, 24, "");
    this.bannerSub = text(HUD_TEXT, 13, "", 0xefe3c8);
    this.offerTitle = text(HUD_BOLD, 24, "Выберите бонус", 0xffd75e);
    this.offerSub = text(HUD_TEXT, 13, "Один бонус — до конца раунда или на несколько этажей", 0xefe3c8);

    this.eventChip = new Chip(skin, "wind", 13);
    this.missionChip = new Chip(skin, "target", 13);
    this.shaiPill = new Chip(skin, "coin", 14);
    this.studentPill = new Chip(skin, "cap", 14);
    this.pauseBtn = new PixiButton(skin, "soft", "", { icon: "pause", height: 42, minWidth: 44, paddingX: 8 });
    this.pauseBtn.onTap = () => this.cb?.onPause();

    const panel = (t: Texture) => new NineSliceSprite({ texture: t, leftWidth: PANEL.slice, rightWidth: PANEL.slice, topHeight: PANEL.slice, bottomHeight: PANEL.slice });
    this.stabFrame = new NineSliceSprite({ texture: skin.chip, leftWidth: CHIP.slice, rightWidth: CHIP.slice, topHeight: CHIP.slice, bottomHeight: CHIP.slice });
    this.stabTrack = new NineSliceSprite({ texture: skin.barTrack, leftWidth: 7, rightWidth: 7, topHeight: 6, bottomHeight: 6 });
    this.stabFill = new NineSliceSprite({ texture: skin.barFill, leftWidth: 6, rightWidth: 6, topHeight: 6, bottomHeight: 6 });
    this.shieldIcon.anchor.set(0.5);
    this.shieldIcon.width = 20;
    this.shieldIcon.height = 20;
    for (let i = 0; i < 3; i++) {
      const l = new Sprite(icon("helmet"));
      l.anchor.set(0.5);
      l.width = 20;
      l.height = 20;
      this.lives.push(l);
    }
    this.stab.addChild(this.stabFrame, this.stabLabel, this.stabTrack, this.stabFill, this.stabNum, this.shieldIcon, this.shieldText, ...this.lives);

    this.nextBg = panel(skin.panel);
    this.nextFrame = panel(skin.frame);
    this.nextThumb.anchor.set(0.5);
    this.nextCard.addChild(this.nextBg, this.nextFrame, this.nextTitle, this.nextThumb, this.nextName);

    this.comboText.anchor.set(0.5);
    this.comboLabel.anchor.set(0.5);
    this.combo.addChild(this.comboText, this.comboLabel);

    this.hintBg = panel(skin.cream);
    this.hint.addChild(this.hintBg, this.hintText);
    this.hint.visible = false;
    this.bannerBg = panel(skin.panel);
    this.bannerTitle.anchor.set(0.5, 0);
    this.bannerSub.anchor.set(0.5, 0);
    this.banner.addChild(this.bannerBg, this.bannerTitle, this.bannerSub);
    this.banner.visible = false;

    this.crownBtn = new PixiButton(skin, "gold", "Завершить шаныраком (+25% $SHAI)", { icon: "dome", fontSize: 15, height: 46 });
    this.crownBtn.onTap = () => this.cb?.onCrown();
    this.skipBtn = new PixiButton(skin, "ghost", "Пропустить обучение", { icon: "next", fontSize: 13, height: 38 });
    this.skipBtn.onTap = () => this.cb?.onSkipTutorial();

    this.offerDim.eventMode = "static";
    this.offerDim.on("pointerdown", (e: FederatedPointerEvent) => e.stopPropagation());
    this.offerTitle.anchor.set(0.5, 0);
    this.offerSub.anchor.set(0.5, 0);
    this.offer.addChild(this.offerDim, this.offerTitle, this.offerSub);
    this.offer.visible = false;

    this.addChild(
      this.heightText,
      this.floorLabel,
      this.scoreText,
      this.modeLabel,
      this.eventChip,
      this.missionChip,
      this.shaiPill,
      this.studentPill,
      this.pauseBtn,
      this.stab,
      this.nextCard,
      this.combo,
      this.pills,
      this.bonusRow,
      this.hint,
      this.banner,
      this.crownBtn,
      this.skipBtn,
      this.offer,
    );
    this.visible = false;
  }

  get attached(): boolean {
    return this.round !== null;
  }

  get offerOpen(): boolean {
    return this.offer.visible;
  }

  attach(round: Round, cb: HudCallbacks): void {
    this.detach();
    this.round = round;
    this.cb = cb;
    this.visible = true;
    this.nextKey = "";
    this.bonusKey = "";
    this.lastCombo = 0;
    this.banner.visible = false;
    this.offer.visible = false;
    const cfg = round.cfg;
    this.modeLabel.text =
      cfg.mode === "campaign" && cfg.missionIndex !== undefined ? `Миссия ${cfg.missionIndex + 1}: ${MISSIONS[cfg.missionIndex].title}` : MODES[cfg.mode].name;
    this.skipBtn.visible = round.isTutorial;
    if (round.isTutorial && round.height === 0) this.showHint("Нажмите, тапните или пробел — сбросить комнату");
    else this.hint.visible = false;
    this.unsub = round.events.on((e) => this.onEvent(e));
    if (round.offer) this.showOffer(round.offer);
    this.layout(this.w, this.h);
  }

  detach(): void {
    this.unsub?.();
    this.unsub = null;
    this.round = null;
    this.cb = null;
    this.visible = false;
    this.offer.visible = false;
    for (const p of this.pillPool) p.c.visible = false;
  }

  // ── reactions to round events ──────────────────────────────────────────

  private onEvent(e: RoundEvent): void {
    switch (e.k) {
      case "land":
        e.synergy.forEach((s, i) => this.pill(s, i * 0.25));
        break;
      case "shabyt":
        if (e.on) this.showBanner(e.level === 2 ? "ШАБЫТ ×2!" : "ШАБЫТ!", "Вдохновение: очки растут, башня сияет", "#ffd75e", 1.8);
        break;
      case "event": {
        const ev = EVENTS[e.id];
        if (e.on) this.showBanner(ev.name, ev.desc, ev.color, 3);
        break;
      }
      case "bonusOffer":
        this.showOffer(e.options);
        break;
      case "material":
        this.pill(`+1 ${MATERIAL_INFO[e.id].name}`, 0, "#8a6a3a");
        break;
      case "mission":
        if (e.done) this.showBanner("Цель миссии выполнена!", "Шанырак завершает кампус", "#8ef0a5", 2.6);
        break;
      case "examPassed":
        this.pill(`Экзамен сдан: +${e.students} студентов`, 0);
        break;
      case "collapse":
        this.showBanner("Башня осела", `${e.fallen} верхних этажа упали — но кампус стоит`, "#ff9d5c", 2.4);
        break;
      case "crownStart":
        this.showBanner(
          "Шанырак завершает кампус",
          this.round?.endReason === "lives" ? "Каски закончились — время собрать всех под одной крышей" : "",
          "#fff3c4",
          2.6,
        );
        break;
      case "hint":
        if (e.text) this.showHint(e.text);
        else this.hint.visible = false;
        break;
      case "drop":
        if (!this.round?.isTutorial) this.hint.visible = false;
        break;
      default:
        break;
    }
  }

  private pill(textValue: string, delay: number, color = "#2aa79a"): void {
    let slot = this.pillPool.find((p) => !p.c.visible);
    if (!slot) {
      const c = new Chip(this.skin, null, 14);
      this.pills.addChild(c);
      slot = { c, t: 0, delay: 0 };
      this.pillPool.push(slot);
    }
    slot.c.set(textValue);
    slot.c.bg.tint = hex(color);
    slot.c.visible = true;
    slot.c.alpha = 0;
    slot.t = 0;
    slot.delay = delay;
  }

  private showHint(value: string): void {
    this.hintText.text = value;
    this.hint.visible = true;
    this.layoutHint();
  }

  private showBanner(title: string, sub: string, color: string, dur: number): void {
    this.bannerTitle.text = title;
    this.bannerTitle.tint = hex(color);
    this.bannerSub.text = sub;
    this.bannerSub.visible = !!sub;
    this.banner.visible = true;
    this.bannerT = 0;
    this.bannerDur = dur;
    this.layoutBanner();
  }

  // ── bonus offer (keyboard: 1–4, ← →, Enter) ─────────────────────────────

  private showOffer(options: BonusId[]): void {
    for (const card of this.offerCards) card.c.destroy({ children: true });
    this.offerCards = [];
    options.forEach((id, i) => {
      const b = BONUSES[id];
      const c = new Container();
      const bg = new NineSliceSprite({ texture: this.skin.panel, leftWidth: PANEL.slice, rightWidth: PANEL.slice, topHeight: PANEL.slice, bottomHeight: PANEL.slice });
      const frame = new NineSliceSprite({ texture: this.skin.frame, leftWidth: PANEL.slice, rightWidth: PANEL.slice, topHeight: PANEL.slice, bottomHeight: PANEL.slice });
      frame.tint = 0xf2b84b;
      frame.alpha = 0.5;
      const ic = new Sprite(icon(BONUS_ICON[id]));
      ic.anchor.set(0.5);
      const num = text(HUD_BOLD, 14, String(i + 1), 0xb9b0cf);
      const name = text(HUD_BOLD, 17, b.name, 0xffffff);
      name.anchor.set(0.5, 0);
      const desc = new BitmapText({ text: b.desc, style: { fontFamily: HUD_TEXT, fontSize: 13, wordWrap: true, wordWrapWidth: 150, align: "center" } });
      desc.tint = 0xefe3c8;
      desc.anchor.set(0.5, 0);
      const tag = new Chip(this.skin, null, 11);
      tag.set(b.style);
      tag.caption.tint = 0xffd75e;
      c.addChild(bg, frame, ic, num, name, desc, tag);
      c.eventMode = "static";
      c.cursor = "pointer";
      const entry = { id, c, frame, bg, hover: false };
      c.on("pointerover", (e: FederatedPointerEvent) => {
        if (e.pointerType === "mouse") entry.hover = true;
      });
      c.on("pointerout", () => (entry.hover = false));
      c.on("pointerdown", (e: FederatedPointerEvent) => e.stopPropagation());
      c.on("pointertap", (e: FederatedPointerEvent) => {
        e.stopPropagation();
        this.pick(id);
      });
      this.offer.addChild(c);
      this.offerCards.push(entry);
    });
    this.offerFocus = -1;
    this.offerT = 0;
    this.offer.visible = true;
    this.layoutOffer();
  }

  private pick(id: BonusId): void {
    if (!this.offer.visible) return;
    this.offer.visible = false;
    this.cb?.onPickBonus(id);
  }

  /** Keyboard support; returns true when the key was consumed. */
  handleKey(code: string): boolean {
    if (!this.attached) return false;
    if (this.offer.visible) {
      const n = this.offerCards.length;
      const digit = /^(Digit|Numpad)([1-4])$/.exec(code);
      if (digit) {
        const i = Number(digit[2]) - 1;
        if (i < n) this.pick(this.offerCards[i].id);
        return true;
      }
      if (code === "ArrowRight" || code === "ArrowDown" || code === "Tab") {
        this.offerFocus = (this.offerFocus + 1 + n) % n;
        return true;
      }
      if (code === "ArrowLeft" || code === "ArrowUp") {
        this.offerFocus = (this.offerFocus - 1 + n) % n;
        return true;
      }
      if ((code === "Enter" || code === "Space") && this.offerFocus >= 0) {
        this.pick(this.offerCards[this.offerFocus].id);
        return true;
      }
      return code === "Space" || code === "Enter";
    }
    if (code === "KeyC" && this.round?.canCrown) {
      this.cb?.onCrown();
      return true;
    }
    return false;
  }

  // ── layout (called by the single resize handler) ────────────────────────

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    if (!w || !h) return;
    const narrow = w < 520;
    const top = 8;
    this.heightText.position.set(12, top);
    this.floorLabel.position.set(14, top + 50);
    this.scoreText.position.set(12, top + 66);
    this.pauseBtn.position.set(w - this.pauseBtn.buttonWidth - 10, top);
    // stability bar
    const sw = Math.min(560, w - 20);
    const sy = narrow ? 112 : 92;
    this.stab.position.set((w - sw) / 2, sy);
    this.stabFrame.width = sw;
    this.stabFrame.height = 30;
    this.stabLabel.visible = !narrow;
    this.stabLabel.position.set(14, 8);
    const trackX = narrow ? 14 : 110;
    const trackW = sw - trackX - 156;
    this.stabTrack.position.set(trackX, 8);
    this.stabTrack.width = trackW;
    this.stabTrack.height = 14;
    this.stabFill.position.set(trackX, 8);
    this.stabFill.height = 14;
    this.stabNum.position.set(trackX + trackW + 8, 6);
    this.shieldIcon.position.set(trackX + trackW + 54, 15);
    this.shieldText.position.set(trackX + trackW + 66, 6);
    this.lives.forEach((l, i) => l.position.set(sw - 62 + i * 20, 15));
    // next card
    const cw = narrow ? 92 : 108;
    this.nextCard.position.set(w - cw - 10, sy + 44);
    this.nextBg.width = cw;
    this.nextBg.height = narrow ? 92 : 100;
    this.nextFrame.width = cw;
    this.nextFrame.height = this.nextBg.height;
    this.nextTitle.position.set((cw - this.nextTitle.width) / 2, 8);
    this.nextThumb.position.set(cw / 2, this.nextBg.height / 2 + 2);
    this.nextName.position.set((cw - this.nextName.width) / 2, this.nextBg.height - 22);
    this.combo.position.set(w / 2, h * 0.27);
    this.pills.position.set(w / 2, h * 0.46);
    this.bonusRow.position.set(12, h - 96);
    this.crownBtn.position.set((w - this.crownBtn.buttonWidth) / 2, h - this.crownBtn.buttonHeight - 16);
    this.skipBtn.position.set(10, h - this.skipBtn.buttonHeight - 14);
    this.layoutHint();
    this.layoutBanner();
    this.layoutOffer();
  }

  private layoutHint(): void {
    if (!this.hint.visible) return;
    const narrow = this.w < 520;
    const maxW = narrow ? this.w - 130 : Math.min(460, this.w * 0.7);
    this.hintText.style.wordWrap = true;
    this.hintText.style.wordWrapWidth = maxW - 28;
    this.hintText.position.set(14, 10);
    const bw = Math.min(maxW, this.hintText.width + 28);
    this.hintBg.width = bw;
    this.hintBg.height = this.hintText.height + 20;
    const y = narrow ? 200 : 134;
    this.hint.position.set(narrow ? 10 : (this.w - bw) / 2, y);
  }

  private layoutBanner(): void {
    if (!this.banner.visible) return;
    const maxW = Math.min(460, this.w * 0.9);
    this.bannerSub.style.wordWrap = true;
    this.bannerSub.style.wordWrapWidth = maxW - 32;
    this.bannerSub.style.align = "center";
    const bw = Math.min(maxW, Math.max(this.bannerTitle.width, this.bannerSub.visible ? this.bannerSub.width : 0) + 40);
    const bh = 18 + this.bannerTitle.height + (this.bannerSub.visible ? this.bannerSub.height + 6 : 0) + 14;
    this.bannerBg.width = bw;
    this.bannerBg.height = bh;
    this.bannerTitle.position.set(bw / 2, 14);
    this.bannerSub.position.set(bw / 2, 18 + this.bannerTitle.height + 2);
    this.banner.pivot.set(bw / 2, bh / 2);
    this.banner.position.set(this.w / 2, this.h * 0.36);
  }

  private layoutOffer(): void {
    if (!this.offer.visible) return;
    const w = this.w;
    const h = this.h;
    this.offerDim.clear().rect(0, 0, w, h).fill({ color: 0x080618, alpha: 0.62 });
    this.offerDim.hitArea = { contains: () => true };
    const n = this.offerCards.length;
    const narrow = w < 560;
    const cardW = narrow ? Math.min(w - 32, 340) : 178;
    const cardH = narrow ? 112 : 210;
    const gap = 12;
    const totalW = narrow ? cardW : n * cardW + (n - 1) * gap;
    const totalH = narrow ? n * cardH + (n - 1) * gap : cardH;
    const x0 = (w - totalW) / 2;
    const y0 = Math.max(110, (h - totalH) / 2 + 20);
    this.offerTitle.position.set(w / 2, y0 - 70);
    this.offerSub.position.set(w / 2, y0 - 36);
    this.offerSub.style.wordWrap = true;
    this.offerSub.style.wordWrapWidth = w - 40;
    this.offerSub.style.align = "center";
    this.offerCards.forEach((card, i) => {
      const c = card.c;
      const [bg, frame, ic, num, name, desc, tag] = c.children as [NineSliceSprite, NineSliceSprite, Sprite, BitmapText, BitmapText, BitmapText, Chip];
      bg.width = cardW;
      bg.height = cardH;
      frame.width = cardW;
      frame.height = cardH;
      num.position.set(12, 10);
      if (narrow) {
        ic.width = 44;
        ic.height = 44;
        ic.position.set(40, 42);
        name.anchor.set(0, 0);
        name.position.set(76, 12);
        desc.anchor.set(0, 0);
        desc.style.wordWrapWidth = cardW - 96;
        desc.style.align = "left";
        desc.position.set(76, 40);
        tag.position.set(Math.max(6, 40 - tag.w / 2), cardH - tag.h - 8);
        c.position.set(x0, y0 + i * (cardH + gap));
      } else {
        ic.width = 52;
        ic.height = 52;
        ic.position.set(cardW / 2, 46);
        name.anchor.set(0.5, 0);
        name.position.set(cardW / 2, 80);
        desc.anchor.set(0.5, 0);
        desc.style.wordWrapWidth = cardW - 24;
        desc.style.align = "center";
        desc.position.set(cardW / 2, 108);
        tag.position.set((cardW - tag.w) / 2, cardH - tag.h - 12);
        c.position.set(x0 + i * (cardW + gap), y0);
      }
      c.pivot.set(0, 0);
    });
  }

  // ── per-frame ───────────────────────────────────────────────────────────

  update(dt: number): void {
    const r = this.round;
    if (!r) return;
    this.time += dt;
    const set = (t: BitmapText, v: string) => {
      if (t.text !== v) t.text = v;
    };
    set(this.heightText, String(r.height));
    set(this.scoreText, `${r.score.toLocaleString("ru-RU")} очков`);
    this.shaiPill.set(r.shai.toLocaleString("ru-RU"));
    this.studentPill.set(r.students.toLocaleString("ru-RU"));
    const right = this.w - this.pauseBtn.buttonWidth - 16;
    this.shaiPill.position.set(right - this.shaiPill.w - this.studentPill.w - 6, 14);
    this.studentPill.position.set(right - this.studentPill.w, 14);
    // stability
    const pct = Math.max(0, Math.min(1, r.stability / r.maxStability));
    this.stabFill.width = Math.max(12, this.stabTrack.width * pct);
    this.stabFill.tint = pct > 0.6 ? 0x4fd08a : pct > 0.3 ? 0xffd75e : 0xe04848;
    this.stabFill.alpha = r.danger ? 0.7 + 0.3 * Math.sin(this.time * 12) : 1;
    set(this.stabNum, String(Math.round(r.stability)));
    this.shieldIcon.visible = r.shields > 0;
    this.shieldText.visible = r.shields > 0;
    set(this.shieldText, `×${r.shields}`);
    this.lives.forEach((l, i) => (l.alpha = i < r.lives ? 1 : 0.18));
    // mode / event / mission chips under the mode label
    const narrow = this.w < 520;
    const midX = this.w / 2;
    // Narrow phones: mode label and chips go under the stability bar, left of the next-room card
    const chipMaxW = narrow ? this.w - 130 : this.w * 0.5;
    const chipX = (cw: number) => (narrow ? 10 : midX - cw / 2);
    if (narrow) this.modeLabel.position.set(12, this.stab.y + 38);
    else this.modeLabel.position.set(midX - this.modeLabel.width / 2, 10);
    let chipY = narrow ? this.stab.y + 56 : 30;
    const evText = r.event ? `${EVENTS[r.event.id].name} · ещё ${r.event.left}` : r.mission?.constantWind ? "Ветреный день" : "";
    this.eventChip.visible = !!evText;
    if (evText) {
      if (this.eventChip.glyph) this.eventChip.glyph.texture = icon(r.event ? EVENT_ICON[r.event.id] : "wind");
      this.eventChip.set(evText, chipMaxW);
      this.eventChip.position.set(chipX(this.eventChip.w), chipY);
      chipY += this.eventChip.h + 4;
    }
    this.missionChip.visible = !!r.mission;
    if (r.mission) {
      this.missionChip.set(r.mission.check(r).progress, chipMaxW);
      this.missionChip.position.set(chipX(this.missionChip.w), chipY);
    }
    // next room
    const nk = `${r.nextType}`;
    if (nk !== this.nextKey) {
      this.nextKey = nk;
      const room = ROOMS[r.nextType];
      const art = this.bank.room(r.nextType, 190 * room.widthK, r.cfg.cosmetics.facade, r.cfg.cosmetics.ornament, r.cfg.faculty);
      this.nextThumb.texture = art.tex;
      const maxW = this.nextBg.width - 16;
      const k = maxW / art.tex.width;
      this.nextThumb.scale.set(k);
      this.nextThumb.anchor.set(0.5, 0.5);
      this.nextName.text = room.name;
      this.nextName.position.set((this.nextBg.width - this.nextName.width) / 2, this.nextBg.height - 22);
      this.nextFrame.tint = hex(RARITY_COLOR[room.rarity]);
    }
    // combo
    if (r.combo !== this.lastCombo) {
      if (r.combo > this.lastCombo) this.comboPop = 1;
      this.lastCombo = r.combo;
    }
    this.combo.visible = r.combo >= 2;
    if (this.combo.visible) {
      set(this.comboText, `×${r.combo}`);
      set(this.comboLabel, r.shabytLevel > 0 ? "ШАБЫТ" : "КОМБО");
      this.comboLabel.position.set(0, 36);
      const shab = r.shabytLevel > 0;
      this.comboText.tint = shab ? 0xffb347 : 0xffd75e;
      this.comboText.filters = shab ? [this.comboGlow] : [];
      this.comboGlow.outerStrength = 1.5 + Math.sin(this.time * 6) * 0.8;
      this.comboPop = Math.max(0, this.comboPop - dt * 4);
      this.combo.scale.set(1 + this.comboPop * 0.35);
    }
    // synergy pills
    let py = 0;
    for (const p of this.pillPool) {
      if (!p.c.visible) continue;
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.t += dt;
      const k = p.t / 1.8;
      p.c.alpha = k < 0.15 ? k / 0.15 : k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : 1;
      p.c.position.set(-p.c.w / 2, py - p.t * 14);
      py += p.c.h + 6;
      if (p.t > 1.8) p.c.visible = false;
    }
    // active bonuses row
    const chips: [IconName, string][] = [];
    if (r.eff.teaBreak) chips.push(["cup", String(r.eff.teaBreak)]);
    if (r.eff.wideCrane) chips.push(["crane", String(r.eff.wideCrane)]);
    if (r.eff.magnet) chips.push(["magnet", String(r.eff.magnet)]);
    if (r.eff.garland) chips.push(["lantern", String(r.eff.garland)]);
    if (r.eff.facultySpirit) chips.push(["flag", String(r.eff.facultySpirit)]);
    if (r.eff.windbreak) chips.push(["tree", ""]);
    if (r.eff.antiDeadline) chips.push(["calendar", ""]);
    if (r.eff.balcony) chips.push(["columns", ""]);
    const bk = chips.map((c) => c.join(":")).join("|");
    if (bk !== this.bonusKey) {
      this.bonusKey = bk;
      this.bonusRow.removeChildren().forEach((c) => c.destroy({ children: true }));
      let x = 0;
      for (const [ic, n] of chips) {
        const chip = new Chip(this.skin, ic, 13);
        chip.set(n || "·");
        chip.position.set(x, 0);
        x += chip.w + 4;
        this.bonusRow.addChild(chip);
      }
    }
    // crown button
    this.crownBtn.visible = r.canCrown;
    // banner fade
    if (this.banner.visible) {
      this.bannerT += dt;
      const pop = Math.min(1, this.bannerT / 0.25);
      this.banner.scale.set(0.85 + 0.15 * (1 - Math.pow(1 - pop, 3)));
      this.banner.alpha = this.bannerT > this.bannerDur - 0.3 ? Math.max(0, (this.bannerDur - this.bannerT) / 0.3) : pop;
      if (this.bannerT > this.bannerDur) this.banner.visible = false;
    }
    // hint bob
    if (this.hint.visible && this.w >= 520) this.hint.y = 134 + Math.sin(this.time * 4.5) * 3;
    // offer animation & focus
    if (this.offer.visible) {
      this.offerT += dt;
      this.offerCards.forEach((card, i) => {
        const appear = Math.min(1, Math.max(0, (this.offerT - i * 0.06) / 0.25));
        const focused = this.offerFocus === i;
        card.frame.alpha = card.hover || focused ? 1 : 0.5;
        card.frame.tint = focused ? 0xffd75e : 0xf2b84b;
        card.c.alpha = appear;
        const lift = (card.hover || focused ? -4 : 0) + (1 - appear) * 16;
        card.c.pivot.y = -lift;
      });
    }
  }
}
