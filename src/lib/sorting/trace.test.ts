import { describe, expect, it } from 'vitest';
import { makePreset, parseArray, traceSort, type SortAlgorithm } from './trace';

const last = (algorithm: SortAlgorithm, input: number[]) => traceSort(algorithm, input).at(-1)!;

describe('лічильники збігаються з трасуванням лекції 11 на [5, 2, 4, 1, 3]', () => {
  it.each([
    ['bubble', 10, 7],
    ['selection', 10, 3],
    ['insertion', 9, 7],
  ] as const)('%s: %i порівнянь, %i переміщень', (algorithm, comparisons, moves) => {
    const done = last(algorithm, [5, 2, 4, 1, 3]);
    expect(done).toMatchObject({ kind: 'done', array: [1, 2, 3, 4, 5], comparisons, moves });
    expect(done.sorted).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('сортує правильно', () => {
  const inputs = [[], [7], [2, 1], [3, 3, 1], [1, 2, 3, 4], [9, -3, 0, 9, -3, 5], [5, 4, 3, 2, 1]];
  it.each(['bubble', 'selection', 'insertion', 'shell', 'merge', 'quick', 'heap'] as const)(
    '%s',
    (algorithm) => {
      for (const input of inputs) {
        expect(last(algorithm, input).array).toEqual([...input].sort((a, b) => a - b));
      }
    },
  );
});

describe('особливості методів', () => {
  it('бульбашка з прапорцем: відсортований масив — один прохід', () => {
    expect(last('bubble', [1, 2, 3, 4, 5])).toMatchObject({ comparisons: 4, moves: 0 });
  });

  it('вибір завжди робить n(n−1)/2 порівнянь', () => {
    expect(last('selection', [1, 2, 3, 4, 5]).comparisons).toBe(10);
  });

  it('вставки: «дірка» на місці ключа під час зсувів', () => {
    const steps = traceSort('insertion', [2, 1]);
    const take = steps.find((s) => s.kind === 'take')!;
    expect(take.array).toEqual([2, null]);
    expect(take.key).toEqual({ value: 1, at: 1 });
    const shift = steps.find((s) => s.kind === 'shift')!;
    expect(shift.array).toEqual([null, 2]);
  });

  it('кожен крок має рядок коду й пояснення', () => {
    for (const algorithm of ['bubble', 'selection', 'insertion'] as const) {
      for (const step of traceSort(algorithm, [3, 1, 2])) {
        expect(step.line).toBeGreaterThan(0);
        expect(step.text.length).toBeGreaterThan(5);
      }
    }
  });
});

describe('введення', () => {
  it('розбирає масив', () => {
    expect(parseArray('5, 2 4;1  3')).toEqual({ ok: true, values: [5, 2, 4, 1, 3] });
    expect(parseArray('').ok).toBe(false);
    expect(parseArray('1, x').ok).toBe(false);
    expect(parseArray(Array(17).fill(1).join(',')).ok).toBe(false);
  });

  it('набори даних — без повторів і потрібної довжини', () => {
    for (let n = 2; n <= 16; n++) {
      for (const preset of ['random', 'sorted', 'reversed', 'nearly'] as const) {
        const values = makePreset(preset, n);
        expect(values).toHaveLength(n);
        expect(new Set(values).size).toBe(n);
      }
    }
    const sorted = makePreset('sorted', 6);
    expect(sorted).toEqual([...sorted].sort((x, y) => x - y));
    const reversed = makePreset('reversed', 6);
    expect(reversed).toEqual([...reversed].sort((x, y) => y - x));
  });
});

describe('лекція 12', () => {
  const lecture = [5, 2, 7, 1, 9, 3, 8, 4];

  it('Шелл: на [8…1] з кроками 4, 2, 1 — 12 переміщень', () => {
    expect(last('shell', [8, 7, 6, 5, 4, 3, 2, 1])).toMatchObject({
      array: [1, 2, 3, 4, 5, 6, 7, 8],
      moves: 12,
    });
  });

  it('швидке: після першого розбиття — [2, 1, 3, 4, 9, 7, 8, 5]', () => {
    const steps = traceSort('quick', lecture);
    const first = steps.find((s) => s.kind === 'swap' && s.line === 10)!;
    expect(first.array).toEqual([2, 1, 3, 4, 9, 7, 8, 5]);
    expect(first.pivot).toBe(3);
  });

  it('пірамідальне: купа як у лекції — [9, 5, 8, 4, 2, 3, 7, 1]', () => {
    const steps = traceSort('heap', lecture);
    const built = steps.find((s) => s.text.startsWith('Купа побудована'))!;
    expect(built.array).toEqual([9, 5, 8, 4, 2, 3, 7, 1]);
  });

  it('злиття: буфер і остаточне злиття', () => {
    const done = last('merge', lecture);
    expect(done.array).toEqual([1, 2, 3, 4, 5, 7, 8, 9]);
    expect(done.aux?.label).toBe('Буфер');
  });

  it('підрахунок: жодного порівняння', () => {
    const done = last('counting', [3, 1, 4, 1, 5, 2, 3, 0]);
    expect(done).toMatchObject({ array: [0, 1, 1, 2, 3, 3, 4, 5], comparisons: 0, moves: 8 });
    expect(done.aux?.labels).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('підрахунок: від’ємні числа — пояснення замість сортування', () => {
    expect(traceSort('counting', [3, -1])[0]?.kind).toBe('error');
  });
});
