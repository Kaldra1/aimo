/** Вбудовані приклади емулятора машини Тюрінга. Таблиця: стан → символ → клітинка. */

export interface TuringExample {
  id: string;
  title: string;
  alphabet: string;
  states: number;
  table: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Вхідна стрічка в нотації. */
  input: string;
}

const increment: Record<string, string> = { '9': '0L', λ: '1N!' };
for (let digit = 0; digit < 9; digit++) increment[String(digit)] = `${digit + 1}N!`;

export const TURING_EXAMPLES: readonly TuringExample[] = [
  {
    id: 'increment',
    title: 'Додати одиницю до десяткового числа',
    alphabet: '0123456789',
    states: 1,
    // Каретка на останній цифрі: 9 → 0 і перенесення ліворуч, інша цифра — +1 і зупинка.
    table: { q0: increment },
    input: '19[9]',
  },
  {
    id: 'invert',
    title: 'Інвертувати двійкове слово',
    alphabet: '01',
    states: 1,
    table: { q0: { '0': '1R', '1': '0R', λ: 'N!' } },
    input: '10110',
  },
  {
    id: 'double',
    title: 'Подвоїти блок одиниць',
    alphabet: '1ab',
    states: 5,
    // q0: позначити наступну одиницю (a); q1: дописати b в кінці; q2: повернутися до останньої a;
    // q3: замінити a на 1, рухаючись ліворуч; q4: замінити b на 1, рухаючись праворуч.
    table: {
      q0: { '1': 'aRq1', b: 'Lq3', λ: 'N!' },
      q1: { '1': 'R', b: 'R', λ: 'bLq2' },
      q2: { '1': 'L', b: 'L', a: 'Rq0' },
      q3: { a: '1L', λ: 'Rq4' },
      q4: { '1': 'R', b: '1R', λ: 'N!' },
    },
    input: '111',
  },
];
