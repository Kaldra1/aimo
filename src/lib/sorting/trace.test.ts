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
  it.each(['bubble', 'selection', 'insertion'] as const)('%s', (algorithm) => {
    for (const input of inputs) {
      expect(last(algorithm, input).array).toEqual([...input].sort((a, b) => a - b));
    }
  });
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

  it('набори даних', () => {
    const rnd = () => 0.5;
    expect(makePreset('sorted', 4, rnd)).toEqual([11, 11, 11, 11]);
    let k = 0;
    const seq = () => [0.1, 0.9, 0.5, 0.3][k++ % 4]!;
    expect(makePreset('reversed', 4, seq)).toEqual([19, 11, 7, 3]);
  });
});
