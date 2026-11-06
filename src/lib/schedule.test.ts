import { describe, expect, it } from 'vitest';
import { isNumerator, nextClass, weekNumber } from './schedule';

describe('weekNumber', () => {
  it('рахує тижні від понеділка першого тижня', () => {
    expect(weekNumber(new Date(2026, 7, 31))).toBe(1);
    expect(weekNumber(new Date(2026, 8, 6))).toBe(1);
    expect(weekNumber(new Date(2026, 8, 7))).toBe(2);
    expect(weekNumber(new Date(2026, 9, 29))).toBe(9);
  });

  it('непарні тижні — чисельник', () => {
    expect(isNumerator(1)).toBe(true);
    expect(isNumerator(2)).toBe(false);
  });
});

describe('nextClass', () => {
  it('у четвер знаменника показує п’ятничну лабораторну КІ-2407', () => {
    // 5 листопада — 10-й тиждень (знаменник)
    const next = nextClass(new Date(2026, 10, 5, 10, 0));
    expect(next?.slot.who).toBe('КІ-2407');
    expect(next?.date.getDate()).toBe(6);
    expect(next?.live).toBe(false);
  });

  it('позначає пару, що йде', () => {
    const next = nextClass(new Date(2026, 10, 6, 16, 10));
    expect(next?.slot.who).toBe('КІ-2408');
    expect(next?.live).toBe(true);
  });

  it('лабораторні лише по знаменниках', () => {
    // 29 жовтня — четвер 9-го тижня (чисельник): наступна пара — понеділкова лекція 2 листопада
    const next = nextClass(new Date(2026, 9, 29, 10, 0));
    expect(next?.slot.kind).toBe('lecture');
    expect(next?.date.getDate()).toBe(2);
  });

  it('понеділкова лекція лише по знаменниках', () => {
    // 2 листопада — 10-й тиждень (знаменник), 9 листопада — 11-й (чисельник)
    expect(nextClass(new Date(2026, 10, 2, 9, 0))?.slot.day).toBe(1);
    expect(nextClass(new Date(2026, 10, 9, 9, 0))?.slot.day).toBe(2);
  });
});
