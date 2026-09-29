/** Острів каталогу задач: фільтри, позначки «розв’язано», лічильник і перенесення прогресу. */
import { useRef, useState } from 'preact/hooks';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  difficultyText,
  stars,
  type Difficulty,
} from '../../lib/tasks/meta';
import { downloadText, errorText } from '../emulator/support';
import { notifyProgress, useProgress } from './progress';

export interface CatalogTask {
  id: string;
  title: string;
  machine: string;
  difficulty: Difficulty;
  /** Адреса сторінки задачі (уже з базовим шляхом сайту). */
  href: string;
}

export interface CatalogMachine {
  id: string;
  title: string;
}

interface Props {
  tasks: CatalogTask[];
  machines: CatalogMachine[];
}

type Status = 'all' | 'solved' | 'unsolved';

interface Notice {
  kind: 'info' | 'error';
  text: string;
}

function Segmented<T extends string | number>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset class="task-filter">
      <legend class="task-filter__legend">{legend}</legend>
      <div class="segmented">
        {options.map((option) => (
          <label key={String(option.value)}>
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span title={option.title}>
              <span aria-hidden={option.title ? 'true' : undefined}>{option.label}</span>
              {option.title && <span class="visually-hidden">{option.title}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function TaskCatalog({ tasks, machines }: Props) {
  const { progress, store } = useProgress();
  const [machine, setMachine] = useState('all');
  const [difficulty, setDifficulty] = useState<Difficulty | 0>(0);
  const [status, setStatus] = useState<Status>('all');
  const [notice, setNotice] = useState<Notice | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isSolved = (task: CatalogTask) => progress?.solved[task.id] !== undefined;
  const solvedCount = tasks.filter(isSolved).length;
  const visible = tasks.filter(
    (task) =>
      (machine === 'all' || task.machine === machine) &&
      (difficulty === 0 || task.difficulty === difficulty) &&
      (status === 'all' || (status === 'solved') === isSolved(task)),
  );
  const groups = machines
    .map((m) => ({ ...m, tasks: visible.filter((task) => task.machine === m.id) }))
    .filter((group) => group.tasks.length > 0);

  const exportProgress = () => {
    downloadText('aimo-progress.json', store.export());
    setNotice({ kind: 'info', text: 'Прогрес збережено у файл aimo-progress.json.' });
  };

  const importProgress = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const added = store.import(await file.text());
      notifyProgress();
      setNotice({
        kind: 'info',
        text:
          added > 0
            ? `Прогрес імпортовано: нових розв’язаних задач — ${added}.`
            : 'Прогрес імпортовано: нових розв’язаних задач у файлі немає.',
      });
    } catch (error) {
      setNotice({ kind: 'error', text: `Не вдалося імпортувати прогрес: ${errorText(error)}` });
    }
  };

  return (
    <div class="task-catalog">
      <div class="task-catalog__summary">
        <p class="task-catalog__count" aria-live="polite">
          {progress === null
            ? `Задач: ${tasks.length}`
            : `Розв’язано ${solvedCount} з ${tasks.length}`}
        </p>
        <div class="task-catalog__transfer">
          <button type="button" class="button button--secondary" onClick={exportProgress}>
            Експортувати прогрес
          </button>
          <button
            type="button"
            class="button button--secondary"
            onClick={() => fileRef.current?.click()}
          >
            Імпортувати прогрес
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            class="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void importProgress(event.currentTarget)}
          />
        </div>
        <p class={`task-catalog__notice${notice ? ` is-${notice.kind}` : ''}`} role="status">
          {notice?.text}
        </p>
      </div>

      <div class="task-catalog__filters">
        <Segmented
          name="task-machine"
          legend="Машина"
          value={machine}
          options={[
            { value: 'all', label: 'Усі' },
            ...machines.map((m) => ({ value: m.id, label: m.title })),
          ]}
          onChange={setMachine}
        />
        <Segmented<Difficulty | 0>
          name="task-difficulty"
          legend="Складність"
          value={difficulty}
          options={[
            { value: 0, label: 'Усі' },
            ...DIFFICULTIES.map((d) => ({
              value: d,
              label: '★'.repeat(d),
              title: DIFFICULTY_LABELS[d],
            })),
          ]}
          onChange={setDifficulty}
        />
        <Segmented<Status>
          name="task-status"
          legend="Статус"
          value={status}
          options={[
            { value: 'all', label: 'Усі' },
            { value: 'unsolved', label: 'Нерозв’язані' },
            { value: 'solved', label: 'Розв’язані' },
          ]}
          onChange={setStatus}
        />
      </div>

      {groups.length === 0 ? (
        <p class="task-catalog__empty">Немає задач за цими фільтрами.</p>
      ) : (
        groups.map((group) => (
          <section key={group.id} class="task-group" aria-labelledby={`task-group-${group.id}`}>
            <h2 id={`task-group-${group.id}`} class="task-group__title">
              {group.title}
            </h2>
            <ul class="task-list">
              {group.tasks.map((task) => {
                const solved = isSolved(task);
                return (
                  <li
                    key={task.id}
                    class={`card card--link task-card${solved ? ' is-solved' : ''}`}
                  >
                    <h3 class="task-card__title">
                      <a class="card__link" href={task.href}>
                        {task.title}
                      </a>
                    </h3>
                    <p class="task-card__meta">
                      <span class="task-card__stars" title={difficultyText(task.difficulty)}>
                        <span aria-hidden="true">{stars(task.difficulty)}</span>
                        <span class="visually-hidden">{difficultyText(task.difficulty)}</span>
                      </span>
                      {solved && (
                        <span class="badge badge--info">
                          <span aria-hidden="true">✓</span> Розв’язано
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
