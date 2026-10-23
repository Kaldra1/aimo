/**
 * Рекомендована оцінка за індивідуальні завдання заняття. Остаточну оцінку ставить викладач;
 * це лише підказка в дашборді.
 *
 *  - Обсяг: найвище виконане завдання (★, ★★, ★★★) дає базову оцінку. Без ★ оцінки немає.
 *  - Термін: від дати проведення заняття — до 2 тижнів без обмежень, до 4 тижнів не вище «добре»,
 *    далі не вище «задовільно».
 *  - Рекомендована оцінка — менша з двох. Якщо дати заняття немає, термін не враховується.
 */

export type Grade = 3 | 4 | 5;
export type Stars = 1 | 2 | 3;

export const GRADE_LABELS: Record<Grade, string> = {
  5: 'відмінно',
  4: 'добре',
  3: 'задовільно',
};

export interface GradingRules {
  /** Базова оцінка за найвищим виконаним завданням. */
  byStars: Record<Stars, Grade>;
  /** Вікна від дати заняття: до `days` днів включно оцінка не вища за `cap`. Упорядковані за days. */
  windows: readonly { days: number; cap: Grade }[];
  /** Після всіх вікон. */
  lateCap: Grade;
}

export const DEFAULT_RULES: GradingRules = {
  byStars: { 1: 3, 2: 4, 3: 5 },
  windows: [
    { days: 14, cap: 5 },
    { days: 28, cap: 4 },
  ],
  lateCap: 3,
};

export interface SolvedTask {
  stars: Stars;
  /** Коли завдання пройшло перевірку. */
  solvedAt: Date;
}

export interface Recommendation {
  /** null — обов'язкове завдання ★ не виконано. */
  grade: Grade | null;
  /** Оцінка за обсягом, без урахування терміну. */
  byVolume: Grade | null;
  /** Обмеження за терміном; null — дата заняття невідома. */
  cap: Grade | null;
  /** Скільки днів минуло від заняття до виконання врахованого завдання. */
  days: number | null;
  /** Пояснення для викладача. */
  reason: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** Повні календарні дні між датами (за місцевим часом, без урахування годин). */
export function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / DAY);
}

export function capFor(days: number, rules: GradingRules = DEFAULT_RULES): Grade {
  return rules.windows.find((window) => days <= window.days)?.cap ?? rules.lateCap;
}

export function recommendGrade(
  solved: readonly SolvedTask[],
  sessionDate: Date | null = null,
  rules: GradingRules = DEFAULT_RULES,
): Recommendation {
  const required = solved.filter((task) => task.stars === 1);
  if (required.length === 0) {
    return {
      grade: null,
      byVolume: null,
      cap: null,
      days: null,
      reason: 'Обов’язкове завдання ★ не виконано.',
    };
  }
  // Кожне виконане завдання дає кандидата: оцінка за обсягом, обмежена терміном його першого
  // розв'язання. Беремо найкращого — пізнє доробляння ★★★ не знижує вже заробленого.
  const levels = ([1, 2, 3] as const).filter((stars) => solved.some((t) => t.stars === stars));
  const firstSolve = (stars: Stars) =>
    new Date(Math.min(...solved.filter((t) => t.stars === stars).map((t) => t.solvedAt.getTime())));
  const top = levels[levels.length - 1]!;
  const byVolume = rules.byStars[top];

  if (sessionDate === null) {
    return {
      grade: byVolume,
      byVolume,
      cap: null,
      days: null,
      reason: `Виконано до ${'★'.repeat(top)} включно — «${GRADE_LABELS[byVolume]}». Дату заняття не задано, тож термін не враховано.`,
    };
  }

  const candidates = levels.map((stars) => {
    const days = daysBetween(sessionDate, firstSolve(stars));
    const cap = capFor(days, rules);
    return { stars, days, cap, grade: Math.min(rules.byStars[stars], cap) as Grade };
  });
  const best = candidates.reduce((x, y) =>
    y.grade > x.grade || (y.grade === x.grade && y.stars > x.stars) ? y : x,
  );
  const late =
    best.cap < rules.byStars[best.stars]
      ? `, але здано через ${best.days} дн. після заняття — не вище «${GRADE_LABELS[best.cap]}»`
      : '';
  return {
    grade: best.grade,
    byVolume,
    cap: best.cap,
    days: best.days,
    reason: `Враховано ${'★'.repeat(best.stars)} — «${GRADE_LABELS[rules.byStars[best.stars]]}»${late}.`,
  };
}
