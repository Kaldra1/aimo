/** Розклад пар курсу: дні, зміна, чисельник і знаменник. */

/** Понеділок першого навчального тижня (чисельник). */
export const SEMESTER_START = '2026-08-31';

export const ZOOM_URL =
  'https://us05web.zoom.us/j/89047765439?pwd=phguhD7Y6bxHsHjPJqnHiQiCawoH91.1';

/** Пари другої зміни. */
export const PERIODS = {
  4: { start: '13:00', end: '14:20' },
  5: { start: '14:30', end: '15:50' },
  6: { start: '16:00', end: '17:20' },
} as const;

export type Period = keyof typeof PERIODS;
/** odd — чисельник (1, 3, 5… тиждень), even — знаменник (2, 4, 6…). */
export type Weeks = 'every' | 'odd' | 'even';

export interface Slot {
  /** 1 — понеділок … 5 — п'ятниця. */
  day: 1 | 2 | 3 | 4 | 5;
  period: Period;
  weeks: Weeks;
  kind: 'lecture' | 'seminar';
  /** Потік або група. */
  who: string;
}

export const SLOTS: Slot[] = [
  { day: 1, period: 6, weeks: 'even', kind: 'lecture', who: 'Потік' },
  { day: 2, period: 6, weeks: 'every', kind: 'lecture', who: 'Потік' },
  { day: 3, period: 4, weeks: 'every', kind: 'seminar', who: 'КІ-2406' },
  { day: 5, period: 4, weeks: 'every', kind: 'seminar', who: 'КІ-2407' },
  { day: 5, period: 5, weeks: 'every', kind: 'seminar', who: 'КІ-2408' },
];

export const DAY_NAMES = ['', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця"] as const;
export const KIND_LABELS = { lecture: 'Лекція', seminar: 'ЛР або ПР' } as const;
export const WEEKS_LABELS = { every: 'Щотижня', odd: 'Чисельник', even: 'Знаменник' } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const dayIndex = (d: Date) =>
  Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);

/** Номер навчального тижня для місцевої дати (1 — тиждень SEMESTER_START). */
export function weekNumber(date: Date): number {
  const [y, m, d] = SEMESTER_START.split('-').map(Number);
  const start = dayIndex(new Date(y!, m! - 1, d!));
  return Math.floor((dayIndex(date) - start) / 7) + 1;
}

export const isNumerator = (week: number) => week % 2 !== 0;

export function slotRuns(slot: Slot, week: number): boolean {
  return slot.weeks === 'every' || (slot.weeks === 'odd') === isNumerator(week);
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

export interface Upcoming {
  slot: Slot;
  /** Місцева дата пари (північ). */
  date: Date;
  /** Пара вже йде. */
  live: boolean;
}

/** Найближча пара: та, що йде зараз, або наступна за розкладом (до двох тижнів уперед). */
export function nextClass(now: Date): Upcoming | undefined {
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset < 15; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const week = weekNumber(date);
    if (week < 1) continue;
    const day = date.getDay();
    const slots = SLOTS.filter((s) => s.day === day && slotRuns(s, week)).sort(
      (a, b) => a.period - b.period,
    );
    for (const slot of slots) {
      const { start, end } = PERIODS[slot.period];
      if (offset === 0 && minutes >= toMinutes(end)) continue;
      return { slot, date, live: offset === 0 && minutes >= toMinutes(start) };
    }
  }
  return undefined;
}
