/** Виконання програм машини Поста. Стан незмінний: step() повертає новий стан. */
import {
  runSteps,
  type BaseState,
  type RunOptions,
  type RunResult,
  type StepResult,
} from '../types';
import type { PostCommand, PostProgram } from './program';
import type { PostTape } from './tape';

export interface PostState extends BaseState, PostTape {
  readonly program: PostProgram;
  /** Команда, яка виконуватиметься наступною; після зупинки чи аварії — остання виконана. */
  readonly current: number;
}

export interface PostPosition {
  command: number;
  line: number;
}

/** Запис журналу: який крок, яка команда, куди далі та стан після кроку. */
export interface PostEvent {
  step: number;
  command: PostCommand;
  /** Наступна команда; null — після зупинки чи аварії. */
  next: number | null;
  state: PostState;
}

export type PostStepResult = StepResult<PostState, PostPosition, PostEvent>;
export type PostRunResult = RunResult<PostState, PostPosition>;

export function createState(program: PostProgram, input: PostTape): PostState {
  return {
    program,
    marks: new Set(input.marks),
    head: input.head,
    current: program.start,
    steps: 0,
    status: 'running',
  };
}

export function positionOf(state: PostState): PostPosition | null {
  const command = state.program.byNumber.get(state.current);
  return command ? { command: command.number, line: command.line } : null;
}

function result(state: PostState, event?: PostEvent): PostStepResult {
  return {
    state,
    status: state.status,
    steps: state.steps,
    position: positionOf(state),
    ...(state.error ? { error: state.error } : {}),
    ...(event ? { event } : {}),
  };
}

export function step(state: PostState): PostStepResult {
  if (state.status !== 'running') return result(state);

  const command = state.program.byNumber.get(state.current);
  const steps = state.steps + 1;
  if (!command) {
    const crashed: PostState = {
      ...state,
      steps,
      status: 'crashed',
      error: `команди ${state.current} немає в програмі`,
    };
    return result(crashed);
  }

  const crash = (error: string, changes: Partial<PostState> = {}): PostStepResult => {
    const crashed: PostState = { ...state, ...changes, steps, status: 'crashed', error };
    return result(crashed, { step: steps, command, next: null, state: crashed });
  };

  // Дія виконана — передаємо керування. Перехід до неіснуючої команди — аварійна зупинка.
  const jump = (next: number, changes: Partial<PostState> = {}): PostStepResult => {
    if (!state.program.byNumber.has(next)) {
      return crash(
        `команди ${next} немає в програмі (перехід з команди ${command.number})`,
        changes,
      );
    }
    const moved: PostState = { ...state, ...changes, steps, current: next };
    return result(moved, { step: steps, command, next, state: moved });
  };

  const marked = state.marks.has(state.head);
  switch (command.op) {
    case 'halt': {
      const halted: PostState = { ...state, steps, status: 'halted' };
      return result(halted, { step: steps, command, next: null, state: halted });
    }
    case 'right':
      return jump(command.next, { head: state.head + 1 });
    case 'left':
      return jump(command.next, { head: state.head - 1 });
    case 'mark': {
      if (marked) return crash(`у комірці ${state.head} вже є мітка (команда ${command.number})`);
      const marks = new Set(state.marks);
      marks.add(state.head);
      return jump(command.next, { marks });
    }
    case 'erase': {
      if (!marked) {
        return crash(`комірка ${state.head} порожня, стирати нічого (команда ${command.number})`);
      }
      const marks = new Set(state.marks);
      marks.delete(state.head);
      return jump(command.next, { marks });
    }
    case 'check':
      return jump(marked ? command.ifMarked : command.ifEmpty);
  }
}

export function run(
  state: PostState,
  options: RunOptions<PostState, PostPosition, PostEvent>,
): PostRunResult {
  return runSteps(step, positionOf, state, options);
}
