import { describe, expect, it } from 'vitest';
import { decodeShareHash, shareUrl } from '../share';
import {
  createState,
  deserialize,
  formatCommand,
  formatTape,
  parse,
  parseTape,
  POST_EXAMPLES,
  renumber,
  rowsFromSource,
  run,
  serialize,
  sourceFromRows,
  step,
  type PostProgram,
  type PostState,
  type PostTape,
} from './index';

function program(source: string): PostProgram {
  const parsed = parse(source);
  if (!parsed.ok) throw new Error(parsed.errors.map((e) => `${e.line}: ${e.message}`).join('\n'));
  return parsed.value;
}

function tape(text: string): PostTape {
  const parsed = parseTape(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

function start(source: string, input: string): PostState {
  return createState(program(source), tape(input));
}

const marksOf = (state: PostTape) => [...state.marks].sort((a, b) => a - b);

const EXAMPLE_1 = `1. → 2
2. ? 1, 3
3. X 4
4. ← 5
5. !`;

describe('нотація стрічки', () => {
  it('розбирає «1^3 0 [1]»', () => {
    const parsed = tape('1^3 0 [1]');
    expect(marksOf(parsed)).toEqual([0, 1, 2, 4]);
    expect(parsed.head).toBe(4);
  });

  it('розбирає верхні індекси й записи без пробілів', () => {
    expect(marksOf(tape('1³0²1'))).toEqual([0, 1, 2, 5]);
    expect(marksOf(tape('111001'))).toEqual([0, 1, 2, 5]);
    expect(marksOf(tape('1¹²'))).toHaveLength(12);
  });

  it('без позначки каретка стоїть на першому символі', () => {
    const parsed = tape('0^3 1');
    expect(parsed.head).toBe(0);
    expect(marksOf(parsed)).toEqual([3]);
  });

  it('«[1]^3» ставить каретку на першу з трьох комірок', () => {
    const parsed = tape('0 [1]^3');
    expect(parsed.head).toBe(1);
    expect(marksOf(parsed)).toEqual([1, 2, 3]);
  });

  it('приймає пробіли всередині дужок і навколо ^', () => {
    const parsed = tape('1 ^ 2 [ 0 ] 1');
    expect(marksOf(parsed)).toEqual([0, 1, 3]);
    expect(parsed.head).toBe(2);
  });

  it('порожній запис — порожня стрічка', () => {
    const parsed = tape('   ');
    expect(parsed.marks.size).toBe(0);
    expect(parsed.head).toBe(0);
  });

  it.each([
    ['1 2', /Незрозумілий символ «2»/],
    ['[1] [0]', /лише один раз/],
    ['1^0', /щонайменше 1/],
    ['1^', /число повторень/],
    ['[2]', /Після «\[» очікується 0 або 1/],
    ['[1', /Очікується «\]»/],
    ['1^20000', /до 10000 комірок/],
  ])('помилка для «%s»', (text, message) => {
    const parsed = parseTape(text);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(message);
  });

  it.each([
    [{ marks: [3], head: 0 }, '[0] 0^2 1'],
    [{ marks: [0, 1, 3], head: 2 }, '1^2 [0] 1'],
    [{ marks: [0, 1, 2, 3, 4], head: 2 }, '1^2 [1] 1^2'],
    [{ marks: [], head: 5 }, '[0]'],
    [{ marks: [-2, -1], head: 3 }, '1^2 0^3 [0]'],
    [{ marks: [0, 1000000], head: 0 }, '[1] 0^999999 1'],
  ])('записує %j як «%s»', ({ marks, head }, expected) => {
    expect(formatTape({ marks: new Set(marks), head })).toBe(expected);
  });

  it('запис і розбір узгоджені', () => {
    for (const text of ['1^3 0 [1]', '[0] 0 1^4', '1 0 1 0 [1] 0 1']) {
      const parsed = tape(text);
      const again = tape(formatTape(parsed));
      expect(marksOf(again).map((m) => m - marksOf(again)[0]!)).toEqual(
        marksOf(parsed).map((m) => m - marksOf(parsed)[0]!),
      );
    }
  });
});

describe('розбір програми', () => {
  it('розбирає програму зі специфікації', () => {
    const parsed = parse(EXAMPLE_1);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.commands.map(formatCommand)).toEqual([
      '1. → 2',
      '2. ? 1, 3',
      '3. X 4',
      '4. ← 5',
      '5. !',
    ]);
    expect(parsed.warnings).toEqual([]);
  });

  it('приймає ASCII-аліаси, довільні пробіли й коментарі', () => {
    const parsed = parse(
      [
        '1.->2 // праворуч',
        '2 . > 3',
        '3. <- 4 ; ліворуч',
        '4.<5',
        '5. v 6',
        '6. x 7',
        '7.?8,9',
        '8. ? 9 9',
        '  // коментар',
        '',
        '9. !',
      ].join('\n'),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.commands.map(formatCommand)).toEqual([
      '1. → 2',
      '2. → 3',
      '3. ← 4',
      '4. ← 5',
      '5. V 6',
      '6. X 7',
      '7. ? 8, 9',
      '8. ? 9, 9',
      '9. !',
    ]);
    expect(parsed.value.commands[0]!.comment).toBe('праворуч');
    expect(parsed.value.commands[2]!.comment).toBe('ліворуч');
  });

  it('приймає кириличну «Х» як X', () => {
    const parsed = parse('1. Х 2\n2. !');
    expect(parsed.ok && parsed.value.commands[0]!.op).toBe('erase');
  });

  it('номери не обов’язково йдуть підряд; старт — з найменшого', () => {
    const parsed = parse('20. !\n10. → 20');
    expect(parsed.ok && parsed.value.start).toBe(10);
  });

  it.each([
    ['→ 2', 1, /починатися з номера/],
    ['1 → 2', 1, /потрібна крапка/],
    ['1.', 1, /не вказано команду/],
    ['1. Y 2', 1, /Невідома команда «Y»/],
    ['1. → ', 1, /потрібен номер наступної команди/],
    ['1. ? 2', 1, /потрібні два номери/],
    ['1. ! 2', 1, /нічого не пишуть/],
    ['1. → 2 3', 1, /Зайві символи/],
    ['1. !\n1. → 1', 2, /Команда 1 вже є в рядку 1/],
  ])('помилка в «%s»', (source, line, message) => {
    const parsed = parse(source);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors[0]!.line).toBe(line);
    expect(parsed.errors[0]!.message).toMatch(message);
  });

  it('збирає всі помилки, а не лише першу', () => {
    const parsed = parse('1. Y\n2. !\n3 ! ');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.map((e) => e.line)).toEqual([1, 3]);
  });

  it('порожня програма — помилка', () => {
    const parsed = parse('// лише коментар\n\n');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[0]!.message).toMatch(/порожня/);
  });

  it('програма без «!» — попередження, а не помилка', () => {
    const parsed = parse('1. → 1');
    expect(parsed.ok).toBe(true);
    expect(parsed.warnings.map((w) => w.message)).toEqual([
      expect.stringMatching(/немає команди «!»/),
    ]);
  });

  it('перехід до неіснуючої команди — попередження з номером рядка', () => {
    const parsed = parse('1. → 7\n2. !');
    expect(parsed.ok).toBe(true);
    expect(parsed.warnings).toEqual([
      { line: 1, message: expect.stringMatching(/Команди 7 немає/) },
    ]);
  });
});

describe('виконання', () => {
  it('приклад 1 на стрічці «0^3 1» з кареткою зліва: мітку стерто, каретка зліва від неї', () => {
    const result = run(start(EXAMPLE_1, '0^3 1'), { maxSteps: 10_000 });
    expect(result.status).toBe('halted');
    expect(result.state.marks.size).toBe(0);
    expect(result.state.head).toBe(2);
    expect(result.steps).toBe(9);
    expect(result.position).toEqual({ command: 5, line: 5 });
  });

  it('V у комірку з міткою — аварійна зупинка з поясненням', () => {
    const result = run(start('1. V 2\n2. !', '[1]'), { maxSteps: 100 });
    expect(result.status).toBe('crashed');
    expect(result.error).toBe('у комірці 0 вже є мітка (команда 1)');
    expect(result.position).toEqual({ command: 1, line: 1 });
  });

  it('X у порожній комірці — аварійна зупинка з поясненням', () => {
    const result = run(start('1. X 2\n2. !', '0 [0] 1'), { maxSteps: 100 });
    expect(result.status).toBe('crashed');
    expect(result.error).toBe('комірка 1 порожня, стирати нічого (команда 1)');
  });

  it('перехід до неіснуючої команди — аварійна зупинка', () => {
    const result = run(start('1. → 7', '[0]'), { maxSteps: 100 });
    expect(result.status).toBe('crashed');
    expect(result.error).toBe('команди 7 немає в програмі (перехід з команди 1)');
    expect(result.state.head).toBe(1);
    expect(result.position).toEqual({ command: 1, line: 1 });
  });

  it('нескінченний цикл «1. → 1» зупиняється на ліміті кроків', () => {
    const result = run(start('1. → 1', '[0]'), { maxSteps: 10_000 });
    expect(result.status).toBe('step-limit');
    expect(result.steps).toBe(10_000);
    expect(result.state.status).toBe('running');
    expect(result.state.head).toBe(10_000);
  });

  it('після підвищення ліміту виконання продовжується', () => {
    const first = run(start('1. → 2\n2. → 3\n3. !', '[0]'), { maxSteps: 2 });
    expect(first.status).toBe('step-limit');
    const second = run(first.state, { maxSteps: 10 });
    expect(second.status).toBe('halted');
    expect(second.steps).toBe(3);
  });

  it('«?» переходить за першим номером на порожній комірці й за другим — на мітці', () => {
    const source = '1. ? 2, 3\n2. !\n3. !';
    expect(step(start(source, '[0]')).state.current).toBe(2);
    expect(step(start(source, '[1]')).state.current).toBe(3);
  });

  it('step не змінює попередній стан', () => {
    const before = start('1. V 2\n2. !', '[0]');
    const after = step(before);
    expect(before.marks.size).toBe(0);
    expect(before.steps).toBe(0);
    expect(after.state.marks.has(0)).toBe(true);
    expect(after.state).not.toBe(before);
  });

  it('крок після зупинки нічого не робить', () => {
    const halted = run(start('1. !', '[0]'), { maxSteps: 10 }).state;
    const again = step(halted);
    expect(again.state).toBe(halted);
    expect(again.event).toBeUndefined();
  });

  it('onStep отримує кожен крок для журналу', () => {
    const events: string[] = [];
    run(start(EXAMPLE_1, '0 1'), {
      maxSteps: 100,
      onStep: (r) => events.push(`${r.event?.command.number}→${r.event?.next ?? '·'}`),
    });
    expect(events).toEqual(['1→2', '2→3', '3→4', '4→5', '5→·']);
  });
});

describe('перенумерування', () => {
  it('нумерує 1, 2, 3… і оновлює переходи й коментарі', () => {
    const source = '// початок\n10. → 30 // праворуч\n\n30. ? 10, 40\n40. !';
    expect(renumber(source)).toBe('// початок\n1. → 2 // праворуч\n\n2. ? 1, 3\n3. !');
  });

  it('не чіпає переходи до неіснуючих команд', () => {
    expect(renumber('5. → 9\n7. !')).toBe('1. → 9\n2. !');
  });

  it('повертає null для програми з помилками', () => {
    expect(renumber('1. Y')).toBeNull();
  });
});

describe('табличний режим', () => {
  it('рядки таблиці й текст узгоджені', () => {
    const source = '// коментар\n1. → 2 // праворуч\n2. ? 1, 3\n3. !';
    const rows = rowsFromSource(source);
    expect(rows).toEqual([
      { number: '', op: '', target: '', comment: 'коментар' },
      { number: '1', op: '→', target: '2', comment: 'праворуч' },
      { number: '2', op: '?', target: '1, 3', comment: '' },
      { number: '3', op: '!', target: '', comment: '' },
    ]);
    expect(sourceFromRows(rows!)).toBe(source);
  });

  it('незаповнений рядок таблиці дає зрозумілу помилку', () => {
    const source = sourceFromRows([{ number: '4', op: '→', target: '', comment: '' }]);
    const parsed = parse(source);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[0]!.message).toMatch(/номер наступної команди/);
  });

  it('для програми з помилками таблиці немає', () => {
    expect(rowsFromSource('1. Y')).toBeNull();
  });
});

describe('вбудовані приклади', () => {
  const expected: Record<string, { marks: number; head: number }> = {
    'erase-mark': { marks: 0, head: 2 },
    'add-one': { marks: 4, head: 3 },
    'fill-gaps': { marks: 6, head: 5 },
  };

  it.each(POST_EXAMPLES.map((e) => [e.title, e] as const))(
    '«%s» завершується штатно',
    (_, example) => {
      const parsed = parse(example.program);
      expect(parsed.ok).toBe(true);
      expect(parsed.warnings).toEqual([]);
      const result = run(start(example.program, example.input), { maxSteps: 10_000 });
      expect(result.status).toBe('halted');
      expect(result.state.marks.size).toBe(expected[example.id]!.marks);
      expect(result.state.head).toBe(expected[example.id]!.head);
    },
  );
});

describe('збереження й посилання', () => {
  const program = '1. → 2 // коментар з «лапками» і \\ скісною\n2. !';
  const input = '0^3 [1]';
  const comment = 'Ідея: крок праворуч і зупинка.\nДругий рядок.';

  it('serialize / deserialize зберігають програму, вхідні дані й коментар', () => {
    const text = serialize(program, input, comment);
    expect(JSON.parse(text)).toMatchObject({ machine: 'post', version: 1, comment });
    expect(deserialize(text)).toEqual({ program, input, comment });
  });

  it('файл без коментаря (старий формат) відкривається з порожнім коментарем', () => {
    const old = JSON.stringify({ machine: 'post', version: 1, program, input });
    expect(deserialize(old)).toEqual({ program, input, comment: '' });
  });

  it('відновлює стан з посилання «Поділитися»', () => {
    const url = shareUrl(
      'https://kaldra1.github.io/aimo/emulators/post/',
      serialize(program, input, comment),
    );
    expect(url).toMatch(/^https:\/\/kaldra1\.github\.io\/aimo\/emulators\/post\/#s=/);
    const restored = decodeShareHash(new URL(url).hash);
    expect(restored).not.toBeNull();
    expect(deserialize(restored!)).toEqual({ program, input, comment });
  });

  it('кожен вбудований приклад має опис логіки розв’язання', () => {
    for (const example of POST_EXAMPLES) expect(example.comment.length).toBeGreaterThan(80);
  });

  it('відхиляє програму іншої машини', () => {
    const turing = JSON.stringify({ machine: 'turing', version: 1, program: '', input: '' });
    expect(() => deserialize(turing)).toThrow(
      'Це програма для машини Тюрінга, а не для машини Поста.',
    );
  });
});
