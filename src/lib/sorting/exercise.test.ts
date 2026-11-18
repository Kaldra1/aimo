import { describe, expect, it } from 'vitest';
import p3 from '../../data/variants/practical-03.tests.yaml?raw';
import p4 from '../../data/variants/practical-04.tests.yaml?raw';
import { parseVariantTests } from '../variants/variants';
import {
  answerFromText,
  answerText,
  checkAnswer,
  countsOf,
  exerciseFromLine,
  inversionsOf,
  recheckSorting,
  stagesOf,
  type Answer,
  type Exercise,
  type ExerciseAlgorithm,
} from './exercise';
import { traceSort } from './trace';

const ALL: ExerciseAlgorithm[] = [
  'bubble',
  'selection',
  'insertion',
  'shell',
  'merge',
  'quick',
  'heap',
];
const ARRAY = [30, 1, 15, 5, 20, 24, 23, 2];

/** Правильна відповідь на вправу. */
function correct(exercise: Exercise): Answer {
  return {
    algorithms: Object.fromEntries(
      exercise.algorithms.map((a) => {
        const counts = countsOf(a, exercise.array);
        return [
          a,
          {
            stages: stagesOf(a, exercise.array).map((s) => s.join(' ')),
            comparisons: String(counts.comparisons),
            moves: String(counts.moves),
          },
        ];
      }),
    ),
    inversions: String(inversionsOf(exercise.array)),
  };
}

describe('stagesOf', () => {
  it('останній етап — відсортований масив, як у візуалізатора', () => {
    for (const a of ALL) {
      const stages = stagesOf(a, ARRAY);
      expect(stages.at(-1)).toEqual([...ARRAY].sort((x, y) => x - y));
      expect(traceSort(a, ARRAY).at(-1)!.array).toEqual(stages.at(-1));
    }
  });

  it('кількість етапів', () => {
    expect(stagesOf('selection', ARRAY)).toHaveLength(7);
    expect(stagesOf('insertion', ARRAY)).toHaveLength(7);
    expect(stagesOf('shell', ARRAY)).toHaveLength(3);
    expect(stagesOf('merge', ARRAY)).toHaveLength(7);
    expect(stagesOf('heap', ARRAY)).toHaveLength(8);
    // Бульбашка зупиняється після проходу без обмінів.
    expect(stagesOf('bubble', [1, 2, 3, 4])).toEqual([[1, 2, 3, 4]]);
  });

  it('проміжні етапи бульбашки', () => {
    expect(stagesOf('bubble', [3, 1, 2])).toEqual([
      [1, 2, 3],
      [1, 2, 3],
    ]);
  });
});

describe('перевірка відповіді', () => {
  const exercise: Exercise = {
    algorithms: ['bubble', 'selection', 'insertion'],
    array: ARRAY,
    inversions: true,
  };

  it('правильна відповідь зараховується', () => {
    expect(checkAnswer(exercise, correct(exercise)).solved).toBe(true);
  });

  it('помилка в етапі, лічильнику чи інверсіях — не зараховується', () => {
    const wrongStage = correct(exercise);
    wrongStage.algorithms.bubble!.stages[0] = '1 2 3';
    expect(checkAnswer(exercise, wrongStage).algorithms.bubble!.stages[0]).toBe(false);
    expect(checkAnswer(exercise, wrongStage).solved).toBe(false);

    const wrongCount = correct(exercise);
    wrongCount.algorithms.insertion!.moves = '0';
    expect(checkAnswer(exercise, wrongCount).algorithms.insertion!.moves).toBe(false);

    const wrongInv = correct(exercise);
    wrongInv.inversions = '1';
    expect(checkAnswer(exercise, wrongInv).inversions).toBe(false);
  });

  it('зайвий етап — помилка, порожні рядки й коми — ні', () => {
    const extra = correct(exercise);
    extra.algorithms.selection!.stages.push('1 2 3');
    expect(checkAnswer(exercise, extra).algorithms.selection!.extraStages).toBe(true);

    const commas = correct(exercise);
    commas.algorithms.selection!.stages = commas.algorithms.selection!.stages.map(
      (s) => `[${s.replace(/ /g, ', ')}]`,
    );
    commas.algorithms.selection!.stages.push('', '  ');
    expect(checkAnswer(exercise, commas).solved).toBe(true);
  });

  it('текст для бази розбирається назад і проходить повторну перевірку', () => {
    const text = answerText(exercise, correct(exercise));
    expect(answerFromText(text)).toMatchObject({ inversions: String(inversionsOf(ARRAY)) });
    expect(recheckSorting(text, ['bubble,selection,insertion+inv → 30 1 15 5 20 24 23 2'])).toBe(
      true,
    );
    expect(
      recheckSorting(text.replace(/інверсій: \d+/, 'інверсій: 0'), [
        'bubble,selection,insertion+inv → 30 1 15 5 20 24 23 2',
      ]),
    ).toBe(false);
  });
});

describe('варіанти ПР-3 і ПР-4', () => {
  it('усі 30 вправ ★ розбираються й мають розв’язок', () => {
    for (const [source, count] of [
      [p3, 30],
      [p4, 30],
    ] as const) {
      const tests = parseVariantTests(source);
      expect(Object.keys(tests)).toHaveLength(count);
      for (const lines of Object.values(tests)) {
        const exercise = exerciseFromLine(lines[0]!);
        expect(exercise).not.toBeNull();
        expect(recheckSorting(answerText(exercise!, correct(exercise!)), lines)).toBe(true);
      }
    }
  });
});
