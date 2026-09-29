/** Острів сторінки задачі: підказки, емулятор, перевірка на всіх тестах і позначка «розв’язано». */
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { PostProgram, PostSaved } from '../../lib/machines/post';
import {
  parse as parseTuring,
  tableFromProgram,
  type TuringProgram,
  type TuringSaved,
} from '../../lib/machines/turing';
import { plural } from '../../lib/plural';
import {
  checkPost,
  checkTuring,
  type CheckReport,
  type TaskTest,
  type TestResult,
} from '../../lib/tasks/check';
import { formatSolvedDate, taskStorageKey } from '../../lib/tasks/meta';
import { formatNumber, removeStorage, type EmulatorApi } from '../emulator/support';
import PostEmulator from '../post/PostEmulator';
import TuringEmulator from '../turing/TuringEmulator';
import { notifyProgress, useProgress } from './progress';

/** Те, що острів отримує від сторінки: лише потрібні для роботи поля задачі. */
export interface TaskView {
  id: string;
  machine: 'post' | 'turing';
  alphabet: string;
  starter: string;
  tests: TaskTest[];
  hints: string[];
  maxSteps: number;
}

type Program = PostProgram | TuringProgram;

const NO_EXAMPLES: readonly never[] = [];
const EMPTY = 'порожня стрічка';

function initialPost(task: TaskView): PostSaved {
  return { program: task.starter, input: task.tests[0]?.input ?? '', comment: '' };
}

function initialTuring(task: TaskView): TuringSaved {
  const parsed =
    task.starter.trim() === '' ? null : parseTuring(task.starter, { alphabet: task.alphabet });
  const table = parsed?.ok
    ? tableFromProgram(parsed.value, task.alphabet)
    : { alphabet: task.alphabet, states: 1, cells: {} };
  return { table, input: task.tests[0]?.input ?? '', comment: '' };
}

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

export default function TaskWorkbench({ task }: { task: TaskView }) {
  const { progress, store } = useProgress();
  const programRef = useRef<Program | null>(null);
  const emulatorApiRef = useRef<EmulatorApi | null>(null);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [broken, setBroken] = useState(false);
  const [stale, setStale] = useState(false);
  const [hints, setHints] = useState(0);
  const [generation, setGeneration] = useState(0);
  const checkPanelRef = useRef<HTMLElement>(null);
  const emulatorRef = useRef<HTMLDivElement>(null);

  const initialState = useMemo(
    () => (task.machine === 'post' ? initialPost(task) : initialTuring(task)),
    [task],
  );
  const solvedAt = progress?.solved[task.id];

  const onChange = useCallback((next: Program | null) => {
    if (next === programRef.current) return;
    programRef.current = next;
    setStale(true);
  }, []);

  const onReady = useCallback((api: EmulatorApi) => {
    emulatorApiRef.current = api;
  }, []);

  const check = () => {
    const current = programRef.current;
    setBroken(current === null);
    if (current === null) {
      setReport(null);
    } else {
      const next =
        task.machine === 'post'
          ? checkPost(current as PostProgram, task.tests, task.maxSteps)
          : checkTuring(current as TuringProgram, task.tests, task.maxSteps);
      setReport(next);
      setStale(false);
      if (next.solved) {
        store.markSolved(task.id);
        notifyProgress();
      }
    }
    requestAnimationFrame(() =>
      checkPanelRef.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() }),
    );
  };

  const openInEmulator = (result: TestResult) => {
    emulatorApiRef.current?.loadInput(result.input);
    emulatorRef.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
  };

  const restart = () => {
    if (!window.confirm('Почати задачу заново? Вашу програму буде замінено початковою.')) return;
    removeStorage(taskStorageKey(task.id));
    programRef.current = null;
    setReport(null);
    setBroken(false);
    setGeneration((g) => g + 1);
  };

  const actions = (
    <>
      <button type="button" class="button button--primary" onClick={check}>
        Перевірити
      </button>
      <button type="button" class="button button--secondary" onClick={restart}>
        Почати заново
      </button>
    </>
  );

  const summary = broken
    ? 'У програмі є помилки — виправте їх, щоб перевірити.'
    : report === null
      ? ''
      : report.solved
        ? `Усі тести пройдено (${report.total} з ${report.total}) — задачу розв’язано!`
        : `Пройдено ${report.passed} з ${plural(report.total, ['тесту', 'тестів', 'тестів'])}.`;

  return (
    <div class="task-workbench">
      {task.hints.length > 0 && (
        <section class="task-hints" aria-labelledby="task-hints-title">
          <h2 id="task-hints-title" class="task-section-title">
            Підказки
          </h2>
          {hints > 0 && (
            <ol class="task-hints__list">
              {task.hints.slice(0, hints).map((hint, index) => (
                <li key={index}>{hint}</li>
              ))}
            </ol>
          )}
          {hints < task.hints.length ? (
            <button
              type="button"
              class="button button--secondary"
              onClick={() => setHints(hints + 1)}
            >
              {hints === 0 ? 'Показати підказку' : 'Наступна підказка'} ({hints + 1} з{' '}
              {task.hints.length})
            </button>
          ) : (
            <p class="panel__hint">Це всі підказки.</p>
          )}
        </section>
      )}

      <div class="task-emulator" ref={emulatorRef}>
        <h2 class="task-section-title">Розв’язання</h2>
        {task.machine === 'post' ? (
          <PostEmulator
            key={generation}
            storageKey={taskStorageKey(task.id)}
            initial={initialState as PostSaved}
            examples={NO_EXAMPLES}
            fileName={`${task.id}.json`}
            onChange={onChange}
            onReady={onReady}
            actions={actions}
          />
        ) : (
          <TuringEmulator
            key={generation}
            storageKey={taskStorageKey(task.id)}
            initial={initialState as TuringSaved}
            examples={NO_EXAMPLES}
            fileName={`${task.id}.json`}
            onChange={onChange}
            onReady={onReady}
            actions={actions}
          />
        )}
      </div>

      <section class="panel task-check" aria-labelledby="task-check-title" ref={checkPanelRef}>
        <div class="panel__header">
          <h2 id="task-check-title" class="panel__title">
            Перевірка
          </h2>
          {solvedAt !== undefined && (
            <span class="badge badge--info">
              <span aria-hidden="true">✓</span> Розв’язано {formatSolvedDate(solvedAt)}
            </span>
          )}
          <button type="button" class="button button--primary" onClick={check}>
            Перевірити
          </button>
        </div>
        <p class="panel__hint">
          Програму буде запущено на {plural(task.tests.length, ['тесті', 'тестах', 'тестах'])} з
          лімітом {formatNumber(task.maxSteps)} кроків на кожен. Порожні комірки по краях стрічки не
          враховуються. Задачу зараховано, коли пройдено всі тести; прогрес зберігається лише в
          цьому браузері.
        </p>
        <p
          class={`task-check__summary${report?.solved ? ' is-solved' : ''}${broken ? ' is-error' : ''}`}
          role="status"
        >
          {summary}
        </p>
        {report !== null && stale && (
          <p class="message message--warning">
            Програму змінено після перевірки — натисніть «Перевірити» ще раз.
          </p>
        )}
        {report !== null && (
          <ol class="task-results">
            {report.results.map((result) => (
              <li
                key={result.number}
                class={`task-result ${result.passed ? 'is-passed' : 'is-failed'}`}
              >
                <p class="task-result__title">
                  <span class="task-result__mark" aria-hidden="true">
                    {result.passed ? '✓' : '✗'}
                  </span>
                  Тест {result.number}: {result.passed ? 'пройдено' : 'не пройдено'}
                  {result.verdict !== 'bad-input' && (
                    <span class="task-result__steps">
                      {plural(result.steps, ['крок', 'кроки', 'кроків'])}
                    </span>
                  )}
                </p>
                <dl class="task-result__tapes">
                  <div>
                    <dt>Вхід</dt>
                    <dd>
                      <code>{result.input || EMPTY}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Очікувано</dt>
                    <dd>
                      <code>{result.expected || EMPTY}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Отримано</dt>
                    <dd>{result.actual === null ? '—' : <code>{result.actual}</code>}</dd>
                  </div>
                </dl>
                {result.reason && <p class="task-result__reason">{result.reason}</p>}
                <button
                  type="button"
                  class="button button--secondary task-result__open"
                  onClick={() => openInEmulator(result)}
                >
                  Завантажити в емулятор
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
