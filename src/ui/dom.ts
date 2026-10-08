// Tiny DOM helper: h("div.card", { onclick }, child, …). No framework — screens rebuild their
// content on state changes, which is plenty for menus of this size.
// Text children go through the icon set: an emoji such as 🪙 or 🏆 in UI copy becomes the matching
// inline SVG icon (design/glyphs.ts), so menus look the same on every OS.

import { EMOJI_RE, iconEl, iconForEmoji } from "../design/glyphs";

type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & { style?: Partial<CSSStyleDeclaration> | string; dataset?: Record<string, string> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K | `${K}.${string}` | `${K}#${string}`, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K];
export function h(spec: string, props?: Props | null, ...children: Child[]): HTMLElement {
  const [tagPart, ...classes] = spec.split(".");
  const [tag, id] = tagPart.split("#");
  const el = document.createElement(tag || "div");
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(" ");
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "style") {
        if (typeof v === "string") el.setAttribute("style", v);
        else Object.assign(el.style, v);
      } else if (k === "dataset") {
        Object.assign(el.dataset, v as Record<string, string>);
      } else if (k === "class" || k === "className") {
        el.className = [el.className, String(v)].filter(Boolean).join(" ");
      } else if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === "html") {
        el.innerHTML = String(v);
      } else if (v === true) {
        el.setAttribute(k, "");
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  append(el, children);
  return el;
}

export function append(el: HTMLElement, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else appendText(el, String(c));
  }
}

/** Append text, swapping known emoji for vector icons. */
function appendText(el: HTMLElement, s: string): void {
  EMOJI_RE.lastIndex = 0;
  if (!EMOJI_RE.test(s)) {
    el.appendChild(document.createTextNode(s));
    return;
  }
  EMOJI_RE.lastIndex = 0;
  let last = 0;
  for (const m of s.matchAll(EMOJI_RE)) {
    const name = iconForEmoji(m[0]);
    if (!name) continue;
    if (m.index > last) el.appendChild(document.createTextNode(s.slice(last, m.index)));
    el.appendChild(iconEl(name));
    last = m.index + m[0].length;
  }
  if (last < s.length) el.appendChild(document.createTextNode(s.slice(last)));
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
