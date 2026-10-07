// WebGL button: shared 9-slice skin with normal / hover / pressed / focus states.
// Hover only for real mouse pointers (touch devices never get stuck in hover).

import { BitmapText, Container, NineSliceSprite, Sprite, type FederatedPointerEvent } from "pixi.js";
import { BTN, type ButtonKind, type ButtonState, type Skin } from "../../design/skin";
import { icon as iconTex, type IconName } from "../../design/icons";
import { HUD_TEXT } from "./fonts";

export interface ButtonOptions {
  icon?: IconName;
  fontSize?: number;
  height?: number;
  minWidth?: number;
  paddingX?: number;
}

export class PixiButton extends Container {
  private bg: NineSliceSprite;
  private caption: BitmapText;
  private glyph: Sprite | null = null;
  private stateNow: ButtonState = "normal";
  private hovering = false;
  private focused = false;
  private pressing = false;
  enabled = true;
  onTap: (() => void) | null = null;

  constructor(
    private readonly skin: Skin,
    private readonly kind: ButtonKind,
    text: string,
    private readonly opts: ButtonOptions = {},
  ) {
    super();
    this.bg = new NineSliceSprite({
      texture: skin.button(kind, "normal"),
      leftWidth: BTN.slice,
      rightWidth: BTN.slice,
      topHeight: BTN.slice,
      bottomHeight: BTN.slice,
    });
    this.caption = new BitmapText({ text, style: { fontFamily: HUD_TEXT, fontSize: opts.fontSize ?? 16 } });
    this.caption.tint = kind === "gold" ? 0x2a1a05 : 0xfbf3e2;
    this.addChild(this.bg);
    if (opts.icon) {
      this.glyph = new Sprite(iconTex(opts.icon));
      this.glyph.anchor.set(0.5);
      this.addChild(this.glyph);
    }
    this.addChild(this.caption);
    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointerover", (e: FederatedPointerEvent) => {
      if (e.pointerType === "mouse") {
        this.hovering = true;
        this.refresh();
      }
    });
    this.on("pointerout", () => {
      this.hovering = false;
      this.pressing = false;
      this.refresh();
    });
    this.on("pointerdown", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (!this.enabled) return;
      this.pressing = true;
      this.refresh();
    });
    this.on("pointerup", () => {
      this.pressing = false;
      this.refresh();
    });
    this.on("pointerupoutside", () => {
      this.pressing = false;
      this.refresh();
    });
    this.on("pointertap", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this.enabled) this.onTap?.();
    });
    this.layoutSelf();
  }

  setText(text: string): void {
    if (this.caption.text === text) return;
    this.caption.text = text;
    this.layoutSelf();
  }

  setFocused(f: boolean): void {
    this.focused = f;
    this.refresh();
  }

  setEnabled(e: boolean): void {
    this.enabled = e;
    this.alpha = e ? 1 : 0.45;
    this.cursor = e ? "pointer" : "default";
  }

  get buttonWidth(): number {
    return this.bg.width;
  }

  get buttonHeight(): number {
    return this.bg.height;
  }

  private refresh(): void {
    const s: ButtonState = this.pressing ? "pressed" : this.focused ? "focus" : this.hovering ? "hover" : "normal";
    if (s === this.stateNow) return;
    this.stateNow = s;
    this.bg.texture = this.skin.button(this.kind, s);
    const dy = s === "pressed" ? 2 : 0;
    this.caption.y = this.labelY + dy;
    if (this.glyph) this.glyph.y = this.labelY + this.caption.height / 2 + dy;
  }

  private labelY = 0;

  private layoutSelf(): void {
    const h = this.opts.height ?? 44;
    const padX = this.opts.paddingX ?? 16;
    const iconW = this.glyph ? 24 : 0;
    const gap = this.glyph && this.caption.text ? 6 : 0;
    const contentW = iconW + gap + (this.caption.text ? this.caption.width : 0);
    const w = Math.max(this.opts.minWidth ?? 0, contentW + padX * 2);
    this.bg.width = w;
    this.bg.height = h;
    const x0 = (w - contentW) / 2;
    const bodyH = h - BTN.lip;
    this.labelY = (bodyH - this.caption.height) / 2;
    if (this.glyph) {
      this.glyph.width = 24;
      this.glyph.height = 24;
      this.glyph.x = x0 + 12;
      this.glyph.y = bodyH / 2;
    }
    this.caption.x = x0 + iconW + gap;
    this.caption.y = this.labelY;
  }
}
