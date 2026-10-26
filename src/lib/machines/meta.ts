/** Перелік машин і їхні назви. Модуль без залежностей: його імпортують і сторінки, і острови. */

export const MACHINES = ['post', 'turing', 'markov', 'flowchart', 'sorting', 'cpp'] as const;
export type MachineId = (typeof MACHINES)[number];

export function isMachineId(value: unknown): value is MachineId {
  return typeof value === 'string' && (MACHINES as readonly string[]).includes(value);
}

/** `ready: false` — сторінка-заглушка «Скоро», емулятор ще в розробці. */
export const MACHINE_META: Record<
  MachineId,
  { title: string; genitive: string; path: string; summary: string; ready: boolean }
> = {
  post: {
    title: 'Машина Поста',
    genitive: 'машини Поста',
    path: '/emulators/post/',
    summary: 'Стрічка з мітками, каретка й програма з команд →, ←, V, X, ? та !.',
    ready: true,
  },
  turing: {
    title: 'Машина Тюрінга',
    genitive: 'машини Тюрінга',
    path: '/emulators/turing/',
    summary: 'Власний алфавіт, таблиця переходів і журнал конфігурацій.',
    ready: true,
  },
  markov: {
    title: 'Нормальні алгоритми Маркова',
    genitive: 'нормальних алгоритмів Маркова',
    path: '/emulators/markov/',
    summary: 'Схема підстановок, підсвітка заміни й трасувальна таблиця.',
    ready: true,
  },
  flowchart: {
    title: 'Блок-схеми',
    genitive: 'конструктора блок-схем',
    path: '/emulators/flowchart/',
    summary: 'Схема алгоритму за ГОСТ 19.701 з блоків: покрокове виконання, змінні й вивід.',
    ready: true,
  },
  sorting: {
    title: 'Сортування масивів',
    genitive: 'візуалізатора сортувань',
    path: '/emulators/sorting/',
    summary: 'Бульбашка, вибір і вставки покроково: стовпчики масиву, код з лекції й лічильники.',
    ready: true,
  },
  cpp: {
    title: 'Виконання C++ покроково',
    genitive: 'візуалізатора C++',
    path: '/emulators/cpp/',
    summary: 'Навчальна підмножина C++: поточний рядок, змінні, стек викликів і масив комірками.',
    ready: false,
  },
};
