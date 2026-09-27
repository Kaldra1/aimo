/**
 * Керування виконанням для UI: крок, пуск із заданою швидкістю, пауза, скидання, ліміт кроків
 * і журнал останніх кроків. Не залежить від фреймворку; UI підписується на зміни.
 */
import type { BaseState, RunOptions, RunResult, StepResult } from './types';

/** Швидкість «миттєво»: кроки виконуються пачками без анімації. */
export const INSTANT = Number.POSITIVE_INFINITY;

export interface RunnerMachine<S extends BaseState, P, E> {
  step(state: S): StepResult<S, P, E>;
  run(state: S, options: RunOptions<S, P, E>): RunResult<S, P>;
}

export interface RunnerSnapshot<S, E> {
  /** Поточний стан машини; null — програма з помилками, запускати нічого. */
  readonly state: S | null;
  /** Останні кроки (не більше logCapacity). */
  readonly log: readonly E[];
  /** Скільки кроків записано в журнал від останнього скидання. */
  readonly logged: number;
  /** Чи йде автоматичне виконання. */
  readonly playing: boolean;
  readonly limit: number;
  /** Машина ще працює, але ліміт кроків вичерпано. */
  readonly limitReached: boolean;
}

export interface Scheduler {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

const timerScheduler: Scheduler = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface RunnerOptions {
  limit: number;
  /** Кроків за секунду або INSTANT. */
  speed: number;
  logCapacity?: number;
  /** Скільки кроків виконувати за один раз у режимі «миттєво». */
  chunkSize?: number;
  scheduler?: Scheduler;
}

export class MachineRunner<S extends BaseState, P, E> {
  private snapshot: RunnerSnapshot<S, E>;
  private speed: number;
  private handle: unknown = null;
  private readonly listeners = new Set<() => void>();
  private readonly logCapacity: number;
  private readonly chunkSize: number;
  private readonly scheduler: Scheduler;

  constructor(
    private readonly machine: RunnerMachine<S, P, E>,
    initial: S | null,
    options: RunnerOptions,
  ) {
    this.speed = options.speed;
    this.logCapacity = options.logCapacity ?? 300;
    this.chunkSize = options.chunkSize ?? 5_000;
    this.scheduler = options.scheduler ?? timerScheduler;
    this.snapshot = this.build(
      { state: initial, log: [], logged: 0, playing: false },
      options.limit,
    );
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): RunnerSnapshot<S, E> {
    return this.snapshot;
  }

  /** Новий початковий стан (після зміни програми чи вхідних даних або кнопки «Скинути»). */
  reset(state: S | null): void {
    this.cancelTimer();
    this.update({ state, log: [], logged: 0, playing: false });
  }

  setLimit(limit: number): void {
    const value = Math.max(1, Math.floor(limit));
    this.snapshot = this.build(this.snapshot, value);
    if (this.snapshot.playing && !this.canContinue()) this.pause();
    else this.emit();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.snapshot.playing) {
      this.cancelTimer();
      this.schedule();
    }
  }

  /** Один крок. Під час автоматичного виконання спершу ставить на паузу. */
  stepOnce(): void {
    if (this.snapshot.playing) this.pause();
    if (!this.canContinue()) return;
    this.advance(1);
  }

  play(): void {
    if (this.snapshot.playing || !this.canContinue()) return;
    this.update({ playing: true });
    this.schedule();
  }

  pause(): void {
    this.cancelTimer();
    if (this.snapshot.playing) this.update({ playing: false });
  }

  dispose(): void {
    this.cancelTimer();
    this.listeners.clear();
  }

  private canContinue(): boolean {
    const { state, limit } = this.snapshot;
    return state !== null && state.status === 'running' && state.steps < limit;
  }

  private schedule(): void {
    const delay = this.speed === INSTANT ? 0 : Math.max(1, Math.round(1000 / this.speed));
    this.handle = this.scheduler.set(() => {
      this.handle = null;
      this.advance(this.speed === INSTANT ? this.chunkSize : 1);
      if (this.snapshot.playing) {
        if (this.canContinue()) this.schedule();
        else this.update({ playing: false });
      }
    }, delay);
  }

  private cancelTimer(): void {
    if (this.handle !== null) {
      this.scheduler.clear(this.handle);
      this.handle = null;
    }
  }

  /** Виконує до `count` кроків, не перевищуючи ліміт, і дописує їх у журнал. */
  private advance(count: number): void {
    const { state, limit } = this.snapshot;
    if (state === null) return;
    const events: E[] = [];
    const result = this.machine.run(state, {
      maxSteps: Math.min(limit, state.steps + count),
      onStep: (step) => {
        if (step.event !== undefined) events.push(step.event);
      },
    });
    const log =
      events.length >= this.logCapacity
        ? events.slice(-this.logCapacity)
        : [...this.snapshot.log, ...events].slice(-this.logCapacity);
    this.update({ state: result.state, log, logged: this.snapshot.logged + events.length });
  }

  private update(changes: Partial<Omit<RunnerSnapshot<S, E>, 'limit' | 'limitReached'>>): void {
    this.snapshot = this.build({ ...this.snapshot, ...changes }, this.snapshot.limit);
    this.emit();
  }

  private build(
    values: Pick<RunnerSnapshot<S, E>, 'state' | 'log' | 'logged' | 'playing'>,
    limit: number,
  ): RunnerSnapshot<S, E> {
    const { state } = values;
    const limitReached = state !== null && state.status === 'running' && state.steps >= limit;
    return { ...values, limit, limitReached };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
