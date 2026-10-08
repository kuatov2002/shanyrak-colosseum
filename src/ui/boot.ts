// Loading screen: progress bar with percent and rotating tips. The markup lives in index.html so it
// shows before any JS arrives; the boot sequence reports real stages (fonts, WebGL, baking, first
// frame) and the screen fades out once the first frame is on screen.

const TIPS = [
  "Тапните, когда комната над башней",
  "«Идеально» подряд включает Шабыт",
  "Чайхана рядом с общагой приносит $SHAI",
  "Сады гасят ветер с гор",
  "Каждую башню венчает шанырак",
  "Кошелёк не нужен, чтобы играть",
];

let shown = 0;
let tipTimer: ReturnType<typeof setInterval> | null = null;

function el<T extends HTMLElement>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

function startTips(): void {
  if (tipTimer) return;
  const tip = el("#boot .boot-tip");
  if (!tip) return;
  let i = Math.floor(Math.random() * TIPS.length);
  tip.textContent = TIPS[i];
  tipTimer = setInterval(() => {
    i = (i + 1) % TIPS.length;
    tip.classList.remove("in");
    void tip.offsetWidth;
    tip.textContent = TIPS[i];
    tip.classList.add("in");
  }, 2200);
}

/** Report boot progress (0..1) with an optional stage label. Never goes backwards. */
export function bootProgress(p: number, label?: string): void {
  startTips();
  shown = Math.max(shown, Math.min(1, p));
  const bar = el("#boot .boot-bar i");
  const pct = el("#boot .boot-pct");
  const stage = el("#boot .boot-stage");
  if (bar) bar.style.transform = `scaleX(${shown})`;
  if (pct) pct.textContent = `${Math.round(shown * 100)}%`;
  if (stage && label) stage.textContent = label;
}

/** First frame is on screen: finish the bar and fade the loader out. */
export function bootDone(): void {
  bootProgress(1, "Готово");
  if (tipTimer) clearInterval(tipTimer);
  tipTimer = null;
  const boot = document.getElementById("boot");
  if (!boot) return;
  boot.classList.add("done");
  setTimeout(() => boot.remove(), 420);
}
