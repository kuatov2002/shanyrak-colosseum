export type Listener<T> = (payload: T) => void;

/** Minimal typed event emitter used by the round simulation, store and wallet. */
export class Emitter<T> {
  private listeners = new Set<Listener<T>>();
  on(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(payload: T): void {
    for (const fn of [...this.listeners]) {
      try {
        fn(payload);
      } catch (err) {
        console.error("[emitter] listener failed", err);
      }
    }
  }
  clear(): void {
    this.listeners.clear();
  }
}
