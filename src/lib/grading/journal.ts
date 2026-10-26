/**
 * Журнал оцінок викладача: як таблиця в Google Sheets — семестрова, тематичні й заняття.
 * Тематичні тут — атестаційні (як у журналі групи), а не теми програми курсу.
 */
import type { Grade } from './grade';

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
  /** Оцінка, округлена вниз (3,75 → 3); null — немає жодної оцінки. */
  grade: Grade | null;
  /** Середнє з двома знаками. */
  mean: number | null;
  /** Скільки складових без оцінки (рахуються як 2). */
  missing: number;
}

/** Найнижча оцінка шкали: нездане заняття — «незадовільно», а не нуль. */
export const UNSATISFACTORY: Grade = 2;

/**
 * Тематична чи семестрова: середнє за шкалою 2–5, де нездане (порожня клітинка) — 2,
 * округлене вниз. Приклад: 5, 4, 3 і нездане → (5 + 4 + 3 + 2) / 4 = 3,5 → 3.
 * Поки немає жодної оцінки, рахувати нічого — null.
 */
export function averageOf(values: readonly (Grade | null)[]): Average {
  const missing = values.filter((v) => v === null).length;
  if (missing === values.length) return { grade: null, mean: null, missing };
  const sum = values.reduce<number>((total, v) => total + (v ?? UNSATISFACTORY), 0);
  const mean = Math.round((sum / values.length) * 100) / 100;
  return { grade: Math.floor(mean) as Grade, mean, missing };
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
