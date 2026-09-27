/** Перелік машин і їхні назви. Модуль без залежностей: його імпортують і сторінки, і острови. */

export const MACHINES = ['post', 'turing', 'markov'] as const;
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
    ready: false,
  },
};
