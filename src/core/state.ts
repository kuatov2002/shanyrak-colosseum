// App state container: the save (persistent) + session flags (not persisted). Every change goes
// through mutate() so the UI re-renders and the save is written exactly once per change burst.

import { Emitter } from "./emitter";
import { defaultSave, type SaveData, type SaveStore } from "./save";

export interface SessionState {
  online: "offline" | "connecting" | "online";
  onlineError: string | null;
  userId: string | null;
  lastResult: unknown;
}

export class Store {
  data: SaveData;
  session: SessionState = { online: "offline", onlineError: null, userId: null, lastResult: null };
  readonly changed = new Emitter<void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly storage: SaveStore) {
    this.data = storage.load() ?? defaultSave();
    this.storage.save(this.data);
  }

  mutate(fn: (d: SaveData) => void): void {
    fn(this.data);
    this.scheduleSave();
    this.changed.emit();
  }

  setSession(patch: Partial<SessionState>): void {
    Object.assign(this.session, patch);
    this.changed.emit();
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.storage.save(this.data);
  }

  reset(): void {
    this.storage.clear();
    this.data = defaultSave();
    this.flush();
    this.changed.emit();
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.storage.save(this.data);
    }, 250);
  }
}
