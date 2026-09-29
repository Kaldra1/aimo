/**
 * Автоматична перевірка задач: програма студента проганяється на всіх тестах задачі.
 * Чистий TypeScript без UI — його використовують і сторінка задачі, і тести Vitest.
 *
 * Стрічки порівнюються без порожніх комірок по краях: важливе слово, а не те, де саме на
 * нескінченній стрічці воно записане. Положення каретки перевіряється, лише якщо в тесті
 * `checkHead: true`; тоді воно рахується від початку слова.
 */
import { parseCells } from '../machines/notation';
import * as post from '../machines/post';
import * as turing from '../machines/turing';
import type { RunStatus } from '../machines/types';
import { plural } from '../plural';

/** Ліміт кроків на один тест, якщо в задачі не вказано інший. */
export const DEFAULT_MAX_STEPS = 10_000;

export interface TaskTest {
  readonly input: string;
  readonly expected: string;
  readonly checkHead: boolean;
}

/** Слово на стрічці без порожніх комірок по краях і положення каретки відносно його початку. */
export interface NormalTape {
  /** Символи від першої до останньої непорожньої комірки; порожні комірки всередині — λ. */
  readonly word: readonly string[];
  /** Номер комірки каретки від початку слова (може бути від'ємним); null — стрічка порожня. */
  readonly head: number | null;
}

export type Verdict =
  'passed' | 'wrong-tape' | 'wrong-head' | 'crashed' | 'step-limit' | 'bad-input';

export interface TestResult {
  /** Номер тесту, від 1. */
  readonly number: number;
  readonly verdict: Verdict;
  readonly passed: boolean;
  readonly input: string;
  readonly expected: string;
  /** Стрічка після зупинки в нотації машини; null — машина не зупинилася або не запускалася. */
  readonly actual: string | null;
  /** Пояснення для студента; немає, якщо тест пройдено. */
  readonly reason?: string;
  readonly steps: number;
}

export interface CheckReport {
  readonly results: readonly TestResult[];
  readonly passed: number;
  readonly total: number;
  /** Пройдено всі тести. */
  readonly solved: boolean;
}

const BLANK = turing.BLANK;
const numberFormat = new Intl.NumberFormat('uk-UA');

/** Стан стрічки після запуску — спільний для всіх машин. */
interface Outcome {
  status: RunStatus;
  steps: number;
  error?: string;
  cells: ReadonlyMap<number, string>;
  head: number;
}

type Failure = { ok: false; error: string };
type ParsedTape = { ok: true; cells: Map<number, string>; head: number } | Failure;

interface Checker {
  execute: (input: string) => { ok: true; outcome: Outcome } | Failure;
  parseExpected: (text: string) => ParsedTape;
  /** Запис стрічки для показу: лише слово або, якщо важлива каретка, слово з кареткою. */
  format: (cells: ReadonlyMap<number, string>, head: number, withHead: boolean) => string;
}

export function normalizeTape(cells: ReadonlyMap<number, string>, head: number): NormalTape {
  let low = Infinity;
  let high = -Infinity;
  for (const [index, symbol] of cells) {
    if (symbol === BLANK) continue;
    if (index < low) low = index;
    if (index > high) high = index;
  }
  if (low > high) return { word: [], head: null };
  const word: string[] = [];
  for (let i = low; i <= high; i++) word.push(cells.get(i) ?? BLANK);
  return { word, head: head - low };
}

/** Порівнює результат з очікуваним. */
export function compareTapes(
  actual: NormalTape,
  expected: NormalTape,
  checkHead: boolean,
): 'passed' | 'wrong-tape' | 'wrong-head' {
  const sameWord =
    actual.word.length === expected.word.length &&
    actual.word.every((symbol, i) => symbol === expected.word[i]);
  if (!sameWord) return 'wrong-tape';
  // На порожній стрічці положення каретки нема від чого відрахувати — його не перевіряємо.
  if (checkHead && expected.head !== null && actual.head !== expected.head) return 'wrong-head';
  return 'passed';
}

function reasonOf(verdict: Verdict, outcome: Outcome | null, maxSteps: number, error?: string) {
  switch (verdict) {
    case 'passed':
      return undefined;
    case 'wrong-tape':
      return 'Машина зупинилася, але слово на стрічці не таке, як очікувалося.';
    case 'wrong-head':
      return 'Слово правильне, але каретка зупинилася не там, де потрібно.';
    case 'crashed':
      return `Аварійна зупинка: ${outcome?.error ?? 'невідома причина'}.`;
    case 'step-limit': {
      const word = plural(maxSteps, ['крок', 'кроки', 'кроків']).slice(String(maxSteps).length);
      return `Машина не зупинилася за ${numberFormat.format(maxSteps)}${word} — можливе зациклення.`;
    }
    case 'bad-input':
      return `Вхідне слово тесту не підходить до алфавіту програми. ${error ?? ''}`.trim();
  }
}

function runTests(checker: Checker, tests: readonly TaskTest[], maxSteps: number): CheckReport {
  const results = tests.map((test, index): TestResult => {
    const base = { number: index + 1, input: test.input, expected: test.expected };
    const executed = checker.execute(test.input);
    if (!executed.ok) {
      return {
        ...base,
        verdict: 'bad-input',
        passed: false,
        actual: null,
        reason: reasonOf('bad-input', null, maxSteps, executed.error),
        steps: 0,
      };
    }
    const { outcome } = executed;
    let verdict: Verdict;
    if (outcome.status === 'halted') {
      const expected = checker.parseExpected(test.expected);
      if (!expected.ok) throw new Error(`Тест ${index + 1}: ${expected.error}`);
      verdict = compareTapes(
        normalizeTape(outcome.cells, outcome.head),
        normalizeTape(expected.cells, expected.head),
        test.checkHead,
      );
    } else {
      verdict = outcome.status === 'crashed' ? 'crashed' : 'step-limit';
    }
    const reason = reasonOf(verdict, outcome, maxSteps);
    return {
      ...base,
      verdict,
      passed: verdict === 'passed',
      actual:
        outcome.status === 'halted'
          ? checker.format(outcome.cells, outcome.head, test.checkHead)
          : null,
      ...(reason ? { reason } : {}),
      steps: outcome.steps,
    };
  });
  const passed = results.filter((r) => r.passed).length;
  return { results, passed, total: results.length, solved: passed === results.length };
}

// ---------- Машина Поста ----------

const MARK = '1';

function marksToCells(marks: ReadonlySet<number>): Map<number, string> {
  return new Map([...marks].map((index) => [index, MARK] as const));
}

/** Слово машини Поста в нотації: `1^3 0 1^2`. */
function formatPostWord(word: readonly string[]): string {
  const tokens: string[] = [];
  for (let i = 0; i < word.length;) {
    const symbol = word[i] === MARK ? '1' : '0';
    let j = i;
    while (j < word.length && (word[j] === MARK ? '1' : '0') === symbol) j++;
    tokens.push(j - i === 1 ? symbol : `${symbol}^${j - i}`);
    i = j;
  }
  return tokens.join(' ');
}

const EMPTY_TAPE = 'порожня стрічка';

function postChecker(program: post.PostProgram, maxSteps: number): Checker {
  return {
    execute: (input) => {
      const tape = post.parseTape(input);
      if (!tape.ok) return { ok: false, error: tape.error };
      const result = post.run(post.createState(program, tape.value), { maxSteps });
      return {
        ok: true,
        outcome: {
          status: result.status,
          steps: result.steps,
          ...(result.error ? { error: result.error } : {}),
          cells: marksToCells(result.state.marks),
          head: result.state.head,
        },
      };
    },
    parseExpected: (text) => {
      const tape = post.parseTape(text);
      return tape.ok
        ? { ok: true, cells: marksToCells(tape.value.marks), head: tape.value.head }
        : tape;
    },
    format: (cells, head, withHead) => {
      if (withHead) return post.formatTape({ marks: new Set(cells.keys()), head });
      const { word } = normalizeTape(cells, head);
      return word.length === 0 ? EMPTY_TAPE : formatPostWord(word);
    },
  };
}

export function checkPost(
  program: post.PostProgram,
  tests: readonly TaskTest[],
  maxSteps = DEFAULT_MAX_STEPS,
): CheckReport {
  return runTests(postChecker(program, maxSteps), tests, maxSteps);
}

// ---------- Машина Тюрінга ----------

/**
 * Очікувана стрічка машини Тюрінга. Алфавіт студента може відрізнятися від алфавіту задачі
 * (допоміжні символи), тому тут приймаємо будь-які символи, крім службових.
 */
export function parseTuringWord(text: string): ParsedTape {
  const parsed = parseCells(text, {
    isSymbol: (symbol) => !'[]^'.includes(symbol),
    unknown: (symbol, position) => `Незрозумілий символ «${symbol}» (позиція ${position}).`,
    expected: 'символ',
    maxCells: turing.MAX_TAPE_CELLS,
  });
  if (!parsed.ok) return parsed;
  const cells = new Map<number, string>();
  parsed.cells.forEach((raw, index) => {
    const symbol = raw === '_' ? BLANK : raw;
    if (symbol !== BLANK) cells.set(index, symbol);
  });
  return { ok: true, cells, head: parsed.head };
}

function turingChecker(program: turing.TuringProgram, maxSteps: number): Checker {
  return {
    execute: (input) => {
      const tape = turing.parseTape(input, program.alphabet);
      if (!tape.ok) return { ok: false, error: tape.error };
      const result = turing.run(turing.createState(program, tape.value), { maxSteps });
      return {
        ok: true,
        outcome: {
          status: result.status,
          steps: result.steps,
          ...(result.error ? { error: result.error } : {}),
          cells: result.state.cells,
          head: result.state.head,
        },
      };
    },
    parseExpected: parseTuringWord,
    format: (cells, head, withHead) => {
      if (withHead) return turing.formatTape({ cells, head });
      const { word } = normalizeTape(cells, head);
      return word.length === 0 ? EMPTY_TAPE : word.join('');
    },
  };
}

export function checkTuring(
  program: turing.TuringProgram,
  tests: readonly TaskTest[],
  maxSteps = DEFAULT_MAX_STEPS,
): CheckReport {
  return runTests(turingChecker(program, maxSteps), tests, maxSteps);
}
