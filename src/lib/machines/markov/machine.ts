/** Виконання нормальних алгоритмів Маркова. Стан незмінний: step() повертає новий. */
import {
  runSteps,
  type BaseState,
  type RunOptions,
  type RunResult,
  type StepResult,
} from '../types';
import type { MarkovProgram, MarkovRule } from './program';

/** Захист від слів, що ростуть без кінця (наприклад, «λ -> a»). */
export const MAX_WORD_LENGTH = 100_000;

/** Остання виконана підстановка: що й де замінено. */
export interface MarkovApplied {
  readonly rule: MarkovRule;
  /** Позиція найлівішого входження α у слові до заміни. */
  readonly index: number;
  /** Слово до заміни. */
  readonly before: string;
}

export interface MarkovState extends BaseState {
  readonly program: MarkovProgram;
  readonly word: string;
  readonly last?: MarkovApplied;
  /** Чому алгоритм зупинився: заключна підстановка або жодна не застосовна. */
  readonly stop?: 'final' | 'no-rule';
}

/** Підстановка, яку підсвічувати: номер і рядок схеми. */
export interface MarkovPosition {
  rule: number;
  line: number;
}

export interface MarkovEvent {
  step: number;
  rule: MarkovRule;
  index: number;
  before: string;
  after: string;
  state: MarkovState;
}

export type MarkovStepResult = StepResult<MarkovState, MarkovPosition, MarkovEvent>;
export type MarkovRunResult = RunResult<MarkovState, MarkovPosition>;

export function createState(program: MarkovProgram, word: string): MarkovState {
  return { program, word, steps: 0, status: 'running' };
}

/** Остання виконана підстановка — саме її підсвічують у схемі. */
export function positionOf(state: MarkovState): MarkovPosition | null {
  return state.last ? { rule: state.last.rule.number, line: state.last.rule.line } : null;
}

/**
 * Перша за порядком підстановка, ліва частина якої входить у слово, і її найлівіше входження.
 * Порожня ліва частина входить у будь-яке слово — на самому початку.
 */
export function findRule(
  program: MarkovProgram,
  word: string,
): { rule: MarkovRule; index: number } | null {
  for (const rule of program.rules) {
    const index = word.indexOf(rule.left);
    if (index !== -1) return { rule, index };
  }
  return null;
}

function result(state: MarkovState, event?: MarkovEvent): MarkovStepResult {
  return {
    state,
    status: state.status,
    steps: state.steps,
    position: positionOf(state),
    ...(state.error ? { error: state.error } : {}),
    ...(event ? { event } : {}),
  };
}

export function step(state: MarkovState): MarkovStepResult {
  if (state.status !== 'running') return result(state);

  const match = findRule(state.program, state.word);
  // Жодна підстановка не застосовна — звичайна зупинка, заміни не було.
  if (!match) return result({ ...state, status: 'halted', stop: 'no-rule' });

  const { rule, index } = match;
  const word = state.word.slice(0, index) + rule.right + state.word.slice(index + rule.left.length);
  const steps = state.steps + 1;
  const last: MarkovApplied = { rule, index, before: state.word };

  if (word.length > MAX_WORD_LENGTH) {
    const crashed: MarkovState = {
      ...state,
      steps,
      last,
      status: 'crashed',
      error: `слово стало довшим за ${new Intl.NumberFormat('uk-UA').format(MAX_WORD_LENGTH)} символів (підстановка ${rule.number})`,
    };
    return result(crashed);
  }

  const next: MarkovState = rule.final
    ? { ...state, word, steps, last, status: 'halted', stop: 'final' }
    : { ...state, word, steps, last };
  return result(next, { step: steps, rule, index, before: state.word, after: word, state: next });
}

export function run(
  state: MarkovState,
  options: RunOptions<MarkovState, MarkovPosition, MarkovEvent>,
): MarkovRunResult {
  return runSteps(step, positionOf, state, options);
}
