import { describe, expect, it } from 'vitest';
import {
  averageOf,
  cellKey,
  draftToWrites,
  editDraft,
  journalSessions,
  parseGradeInput,
} from './journal';

describe('журнал', () => {
  it('стовпці занять у порядку журналу', () => {
    expect(journalSessions()).toEqual([
      'lab-01',
      'lab-02',
      'practical-01',
      'practical-02',
      'lab-03',
      'practical-03',
      'lab-04',
      'practical-04',
    ]);
  });

  it('нездане рахується як 2, округлення вниз', () => {
    expect(averageOf([5, 4, 3, null])).toEqual({ grade: 3, mean: 3.5, missing: 1 });
    expect(averageOf([5, 5, 5, 4])).toEqual({ grade: 4, mean: 4.75, missing: 0 });
    expect(averageOf([5, 5, 5, 5])).toEqual({ grade: 5, mean: 5, missing: 0 });
    expect(averageOf([3, null])).toEqual({ grade: 2, mean: 2.5, missing: 1 });
    expect(averageOf([null, null])).toEqual({ grade: null, mean: null, missing: 2 });
  });

  it('введення в клітинку', () => {
    expect(parseGradeInput(' 4 ')).toBe(4);
    expect(parseGradeInput('')).toBeNull();
    expect(parseGradeInput('6')).toBeUndefined();
    expect(parseGradeInput('1')).toBeUndefined();
    expect(parseGradeInput('а')).toBeUndefined();
  });
});

describe('чернетка змін', () => {
  const key = cellKey('u1', 'lab-01');

  it('зміна, що повертає збережене значення, зникає з чернетки', () => {
    const changed = editDraft(new Map(), key, 5, 4);
    expect(changed.get(key)).toBe(5);
    expect(editDraft(changed, key, 4, 4).size).toBe(0);
  });

  it('записи й видалення', () => {
    const draft = new Map([
      [cellKey('u1', 'lab-01'), 5 as const],
      [cellKey('u2', 'topic-1'), null],
    ]);
    expect(draftToWrites(draft)).toEqual({
      upserts: [{ user_id: 'u1', item: 'lab-01', grade: 5 }],
      deletes: [{ user_id: 'u2', item: 'topic-1' }],
    });
  });
});
