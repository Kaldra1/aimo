import { describe, expect, it } from 'vitest';
import { decodeShareHash, shareUrl } from '../share';
import {
  buildProgram,
  cellKey,
  createState,
  deserialize,
  flattenTable,
  formatConfiguration,
  formatProgram,
  formatTape,
  parse,
  parseAlphabet,
  parseCell,
  parseTape,
  run,
  serialize,
  step,
  tableFromProgram,
  TURING_EXAMPLES,
  type TuringProgram,
  type TuringState,
  type TuringTable,
} from './index';

function example(id: string) {
  const found = TURING_EXAMPLES.find((e) => e.id === id);
  if (!found) throw new Error(id);
  return found;
}

function tableOf(id: string): TuringTable {
  const e = example(id);
  return { alphabet: e.alphabet, states: e.states, cells: flattenTable(e.table) };
}

function programOf(table: TuringTable): TuringProgram {
  const built = buildProgram(table);
  if (!built.ok) throw new Error(built.errors.map((e) => e.message).join('\n'));
  return built.value;
}

function start(program: TuringProgram, input: string): TuringState {
  const tape = parseTape(input, program.alphabet);
  if (!tape.ok) throw new Error(tape.error);
  return createState(program, tape.value);
}

/** Слово на стрічці без порожніх комірок по краях. */
function word(state: TuringState): string {
  const keys = [...state.cells.keys()].sort((a, b) => a - b);
  if (keys.length === 0) return '';
  let text = '';
  for (let i = keys[0]!; i <= keys[keys.length - 1]!; i++) text += state.cells.get(i) ?? 'λ';
  return text;
}

const INCREMENT = programOf(tableOf('increment'));

describe('додати одиницю до десяткового числа', () => {
  it.each([
    ['19[9]', '200'],
    ['[9]', '10'],
    ['12[3]', '124'],
    ['99[9]', '1000'],
  ])('%s → %s', (input, expected) => {
    const result = run(start(INCREMENT, input), { maxSteps: 1000 });
    expect(result.status).toBe('halted');
    expect(word(result.state)).toBe(expected);
  });

  it('199 → 200: конфігурації кроків', () => {
    const configurations: string[] = [];
    run(start(INCREMENT, '19[9]'), {
      maxSteps: 100,
      onStep: (r) =>
        configurations.push(
          formatConfiguration(r.state, r.state.status === 'halted' ? null : r.state.current),
        ),
    });
    expect(configurations).toEqual(['1q₀90', 'q₀100', '!200']);
  });
});

describe('виконання', () => {
  it('немає правила — аварійна зупинка з поясненням', () => {
    const program = programOf({
      alphabet: '12345',
      states: 2,
      cells: { [cellKey(0, '1')]: 'Rq1' },
    });
    const result = run(start(program, '15'), { maxSteps: 100 });
    expect(result.status).toBe('crashed');
    expect(result.error).toBe('у стані q1 для символу 5 правило не задане');
    expect(result.position).toEqual({ state: 1, symbol: '5' });
    expect(result.steps).toBe(1);
  });

  it('виходить за межі початкової стрічки в обидва боки', () => {
    // q0 іде ліворуч за слово й пише x, q1 іде праворуч за слово й пише y.
    const program = programOf({
      alphabet: '1xy',
      states: 3,
      cells: {
        [cellKey(0, '1')]: 'L',
        [cellKey(0, 'λ')]: 'xRq1',
        [cellKey(1, '1')]: 'R',
        [cellKey(1, 'x')]: 'R',
        [cellKey(1, 'λ')]: 'yN!',
      },
    });
    const result = run(start(program, '11[1]'), { maxSteps: 100 });
    expect(result.status).toBe('halted');
    expect(result.state.cells.get(-1)).toBe('x');
    expect(result.state.cells.get(3)).toBe('y');
    expect(word(result.state)).toBe('x111y');
    expect(formatConfiguration(result.state, null)).toBe('x111!y');
  });

  it('ліміт кроків на нескінченному циклі', () => {
    const program = programOf({ alphabet: '1', states: 1, cells: { [cellKey(0, 'λ')]: 'R' } });
    const result = run(start(program, ''), { maxSteps: 500 });
    expect(result.status).toBe('step-limit');
    expect(result.steps).toBe(500);
    expect(result.state.head).toBe(500);
  });

  it('запис λ стирає символ; step не змінює попередній стан', () => {
    const program = programOf({ alphabet: '1', states: 1, cells: { [cellKey(0, '1')]: 'λN!' } });
    const before = start(program, '1');
    const after = step(before);
    expect(after.state.cells.size).toBe(0);
    expect(before.cells.get(0)).toBe('1');
  });

  it('позиція в таблиці: стан і символ під кареткою, після зупинки — останнє правило', () => {
    const state = start(INCREMENT, '4[5]');
    expect(run(state, { maxSteps: 0 }).position).toEqual({ state: 0, symbol: '5' });
    const halted = step(state);
    expect(halted.status).toBe('halted');
    expect(halted.position).toEqual({ state: 0, symbol: '5' });
  });
});

describe('клітинки таблиці', () => {
  const context = { state: 1, symbol: '5', isSymbol: (c: string) => '0123456789ab'.includes(c) };
  const rule = (text: string) => {
    const result = parseCell(text, context);
    if (!result.ok) throw new Error(result.error);
    return (
      result.rule && { write: result.rule.write, move: result.rule.move, next: result.rule.next }
    );
  };

  it.each([
    ['1Rq0', { write: '1', move: 'R', next: 0 }],
    ['λLq1', { write: 'λ', move: 'L', next: 1 }],
    ['0N!', { write: '0', move: 'N', next: null }],
    ['Rq3', { write: '5', move: 'R', next: 3 }],
    ['aL', { write: 'a', move: 'L', next: 1 }],
    ['R', { write: '5', move: 'R', next: 1 }],
    ['_>2', { write: 'λ', move: 'R', next: 2 }],
    ['b<Q4', { write: 'b', move: 'L', next: 4 }],
    ['.!', { write: '5', move: 'N', next: null }],
    [' 1 R q0 ', { write: '1', move: 'R', next: 0 }],
  ])('«%s»', (text, expected) => {
    expect(rule(text)).toEqual(expected);
  });

  it('порожня клітинка — правила немає', () => {
    expect(rule('   ')).toBeNull();
  });

  it.each([
    ['1', /потрібен рух/],
    ['zR', /Символу «z» немає в алфавіті/],
    ['1Rx', /Незрозумілий новий стан «x»/],
    ['1RR', /Незрозумілий новий стан «R»/],
  ])('помилка в «%s»', (text, message) => {
    const result = parseCell(text, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it('перехід до стану, якого немає в таблиці, — помилка клітинки', () => {
    const built = buildProgram({ alphabet: '1', states: 2, cells: { [cellKey(1, '1')]: 'Rq5' } });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.errors).toEqual([
        { state: 1, symbol: '1', message: expect.stringMatching(/Стану q5 немає в таблиці/) },
      ]);
    }
  });

  it('програма без «!» — попередження', () => {
    const built = buildProgram({ alphabet: '1', states: 1, cells: { [cellKey(0, '1')]: 'R' } });
    expect(built.ok).toBe(true);
    expect(built.warnings[0]?.message).toMatch(/немає переходу в стан зупинки/);
  });
});

describe('алфавіт', () => {
  it('кожен символ — окремий, пробіли й коми ігноруються, повтори відкидаються', () => {
    expect(parseAlphabet('0 1, 2 1')).toEqual({ ok: true, symbols: ['0', '1', '2'] });
  });

  it.each(['λ', '_', '!', '[', '^'])('«%s» зарезервований', (symbol) => {
    const result = parseAlphabet(`1${symbol}`);
    expect(result.ok).toBe(false);
  });
});

describe('текстовий формат', () => {
  it('розбирає «q0, 1 -> 1, R, q0» і скорочений запис', () => {
    const parsed = parse('q0, 1 -> 1, R, q0\n1, λ -> 0, <, !  // коментар\nq1, 0 -> Lq0', {
      alphabet: '01',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.states).toBe(2);
    expect(formatProgram(parsed.value)).toBe(
      'q0, 1 -> 1, R, q0\nq1, 0 -> 0, L, q0\nq1, λ -> 0, L, !',
    );
  });

  it('без алфавіту збирає його з правил', () => {
    const parsed = parse('q0, a -> b, R, q0');
    expect(parsed.ok && parsed.value.alphabet).toEqual(['a', 'b']);
  });

  it.each([
    ['q0 1 -> 1, R, q0', 1, /Очікується правило/],
    ['q0, 7 -> 1, R, q0', 1, /Символу «7» немає в алфавіті/],
    ['q0, 1 -> 1, X, q0', 1, /Незрозумілий рух «X»/],
    ['q0, 1 -> 1, R, z', 1, /Незрозумілий новий стан/],
    ['q0, 1 -> 1, R, q0\nq0, 1 -> 0, L, !', 2, /вже задане в рядку 1/],
  ])('помилка в «%s»', (source, line, message) => {
    const parsed = parse(source, { alphabet: '01' });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors[0]!.line).toBe(line);
    expect(parsed.errors[0]!.message).toMatch(message);
  });

  it('таблиця → текст → таблиця зберігає програму', () => {
    const program = programOf(tableOf('double'));
    const again = parse(formatProgram(program), { alphabet: '1ab' });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const table = tableFromProgram(again.value, '1ab');
    expect(programOf(table).rules).toEqual(program.rules);
  });
});

describe('стрічка', () => {
  it('розбирає нотацію з кареткою, повтореннями й порожніми символами', () => {
    const tape = parseTape('_ 1^3 [λ] 0', ['0', '1']);
    expect(tape.ok).toBe(true);
    if (!tape.ok) return;
    expect([...tape.value.cells]).toEqual([
      [1, '1'],
      [2, '1'],
      [3, '1'],
      [5, '0'],
    ]);
    expect(tape.value.head).toBe(4);
    expect(formatTape(tape.value)).toBe('111[λ]0');
  });

  it('символу поза алфавітом — помилка з позицією', () => {
    const tape = parseTape('102', ['0', '1']);
    expect(tape.ok).toBe(false);
    if (!tape.ok) expect(tape.error).toBe('Символу «2» немає в алфавіті (позиція 3).');
  });

  it('конфігурація α qᵢ β', () => {
    const tape = parseTape('12[9]', ['1', '2', '9']);
    if (!tape.ok) throw new Error(tape.error);
    expect(formatConfiguration(tape.value, 0)).toBe('12q₀9');
    expect(formatConfiguration({ cells: new Map(), head: 0 }, 12)).toBe('q₁₂λ');
  });
});

describe('вбудовані приклади', () => {
  it.each([
    ['increment', '200'],
    ['invert', '01001'],
    ['double', '111111'],
  ])('«%s» завершується штатно з результатом %s', (id, expected) => {
    const e = example(id);
    const program = programOf(tableOf(id));
    const built = buildProgram(tableOf(id));
    expect(built.warnings).toEqual([]);
    const result = run(start(program, e.input), { maxSteps: 10_000 });
    expect(result.status).toBe('halted');
    expect(word(result.state)).toBe(expected);
  });

  it('подвоєння для 0…6 одиниць', () => {
    const program = programOf(tableOf('double'));
    for (let n = 0; n <= 6; n++) {
      const result = run(start(program, '1'.repeat(n)), { maxSteps: 10_000 });
      expect(result.status).toBe('halted');
      expect(word(result.state)).toBe('1'.repeat(2 * n));
    }
  });
});

describe('збереження й посилання', () => {
  const table = tableOf('double');
  const input = '1^3';

  it('serialize / deserialize зберігають таблицю й вхідні дані', () => {
    const text = serialize(table, input);
    expect(JSON.parse(text)).toMatchObject({ machine: 'turing', version: 1, states: 5 });
    const restored = deserialize(text);
    expect(restored.input).toBe(input);
    expect(restored.table.alphabet).toBe('1ab');
    expect(programOf(restored.table).rules).toEqual(programOf(table).rules);
  });

  it('відновлює стан з посилання «Поділитися»', () => {
    const url = shareUrl(
      'https://kaldra1.github.io/aimo/emulators/turing/',
      serialize(table, input),
    );
    const restored = deserialize(decodeShareHash(new URL(url).hash)!);
    expect(restored.table.cells).toEqual(table.cells);
  });

  it('зберігає й невалідні клітинки, щоб не губити незавершену роботу', () => {
    const draft: TuringTable = { alphabet: '01', states: 1, cells: { [cellKey(0, '1')]: '1X?' } };
    expect(deserialize(serialize(draft, '')).table.cells).toEqual(draft.cells);
  });

  it.each([
    ['{"machine":"turing","version":1,"alphabet":"1","states":0,"table":{},"input":""}', /states/],
    ['{"machine":"turing","version":1,"alphabet":"1","states":1,"table":[],"input":""}', /table/],
    [
      '{"machine":"turing","version":1,"alphabet":"1","states":1,"table":{"x":{}},"input":""}',
      /«x»/,
    ],
    ['{"machine":"post","version":1,"program":"","input":""}', /машини Поста/],
  ])('відхиляє пошкоджений файл', (text, message) => {
    expect(() => deserialize(text)).toThrow(message);
  });
});
