/**
 * Розв'язки в базі: розбір ідентифікатора задачі, текст програми для збереження, пошук однакових
 * програм і повторна перевірка. Три машини: Пост, Тюрінг, нормальні алгоритми Маркова.
 */
import * as flowchart from '../machines/flowchart';
import * as markov from '../machines/markov';
import * as post from '../machines/post';
import * as turing from '../machines/turing';
import {
  checkFlowchart,
  checkMarkov,
  checkPost,
  checkTuring,
  DEFAULT_MAX_STEPS,
  type TaskTest,
} from '../tasks/check';
import { splitExample } from '../variants/ids';

export type TaskMachine = 'post' | 'turing' | 'markov' | 'flowchart';
export type AnyProgram =
  post.PostProgram | turing.TuringProgram | markov.MarkovProgram | flowchart.FlowProgram;

export interface VariantRef {
  session: string;
  variant: number;
  stars: 1 | 2 | 3;
}

/** practical-02/v7/2 → { session: 'practical-02', variant: 7, stars: 2 } */
export function parseVariantTaskId(id: string): VariantRef | null {
  const match = /^([a-z]+-\d{2})\/v(\d{1,2})\/([1-3])$/.exec(id);
  if (!match) return null;
  return {
    session: match[1]!,
    variant: Number(match[2]),
    stars: Number(match[3]) as 1 | 2 | 3,
  };
}

/** Рядок-коментар з алфавітом машини Тюрінга: без нього не прочитати допоміжні символи. */
const ALPHABET_LINE = /^\/\/ алфавіт: (.*)$/m;

/** Програма для збереження: без коментарів студента й зайвих пробілів. */
export function programText(machine: TaskMachine, program: AnyProgram): string {
  if (machine === 'flowchart') return flowchart.treeText((program as flowchart.FlowProgram).tree);
  if (machine === 'post') {
    return (program as post.PostProgram).commands.map(post.formatCommand).join('\n');
  }
  if (machine === 'turing') {
    const machineProgram = program as turing.TuringProgram;
    return `// алфавіт: ${machineProgram.alphabet.join('')}\n${turing.formatProgram(machineProgram)}`;
  }
  return (program as markov.MarkovProgram).rules.map(markov.formatRule).join('\n');
}

/** Збережений текст → програма; null — текст не розбирається. */
export function parseProgram(machine: TaskMachine, text: string): AnyProgram | null {
  if (machine === 'flowchart') {
    try {
      const compiled = flowchart.compile(flowchart.normalizeTree(JSON.parse(text)));
      return compiled.ok ? compiled.value : null;
    } catch {
      return null;
    }
  }
  if (machine === 'post') {
    const parsed = post.parse(text);
    return parsed.ok ? parsed.value : null;
  }
  if (machine === 'turing') {
    const alphabet = ALPHABET_LINE.exec(text)?.[1];
    const parsed = turing.parse(text, alphabet === undefined ? {} : { alphabet });
    return parsed.ok ? parsed.value : null;
  }
  const parsed = markov.parse(text);
  return parsed.ok ? parsed.value : null;
}

/**
 * Ключ для пошуку однакових програм: порядок команд і правил важливий, а пробіли й запис — ні.
 */
export function fingerprint(machine: TaskMachine, text: string): string {
  const program = parseProgram(machine, text);
  if (machine === 'flowchart' && program) {
    return flowchart.treeShape((program as flowchart.FlowProgram).tree);
  }
  return (program ? programText(machine, program) : text).replace(/\s+/g, '');
}

/** Тести варіанта з рядків «вхід → вихід». */
export const testsFromLines = (lines: readonly string[]): TaskTest[] =>
  lines.map((line) => {
    const { input, output } = splitExample(line);
    return { input, expected: output, checkHead: false };
  });

export function checkProgram(
  machine: TaskMachine,
  program: AnyProgram,
  tests: readonly TaskTest[],
  maxSteps = DEFAULT_MAX_STEPS,
) {
  if (machine === 'flowchart') {
    return checkFlowchart(program as flowchart.FlowProgram, tests, maxSteps);
  }
  if (machine === 'post') return checkPost(program as post.PostProgram, tests, maxSteps);
  if (machine === 'turing') return checkTuring(program as turing.TuringProgram, tests, maxSteps);
  return checkMarkov(program as markov.MarkovProgram, tests, maxSteps);
}

/** Ліміт кроків для варіантів лабораторних (машини Поста й Тюрінга). */
export const LONG_MAX_STEPS = 100_000;

export type Recheck = 'ok' | 'fail' | 'unknown';

/** Повторна перевірка збереженої програми на тестах варіанта. */
export function recheck(
  machine: TaskMachine,
  text: string,
  lines: readonly string[] | undefined,
): Recheck {
  if (!lines) return 'unknown';
  const program = parseProgram(machine, text);
  if (!program) return 'fail';
  const limit = machine === 'markov' ? DEFAULT_MAX_STEPS : LONG_MAX_STEPS;
  return checkProgram(machine, program, testsFromLines(lines), limit).solved ? 'ok' : 'fail';
}

/** Програма з автозбереження сторінки задачі (для перенесення розв'язків у кабінет). */
export function programFromSaved(machine: TaskMachine, saved: string): AnyProgram | null {
  try {
    if (machine === 'flowchart') {
      const compiled = flowchart.compile(flowchart.deserialize(saved).tree);
      return compiled.ok ? compiled.value : null;
    }
    if (machine === 'post') return parseProgram('post', post.deserialize(saved).program);
    if (machine === 'turing') {
      const built = turing.buildProgram(turing.deserialize(saved).table);
      return built.ok ? built.value : null;
    }
    return parseProgram('markov', markov.deserialize(saved).program);
  } catch {
    return null;
  }
}
