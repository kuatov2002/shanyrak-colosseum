// Analytics: a tiny event log kept in memory (visible in Settings for transparency) and forwarded
// to iDos custom events when the player is online and has not opted out.

import type { Backend } from "../platform/backend";

export interface LoggedEvent {
  name: string;
  params: Record<string, string | number | boolean>;
  value?: number;
  at: number;
}

export class Analytics {
  readonly log: LoggedEvent[] = [];
  enabled = true;
  constructor(private backend: () => Backend) {}

  track(name: string, params: Record<string, string | number | boolean> = {}, value?: number): void {
    this.log.unshift({ name, params, value, at: Date.now() });
    if (this.log.length > 40) this.log.pop();
    if (this.enabled) this.backend().logEvent(name, params, value);
  }
}
