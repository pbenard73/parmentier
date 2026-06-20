type Handler = (...args: any[]) => void;

/** Minimal typed event bus bridging React UI and the Phaser scene. */
class Emitter {
  private map = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): () => void {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  off(event: string, fn: Handler): void {
    this.map.get(event)?.delete(fn);
  }

  emit(event: string, ...args: any[]): void {
    this.map.get(event)?.forEach((fn) => fn(...args));
  }
}

export const EventBus = new Emitter();

export const EVENTS = {
  /** UI -> game: (re)start with a new GameConfig */
  NEW_GAME: 'new-game',
  /** UI -> game: reset current puzzle bridges */
  RESET: 'reset',
  /** UI -> game: undo last move */
  UNDO: 'undo',
  /** UI -> game: compute & highlight the next teaching hint */
  HINT: 'hint',
  /** UI -> game: play the currently highlighted hint move */
  APPLY_HINT: 'apply-hint',
  /** UI -> game: fill in the full solution */
  SOLVE: 'solve',
  /** UI -> game: toggle child/learning mode (boolean) */
  KID_MODE: 'kid-mode',
  /** game -> UI: progress update { remaining, total, solved } */
  PROGRESS: 'progress',
  /** game -> UI: hint text { text, kind, hasMove } */
  HINT_INFO: 'hint-info',
  /** game -> UI: puzzle solved */
  SOLVED: 'solved',
  /** game -> UI: scene is ready */
  READY: 'ready',
} as const;
