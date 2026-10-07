// requestAnimationFrame loop with a fixed simulation step (stable physics on 60/120/144 Hz screens)
// and variable-rate rendering. Pauses itself when the tab is hidden.

export interface LoopHooks {
  update(dt: number): void;
  render(alpha: number, frameDt: number): void;
}

export class GameLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  readonly step = 1 / 120;

  private readonly onVisibility = () => {
    if (document.hidden) this.stop();
    else if (this.wanted) this.start();
  };
  private wanted = false;

  constructor(private readonly hooks: LoopHooks) {
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  dispose(): void {
    this.wanted = false;
    this.stop();
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  start(): void {
    this.wanted = true;
    if (this.running || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const frame = (now: number) => {
      if (!this.running) return;
      const frameDt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.acc += frameDt;
      let steps = 0;
      while (this.acc >= this.step && steps < 24) {
        this.hooks.update(this.step);
        this.acc -= this.step;
        steps++;
      }
      if (steps >= 24) this.acc = 0;
      this.hooks.render(this.acc / this.step, frameDt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Stop ticking; pass pause=true when the host suspends the game (it stays stopped until start()). */
  stop(pause = false): void {
    if (pause) this.wanted = false;
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get isRunning(): boolean {
    return this.running;
  }
}
