/** Вбудовані приклади конструктора блок-схем (лекція 9 і ЛР3). */
import { makeNode, type BlockType, type FlowNode } from './program';

export interface FlowExample {
  id: string;
  title: string;
  tree: FlowNode[];
  input: string;
  comment: string;
}

type Spec = [BlockType, string, ...Spec[][]];

/** Короткий запис дерева: ['while', 'n > 0', [тіло]], ['if', 'a > b', [так], [ні]]. */
export function build(specs: Spec[], counter = { id: 1 }): FlowNode[] {
  return specs.map(([type, text, first, second]) => {
    const node = makeNode(type, counter.id++, text);
    if (type === 'if') {
      node.yes = build(first ?? [], counter);
      node.no = build(second ?? [], counter);
    } else if (type === 'while' || type === 'for') node.body = build(first ?? [], counter);
    return node;
  });
}

export const FLOWCHART_EXAMPLES: readonly FlowExample[] = [
  {
    id: 'digits',
    title: 'Сума цифр натурального числа',
    tree: build([
      ['input', 'ввести n'],
      ['process', 's = 0'],
      [
        'while',
        'n > 0',
        [
          ['process', 's = s + n % 10'],
          ['process', 'n = n div 10'],
        ],
      ],
      ['output', 'вивести s'],
    ]),
    input: '2024',
    comment: [
      'Остання цифра числа — остача від ділення на 10 (n % 10), а n div 10 відкидає її.',
      'Поки число не стало нулем, додаємо останню цифру до суми й відкидаємо її.',
    ].join('\n'),
  },
  {
    id: 'gcd',
    title: 'НСД: алгоритм Евкліда',
    tree: build([
      ['input', 'ввести a, b'],
      [
        'while',
        'a != b',
        [['if', 'a > b', [['process', 'a = a - b']], [['process', 'b = b - a']]]],
      ],
      ['output', 'вивести a'],
    ]),
    input: '12 18',
    comment:
      'Від більшого числа віднімаємо менше, поки числа не зрівняються. Спільне значення — НСД.',
  },
  {
    id: 'table',
    title: 'Табулювання функції',
    tree: build([
      [
        'for',
        'x = -2 .. 2 крок 0.5',
        [
          ['if', 'x < 0', [['process', 'y = x * x']], [['process', 'y = sqrt(x)']]],
          ['output', 'вивести x, y'],
        ],
      ],
    ]),
    input: '',
    comment: 'y = x² для x < 0 і y = √x для x ≥ 0 на відрізку [−2; 2] з кроком 0,5.',
  },
  {
    id: 'max',
    title: 'Найбільший елемент масиву',
    tree: build([
      ['input', 'ввести n'],
      ['for', 'i = 1 .. n', [['input', 'ввести a[i]']]],
      ['process', 'max = a[1]; k = 1'],
      ['for', 'i = 2 .. n', [['if', 'a[i] > max', [['process', 'max = a[i]; k = i']], []]]],
      ['output', 'вивести max, k'],
    ]),
    input: '5  3 9 2 9 4',
    comment:
      'Спершу вводимо n і n елементів. Потім вважаємо найбільшим перший і порівнюємо з ним решту; k — номер першого входження.',
  },
];
