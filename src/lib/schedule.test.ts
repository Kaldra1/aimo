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
  it('у четвер показує п’ятничну пару КІ-2407', () => {
    const next = nextClass(new Date(2026, 9, 29, 10, 0));
    expect(next?.slot.who).toBe('КІ-2407');
    expect(next?.date.getDate()).toBe(30);
    expect(next?.live).toBe(false);
  });

  it('позначає пару, що йде', () => {
    const next = nextClass(new Date(2026, 9, 30, 14, 40));
    expect(next?.slot.who).toBe('КІ-2408');
    expect(next?.live).toBe(true);
  });

  it('понеділкова лекція лише по знаменниках', () => {
    // 2 листопада — 10-й тиждень (знаменник), 9 листопада — 11-й (чисельник)
    expect(nextClass(new Date(2026, 10, 2, 9, 0))?.slot.day).toBe(1);
    expect(nextClass(new Date(2026, 10, 9, 9, 0))?.slot.day).toBe(2);
  });
});
