/** Виконання програм машини Тюрінга. Початковий стан — q0; стан незмінний: step() повертає новий. */
import {
  runSteps,
  type BaseState,
  type RunOptions,
  type RunResult,
  type StepResult,
} from '../types';
import { BLANK } from './alphabet';
import { cellKey, type TuringProgram, type TuringRule } from './program';
import { readCell, type TuringTape } from './tape';

export interface TuringState extends BaseState, TuringTape {
  readonly program: TuringProgram;
  /** Поточний стан qᵢ. Після зупинки — стан, у якому спрацювало правило з «!». */
  readonly current: number;
  /** Клітинка таблиці, на якій машина зупинилася або аварійно зупинилася. */
  readonly last?: TuringPosition;
}

/** Клітинка таблиці переходів: стан і символ. */
export interface TuringPosition {
  state: number;
  symbol: string;
}

export interface TuringEvent {
  step: number;
  rule: TuringRule;
  state: TuringState;
}

export type TuringStepResult = StepResult<TuringState, TuringPosition, TuringEvent>;
export type TuringRunResult = RunResult<TuringState, TuringPosition>;

export function createState(program: TuringProgram, input: TuringTape): TuringState {
  return {
    program,
    cells: new Map(input.cells),
    head: input.head,
    current: 0,
    steps: 0,
    status: 'running',
  };
}

export function positionOf(state: TuringState): TuringPosition | null {
  if (state.status !== 'running') return state.last ?? null;
  return { state: state.current, symbol: readCell(state, state.head) };
}

/** Стан для конфігурації: null після зупинки. */
export function configurationState(state: TuringState): number | null {
  return state.status === 'halted' ? null : state.current;
}

function result(state: TuringState, event?: TuringEvent): TuringStepResult {
  return {
    state,
    status: state.status,
    steps: state.steps,
    position: positionOf(state),
    ...(state.error ? { error: state.error } : {}),
    ...(event ? { event } : {}),
  };
}

const SHIFT = { L: -1, R: 1, N: 0 } as const;

export function step(state: TuringState): TuringStepResult {
  if (state.status !== 'running') return result(state);

  const symbol = readCell(state, state.head);
  const rule = state.program.rules.get(cellKey(state.current, symbol));
  if (!rule) {
    // Правила немає — аварійна зупинка; крок не виконано.
    return result({
      ...state,
      status: 'crashed',
      error: `у стані q${state.current} для символу ${symbol} правило не задане`,
      last: { state: state.current, symbol },
    });
  }

  let cells = state.cells;
  if (rule.write !== symbol) {
    const next = new Map(state.cells);
    if (rule.write === BLANK) next.delete(state.head);
    else next.set(state.head, rule.write);
    cells = next;
  }
  const steps = state.steps + 1;
  const moved = { ...state, cells, head: state.head + SHIFT[rule.move], steps };
  const after: TuringState =
    rule.next === null
      ? { ...moved, status: 'halted', last: { state: state.current, symbol } }
      : { ...moved, current: rule.next };
  return result(after, { step: steps, rule, state: after });
}

export function run(
  state: TuringState,
  options: RunOptions<TuringState, TuringPosition, TuringEvent>,
): TuringRunResult {
  return runSteps(step, positionOf, state, options);
}
