import { describe, expect, it } from 'vitest';
import {
  LocalProgressStore,
  mergeProgress,
  parseProgress,
  PROGRESS_KEY,
  type KeyValueStorage,
} from './progress';

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const at = (iso: string) => () => new Date(iso);

describe('LocalProgressStore', () => {
  it('спершу прогрес порожній', () => {
    expect(new LocalProgressStore(new MemoryStorage()).get()).toEqual({ solved: {} });
  });

  it('позначає задачу розв’язаною й зберігає дату першого розв’язання', () => {
    const storage = new MemoryStorage();
    new LocalProgressStore(storage, at('2026-09-01T10:00:00.000Z')).markSolved('post-001');
    new LocalProgressStore(storage, at('2026-09-05T10:00:00.000Z')).markSolved('post-001');
    expect(new LocalProgressStore(storage).get().solved).toEqual({
      'post-001': '2026-09-01T10:00:00.000Z',
    });
  });

  it('експорт і імпорт переносять прогрес на інший комп’ютер', () => {
    const home = new LocalProgressStore(new MemoryStorage(), at('2026-09-01T10:00:00.000Z'));
    home.markSolved('post-001');
    home.markSolved('turing-002');

    const lab = new LocalProgressStore(new MemoryStorage(), at('2026-09-03T10:00:00.000Z'));
    lab.markSolved('post-003');
    expect(lab.import(home.export())).toBe(2);
    expect(Object.keys(lab.get().solved).sort()).toEqual(['post-001', 'post-003', 'turing-002']);
    expect(lab.import(home.export())).toBe(0);
  });

  it('пошкоджений запис у сховищі не ламає сторінку', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, '{оце не JSON');
    const store = new LocalProgressStore(storage);
    expect(store.get()).toEqual({ solved: {} });
    store.markSolved('post-002');
    expect(Object.keys(store.get().solved)).toEqual(['post-002']);
  });

  it('без сховища працює, але нічого не зберігає', () => {
    const store = new LocalProgressStore(null);
    store.markSolved('post-001');
    expect(store.get()).toEqual({ solved: {} });
  });

  it('недоступне сховище (виняток) не ламає сторінку', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = new LocalProgressStore(broken);
    expect(() => store.markSolved('post-001')).not.toThrow();
    expect(store.get()).toEqual({ solved: {} });
  });
});

describe('parseProgress', () => {
  it('відхиляє чужі й пошкоджені файли з поясненням', () => {
    expect(() => parseProgress('не json')).toThrow('Файл пошкоджений або це не JSON.');
    expect(() => parseProgress('[]')).toThrow('У файлі немає прогресу задач.');
    expect(() => parseProgress('{"machine":"post","version":1}')).toThrow(
      'Це не файл прогресу задач цього сайту.',
    );
    expect(() => parseProgress('{"format":"aimo-progress","version":99,"solved":{}}')).toThrow(
      /новішою версією/,
    );
    expect(() =>
      parseProgress('{"format":"aimo-progress","version":1,"solved":{"post-001":"вчора"}}'),
    ).toThrow('Задача «post-001»: незрозуміла дата розв’язання.');
  });
});

describe('mergeProgress', () => {
  it('об’єднує й лишає ранішу дату', () => {
    const merged = mergeProgress(
      { solved: { a: '2026-09-05T00:00:00.000Z', b: '2026-09-01T00:00:00.000Z' } },
      { solved: { a: '2026-09-02T00:00:00.000Z', c: '2026-09-03T00:00:00.000Z' } },
    );
    expect(merged.solved).toEqual({
      a: '2026-09-02T00:00:00.000Z',
      b: '2026-09-01T00:00:00.000Z',
      c: '2026-09-03T00:00:00.000Z',
    });
  });
});
