import { describe, expect, it } from 'vitest';
import * as post from '../machines/post';
import * as turing from '../machines/turing';
import {
  checkPost,
  checkTuring,
  compareTapes,
  normalizeTape,
  parseTuringWord,
  type TaskTest,
} from './check';

function postProgram(source: string) {
  const parsed = post.parse(source);
  if (!parsed.ok) throw new Error(parsed.errors.map((e) => e.message).join('; '));
  return parsed.value;
}

function turingProgram(alphabet: string, table: Record<string, Record<string, string>>) {
  const built = turing.buildProgram({
    alphabet,
    states: Object.keys(table).length,
    cells: turing.flattenTable(table),
  });
  if (!built.ok) throw new Error(built.errors.map((e) => e.message).join('; '));
  return built.value;
}

const test = (input: string, expected: string, checkHead = false): TaskTest => ({
  input,
  expected,
  checkHead,
});

describe('normalizeTape', () => {
  it('відкидає порожні комірки по краях і рахує каретку від початку слова', () => {
    const cells = new Map([
      [5, '1'],
      [7, '1'],
    ]);
    expect(normalizeTape(cells, 4)).toEqual({ word: ['1', 'λ', '1'], head: -1 });
  });

  it('порожня стрічка — порожнє слово без каретки', () => {
    expect(normalizeTape(new Map(), 3)).toEqual({ word: [], head: null });
  });
});

describe('compareTapes', () => {
  const word = (symbols: string, head: number | null = 0) => ({ word: [...symbols], head });

  it('однакові слова в різних місцях стрічки рівні', () => {
    expect(compareTapes(word('11'), word('11'), false)).toBe('passed');
  });

  it('різні слова', () => {
    expect(compareTapes(word('11'), word('111'), false)).toBe('wrong-tape');
  });

  it('каретку перевіряє лише за checkHead', () => {
    expect(compareTapes(word('10', 1), word('10', 0), false)).toBe('passed');
    expect(compareTapes(word('10', 1), word('10', 0), true)).toBe('wrong-head');
  });

  it('на порожній стрічці каретку не перевіряє', () => {
    expect(compareTapes(word('', 5), word('', null), true)).toBe('passed');
  });
});

describe('checkPost', () => {
  // Дописати мітку в кінець масиву.
  const append = postProgram('1. → 2\n2. ? 3, 1\n3. V 4\n4. !');

  it('усі тести пройдено', () => {
    const report = checkPost(append, [test('[1]^2', '1^3'), test('[1]', '1^2')]);
    expect(report).toMatchObject({ passed: 2, total: 2, solved: true });
    expect(report.results[0]).toMatchObject({ verdict: 'passed', actual: '1^3', steps: 6 });
    expect(report.results[0]!.reason).toBeUndefined();
  });

  it('неправильний результат', () => {
    const report = checkPost(append, [test('[1]^2', '1^4')]);
    expect(report.solved).toBe(false);
    expect(report.results[0]).toMatchObject({ verdict: 'wrong-tape', actual: '1^3' });
    expect(report.results[0]!.reason).toMatch(/не таке/);
  });

  it('порівняння ігнорує положення слова на стрічці', () => {
    const left = postProgram('1. ← 2\n2. V 3\n3. !');
    expect(checkPost(left, [test('[1]^2', '1^3')]).solved).toBe(true);
  });

  it('аварійна зупинка', () => {
    const report = checkPost(postProgram('1. V 2\n2. !'), [test('[1]', '1')]);
    expect(report.results[0]).toMatchObject({ verdict: 'crashed', actual: null });
    expect(report.results[0]!.reason).toMatch(/^Аварійна зупинка: у комірці 0 вже є мітка/);
  });

  it('зациклення — перевищено ліміт кроків', () => {
    const report = checkPost(postProgram('1. → 1'), [test('[1]', '1')], 50);
    expect(report.results[0]).toMatchObject({ verdict: 'step-limit', steps: 50 });
    expect(report.results[0]!.reason).toBe(
      'Машина не зупинилася за 50 кроків — можливе зациклення.',
    );
  });

  it('ліміт форматується з розрядами', () => {
    const report = checkPost(postProgram('1. → 1'), [test('[1]', '1')]);
    expect(report.results[0]!.reason).toMatch(/за 10\s000 кроків/);
  });

  it('перевіряє каретку й показує її в результаті', () => {
    const stay = postProgram('1. !');
    expect(checkPost(stay, [test('1 [1]', '[1] 1', true)]).results[0]).toMatchObject({
      verdict: 'wrong-head',
      actual: '1 [1]',
    });
    expect(checkPost(stay, [test('1 [1]', '1 [1]', true)]).solved).toBe(true);
  });

  it('порожній результат', () => {
    const erase = postProgram('1. X 2\n2. !');
    expect(checkPost(erase, [test('[1]', '')]).results[0]).toMatchObject({
      verdict: 'passed',
      actual: 'порожня стрічка',
    });
  });
});

describe('checkTuring', () => {
  const invert = turingProgram('01', { q0: { 0: '1R', 1: '0R', λ: 'N!' } });

  it('усі тести пройдено', () => {
    const report = checkTuring(invert, [test('10', '01'), test('111', '000')]);
    expect(report).toMatchObject({ passed: 2, total: 2, solved: true });
    expect(report.results[1]).toMatchObject({ actual: '000', steps: 4 });
  });

  it('вхідне слово з чужими символами', () => {
    const report = checkTuring(invert, [test('1+1', '0+0')]);
    expect(report.results[0]).toMatchObject({ verdict: 'bad-input', actual: null, steps: 0 });
    expect(report.results[0]!.reason).toMatch(/алфавіту програми.*«\+»/);
  });

  it('аварійна зупинка з причиною', () => {
    const noBlank = turingProgram('01', { q0: { 0: '1R', 1: '0R' } });
    expect(checkTuring(noBlank, [test('1', '0')]).results[0]!.reason).toBe(
      'Аварійна зупинка: у стані q0 для символу λ правило не задане.',
    );
  });

  it('допоміжні символи в алфавіті студента не заважають', () => {
    const withMarker = turingProgram('01x', { q0: { 0: '1R', 1: '0R', x: 'R', λ: 'N!' } });
    expect(checkTuring(withMarker, [test('10', '01')]).solved).toBe(true);
  });

  it('порожні комірки всередині слова мають значення', () => {
    const gap = turingProgram('1', { q0: { 1: 'λR', λ: 'N!' } });
    expect(checkTuring(gap, [test('1', '')]).solved).toBe(true);
    expect(checkTuring(gap, [test('1', '1')]).results[0]!.actual).toBe('порожня стрічка');
  });

  it('каретка з checkHead', () => {
    const back = turingProgram('01', {
      q0: { 0: 'R', 1: 'R', λ: 'Lq1' },
      q1: { 0: 'L', 1: 'L', λ: 'R!' },
    });
    expect(checkTuring(back, [test('101', '[1]01', true)]).solved).toBe(true);
    expect(checkTuring(back, [test('101', '10[1]', true)]).results[0]).toMatchObject({
      verdict: 'wrong-head',
      actual: '[1]01',
    });
  });
});

describe('parseTuringWord', () => {
  it('приймає будь-які символи, λ і _ — порожні', () => {
    const parsed = parseTuringWord('a_b[λ]c');
    expect(parsed.ok && [...parsed.cells]).toEqual([
      [0, 'a'],
      [2, 'b'],
      [4, 'c'],
    ]);
    expect(parsed.ok && parsed.head).toBe(3);
  });
});
