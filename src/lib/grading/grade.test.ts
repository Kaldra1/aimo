import { describe, expect, it } from 'vitest';
import {
  averageRecommendation,
  capFor,
  daysBetween,
  recommendGrade,
  type SolvedTask,
} from './grade';

const at = (iso: string) => new Date(iso);
const task = (stars: 1 | 2 | 3, iso: string): SolvedTask => ({ stars, solvedAt: at(iso) });
const session = at('2026-10-01T10:00:00');

describe('рекомендована оцінка', () => {
  it('без ★ оцінки немає', () => {
    expect(recommendGrade([task(2, '2026-10-02')], session).grade).toBeNull();
    expect(recommendGrade([], session).reason).toMatch(/★ не виконано/);
  });

  it('обсяг: ★ — 3, до ★★ — 4, до ★★★ — 5', () => {
    expect(recommendGrade([task(1, '2026-10-02')], session).grade).toBe(3);
    expect(recommendGrade([task(1, '2026-10-02'), task(2, '2026-10-03')], session).grade).toBe(4);
    expect(
      recommendGrade([task(1, '2026-10-02'), task(2, '2026-10-03'), task(3, '2026-10-05')], session)
        .grade,
    ).toBe(5);
  });

  it('термін: до 14 днів без обмежень, до 28 — не вище 4, далі — не вище 3', () => {
    const all = (iso: string) => [task(1, iso), task(2, iso), task(3, iso)];
    expect(recommendGrade(all('2026-10-15T23:00'), session)).toMatchObject({ grade: 5, days: 14 });
    expect(recommendGrade(all('2026-10-16T08:00'), session)).toMatchObject({ grade: 4, days: 15 });
    expect(recommendGrade(all('2026-10-29'), session)).toMatchObject({ grade: 4, days: 28 });
    expect(recommendGrade(all('2026-10-30'), session)).toMatchObject({ grade: 3, days: 29 });
  });

  it('пізня ★★★ не знижує вже заробленого', () => {
    const r = recommendGrade(
      [task(1, '2026-10-02'), task(2, '2026-10-03'), task(3, '2026-11-20')],
      session,
    );
    // ★★ вчасно дає 4, ★★★ запізно — лише 3: лишається 4.
    expect(r).toMatchObject({ byVolume: 5, grade: 4, days: 2 });
  });

  it('без дати заняття термін не враховується', () => {
    const r = recommendGrade([task(1, '2026-12-31'), task(2, '2026-12-31')]);
    expect(r).toMatchObject({ grade: 4, cap: null, days: null });
    expect(r.reason).toMatch(/Дату заняття не задано/);
  });

  it('повторне розв’язання не зсуває дату — враховується перше', () => {
    const r = recommendGrade([task(1, '2026-10-02'), task(1, '2026-11-30')], session);
    expect(r).toMatchObject({ grade: 3, days: 1 });
  });
});

describe('допоміжні функції', () => {
  it('дні рахуються за календарем, без годин', () => {
    expect(daysBetween(at('2026-10-01T23:59'), at('2026-10-02T00:01'))).toBe(1);
  });

  it('обмеження за днями', () => {
    expect([0, 14, 15, 28, 29, 100].map((d) => capFor(d))).toEqual([5, 5, 4, 4, 3, 3]);
  });
});

describe('тематичні й семестрова оцінки', () => {
  const item = (label: string, grade: 3 | 4 | 5 | null) => ({ label, grade });

  it('середнє з округленням 3,5 → 4', () => {
    expect(averageRecommendation([item('ЛР1', 3), item('ПЗ1', 4)])).toMatchObject({
      grade: 4,
      mean: 3.5,
    });
    expect(
      averageRecommendation([item('ЛР1', 3), item('ЛР2', 3), item('ПЗ1', 4), item('ПЗ2', 4)])
        .reason,
    ).toBe('Середнє 3,5 → «добре».');
    expect(averageRecommendation([item('a', 4), item('b', 4), item('c', 5)])).toMatchObject({
      grade: 4,
      mean: 4.33,
    });
  });

  it('неоцінені складові — рекомендації немає', () => {
    const r = averageRecommendation([item('ЛР1', 5), item('ПЗ2', null)]);
    expect(r).toMatchObject({ grade: null, missing: ['ПЗ2'] });
    expect(r.reason).toBe('Ще не оцінено: ПЗ2.');
  });

  it('семестрова — із тематичних', () => {
    expect(
      averageRecommendation([item('Тема 2', 4), item('Тема 3', 5), item('Тема 4', 3)]).grade,
    ).toBe(4);
  });
});
