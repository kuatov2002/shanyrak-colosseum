// Sky themes. The sky follows the tower: day at the ground, sunset in the middle, a starry
// night up high — and events tint it (Наурыз warm, session violet, wind stormy).

import type { EventId } from "../gameplay/types";
import { mix } from "./color";

export interface Theme {
  top: string;
  bottom: string;
  far: string;
  mid: string;
  snow: string;
  stars: number;
  lights: number;
  sun: number;
}

const THEMES: Record<string, Theme> = {
  day: { top: "#4b8fd8", bottom: "#c7e7f4", far: "#8aa6cc", mid: "#5f7fa8", snow: "#f4f8ff", stars: 0, lights: 0, sun: 1 },
  sunset: { top: "#3c3f84", bottom: "#f4a06a", far: "#7a6696", mid: "#4f4473", snow: "#ffd9c2", stars: 0.25, lights: 0.5, sun: 0.6 },
  night: { top: "#0b0f2c", bottom: "#2c2f68", far: "#2e3361", mid: "#1c1f42", snow: "#9aa6d6", stars: 1, lights: 1, sun: 0 },
  nauryz: { top: "#3a2a72", bottom: "#ffb36b", far: "#806496", mid: "#5a3f6f", snow: "#ffe1c4", stars: 0.4, lights: 1, sun: 0.4 },
  session: { top: "#0d0820", bottom: "#3b1f63", far: "#30245a", mid: "#1b1335", snow: "#8f7fc0", stars: 0.8, lights: 1, sun: 0 },
  storm: { top: "#27324a", bottom: "#6d7b94", far: "#5d6982", mid: "#424d63", snow: "#dfe6f2", stars: 0, lights: 0.6, sun: 0 },
  menu: { top: "#141a46", bottom: "#d98a6a", far: "#56548a", mid: "#2e2c58", snow: "#f2c9b8", stars: 0.7, lights: 1, sun: 0.25 },
};

function blend(a: Theme, b: Theme, t: number): Theme {
  return {
    top: mix(a.top, b.top, t),
    bottom: mix(a.bottom, b.bottom, t),
    far: mix(a.far, b.far, t),
    mid: mix(a.mid, b.mid, t),
    snow: mix(a.snow, b.snow, t),
    stars: a.stars + (b.stars - a.stars) * t,
    lights: a.lights + (b.lights - a.lights) * t,
    sun: a.sun + (b.sun - a.sun) * t,
  };
}

export function themeFor(height: number, event: EventId | null, menu: boolean, eventK: number): Theme {
  let base: Theme;
  if (menu) base = THEMES.menu;
  else if (height < 8) base = blend(THEMES.day, THEMES.sunset, (height / 8) * 0.35);
  else if (height < 18) base = blend(THEMES.day, THEMES.sunset, 0.35 + ((height - 8) / 10) * 0.65);
  else if (height < 28) base = blend(THEMES.sunset, THEMES.night, (height - 18) / 10);
  else base = THEMES.night;
  if (event && eventK > 0) {
    const target = event === "nauryz" ? THEMES.nauryz : event === "session" ? THEMES.session : event === "wind" ? THEMES.storm : null;
    if (target) base = blend(base, target, eventK * (event === "wind" ? 0.55 : 0.85));
  }
  return base;
}
