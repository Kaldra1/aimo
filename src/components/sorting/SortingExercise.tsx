/**
 * Тренажер трасування для варіантів ПР-3 і ПР-4: студент вписує масив після кожного етапу й лічильники,
 * сайт звіряє з еталоном. Розв'язаний варіант зберігається в кабінеті так само, як схеми лабораторних.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { saveSolve } from '../../lib/cloud/client';
import {
  answerText,
  checkAnswer,
  movesLabel,
  STAGE_LABEL,
  type Answer,
  type Exercise,
  type ExerciseAlgorithm,
  type Verdict,
} from '../../lib/sorting/exercise';
import { ALGORITHMS } from '../../lib/sorting/trace';
import { formatSolvedDate, taskStorageKey } from '../../lib/tasks/meta';
import { pasteStats, trackPastes } from '../../lib/tasks/paste';
import { readStorage, removeStorage, writeStorage } from '../emulator/support';
import { notifyProgress, useProgress } from '../tasks/progress';

/** Скільки рядків етапів показати: стільки, скільки може знадобитися, щоб не підказувати відповідь. */
function rowsOf(algorithm: ExerciseAlgorithm, n: number): number {
  if (algorithm === 'shell') {
    let count = 0;
    for (let h = Math.floor(n / 2); h > 0; h = Math.floor(h / 2)) count++;
    return count;
  }
  if (algorithm === 'heap') return n;
  return n - 1;
}

const emptyAnswer = (exercise: Exercise): Answer => ({
  algorithms: Object.fromEntries(
    exercise.algorithms.map((a) => [
      a,
      { stages: Array(rowsOf(a, exercise.array.length)).fill(''), comparisons: '', moves: '' },
    ]),
  ),
  inversions: '',
});

function loadAnswer(id: string, exercise: Exercise): Answer {
  const fresh = emptyAnswer(exercise);
  try {
    const raw = readStorage(taskStorageKey(id));
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Answer;
    for (const a of exercise.algorithms) {
      const s = saved.algorithms?.[a];
      const f = fresh.algorithms[a]!;
      if (s) {
        f.stages = f.stages.map((_, k) => s.stages?.[k] ?? '');
        f.comparisons = s.comparisons ?? '';
        f.moves = s.moves ?? '';
      }
    }
    fresh.inversions = saved.inversions ?? '';
  } catch {
    // Пошкоджене збереження — починаємо з порожньої форми.
  }
  return fresh;
}

const mark = (ok: boolean | undefined) =>
  ok === undefined ? null : (
    <span
      class={`sort-ex__mark ${ok ? 'is-ok' : 'is-bad'}`}
      aria-label={ok ? 'правильно' : 'помилка'}
    >
      {ok ? '✓' : '✗'}
    </span>
  );

export default function SortingExercise({ id, exercise }: { id: string; exercise: Exercise }) {
  const { progress, store } = useProgress();
  const [answer, setAnswer] = useState<Answer>(() => emptyAnswer(exercise));
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [cloud, setCloud] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const solvedAt = progress?.solved[id];
  const total = useMemo(() => exercise.array.join(' '), [exercise]);

  useEffect(() => setAnswer(loadAnswer(id, exercise)), [id, exercise]);
  useEffect(() => (rootRef.current ? trackPastes(rootRef.current, id) : undefined), [id]);

  // Оновлюємо від попереднього стану: швидкі зміни підряд (вставка, автозаповнення) не губляться.
  const update = (change: (prev: Answer) => Answer) => {
    setVerdict(null);
    setAnswer((prev) => {
      const next = change(prev);
      writeStorage(taskStorageKey(id), JSON.stringify(next));
      return next;
    });
  };

  const setStage = (algorithm: ExerciseAlgorithm, k: number, value: string) =>
    update((prev) => {
      const current = prev.algorithms[algorithm]!;
      const stages = current.stages.map((s, i) => (i === k ? value : s));
      return { ...prev, algorithms: { ...prev.algorithms, [algorithm]: { ...current, stages } } };
    });

  const setCount = (algorithm: ExerciseAlgorithm, field: 'comparisons' | 'moves', value: string) =>
    update((prev) => {
      const current = prev.algorithms[algorithm]!;
      return {
        ...prev,
        algorithms: { ...prev.algorithms, [algorithm]: { ...current, [field]: value } },
      };
    });

  const check = () => {
    const next = checkAnswer(exercise, answer);
    setVerdict(next);
    if (!next.solved) return;
    store.markSolved(id);
    notifyProgress();
    saveSolve(id, answerText(exercise, answer), pasteStats(id)).then(
      (result) =>
        setCloud(
          result === 'saved'
            ? 'Трасування збережено в кабінеті — викладач його бачить.'
            : result === 'foreign'
              ? 'Це не ваш варіант, тож у кабінет розв’язок не записано.'
              : null,
        ),
      (error: Error) => setCloud(`Не вдалося зберегти в кабінеті: ${error.message}`),
    );
  };

  const restart = () => {
    if (!window.confirm('Очистити всі введені відповіді?')) return;
    removeStorage(taskStorageKey(id));
    setAnswer(emptyAnswer(exercise));
    setVerdict(null);
  };

  const wrong = verdict
    ? exercise.algorithms.filter((a) => !verdict.algorithms[a]?.ok).length +
      (verdict.inversions === false ? 1 : 0)
    : 0;

  return (
    <div class="sort-ex" ref={rootRef}>
      <p class="sort-ex__intro">
        Початковий масив: <code>{total}</code>. Впишіть масив після кожного етапу (числа через
        пробіл або кому). Рядків дано з запасом: зайві залиште порожніми. Лічильники рахуйте так, як
        у коді лекції та у <a href="../../../../emulators/sorting/">візуалізаторі сортувань</a>.
      </p>

      {exercise.algorithms.map((algorithm) => {
        const given = answer.algorithms[algorithm]!;
        const v = verdict?.algorithms[algorithm];
        return (
          <fieldset class="sort-ex__algo" key={algorithm}>
            <legend>
              Сортування {ALGORITHMS[algorithm].title.toLowerCase()} {v && mark(v.ok)}
            </legend>
            <ol class="sort-ex__stages">
              {given.stages.map((stage, k) => (
                <li key={k}>
                  <label>
                    <span>{STAGE_LABEL[algorithm](k + 1)}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      spellcheck={false}
                      value={stage}
                      onInput={(e) => setStage(algorithm, k, (e.target as HTMLInputElement).value)}
                    />
                  </label>
                  {v &&
                    (k < v.stages.length ? mark(v.stages[k]) : stage.trim() !== '' && mark(false))}
                </li>
              ))}
            </ol>
            <div class="sort-ex__counts">
              <label>
                <span>Порівнянь</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={given.comparisons}
                  onInput={(e) =>
                    setCount(algorithm, 'comparisons', (e.target as HTMLInputElement).value)
                  }
                />
                {v && mark(v.comparisons)}
              </label>
              <label>
                <span>{movesLabel(algorithm).replace(/^./, (c) => c.toUpperCase())}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={given.moves}
                  onInput={(e) =>
                    setCount(algorithm, 'moves', (e.target as HTMLInputElement).value)
                  }
                />
                {v && mark(v.moves)}
              </label>
            </div>
            {v?.extraStages && <p class="sort-ex__note">Етапів вписано більше, ніж має бути.</p>}
          </fieldset>
        );
      })}

      {exercise.inversions && (
        <div class="sort-ex__counts">
          <label>
            <span>Інверсій у початковому масиві</span>
            <input
              type="text"
              inputMode="numeric"
              value={answer.inversions}
              onInput={(e) =>
                update((prev) => ({ ...prev, inversions: (e.target as HTMLInputElement).value }))
              }
            />
            {verdict && mark(verdict.inversions ?? undefined)}
          </label>
        </div>
      )}

      <section class="task-check" aria-live="polite">
        <div class="task-check__actions">
          <button type="button" class="button button--primary" onClick={check}>
            Перевірити
          </button>
          <button type="button" class="button button--secondary" onClick={restart}>
            Почати заново
          </button>
        </div>
        {verdict && (
          <p class={`task-check__summary${verdict.solved ? ' is-solved' : ''}`}>
            {verdict.solved
              ? 'Усе правильно — завдання розв’язано!'
              : `Є помилки (позначено ✗). Перевірте ${wrong === 1 ? 'позначений блок' : 'позначені блоки'} і спробуйте ще раз.`}
          </p>
        )}
        {verdict?.solved && cloud !== null && <p class="task-check__cloud">{cloud}</p>}
        {solvedAt !== undefined && (
          <p class="task-solved">
            <span aria-hidden="true">✓</span> Розв’язано {formatSolvedDate(solvedAt)}
          </p>
        )}
      </section>
    </div>
  );
}
