// Game loop on PixiJS's ticker: fixed simulation step (stable physics on 60/120/144 Hz screens),
// variable-rate rendering (Pixi renders right after our high-priority update). The ticker is
// stopped while the tab is hidden and when the host suspends the game.

import type { Ticker } from "pixi.js";
import { UPDATE_PRIORITY } from "pixi.js";

export interface LoopHooks {
  update(dt: number): void;
  /** Called once per rendered frame, before Pixi draws. */
  frame(alpha: number, frameDt: number): void;
}

export class GameLoop {
  private acc = 0;
  private wanted = false;
  readonly step = 1 / 120;
  /** Smoothed frames per second (for diagnostics). */
  fps = 0;

  private readonly tick = () => {
    const frameDt = Math.min(0.1, this.ticker.deltaMS / 1000);
    if (frameDt > 0) this.fps += (1 / frameDt - this.fps) * 0.05;
    this.acc += frameDt;
    let steps = 0;
    while (this.acc >= this.step && steps < 24) {
      this.hooks.update(this.step);
      this.acc -= this.step;
      steps++;
    }
    if (steps >= 24) this.acc = 0;
    this.hooks.frame(this.acc / this.step, frameDt);
  };

  private readonly onVisibility = () => {
    if (document.hidden) this.ticker.stop();
    else if (this.wanted) this.ticker.start();
  };

  constructor(
    private readonly hooks: LoopHooks,
    private readonly ticker: Ticker,
  ) {
    ticker.add(this.tick, undefined, UPDATE_PRIORITY.HIGH);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  start(): void {
    this.wanted = true;
    if (!document.hidden) this.ticker.start();
  }

  /** Stop ticking; pause=true keeps it stopped until start() (host suspend). */
  stop(pause = false): void {
    if (pause) this.wanted = false;
    this.ticker.stop();
  }

  dispose(): void {
    this.wanted = false;
    this.ticker.stop();
    this.ticker.remove(this.tick);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  get isRunning(): boolean {
    return this.ticker.started;
  }
}
