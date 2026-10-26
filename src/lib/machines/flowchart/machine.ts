/**
 * Покрокове виконання схеми. Один крок — один блок: процес, введення, виведення, перевірка
 * умови чи заголовок циклу. Наприкінці — крок «Кінець».
 */
import {
  runSteps,
  type BaseState,
  type MachineStatus,
  type RunOptions,
  type StepResult,
} from '../types';
import {
  evaluate,
  formatValue,
  indexOf,
  isTrue,
  RuntimeProblem,
  type ArrayValue,
  type Env,
  type Value,
} from './expr';
import type { FlowProgram, Instruction, Target } from './program';

/** Кінець схеми — позиція «Кінець». */
export const END = -1;

export interface FlowState extends BaseState {
  readonly program: FlowProgram;
  /** Номер наступної інструкції. */
  readonly pc: number;
  readonly env: Env;
  /** Вхідні дані (лексеми через пробіл) і скільки вже прочитано. */
  readonly input: readonly string[];
  readonly read: number;
  /** Рядки виводу: кожен блок «Виведення» — окремий рядок. */
  readonly output: readonly string[];
  /** Межі циклів з параметром: кінцеве значення й крок. */
  readonly loops: readonly ({ to: number; step: number } | undefined)[];
}

export interface FlowPosition {
  /** Блок, який буде виконано наступним; END — «Кінець». */
  readonly node: number;
}

export interface FlowEvent {
  readonly step: number;
  readonly node: number;
  /** Що сталося, для журналу: «s = 8», «n > 0 — так», «вивід: 8». */
  readonly text: string;
}

export type FlowStepResult = StepResult<FlowState, FlowPosition, FlowEvent>;

/** Розбиває вхідні дані на лексеми (пробіли й переноси рядків). «—» чи «λ» — даних немає. */
export function splitInput(text: string): string[] {
  const t = text.trim();
  if (t === '' || t === '—' || t === 'λ') return [];
  return t.split(/\s+/);
}

/** Пропускає безумовні переходи: вони не є кроками й не підсвічуються. */
function settle(code: readonly Instruction[], pc: number): number {
  let guard = 0;
  while (code[pc]?.kind === 'jump' && guard++ < code.length) pc = (code[pc] as { to: number }).to;
  return pc;
}

export function createState(program: FlowProgram, input: string): FlowState {
  return {
    program,
    pc: settle(program.code, 0),
    env: new Map(),
    input: splitInput(input),
    read: 0,
    output: [],
    loops: [],
    status: 'running',
    steps: 0,
  };
}

export function positionOf(state: FlowState): FlowPosition | null {
  if (state.status !== 'running') return null;
  const ins = state.program.code[state.pc];
  if (!ins || ins.kind === 'jump') return null;
  return { node: ins.kind === 'halt' ? END : ins.node };
}

const parseToken = (raw: string): Value => {
  const n = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(n) ? n : raw;
};

function assign(env: Map<string, Value | ArrayValue>, t: Target, value: Value): string {
  if (t.index === null) {
    const old = env.get(t.name);
    if (typeof old === 'object')
      throw new RuntimeProblem(`«${t.name}» — масив; присвоюйте елементам: ${t.name}[i] = …`);
    env.set(t.name, value);
    return `${t.name} = ${show(value)}`;
  }
  const i = indexOf(evaluate(t.index, env), t.name);
  const old = env.get(t.name);
  if (old !== undefined && typeof old !== 'object') {
    throw new RuntimeProblem(`«${t.name}» — звичайна змінна, а не масив.`);
  }
  const arr = new Map(old ?? []);
  arr.set(i, value);
  env.set(t.name, arr);
  return `${t.name}[${i}] = ${show(value)}`;
}

const show = (v: Value) => (typeof v === 'string' ? `"${v}"` : formatValue(v));
const nearly = (a: number, b: number) => Math.abs(a - b) < 1e-9;
/** Прибирає похибку накопичення дробового кроку: 0.1 + 0.2 → 0.3. */
const tidy = (v: number) => Math.round(v * 1e12) / 1e12;
const inRange = (v: number, to: number, step: number) =>
  step > 0 ? v < to || nearly(v, to) : v > to || nearly(v, to);

export function step(state: FlowState): FlowStepResult {
  const position = positionOf(state);
  if (state.status !== 'running') {
    return {
      state,
      status: state.status,
      steps: state.steps,
      position,
      ...(state.error ? { error: state.error } : {}),
    };
  }
  const { code } = state.program;
  const ins = code[state.pc]!;
  const steps = state.steps + 1;
  const node = ins.kind === 'halt' || ins.kind === 'jump' ? END : ins.node;

  const crash = (message: string): FlowStepResult => {
    const next: FlowState = { ...state, status: 'crashed', steps, error: message };
    return {
      state: next,
      status: 'crashed',
      steps,
      position: { node },
      error: message,
      event: { step: steps, node, text: `помилка: ${message}` },
    };
  };

  try {
    let env = state.env;
    let read = state.read;
    let output = state.output;
    let loops = state.loops;
    let pc = state.pc + 1;
    let status: MachineStatus = 'running';
    let text = '';

    switch (ins.kind) {
      case 'halt':
        status = 'halted';
        pc = state.pc;
        text = 'Кінець';
        break;
      case 'process': {
        const next = new Map(env);
        const parts: string[] = [];
        for (const a of (ins.code as Extract<typeof ins.code, { type: 'process' }>).assigns) {
          parts.push(assign(next, a.target, evaluate(a.value, next)));
        }
        env = next;
        text = parts.join('; ');
        break;
      }
      case 'input': {
        const next = new Map(env);
        const parts: string[] = [];
        for (const t of (ins.code as Extract<typeof ins.code, { type: 'input' }>).targets) {
          if (read >= state.input.length) {
            throw new RuntimeProblem('Вхідні дані закінчилися: введіть більше значень.');
          }
          parts.push(assign(next, t, parseToken(state.input[read++]!)));
        }
        env = next;
        text = `введено: ${parts.join(', ')}`;
        break;
      }
      case 'output': {
        const items = (ins.code as Extract<typeof ins.code, { type: 'output' }>).items;
        const line = items.map((e) => formatValue(evaluate(e, env))).join(' ');
        output = [...output, line];
        text = `вивід: ${line}`;
        break;
      }
      case 'branch': {
        const yes = isTrue(evaluate(ins.cond, env));
        if (!yes) pc = ins.elseTo;
        text = yes ? 'так' : 'ні';
        break;
      }
      case 'forInit': {
        const from = evaluate(ins.code.from, env);
        const to = evaluate(ins.code.to, env);
        const by = evaluate(ins.code.step, env);
        if (typeof from !== 'number' || typeof to !== 'number' || typeof by !== 'number') {
          throw new RuntimeProblem('Межі й крок циклу мають бути числами.');
        }
        if (by === 0) throw new RuntimeProblem('Крок циклу не може дорівнювати нулю.');
        const next = new Map(env);
        next.set(ins.code.variable, tidy(from));
        env = next;
        const bounds = [...loops];
        bounds[ins.slot] = { to, step: by };
        loops = bounds;
        if (!inRange(from, to, by)) {
          pc = ins.exitTo;
          text = `${ins.code.variable} = ${formatValue(tidy(from))} — цикл не виконується`;
        } else text = `${ins.code.variable} = ${formatValue(tidy(from))}`;
        break;
      }
      case 'forNext': {
        const bounds = loops[ins.slot]!;
        const current = env.get(ins.variable);
        if (typeof current !== 'number')
          throw new RuntimeProblem(`Параметр циклу «${ins.variable}» має бути числом.`);
        const value = tidy(current + bounds.step);
        const next = new Map(env);
        next.set(ins.variable, value);
        env = next;
        if (inRange(value, bounds.to, bounds.step)) {
          pc = ins.bodyTo;
          text = `${ins.variable} = ${formatValue(value)}`;
        } else text = `${ins.variable} = ${formatValue(value)} — вихід з циклу`;
        break;
      }
      case 'jump':
        pc = ins.to;
        break;
    }

    const next: FlowState = {
      ...state,
      pc: status === 'running' ? settle(code, pc) : pc,
      env,
      read,
      output,
      loops,
      status,
      steps,
    };
    return {
      state: next,
      status,
      steps,
      position: positionOf(next),
      event: { step: steps, node, text },
    };
  } catch (e) {
    if (e instanceof RuntimeProblem) return crash(e.message);
    throw e;
  }
}

export function run(state: FlowState, options: RunOptions<FlowState, FlowPosition, FlowEvent>) {
  return runSteps(step, positionOf, state, options);
}

/** Значення змінних для таблиці: масиви — як «[1: 5, 2: 7]». */
export function describeEnv(env: Env): { name: string; value: string }[] {
  return Array.from(env, ([name, v]) => ({
    name,
    value:
      typeof v === 'object'
        ? `[${[...v]
            .sort((a, b) => a[0] - b[0])
            .map(([i, x]) => `${i}: ${show(x)}`)
            .join(', ')}]`
        : show(v),
  })).sort((a, b) => a.name.localeCompare(b.name, 'uk'));
}
