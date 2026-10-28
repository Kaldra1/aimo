import { describe, expect, it } from 'vitest';
import { pasteDescription, pasteLevel } from './paste-level';

const program = '*a -> a*\n*b -> b*\na* ->. λ\nb* ->. λ\n* ->. λ\nλ -> *'; // 50 символів
const solve = (fields: Partial<Parameters<typeof pasteLevel>[0]>) => ({ program, ...fields });

describe('позначка вставок у дашборді', () => {
  it('без стеження — невідомо; стежили й вставок не було — сам', () => {
    expect(pasteLevel(solve({}))).toBe('unknown');
    expect(pasteLevel(solve({ pastes: 0, pasted_chars: 0, file_loads: 0, max_paste: null }))).toBe(
      'unknown',
    );
    expect(pasteLevel(solve({ pastes: 0, pasted_chars: 0, file_loads: 0, max_paste: 0 }))).toBe(
      'self',
    );
  });

  it('скопійований свій рядок — дрібна вставка', () => {
    expect(pasteLevel(solve({ pastes: 2, pasted_chars: 16, max_paste: 8 }))).toBe('small');
    // старий запис без max_paste: кілька вставок — розмір кожної невідомий
    expect(pasteLevel(solve({ pastes: 2, pasted_chars: 16 }))).toBe('small');
  });

  it('уся програма за раз, половина програми, файл — велика', () => {
    expect(pasteLevel(solve({ pastes: 1, pasted_chars: 55 }))).toBe('big');
    expect(pasteLevel(solve({ pastes: 1, pasted_chars: 25, max_paste: 25 }))).toBe('big');
    expect(pasteLevel(solve({ pastes: 3, pasted_chars: 60, max_paste: 19 }))).toBe('small');
    expect(
      pasteLevel({ program: 'x'.repeat(500), pastes: 1, pasted_chars: 40, max_paste: 40 }),
    ).toBe('big');
    expect(pasteLevel(solve({ pastes: 0, file_loads: 1, max_paste: 0 }))).toBe('big');
  });

  it('опис — з правильною формою слова', () => {
    expect(pasteDescription(solve({ pastes: 1, pasted_chars: 55, max_paste: 55 }))).toBe(
      'Вставки: 1 раз, 55 симв., найбільша — 55 (у програмі 50)',
    );
    expect(pasteDescription(solve({ pastes: 0, max_paste: 0 }))).toBe(
      'Набрано в редакторі, вставок не було',
    );
  });
});
