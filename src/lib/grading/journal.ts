/**
 * Журнал оцінок викладача: як таблиця в Google Sheets — семестрова, тематичні й заняття.
 * Тематичні тут — атестаційні (як у журналі групи), а не теми програми курсу.
 */
import { roundGrade, type Grade } from './grade';

export interface JournalTopic {
  /** Ключ оцінки в базі: topic-1. */
  item: string;
  label: string;
  /** Заняття теми в порядку журналу. */
  sessions: readonly string[];
}

export const JOURNAL_TOPICS: readonly JournalTopic[] = [
  {
    item: 'topic-1',
    label: 'Тема 1',
    sessions: ['lab-01', 'lab-02', 'practical-01', 'practical-02'],
  },
  {
    item: 'topic-2',
    label: 'Тема 2',
    sessions: ['lab-03', 'practical-03', 'lab-04', 'practical-04'],
  },
];

export const SEMESTER_ITEM = 'semester';

/** Заняття в порядку стовпців журналу. */
export const journalSessions = () => JOURNAL_TOPICS.flatMap((topic) => topic.sessions);

export interface Average {
  /** Округлена оцінка (3,5 → 4); null — немає жодної оцінки. */
  grade: Grade | null;
  /** Середнє з двома знаками. */
  mean: number | null;
  /** Скільки складових ще без оцінки. */
  missing: number;
}

/** Середнє наявних оцінок, як AVERAGE у таблиці: порожні клітинки пропускаються. */
export function averageOf(values: readonly (Grade | null)[]): Average {
  const grades = values.filter((v): v is Grade => v !== null);
  const missing = values.length - grades.length;
  if (grades.length === 0) return { grade: null, mean: null, missing };
  const mean = Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 100) / 100;
  return { grade: roundGrade(mean), mean, missing };
}

export const formatMean = (mean: number) => String(mean).replace('.', ',');

/** Що ввів викладач у клітинку: оцінка, порожньо (зняти) або помилка. */
export function parseGradeInput(text: string): Grade | null | undefined {
  const value = text.trim();
  if (value === '') return null;
  return /^[2-5]$/.test(value) ? (Number(value) as Grade) : undefined;
}

// ---------- Чернетка змін ----------

/** Незбережені зміни: «userId|item» → нова оцінка або null (зняти оцінку). */
export type Draft = ReadonlyMap<string, Grade | null>;

export const cellKey = (userId: string, item: string) => `${userId}|${item}`;

/**
 * Додає зміну до чернетки. Якщо значення збігається зі збереженим, зміна зникає —
 * лічильник «незбережених змін» показує лише справжні відмінності.
 */
export function editDraft(
  draft: Draft,
  key: string,
  value: Grade | null,
  saved: Grade | null,
): Map<string, Grade | null> {
  const next = new Map(draft);
  if (value === saved) next.delete(key);
  else next.set(key, value);
  return next;
}

/** Чернетка → що записати й що видалити в базі. */
export function draftToWrites(draft: Draft): {
  upserts: { user_id: string; item: string; grade: Grade }[];
  deletes: { user_id: string; item: string }[];
} {
  const upserts: { user_id: string; item: string; grade: Grade }[] = [];
  const deletes: { user_id: string; item: string }[] = [];
  for (const [key, grade] of draft) {
    const [user_id, item] = key.split('|') as [string, string];
    if (grade === null) deletes.push({ user_id, item });
    else upserts.push({ user_id, item, grade });
  }
  return { upserts, deletes };
}
