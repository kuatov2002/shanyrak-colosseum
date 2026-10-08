// UI motion helpers: list stagger on mount and number tweens. Everything respects reduced motion
// (the .reduced-motion class on <html> or the OS setting) by jumping straight to the end state.

const ITEMS =
  ".mode-card, .home-card, .board-row, .list-card, .wallet-option, .mission-list > *, .grid-cards > *, .faculty-grid > *, .streak-grid > *, .season-ladder > *";

export function reducedMotion(): boolean {
  return (
    document.documentElement.classList.contains("reduced-motion") ||
    (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

/** Items of each list slide in one after another, 30 ms apart (first 14 per list). */
export function stagger(root: HTMLElement, step = 30, max = 14): void {
  if (reducedMotion()) return;
  const index = new Map<Element, number>();
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(ITEMS))) {
    const parent = el.parentElement;
    if (!parent) continue;
    const i = index.get(parent) ?? 0;
    index.set(parent, i + 1);
    if (i >= max) continue;
    el.style.setProperty("--stagger", `${i * step}ms`);
    el.classList.add("stagger");
    // drop the class afterwards so hover/press transforms work again
    el.addEventListener("animationend", () => el.classList.remove("stagger"), { once: true });
  }
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const running = new WeakMap<HTMLElement, number>();

/** Count a number in an element from its current value to `to` over 250–400 ms. */
export function tweenNumber(el: HTMLElement, to: number, format: (n: number) => string = (n) => String(Math.round(n)), ms = 320): void {
  const from = Number(el.dataset.n ?? NaN);
  el.dataset.n = String(to);
  const prev = running.get(el);
  if (prev) cancelAnimationFrame(prev);
  if (!Number.isFinite(from) || from === to || reducedMotion() || document.hidden) {
    el.textContent = format(to);
    return;
  }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = format(from + (to - from) * easeOutCubic(k));
    if (k < 1) running.set(el, requestAnimationFrame(step));
    else running.delete(el);
  };
  running.set(el, requestAnimationFrame(step));
}
