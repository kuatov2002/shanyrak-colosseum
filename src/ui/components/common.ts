// Shared UI pieces: buttons, progress bars, toasts, modals, rarity badges, reward chips.

import { RARITY_COLOR, RARITY_LABEL, type Rarity } from "../../meta/rooms";
import { emptyArt, type IconName } from "../../design/glyphs";
import { append, clear, h } from "../dom";
import { stagger } from "../motion";

export function button(
  label: string | Node | (string | Node)[],
  onClick: () => void,
  opts: { kind?: "primary" | "gold" | "ghost" | "danger" | "soft"; disabled?: boolean; big?: boolean; title?: string; cls?: string } = {},
): HTMLButtonElement {
  const b = h(`button.btn.btn-${opts.kind ?? "soft"}`, {
    type: "button",
    disabled: opts.disabled,
    title: opts.title,
    class: [opts.big ? "btn-big" : "", opts.cls ?? ""].join(" ").trim() || undefined,
    onclick: (e: Event) => {
      e.stopPropagation();
      if (!b.disabled) onClick();
    },
  });
  // through the DOM helper, so emoji in labels become the shared vector icons
  append(b, Array.isArray(label) ? label : [label]);
  return b;
}

export function bar(value: number, max: number, color = "var(--gold)", cls = ""): HTMLElement {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return h(`div.bar${cls ? `.${cls}` : ""}`, null, h("div.bar-fill", { style: { width: `${pct}%`, background: color } }));
}

export function rarityBadge(r: Rarity): HTMLElement {
  return h("span.rarity", { style: { color: RARITY_COLOR[r], borderColor: RARITY_COLOR[r] } }, RARITY_LABEL[r]);
}

export function chip(text: string, cls = ""): HTMLElement {
  return h(`span.chip${cls ? `.${cls}` : ""}`, null, text);
}

/** One-line "what is this screen" header shared by every hub screen. */
/** Screen header: the icon in a felt medallion, the title in the display face, one line of help. */
export function screenIntro(icon: string, title: string, text: string): HTMLElement {
  return h(
    "header.screen-head",
    null,
    h("span.sh-medal", { "aria-hidden": "true" }, icon),
    h("div.sh-text", null, h("h2", null, title), h("p", null, text)),
  );
}

export function sectionTitle(text: string, sub?: string): HTMLElement {
  return h("div.section-title", null, h("h2", null, text), sub ? h("p.muted", null, sub) : null);
}

// ── Toasts ────────────────────────────────────────────────────────────────

let toastRoot: HTMLElement | null = null;

export function toast(text: string, kind: "info" | "success" | "reward" | "warn" | "error" = "info", icon?: string): void {
  if (!toastRoot) {
    toastRoot = h("div.toasts", { "aria-live": "polite" });
    document.body.appendChild(toastRoot);
  }
  const el = h(`div.toast.toast-${kind}`, null, icon ? h("span.toast-icon", null, icon) : null, h("span", null, text));
  toastRoot.appendChild(el);
  setTimeout(() => el.classList.add("out"), 3200);
  setTimeout(() => el.remove(), 3700);
}

// ── Modal / bottom sheet ──────────────────────────────────────────────────

export interface ModalHandle {
  close(): void;
  body: HTMLElement;
}

// Open dialogs, topmost last. Escape and the Tab focus trap act on the top one only.
const openModals: { panel: HTMLElement; escape: () => void }[] = [];
let modalSeq = 0;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Capture phase on document: runs before the game's window keydown handler, so Esc in a dialog
// never also pauses or drops a room.
function onModalKey(e: KeyboardEvent): void {
  const top = openModals[openModals.length - 1];
  if (!top) return;
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    top.escape();
  } else if (e.key === "Tab") {
    const items = Array.from(top.panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    const active = document.activeElement;
    if (!items.length) {
      e.preventDefault();
      top.panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const outside = !top.panel.contains(active);
    if (e.shiftKey && (active === first || active === top.panel || outside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || outside)) {
      e.preventDefault();
      first.focus();
    }
  }
}

/**
 * Accessible dialog: role="dialog" + aria-modal, focus moves inside and is trapped, Escape closes
 * it (or calls `onEscape` for non-dismissable dialogs such as pause), focus returns to the opener.
 */
export function modal(
  title: string,
  content: (body: HTMLElement, close: () => void) => void,
  opts: { dismissable?: boolean; cls?: string; onEscape?: () => void } = {},
): ModalHandle {
  const body = h("div.modal-body");
  const titleId = `modal-title-${++modalSeq}`;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    const i = openModals.indexOf(entry);
    if (i >= 0) openModals.splice(i, 1);
    if (!openModals.length) document.removeEventListener("keydown", onModalKey, true);
    root.classList.add("out");
    setTimeout(() => root.remove(), 220);
    if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
  };
  const panel = h(
    `div.modal${opts.cls ? `.${opts.cls}` : ""}`,
    { role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, tabindex: "-1", onclick: (e: Event) => e.stopPropagation() },
    h("div.modal-head", null, h("h3", { id: titleId }, title), opts.dismissable === false ? null : h("button.icon-btn.modal-close", { type: "button", "aria-label": "Закрыть", onclick: close }, "✕")),
    body,
  );
  const root = h("div.modal-backdrop", { onclick: () => opts.dismissable !== false && close() }, panel);
  const entry = { panel, escape: () => (opts.onEscape ? opts.onEscape() : opts.dismissable !== false ? close() : undefined) };
  openModals.push(entry);
  if (openModals.length === 1) document.addEventListener("keydown", onModalKey, true);
  document.body.appendChild(root);
  content(body, close);
  stagger(body);
  // Content may focus its primary action itself (pause does); otherwise focus the dialog.
  if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
  return { close, body };
}

/** Empty state: an illustration from the icon set, what will appear here, and one way forward. */
export function emptyState(
  iconName: IconName,
  title: string,
  text: string,
  action?: { label: string; onClick: () => void; kind?: "primary" | "gold" | "soft" },
): HTMLElement {
  return h(
    "div.empty-state",
    { role: "status" },
    h("div.empty-art", { html: emptyArt(iconName) }),
    h("b.empty-title", null, title),
    h("p.empty-text", null, text),
    action ? button(action.label, action.onClick, { kind: action.kind ?? "gold" }) : null,
  );
}

export function refreshInto(el: HTMLElement, build: () => Node): void {
  clear(el);
  el.appendChild(build());
}

/** Small koshkar-muiz ornament divider (inline SVG). */
export function ornamentDivider(): HTMLElement {
  const el = h("div.ornament-divider", { "aria-hidden": "true" });
  el.innerHTML = `<svg viewBox="0 0 120 16" width="120" height="16"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 8 H40"/><path d="M80 8 H118"/><path d="M60 14 V8 C60 2 50 2 50 8 C50 12 55 12 55 9"/><path d="M60 8 C60 2 70 2 70 8 C70 12 65 12 65 9"/><circle cx="45" cy="8" r="1.6" fill="currentColor"/><circle cx="75" cy="8" r="1.6" fill="currentColor"/></g></svg>`;
  return el;
}

/** Shanyrak emblem used in the logo (inline SVG; respectful, purely decorative). */
export function shanyrakEmblem(size = 64): HTMLElement {
  const el = h("div.emblem", { "aria-hidden": "true", style: { width: `${size}px`, height: `${size}px` } });
  el.innerHTML = `<svg viewBox="0 0 64 64" width="${size}" height="${size}">
    <defs><radialGradient id="eg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f2b84b" stop-opacity="0"/></radialGradient></defs>
    <circle cx="32" cy="32" r="31" fill="url(#eg)" opacity=".55"/>
    <circle cx="32" cy="32" r="20" fill="#2a1d4a" stroke="#f2b84b" stroke-width="4"/>
    <g stroke="#f2b84b" stroke-width="2.4" fill="none" stroke-linecap="round">
      <path d="M17 26 Q32 18 47 26"/><path d="M14 32 Q32 24 50 32"/><path d="M17 38 Q32 30 47 38"/>
      <path d="M26 15 Q20 32 26 49"/><path d="M32 12 Q26 32 32 52"/><path d="M38 15 Q32 32 38 49"/>
    </g>
    <g stroke="#c98a1b" stroke-width="2" stroke-linecap="round">
      ${Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x1 = 32 + Math.cos(a) * 23;
        const y1 = 32 + Math.sin(a) * 23;
        const x2 = 32 + Math.cos(a) * 29;
        const y2 = 32 + Math.sin(a) * 29;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
      }).join("")}
    </g></svg>`;
  return el;
}
