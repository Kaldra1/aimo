/** Підписи й адреси задач. Модуль без залежностей: його імпортують і сторінки, і острови. */

export type Difficulty = 1 | 2 | 3;

export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3];

/** Як у лабораторній роботі 2: ★ — базова, ★★ — середня, ★★★ — підвищена. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'базова',
  2: 'середня',
  3: 'підвищена',
};

/** Зірочки складності: `★★☆`. */
export function stars(difficulty: Difficulty): string {
  return '★'.repeat(difficulty) + '☆'.repeat(3 - difficulty);
}

export const difficultyText = (difficulty: Difficulty) =>
  `Складність: ${DIFFICULTY_LABELS[difficulty]} (${difficulty} з 3)`;

export const taskPath = (id: string) => `/tasks/${id}/`;

/** Автозбереження програми задачі — окреме для кожної задачі. */
export const taskStorageKey = (id: string) => `aimo:task:${id}`;

const dateFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long' });

/** «27 вересня 2026 р.» */
export function formatSolvedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}
