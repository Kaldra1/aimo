import { describe, expect, it } from 'vitest';
import {
  createState,
  deserialize,
  formatRule,
  MARKOV_EXAMPLES,
  MAX_WORD_LENGTH,
  parse,
  parseWord,
  run,
  serialize,
  step,
  type MarkovProgram,
} from './index';

function program(source: string, alphabet?: string): MarkovProgram {
  const parsed = parse(source, { alphabet: alphabet ?? null });
  if (!parsed.ok) throw new Error(parsed.errors.map((e) => `${e.line}: ${e.message}`).join('; '));
  return parsed.value;
}

function runWord(source: string, word: string, maxSteps = 10_000) {
  return run(createState(program(source), word), { maxSteps });
}

describe('parse', () => {
  it('розпізнає всі види стрілок', () => {
    const { rules } = program(
      ['a -> b', 'c ->. d', 'e => f', 'g → h', 'i →· j', 'k → · l', 'm →. n'].join('\n'),
    );
    expect(rules.map((r) => [r.left, r.right, r.final])).toEqual([
      ['a', 'b', false],
      ['c', 'd', true],
      ['e', 'f', true],
      ['g', 'h', false],
      ['i', 'j', true],
      ['k', 'l', true],
      ['m', 'n', true],
    ]);
  });

  it('порожнє слово — λ, ε або нічого; пробіли не враховуються', () => {
    const { rules } = program('λ -> a b\n ab -> ε\n  x ->\n -> y');
    expect(rules.map((r) => [r.left, r.right])).toEqual([
      ['', 'ab'],
      ['ab', ''],
      ['x', ''],
      ['', 'y'],
    ]);
  });

  it('нумерує підстановки й пропускає коментарі та порожні рядки', () => {
    const { rules } = program('// схема\n\nab -> ba   // обмін\n\nb -> λ');
    expect(rules.map((r) => [r.number, r.line])).toEqual([
      [1, 3],
      [2, 5],
    ]);
  });

  it('повідомляє про помилки з номером рядка', () => {
    const parsed = parse('ab ba\na -> b -> c\naλ -> b');
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.errors.map((e) => e.line)).toEqual([1, 2, 3]);
    expect(!parsed.ok && parsed.errors[0]!.message).toMatch(/Немає стрілки/);
  });

  it('порожня схема — помилка', () => {
    const parsed = parse('// лише коментар');
    expect(!parsed.ok && parsed.errors[0]!.message).toMatch(/Схема порожня/);
  });

  it('перевіряє символи за алфавітом, якщо його задано', () => {
    expect(parse('a -> c', { alphabet: 'ab' }).ok).toBe(false);
    expect(parse('a -> c', { alphabet: '' }).ok).toBe(true);
    expect(parse('a -> b', { alphabet: 'a, b' }).ok).toBe(true);
  });

  it('попереджає про підстановки, що ніколи не спрацюють', () => {
    const parsed = parse('λ -> #\na -> b\nab -> c');
    expect(parsed.ok && parsed.warnings.map((w) => w.line)).toEqual([2, 3]);
    const blocked = parse('a -> b\nba -> c');
    expect(blocked.ok && blocked.warnings[0]!.message).toMatch(/містить «a»/);
  });

  it('формат підстановки для показу', () => {
    expect(formatRule({ left: '', right: 'ab', final: false })).toBe('λ → ab');
    expect(formatRule({ left: 'a', right: '', final: true })).toBe('a →· λ');
  });
});

describe('parseWord', () => {
  it('вхідне слово', () => {
    expect(parseWord(' 1 0 1 ')).toEqual({ ok: true, word: '101' });
    expect(parseWord('λ')).toEqual({ ok: true, word: '' });
    expect(parseWord('ab', ['a']).ok).toBe(false);
  });
});

describe('step', () => {
  it('бере першу за порядком застосовну підстановку', () => {
    const next = step(createState(program('c -> x\nb -> y\na -> z'), 'abc')).state;
    expect(next.word).toBe('abx');
    expect(next.last?.rule.number).toBe(1);
  });

  it('замінює найлівіше входження', () => {
    const next = step(createState(program('ab -> X'), 'cabab')).state;
    expect(next.word).toBe('cXab');
    expect(next.last?.index).toBe(1);
  });

  it('порожня ліва частина дописує праву на початок слова', () => {
    const next = step(createState(program('λ -> #'), 'ab')).state;
    expect(next.word).toBe('#ab');
    expect(next.last?.index).toBe(0);
  });

  it('заключна підстановка зупиняє алгоритм', () => {
    const next = step(createState(program('a ->. b\nb -> c'), 'aa'));
    expect(next.status).toBe('halted');
    expect(next.state).toMatchObject({ word: 'ba', stop: 'final', steps: 1 });
  });

  it('жодна підстановка не застосовна — зупинка без кроку', () => {
    const next = step(createState(program('x -> y'), 'ab'));
    expect(next.status).toBe('halted');
    expect(next.state).toMatchObject({ word: 'ab', stop: 'no-rule', steps: 0 });
    expect(next.event).toBeUndefined();
  });

  it('працює з порожнім словом', () => {
    expect(runWord('λ ->. 1', '').state.word).toBe('1');
    expect(runWord('a -> b', '').state).toMatchObject({ word: '', steps: 0, stop: 'no-rule' });
  });

  it('подія кроку для журналу', () => {
    const { event } = step(createState(program('b -> xy'), 'abc'));
    expect(event).toMatchObject({ step: 1, index: 1, before: 'abc', after: 'axyc' });
  });

  it('задовге слово — аварійна зупинка', () => {
    const long = 'a'.repeat(MAX_WORD_LENGTH);
    const next = step(createState(program('λ -> b'), long));
    expect(next.status).toBe('crashed');
    expect(next.error).toMatch(/довшим/);
  });
});

describe('run', () => {
  it('зациклення — ліміт кроків', () => {
    const result = runWord('a -> a', 'a', 50);
    expect(result).toMatchObject({ status: 'step-limit', steps: 50 });
  });

  it('вбудовані приклади дають очікуваний результат', () => {
    const results = Object.fromEntries(
      MARKOV_EXAMPLES.map((example) => {
        const parsed = parse(example.program, { alphabet: example.alphabet });
        if (!parsed.ok) throw new Error(example.id);
        expect(parsed.warnings).toEqual([]);
        const r = run(createState(parsed.value, example.input), { maxSteps: 1000 });
        return [example.id, [r.status, r.state.word, r.steps]];
      }),
    );
    expect(results).toEqual({
      replace: ['halted', 'bbcbbb', 3],
      'unary-increment': ['halted', '1111', 1],
      brackets: ['halted', '', 4],
      'binary-increment': ['halted', '1100', 9],
    });
  });

  it('додавання 1 до двійкового числа з переповненням', () => {
    const example = MARKOV_EXAMPLES.find((e) => e.id === 'binary-increment')!;
    expect(runWord(example.program, '111').state.word).toBe('1000');
  });
});

describe('serialize', () => {
  it('зберігає й відновлює схему', () => {
    const saved = {
      program: 'a -> b',
      input: 'aa',
      alphabet: 'ab',
      checkAlphabet: false,
      comment: 'ідея',
    };
    expect(deserialize(serialize(saved))).toEqual(saved);
  });

  it('відхиляє програму іншої машини', () => {
    expect(() => deserialize('{"machine":"post","version":1,"program":"1. !","input":""}')).toThrow(
      /машини Поста/,
    );
  });
});
