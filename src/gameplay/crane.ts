// The crane: a room hangs on a cable and swings side to side above the tower. Speed and amplitude
// grow with height; wind adds amplitude and a slow drift; "Чайный перерыв" slows it right down.

import { BALANCE } from "../config/balance";

export interface CraneParams {
  floor: number;
  endless: boolean;
  slowSwingLevel: number;
  teaBreak: boolean;
  wind: number; // 0..1 effective wind strength
  tutorial: boolean;
}

export class Crane {
  phase = Math.PI / 2;
  x = 0;
  vx = 0;
  center = 0;
  omega: number = BALANCE.crane.omegaBase;
  amp: number = BALANCE.crane.ampBase;
  /** Visual tilt of the hanging room (pendulum feel). */
  tilt = 0;
  private windT = 0;

  reset(center: number, startPhase: number): void {
    this.center = center;
    this.phase = startPhase;
    this.x = center + this.amp * Math.sin(this.phase);
    this.vx = 0;
  }

  configure(p: CraneParams): void {
    const c = BALANCE.crane;
    const growth = p.endless ? c.endlessGrowthK : 1;
    let omega = Math.min(c.omegaMax, c.omegaBase + c.omegaPerFloor * p.floor * growth);
    let amp = Math.min(c.ampMax, c.ampBase + c.ampPerFloor * p.floor);
    if (p.floor < c.gentleFloors || p.tutorial) {
      omega *= c.gentleOmegaK;
      amp *= c.gentleAmpK;
    }
    if (p.tutorial) omega *= 0.85;
    omega *= 1 - c.slowSwingPerLevel * p.slowSwingLevel;
    if (p.teaBreak) omega *= c.teaBreakK;
    amp += BALANCE.events.windAmpAdd * p.wind;
    this.omega = omega;
    this.amp = amp;
  }

  update(dt: number, wind: number, windDir: number): void {
    this.windT += dt;
    this.phase += this.omega * dt;
    const drift = wind * windDir * 22 * Math.sin(this.windT * 0.7);
    const prev = this.x;
    this.x = this.center + this.amp * Math.sin(this.phase) + drift;
    this.vx = (this.x - prev) / dt;
    this.tilt = -Math.cos(this.phase) * 0.06 * Math.min(1, this.omega / 2) + wind * windDir * 0.04;
  }
}
