/** Спільні типи ядер емуляторів. Ядра не знають про DOM: UI лише викликає step() і малює стан. */

/** Стан самої машини. «Перевищено ліміт кроків» — результат запуску, а не стан машини. */
export type MachineStatus = 'running' | 'halted' | 'crashed';

/** Результат запуску: машина працює далі, зупинилася, аварійно зупинилася або вичерпала ліміт. */
export type RunStatus = MachineStatus | 'step-limit';

export interface BaseState {
  readonly status: MachineStatus;
  /** Кількість виконаних кроків. */
  readonly steps: number;
  /** Причина аварійної зупинки (українською). */
  readonly error?: string;
}

/** Повідомлення парсера. `line` — номер рядка (від 1), 0 — програма загалом. */
export interface ParseMessage {
  line: number;
  message: string;
}

export type ParseResult<T> =
  | { ok: true; value: T; warnings: ParseMessage[] }
  | { ok: false; errors: ParseMessage[]; warnings: ParseMessage[] };

export interface StepResult<S extends BaseState, P, E> {
  state: S;
  status: MachineStatus;
  steps: number;
  /** Поточна позиція в програмі (що підсвічувати). */
  position: P | null;
  error?: string;
  /** Що сталося на цьому кроці — для журналу. Немає, якщо крок не виконувався. */
  event?: E;
}

export interface RunOptions<S extends BaseState, P, E> {
  /** Загальний ліміт кроків: запуск зупиняється, щойно `state.steps` досягає цього числа. */
  maxSteps: number;
  onStep?: (result: StepResult<S, P, E>) => void;
}

export interface RunResult<S extends BaseState, P> {
  state: S;
  status: RunStatus;
  steps: number;
  position: P | null;
  error?: string;
}

/** Виконує кроки до зупинки, аварії або ліміту. Спільна реалізація `run()` для всіх машин. */
export function runSteps<S extends BaseState, P, E>(
  step: (state: S) => StepResult<S, P, E>,
  positionOf: (state: S) => P | null,
  state: S,
  { maxSteps, onStep }: RunOptions<S, P, E>,
): RunResult<S, P> {
  let current = state;
  while (current.status === 'running') {
    if (current.steps >= maxSteps) {
      return {
        state: current,
        status: 'step-limit',
        steps: current.steps,
        position: positionOf(current),
      };
    }
    const result = step(current);
    onStep?.(result);
    current = result.state;
  }
  return {
    state: current,
    status: current.status,
    steps: current.steps,
    position: positionOf(current),
    ...(current.error ? { error: current.error } : {}),
  };
}
