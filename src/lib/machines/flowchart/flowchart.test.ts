import { describe, expect, it } from 'vitest';
import { build } from './examples';
import {
  evaluate,
  formatValue,
  parseExpr,
  RuntimeProblem,
  SyntaxProblem,
  tokenize,
  type Env,
} from './expr';
import {
  cleanTree,
  compile,
  compileBlock,
  createState,
  deserialize,
  describeEnv,
  END,
  FLOWCHART_EXAMPLES,
  insertAt,
  layout,
  makeNode,
  nextId,
  positionOf,
  removeNode,
  run,
  serialize,
  splitInput,
  step,
  toSvg,
  treeText,
  updateText,
  walk,
  wrapText,
  type FlowNode,
} from './index';

const ev = (src: string, vars: Record<string, number | string | Map<number, number>> = {}) =>
  evaluate(parseExpr(src), new Map(Object.entries(vars)) as Env);

/** Запуск схеми до кінця: вивід (рядки), статус, помилка. */
function exec(tree: FlowNode[], input = '', maxSteps = 100_000) {
  const compiled = compile(tree);
  if (!compiled.ok) throw new Error(compiled.errors.map((e) => e.message).join('; '));
  const r = run(createState(compiled.value, input), { maxSteps });
  return {
    out: r.state.output,
    status: r.status,
    error: r.state.error,
    steps: r.steps,
    state: r.state,
  };
}

describe('вирази: розбір', () => {
  it('числа: цілі, дробові з крапкою, експонента', () => {
    expect(ev('42')).toBe(42);
    expect(ev('3.25')).toBe(3.25);
    expect(ev('.5')).toBe(0.5);
    expect(ev('1e3')).toBe(1000);
    expect(ev('2.5e-1')).toBe(0.25);
  });

  it('пріоритети й асоціативність', () => {
    expect(ev('2 + 3 * 4')).toBe(14);
    expect(ev('(2 + 3) * 4')).toBe(20);
    expect(ev('10 - 3 - 2')).toBe(5);
    expect(ev('100 / 10 / 5')).toBe(2);
    expect(ev('2 * 3 % 4')).toBe(2);
    expect(ev('-2 * 3')).toBe(-6);
    expect(ev('- -3')).toBe(3);
    expect(ev('1 + 2 < 4')).toBe(1);
  });

  it('div і mod (як у C++: ціла частина відкидається, знак остачі — як у діленого)', () => {
    expect(ev('17 div 5')).toBe(3);
    expect(ev('-17 div 5')).toBe(-3);
    expect(ev('17 mod 5')).toBe(2);
    expect(ev('17 % 5')).toBe(2);
    expect(ev('-17 % 5')).toBe(-2);
    expect(ev('7 / 2')).toBe(3.5);
    expect(ev('9 DIV 2')).toBe(4);
  });

  it('порівняння: ==, !=, <>, ≤, ≥, ≠', () => {
    expect(ev('3 == 3')).toBe(1);
    expect(ev('3 != 3')).toBe(0);
    expect(ev('3 <> 4')).toBe(1);
    expect(ev('3 ≤ 3')).toBe(1);
    expect(ev('3 ≥ 4')).toBe(0);
    expect(ev('3 ≠ 4')).toBe(1);
  });

  it('логіка словами й символами; «не» слабше за порівняння', () => {
    expect(ev('1 < 2 і 3 < 4')).toBe(1);
    expect(ev('1 < 2 та 3 > 4')).toBe(0);
    expect(ev('1 > 2 або 3 < 4')).toBe(1);
    expect(ev('не 1 > 2')).toBe(1);
    expect(ev('!(1 < 2)')).toBe(0);
    expect(ev('1 < 2 && 2 < 3 || 0')).toBe(1);
    expect(ev('x > 0 І x < 10', { x: 5 })).toBe(1);
  });

  it('коротке обчислення: правий операнд не обчислюється', () => {
    expect(ev('0 і (1 / 0 > 0)')).toBe(0);
    expect(ev('1 або (1 / 0 > 0)')).toBe(1);
  });

  it('функції', () => {
    expect(ev('sqrt(16)')).toBe(4);
    expect(ev('abs(-3)')).toBe(3);
    expect(ev('pow(2, 10)')).toBe(1024);
    expect(ev('floor(2.7) + ceil(2.1)')).toBe(5);
    expect(ev('round(2.5)')).toBe(3);
    expect(ev('round(-2.5)')).toBe(-3);
    expect(ev('min(3, 7) + max(3, 7)')).toBe(10);
    expect(ev('trunc(-2.7)')).toBe(-2);
    expect(ev('SQRT(9)')).toBe(3);
  });

  it('змінні з кирилицею, масиви, рядки', () => {
    expect(ev('сума + 1', { сума: 4 })).toBe(5);
    expect(ev('a[i + 1] * 2', { a: new Map([[2, 7]]), i: 1 })).toBe(14);
    expect(ev('"так"')).toBe('так');
    expect(ev('«ні»')).toBe('ні');
    expect(ev('"x = " + 2.5')).toBe('x = 2.500');
  });

  it('синтаксичні помилки — з позицією й зрозумілим текстом', () => {
    const fail = (src: string) => {
      try {
        parseExpr(src);
      } catch (e) {
        expect(e).toBeInstanceOf(SyntaxProblem);
        return (e as Error).message;
      }
      throw new Error('мала бути помилка: ' + src);
    };
    expect(fail('a = b')).toMatch(/==/);
    expect(fail('(1 + 2')).toMatch(/\)/);
    expect(fail('1 +')).toMatch(/обірвано/);
    expect(fail('')).toMatch(/Порожній/);
    expect(fail('2 $ 3')).toMatch(/Незрозумілий символ/);
    expect(fail('"текст')).toMatch(/лапки/);
    expect(fail('a b')).toMatch(/Зайве/);
    expect(() => tokenize('a ≤ b')).not.toThrow();
  });

  it('помилки виконання', () => {
    expect(() => ev('1 / 0')).toThrow(/Ділення на нуль/);
    expect(() => ev('1 div 0')).toThrow(/нуль/);
    expect(() => ev('1 % 0')).toThrow(/нуль/);
    expect(() => ev('x + 1')).toThrow(/«x» ще не має значення/);
    expect(() => ev('sqrt(-1)')).toThrow(/від’ємного/);
    expect(() => ev('ln(0)')).toThrow(/Логарифм/);
    expect(() => ev('foo(1)')).toThrow(/Невідома функція/);
    expect(() => ev('pow(2)')).toThrow(/аргументів: 2/);
    expect(() => ev('a', { a: new Map([[1, 1]]) })).toThrow(/масив/);
    expect(() => ev('a[1.5]', { a: new Map([[1, 1]]) })).toThrow(/цілим/);
    expect(() => ev('a[2]', { a: new Map([[1, 1]]) })).toThrow(/a\[2\]/);
    expect(() => ev('"a" * 2')).toThrow(/число/);
    expect(() => ev('"a" < 2')).toThrow(/порівнювати/);
    expect(() => ev('pow(10, 400)')).toThrow(/скінченним/);
    expect(() => ev('x', {})).toThrow(RuntimeProblem);
  });

  it('форматування виводу', () => {
    expect(formatValue(8)).toBe('8');
    expect(formatValue(-0)).toBe('0');
    expect(formatValue(1.41421)).toBe('1.414');
    expect(formatValue(2.5)).toBe('2.500');
    expect(formatValue(-0.0001)).toBe('0.000');
    expect(formatValue('так')).toBe('так');
  });
});

describe('текст блоків', () => {
  const ok = (type: FlowNode['type'], text: string) => compileBlock({ type, text });
  const bad = (type: FlowNode['type'], text: string) => {
    expect(() => compileBlock({ type, text })).toThrow();
    try {
      compileBlock({ type, text });
    } catch (e) {
      return (e as Error).message;
    }
    return '';
  };

  it('процес: одне чи кілька присвоєнь, := , елементи масиву', () => {
    expect(ok('process', 's = 0')).toMatchObject({
      assigns: [{ target: { name: 's', index: null } }],
    });
    expect(ok('process', 'a = 1; b = 2\nc := 3')).toMatchObject({ assigns: [{}, {}, {}] });
    expect(ok('process', 'a[i] = a[i] + 1')).toMatchObject({
      assigns: [{ target: { name: 'a' } }],
    });
    expect(ok('process', 'f = pow(2, n); g = (1; 2)'.split(';')[0]!)).toBeTruthy();
  });

  it('процес: помилки', () => {
    expect(bad('process', 'x + 1')).toMatch(/присвоєння/);
    expect(bad('process', 'x == 1')).toMatch(/присвоєння/);
    expect(bad('process', 'x <= 1')).toMatch(/присвоєння/);
    expect(bad('process', '2 = x')).toMatch(/не змінна/);
    expect(bad('process', 'і = 1')).toMatch(/не змінна/);
    expect(bad('process', '   ')).toMatch(/Порожній/);
    expect(bad('process', 'x = (1 + ')).toMatch(/біля|обірвано/);
  });

  it('введення й виведення: службове слово необов’язкове', () => {
    expect(ok('input', 'ввести n, m')).toMatchObject({ targets: [{ name: 'n' }, { name: 'm' }] });
    expect(ok('input', 'Введення: a[i]')).toMatchObject({ targets: [{ name: 'a' }] });
    expect(ok('input', 'x')).toMatchObject({ targets: [{ name: 'x' }] });
    expect(ok('output', 'вивести s, "текст", pow(2, 3)')).toMatchObject({ items: [{}, {}, {}] });
    expect(ok('output', 'Вивід: x')).toMatchObject({ items: [{ k: 'var' }] });
    expect(bad('input', 'ввести')).toMatch(/змінні/);
    expect(bad('input', 'ввести n + 1')).toMatch(/не змінна/);
    expect(bad('output', 'вивести')).toMatch(/вивести/);
  });

  it('цикл з параметром: різні записи', () => {
    expect(ok('for', 'i = 1 .. n')).toMatchObject({ variable: 'i', step: { k: 'num', v: 1 } });
    expect(ok('for', 'i = 10 .. 1 крок -1')).toMatchObject({ variable: 'i', step: { k: 'un' } });
    expect(ok('for', 'x = -2 .. 2 крок 0.5')).toMatchObject({ variable: 'x' });
    expect(ok('for', 'i = 1, n, 2')).toMatchObject({ step: { k: 'num', v: 2 } });
    expect(ok('for', 'i := a .. b КРОК 3')).toMatchObject({ step: { v: 3 } });
    expect(ok('for', 'i = 1 … n')).toMatchObject({ variable: 'i' });
    expect(bad('for', 'i від 1 до n')).toMatch(/i = 1 \.\. n/);
    expect(bad('for', 'n > 0')).toMatch(/i = 1 \.\. n/);
  });

  it('умови', () => {
    expect(ok('if', 'x > 0 і y < 5')).toMatchObject({ cond: { k: 'bin', op: '&&' } });
    expect(bad('while', 'x = 0')).toMatch(/==/);
  });
});

describe('виконання', () => {
  it('приклади з емулятора дають правильний результат', () => {
    const results = Object.fromEntries(
      FLOWCHART_EXAMPLES.map((e) => [e.id, exec(e.tree, e.input).out.join(' / ')]),
    );
    expect(results).toEqual({
      digits: '8',
      gcd: '6',
      table:
        '-2 4 / -1.500 2.250 / -1 1 / -0.500 0.250 / 0 0 / 0.500 0.707 / 1 1 / 1.500 1.225 / 2 1.414',
      max: '9 2',
    });
  });

  it('кожен крок — один блок; цикл перевіряє умову перед кожним проходом', () => {
    const tree = FLOWCHART_EXAMPLES[0]!.tree; // сума цифр
    const compiled = compile(tree);
    if (!compiled.ok) throw new Error();
    let s = createState(compiled.value, '12');
    const visited: string[] = [];
    while (s.status === 'running') {
      const pos = positionOf(s)!;
      const r = step(s);
      visited.push(pos.node === END ? 'end' : `${pos.node}:${r.event!.text}`);
      s = r.state;
    }
    // 1 ввести, 2 s=0, 3 цикл, 4 s+=, 5 n div
    expect(visited).toEqual([
      '1:введено: n = 12',
      '2:s = 0',
      '3:так',
      '4:s = 2',
      '5:n = 1',
      '3:так',
      '4:s = 3',
      '5:n = 0',
      '3:ні',
      '6:вивід: 3',
      'end',
    ]);
    expect(s.status).toBe('halted');
    expect(positionOf(s)).toBeNull();
  });

  it('розгалуження без гілки «ні»', () => {
    const tree = build([
      ['input', 'ввести x'],
      ['if', 'x < 0', [['process', 'x = -x']], []],
      ['output', 'вивести x'],
    ]);
    expect(exec(tree, '-5').out).toEqual(['5']);
    expect(exec(tree, '7').out).toEqual(['7']);
  });

  it('вкладені розгалуження й цикли', () => {
    // кількість додатних, від'ємних і нулів
    const tree = build([
      ['input', 'ввести n'],
      ['process', 'p = 0; m = 0; z = 0'],
      [
        'for',
        'i = 1 .. n',
        [
          ['input', 'ввести x'],
          [
            'if',
            'x > 0',
            [['process', 'p = p + 1']],
            [['if', 'x < 0', [['process', 'm = m + 1']], [['process', 'z = z + 1']]]],
          ],
        ],
      ],
      ['output', 'вивести p, m, z'],
    ]);
    expect(exec(tree, '6  1 -2 0 5 0 -7').out).toEqual(['2 2 2']);
  });

  it('цикл з параметром: від’ємний і дробовий крок, порожній цикл, межі обчислюються один раз', () => {
    const down = build([['for', 'i = 5 .. 1 крок -2', [['output', 'вивести i']]]]);
    expect(exec(down).out).toEqual(['5', '3', '1']);
    const frac = build([['for', 'x = 0 .. 1 крок 0.1', [['output', 'вивести x']]]]);
    expect(exec(frac).out).toHaveLength(11);
    expect(exec(frac).out.at(-1)).toBe('1');
    const none = build([
      ['for', 'i = 3 .. 1', [['output', 'вивести i']]],
      ['output', 'вивести "кінець"'],
    ]);
    expect(exec(none).out).toEqual(['кінець']);
    const once = build([
      ['process', 'n = 3'],
      [
        'for',
        'i = 1 .. n',
        [
          ['process', 'n = n + 1'],
          ['output', 'вивести i'],
        ],
      ],
    ]);
    expect(exec(once).out).toEqual(['1', '2', '3']);
    // після циклу параметр на крок далі за межу (як у C++ for)
    const after = build([
      ['for', 'i = 1 .. 3', []],
      ['output', 'вивести i'],
    ]);
    expect(exec(after).out).toEqual(['4']);
  });

  it('масиви: введення елементів, обмін, виведення', () => {
    const tree = build([
      ['input', 'ввести n'],
      ['for', 'i = 1 .. n', [['input', 'ввести a[i]']]],
      ['for', 'i = 1 .. n div 2', [['process', 't = a[i]; a[i] = a[n + 1 - i]; a[n + 1 - i] = t']]],
      ['for', 'i = 1 .. n', [['output', 'вивести a[i]']]],
    ]);
    expect(exec(tree, '5 1 2 3 4 5').out).toEqual(['5', '4', '3', '2', '1']);
  });

  it('вивід кількох значень в одному блоці — через пробіл; текст і дробові', () => {
    const tree = build([
      ['process', 'x = 1 / 3'],
      ['output', 'вивести "x =", x, 7'],
    ]);
    expect(exec(tree).out).toEqual(['x = 0.333 7']);
  });

  it('введення: числа з комою, текст, нестача даних', () => {
    const tree = build([
      ['input', 'ввести a, b'],
      ['output', 'вивести a + 1, b'],
    ]);
    expect(exec(tree, '2,5 слово').out).toEqual(['3.500 слово']);
    const r = exec(tree, '1');
    expect(r.status).toBe('crashed');
    expect(r.error).toMatch(/Вхідні дані закінчилися/);
  });

  it('аварійна зупинка показує блок і причину', () => {
    const tree = build([
      ['process', 'x = 1'],
      ['process', 'y = x / 0'],
    ]);
    const r = exec(tree);
    expect(r.status).toBe('crashed');
    expect(r.error).toBe('Ділення на нуль.');
    expect(r.state.steps).toBe(2);
  });

  it('нескінченний цикл зупиняє ліміт кроків', () => {
    const tree = build([
      ['process', 'n = 1'],
      ['while', 'n > 0', [['process', 'n = n + 1']]],
    ]);
    const r = exec(tree, '', 1000);
    expect(r.status).toBe('step-limit');
    expect(r.steps).toBe(1000);
  });

  it('змінна-масив і звичайна змінна не плутаються', () => {
    expect(
      exec(
        build([
          ['process', 'a = 1'],
          ['process', 'a[1] = 2'],
        ]),
      ).error,
    ).toMatch(/звичайна змінна/);
    expect(
      exec(
        build([
          ['process', 'a[1] = 1'],
          ['process', 'a = 2'],
        ]),
      ).error,
    ).toMatch(/масив/);
  });

  it('порожня схема одразу завершується кроком «Кінець»', () => {
    const r = exec([]);
    expect(r.status).toBe('halted');
    expect(r.steps).toBe(1);
  });

  it('стан не змінюється: кроки повертають нові об’єкти', () => {
    const compiled = compile(
      build([
        ['process', 'x = 1'],
        ['process', 'x = 2'],
      ]),
    );
    if (!compiled.ok) throw new Error();
    const s0 = createState(compiled.value, '');
    const s1 = step(s0).state;
    const s2 = step(s1).state;
    expect(s0.env.size).toBe(0);
    expect(s1.env.get('x')).toBe(1);
    expect(s2.env.get('x')).toBe(2);
  });

  it('змінні для таблиці: масиви впорядковано за індексом', () => {
    expect(
      describeEnv(
        new Map<string, number | Map<number, number>>([
          ['b', 2],
          [
            'a',
            new Map([
              [2, 5],
              [1, 3],
            ]),
          ],
        ]),
      ),
    ).toEqual([
      { name: 'a', value: '[1: 3, 2: 5]' },
      { name: 'b', value: '2' },
    ]);
  });

  it('вхідні дані: пробіли й переноси; «—» — даних немає', () => {
    expect(splitInput(' 1  2\n3 ')).toEqual(['1', '2', '3']);
    expect(splitInput('—')).toEqual([]);
    expect(splitInput('')).toEqual([]);
  });
});

describe('компіляція: помилки в блоках', () => {
  it('усі помилкові блоки з id', () => {
    const tree = build([
      ['process', 'x ='],
      ['while', 'n = 0', [['output', 'вивести']]],
    ]);
    const r = compile(tree);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.id)).toEqual([1, 2, 3]);
  });
});

describe('дерево: вставка, зміна, видалення', () => {
  const tree = build([
    ['process', 'a = 1'],
    ['while', 'a < 3', [['process', 'a = a + 1']]],
  ]);

  it('вставка в корінь, у тіло циклу, у гілки', () => {
    const id = nextId(tree);
    expect(id).toBe(4);
    const t1 = insertAt(
      tree,
      { parent: null, branch: null, index: 0 },
      makeNode('input', id, 'ввести a'),
    );
    expect(t1.map((n) => n.text)).toEqual(['ввести a', 'a = 1', 'a < 3']);
    const t2 = insertAt(
      t1,
      { parent: 2, branch: 'body', index: 1 },
      makeNode('output', 5, 'вивести a'),
    );
    expect(t2[2]!.body!.map((n) => n.text)).toEqual(['a = a + 1', 'вивести a']);
    expect(tree[1]!.body).toHaveLength(1); // вихідне дерево не змінилося
    const t3 = insertAt(t2, { parent: 2, branch: 'body', index: 0 }, makeNode('if', 6, 'a > 1'));
    const t4 = insertAt(t3, { parent: 6, branch: 'no', index: 0 }, makeNode('process', 7, 'b = 0'));
    expect(t4[2]!.body![0]!.no![0]!.text).toBe('b = 0');
  });

  it('зміна тексту й видалення разом із вкладеними блоками', () => {
    const t1 = updateText(tree, 3, 'a = a + 2');
    expect(t1[1]!.body![0]!.text).toBe('a = a + 2');
    expect(tree[1]!.body![0]!.text).toBe('a = a + 1');
    const t2 = removeNode(t1, 2);
    expect(Array.from(walk(t2)).map((n) => n.id)).toEqual([1]);
  });
});

describe('збереження', () => {
  it('serialize → deserialize зберігає дерево, вхідні дані й коментар', () => {
    const tree = FLOWCHART_EXAMPLES[1]!.tree;
    const text = serialize({ tree, input: '12 18', comment: 'НСД' });
    const back = deserialize(text);
    expect(cleanTree(back.tree)).toEqual(cleanTree(tree));
    expect(back.input).toBe('12 18');
    expect(back.comment).toBe('НСД');
  });

  it('пошкоджені дані — зрозумілі помилки', () => {
    expect(() => deserialize('{"machine":"flowchart","version":1,"tree":{}}')).toThrow(/список/);
    expect(() =>
      deserialize('{"machine":"flowchart","version":1,"tree":[{"type":"loop","text":"x"}]}'),
    ).toThrow(/невідомий тип/);
    expect(() => deserialize('{"machine":"post","version":1,"program":""}')).toThrow(
      /машини Поста/,
    );
  });

  it('повторні чи відсутні id виправляються', () => {
    const back = deserialize(
      '{"machine":"flowchart","version":1,"tree":[{"type":"process","text":"a = 1","id":1},{"type":"process","text":"b = 2","id":1},{"type":"if","text":"a > b"}]}',
    );
    const ids = Array.from(walk(back.tree)).map((n) => n.id);
    expect(new Set(ids).size).toBe(3);
    expect(back.tree[2]!.yes).toEqual([]);
  });

  it('текст для бази — компактний і стабільний', () => {
    const t = FLOWCHART_EXAMPLES[0]!.tree;
    expect(treeText(t)).toBe(treeText(JSON.parse(treeText(t)) as FlowNode[]));
  });
});

describe('розкладка за ГОСТ', () => {
  const boxes = (tree: FlowNode[]) => layout(tree).shapes;
  const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

  it('фігури за типом, «Початок» і «Кінець»', () => {
    const shapes = boxes(FLOWCHART_EXAMPLES[3]!.tree);
    expect(shapes[0]).toMatchObject({ kind: 'terminator', lines: ['Початок'] });
    expect(shapes.at(-1)).toMatchObject({ kind: 'terminator', lines: ['Кінець'], key: -1 });
    expect(shapes.map((s) => s.kind)).toContain('preparation');
    expect(shapes.map((s) => s.kind)).toContain('decision');
    expect(shapes.map((s) => s.kind)).toContain('data');
  });

  it('фігури не перетинаються навіть у глибоко вкладених конструкціях', () => {
    const deep = build([
      [
        'if',
        'a',
        [
          [
            'while',
            'b',
            [
              [
                'if',
                'c',
                [
                  ['process', 'x = 1'],
                  ['process', 'x = 2'],
                ],
                [['for', 'i = 1 .. 2', [['process', 'y = 1']]]],
              ],
            ],
          ],
        ],
        [['if', 'd', [['process', 'z = 1']], [['if', 'e', [], [['process', 'w = 1']]]]]],
      ],
    ]);
    const shapes = boxes(deep);
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++)
        expect(overlap(shapes[i]!, shapes[j]!)).toBe(false);
    }
    const l = layout(deep);
    for (const s of l.shapes) {
      expect(s.x - s.w / 2).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w / 2).toBeLessThanOrEqual(l.width);
      expect(s.y + s.h).toBeLessThanOrEqual(l.height);
    }
  });

  it('потік згори вниз: блоки послідовності йдуть один під одним', () => {
    const shapes = boxes(FLOWCHART_EXAMPLES[0]!.tree).filter((s) => s.id !== null);
    const top = shapes.filter((s) => [1, 2, 3, 6].includes(s.id!));
    for (let i = 1; i < top.length; i++)
      expect(top[i]!.y).toBeGreaterThan(top[i - 1]!.y + top[i - 1]!.h);
    expect(new Set(top.map((s) => s.x)).size).toBe(1);
  });

  it('місце «+» у кожному проміжку, зокрема в порожніх гілках і тілах', () => {
    const tree = build([
      ['if', 'x', [], []],
      ['while', 'y', []],
    ]);
    const slots = layout(tree).plus.map((p) => `${p.slot.parent}:${p.slot.branch}:${p.slot.index}`);
    expect(slots.sort()).toEqual(
      ['1:no:0', '1:yes:0', '2:body:0', 'null:null:0', 'null:null:1', 'null:null:2'].sort(),
    );
  });

  it('цикл має стрілку повернення вгору і стрілку виходу; розгалуження — підписи так/ні', () => {
    const l = layout(build([['while', 'n > 0', [['process', 'n = n - 1']]]]));
    expect(l.lines.filter((x) => x.arrow)).toHaveLength(2);
    expect(l.labels.map((x) => x.text)).toEqual(['так', 'ні']);
  });

  it('перенесення тексту в межах символу', () => {
    expect(wrapText('s = s + a[i] * a[i] + b', 16)).toEqual(['s = s + a[i] *', 'a[i] + b']);
    expect(wrapText('довгий_ідентифікатор_без_пробілів', 10).length).toBeLessThanOrEqual(3);
    expect(wrapText('a b c d e f g h i j k l m n o p q r s t u v w x y z', 4).at(-1)).toMatch(/…$/);
  });

  it('SVG для звіту: чорно-білий, без «+», з текстом блоків', () => {
    const svg = toSvg(layout(FLOWCHART_EXAMPLES[1]!.tree));
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('a != b');
    expect(svg).toContain('Початок');
    expect(svg).not.toContain('+</text>');
    expect(svg).toContain('marker-end');
    expect(svg).toContain('&gt;'); // «a > b» екрановано
  });
});

describe('перевірка на тестах (сторінка завдання)', () => {
  it('порівнюються лексеми виводу, а не пробіли й переноси', async () => {
    const { checkFlowchart } = await import('../../tasks/check');
    const compiled = compile(FLOWCHART_EXAMPLES[2]!.tree); // табулювання
    if (!compiled.ok) throw new Error();
    const expected = '-2 4 -1.500 2.250 -1 1 -0.500 0.250 0 0 0.500 0.707 1 1 1.500 1.225 2 1.414';
    const ok = checkFlowchart(compiled.value, [{ input: '—', expected, checkHead: false }]);
    expect(ok.solved).toBe(true);
    const bad = checkFlowchart(compiled.value, [
      { input: '', expected: '1 2 3', checkHead: false },
    ]);
    expect(bad.results[0]).toMatchObject({ verdict: 'wrong-tape', passed: false });
    expect(bad.results[0]!.reason).toMatch(/вивід не такий/);
  });

  it('аварія й зациклення — окремі вердикти', async () => {
    const { checkFlowchart } = await import('../../tasks/check');
    const crash = compile(
      build([
        ['input', 'ввести n'],
        ['output', 'вивести 1 / n'],
      ]),
    );
    const loop = compile(build([['while', '1', []]]));
    if (!crash.ok || !loop.ok) throw new Error();
    expect(
      checkFlowchart(crash.value, [{ input: '0', expected: '1', checkHead: false }]).results[0],
    ).toMatchObject({
      verdict: 'crashed',
    });
    expect(
      checkFlowchart(loop.value, [{ input: '', expected: '', checkHead: false }], 500).results[0],
    ).toMatchObject({ verdict: 'step-limit' });
  });
});

describe('однакові схеми', () => {
  it('структура без id і пробілів; букви не губляться', async () => {
    const { treeShape } = await import('./index');
    const a = build([['process', 's = s + 1']]);
    const b = build([['process', 's=s+1']], { id: 50 });
    const c = build([['process', 't = t + 1']]);
    expect(treeShape(a)).toBe(treeShape(b));
    expect(treeShape(a)).not.toBe(treeShape(c));
  });
});
