/** Острів емулятора машини Поста: ядро з src/lib/machines/post, UI лише малює стан. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  createState,
  deserialize,
  formatCommand,
  formatTape,
  parse,
  parseTape,
  positionOf,
  POST_EXAMPLES,
  renumber,
  rowsFromSource,
  run,
  serialize,
  sourceFromRows,
  step,
  type PostEvent,
  type PostRow,
  type PostSaved,
  type PostTape,
} from '../../lib/machines/post';
import { decodeShareHash, shareUrl } from '../../lib/machines/share';
import { CodeEditor } from '../emulator/CodeEditor';
import { CommentPanel } from '../emulator/CommentPanel';
import { ExecutionLog, type LogColumn } from '../emulator/ExecutionLog';
import { IconLeft, IconNumbers, IconRight } from '../emulator/icons';
import { ProgramActions, type Notice } from '../emulator/ProgramActions';
import { RunControls } from '../emulator/RunControls';
import {
  DEFAULT_LIMIT,
  DEFAULT_SPEED_INDEX,
  downloadText,
  errorText,
  PROGRAM_ERRORS,
  readStorage,
  speedAt,
  statusOf,
  useRunner,
  writeStorage,
} from '../emulator/support';
import { INSTANT } from '../../lib/machines/runner';
import { Tape } from '../emulator/Tape';
import { PostTableEditor } from './PostTableEditor';

const STORAGE_KEY = 'aimo:emulator:post';
const MACHINE = { step, run };
const DEFAULT = POST_EXAMPLES[0]!;
const EMPTY_TAPE: PostTape = { marks: new Set(), head: 0 };

function tapeOrEmpty(text: string): PostTape {
  const parsed = parseTape(text);
  return parsed.ok ? parsed.value : EMPTY_TAPE;
}

const LOG_COLUMNS: readonly LogColumn<PostEvent>[] = [
  { header: 'Крок', cell: (event) => event.step },
  { header: 'Команда', cell: (event) => formatCommand(event.command), mono: true },
  {
    header: 'Далі',
    cell: (event) => event.next ?? (event.state.status === 'halted' ? 'зупинка' : 'аварія'),
  },
  { header: 'Стрічка після кроку', cell: (event) => formatTape(event.state), mono: true },
];

export default function PostEmulator() {
  const [source, setSource] = useState(DEFAULT.program);
  const [inputText, setInputText] = useState(DEFAULT.input);
  const [comment, setComment] = useState(DEFAULT.comment);
  const [inputTape, setInputTape] = useState<PostTape>(() => tapeOrEmpty(DEFAULT.input));
  const [inputError, setInputError] = useState<string | null>(null);
  const [mode, setMode] = useState<'text' | 'table'>('text');
  const [rows, setRows] = useState<PostRow[]>([]);
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [restored, setRestored] = useState(false);

  const parsed = useMemo(() => parse(source), [source]);
  const initial = useMemo(
    () => (parsed.ok ? createState(parsed.value, inputTape) : null),
    [parsed, inputTape],
  );
  const { snapshot, runner } = useRunner(MACHINE, initial, {
    limit: DEFAULT_LIMIT,
    speed: speedAt(DEFAULT_SPEED_INDEX),
  });

  // Нова програма чи нові вхідні дані — починаємо спочатку.
  useEffect(() => runner.reset(initial), [runner, initial]);
  useEffect(() => runner.setSpeed(speedAt(speedIndex)), [runner, speedIndex]);

  const load = (saved: PostSaved) => {
    setSource(saved.program);
    setInputText(saved.input);
    const tape = parseTape(saved.input);
    setInputTape(tape.ok ? tape.value : EMPTY_TAPE);
    setInputError(tape.ok ? null : tape.error);
    setComment(saved.comment);
    setMode('text');
  };

  /** Програма з посилання «Поділитися» (`#s=…`). Хеш прибираємо, щоб далі діяло автозбереження. */
  const readShared = (): PostSaved | null => {
    const shared = decodeShareHash(window.location.hash);
    if (shared === null) return null;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    try {
      const saved = deserialize(shared);
      setNotice({ kind: 'info', text: 'Відкрито програму з посилання.' });
      return saved;
    } catch (error) {
      setNotice({ kind: 'error', text: `Посилання пошкоджене: ${errorText(error)}` });
      return null;
    }
  };

  // Відкриття: посилання «Поділитися» має пріоритет над автозбереженням.
  useEffect(() => {
    let saved = readShared();
    if (saved === null) {
      const stored = readStorage(STORAGE_KEY);
      if (stored !== null) {
        try {
          saved = deserialize(stored);
        } catch {
          saved = null;
        }
      }
    }
    if (saved !== null) load(saved);
    setRestored(true);

    // Посилання вставили в адресний рядок цієї ж вкладки — сторінка не перезавантажується.
    const onHashChange = () => {
      const shared = readShared();
      if (shared !== null) load(shared);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(
      () => writeStorage(STORAGE_KEY, serialize(source, inputText, comment)),
      400,
    );
    return () => clearTimeout(timer);
  }, [restored, source, inputText, comment]);

  const { state, playing, limitReached } = snapshot;
  const tape: PostTape = state ?? inputTape;
  const started = state !== null && state.steps > 0;
  const cellsEditable = !playing && !started;
  const canContinue = state !== null && state.status === 'running' && !limitReached;
  const position = state && (started || playing) ? positionOf(state) : null;
  const speed = speedAt(speedIndex);
  const transitionMs = playing
    ? speed === INSTANT
      ? 0
      : Math.min(200, Math.round(600 / speed))
    : 150;
  const errors = parsed.ok ? [] : parsed.errors;
  const errorLines = new Set(errors.map((e) => e.line));

  const editTape = (next: PostTape) => {
    setInputTape(next);
    setInputText(formatTape(next));
    setInputError(null);
  };

  const toggleCell = (index: number) => {
    const marks = new Set(inputTape.marks);
    if (marks.has(index)) marks.delete(index);
    else marks.add(index);
    editTape({ marks, head: inputTape.head });
  };

  const onInputText = (text: string) => {
    setInputText(text);
    const result = parseTape(text);
    if (result.ok) {
      setInputTape(result.value);
      setInputError(null);
    } else {
      setInputError(result.error);
    }
  };

  const changeSource = (text: string) => {
    setSource(text);
    if (mode === 'table') setRows(rowsFromSource(text) ?? rows);
  };

  const switchMode = (next: 'text' | 'table') => {
    if (next === 'table') {
      const tableRows = rowsFromSource(source);
      if (tableRows === null) return;
      setRows(tableRows);
    }
    setMode(next);
  };

  const onRows = (next: PostRow[]) => {
    setRows(next);
    setSource(sourceFromRows(next));
  };

  const onRenumber = () => {
    const next = renumber(source);
    if (next !== null) changeSource(next);
  };

  const onExample = (id: string) => {
    const example = POST_EXAMPLES.find((e) => e.id === id);
    if (!example) return;
    const modified = source.trim() !== '' && !POST_EXAMPLES.some((e) => e.program === source);
    if (modified && !window.confirm('Замінити поточну програму прикладом? Зміни буде втрачено.'))
      return;
    load({ program: example.program, input: example.input, comment: example.comment });
    setNotice({ kind: 'info', text: `Завантажено приклад «${example.title}».` });
  };

  const onSave = () => {
    downloadText('post-machine.json', serialize(source, inputText, comment));
    setNotice({ kind: 'info', text: 'Програму збережено у файл post-machine.json.' });
  };

  const onOpenFile = (text: string) => {
    try {
      load(deserialize(text));
      setNotice({ kind: 'info', text: 'Програму завантажено з файлу.' });
    } catch (error) {
      setNotice({ kind: 'error', text: `Не вдалося відкрити файл: ${errorText(error)}` });
    }
  };

  const onShare = async () => {
    const url = shareUrl(window.location.href, serialize(source, inputText, comment));
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ kind: 'info', text: 'Посилання скопійовано в буфер обміну.' });
    } catch {
      window.prompt('Скопіюйте посилання:', url);
    }
  };

  return (
    <div class="emulator">
      <ProgramActions
        idPrefix="post"
        examples={POST_EXAMPLES}
        onExample={onExample}
        onSave={onSave}
        onOpenFile={onOpenFile}
        onShare={() => void onShare()}
        notice={notice}
      />

      <section class="tape-panel" aria-labelledby="post-tape-title">
        <h2 id="post-tape-title" class="visually-hidden">
          Стрічка
        </h2>
        <Tape
          head={tape.head}
          cellAt={(index) => {
            const marked = tape.marks.has(index);
            return {
              text: marked ? 'V' : '',
              filled: marked,
              pressed: marked,
              label: `Комірка ${index}: ${marked ? 'мітка' : 'порожня'}`,
            };
          }}
          editable={cellsEditable}
          transitionMs={transitionMs}
          onCellClick={toggleCell}
          onHeadChange={(head) => editTape({ marks: inputTape.marks, head })}
          onCaretKey={(key) => {
            if (key !== ' ' && key !== 'Enter') return false;
            toggleCell(inputTape.head);
            return true;
          }}
          describedBy="post-tape-help post-tape-notation"
        />
        <div class="tape-panel__footer">
          <p id="post-tape-notation" class="tape-panel__notation">
            Стрічка: <code>{formatTape(tape)}</code>
          </p>
          <div class="tape-panel__caret">
            <button
              type="button"
              class="button button--secondary"
              disabled={!cellsEditable}
              onClick={() => editTape({ marks: inputTape.marks, head: inputTape.head - 1 })}
            >
              <IconLeft />
              Каретка ліворуч
            </button>
            <button
              type="button"
              class="button button--secondary"
              disabled={!cellsEditable}
              onClick={() => editTape({ marks: inputTape.marks, head: inputTape.head + 1 })}
            >
              Каретка праворуч
              <IconRight />
            </button>
          </div>
        </div>
        <p id="post-tape-help" class="tape-panel__hint">
          {cellsEditable
            ? 'Клік по комірці ставить або знімає мітку; каретку можна перетягнути. З клавіатури: стрілки рухають каретку, пробіл — мітка під кареткою.'
            : 'Щоб змінити вхідні дані, натисніть «Скинути».'}
        </p>
      </section>

      <RunControls
        idPrefix="post"
        canStep={canContinue}
        canPlay={canContinue && !playing}
        canPause={playing}
        canReset={started || playing}
        onStep={() => runner.stepOnce()}
        onPlay={() => runner.play()}
        onPause={() => runner.pause()}
        onReset={() => runner.reset(initial)}
        speedIndex={speedIndex}
        onSpeedIndex={setSpeedIndex}
        limit={snapshot.limit}
        onLimit={(limit) => runner.setLimit(limit)}
        steps={state?.steps ?? 0}
        status={statusOf(snapshot, parsed.ok ? null : PROGRAM_ERRORS)}
      />

      <div class="emulator__workspace">
        <section class="panel" aria-labelledby="post-program-title">
          <div class="panel__header">
            <h2 id="post-program-title" class="panel__title">
              Програма
            </h2>
            <fieldset class="segmented">
              <legend class="visually-hidden">Режим редактора</legend>
              <label>
                <input
                  type="radio"
                  name="post-mode"
                  checked={mode === 'text'}
                  onChange={() => switchMode('text')}
                />
                <span>Текст</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="post-mode"
                  checked={mode === 'table'}
                  disabled={mode === 'text' && !parsed.ok}
                  onChange={() => switchMode('table')}
                />
                <span>Таблиця</span>
              </label>
            </fieldset>
            <button
              type="button"
              class="button button--secondary"
              disabled={!parsed.ok || playing}
              onClick={onRenumber}
            >
              <IconNumbers />
              Перенумерувати
            </button>
          </div>

          {mode === 'text' ? (
            <CodeEditor
              id="post-program"
              labelledBy="post-program-title"
              value={source}
              onInput={changeSource}
              errors={errors}
              warnings={parsed.warnings}
              currentLine={position?.line ?? null}
              follow={playing}
              readOnly={playing}
            />
          ) : (
            <>
              <PostTableEditor
                rows={rows}
                onChange={onRows}
                errorLines={errorLines}
                currentLine={position?.line ?? null}
                readOnly={playing}
              />
              {(errors.length > 0 || parsed.warnings.length > 0) && (
                <ul class="code-editor__messages">
                  {errors.map((e, i) => (
                    <li key={`e${i}`} class="message message--error">
                      <span class="message__label">Помилка.</span>{' '}
                      {e.line > 0 ? `Рядок ${e.line}: ` : ''}
                      {e.message}
                    </li>
                  ))}
                  {parsed.warnings.map((w, i) => (
                    <li key={`w${i}`} class="message message--warning">
                      <span class="message__label">Попередження.</span>{' '}
                      {w.line > 0 ? `Рядок ${w.line}: ` : ''}
                      {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {mode === 'text' && !parsed.ok && (
            <p class="panel__hint">Таблиця стане доступною, коли в тексті не буде помилок.</p>
          )}
        </section>

        <div class="emulator__side">
          <section class="panel" aria-labelledby="post-input-title">
            <h2 id="post-input-title" class="panel__title">
              Вхідні дані
            </h2>
            <label class="field" for="post-input">
              <span class="field__label">Стан стрічки у нотації</span>
              <input
                id="post-input"
                class="input input--mono"
                value={inputText}
                readOnly={playing}
                spellcheck={false}
                autocomplete="off"
                aria-invalid={inputError !== null}
                aria-describedby="post-input-help"
                onInput={(event) => onInputText(event.currentTarget.value)}
              />
            </label>
            {inputError && <p class="message message--error">{inputError}</p>}
            <p id="post-input-help" class="panel__hint">
              1 — мітка, 0 — порожня комірка, <code>1^3</code> або <code>1³</code> — три поспіль,{' '}
              <code>[1]</code> — каретка. Приклад: <code>1^2 0 [1] 1</code>.
            </p>
          </section>

          <CommentPanel id="post-comment" value={comment} onInput={setComment} />

          <ExecutionLog
            entries={snapshot.log}
            total={snapshot.logged}
            columns={LOG_COLUMNS}
            rowKey={(event) => event.step}
          />
        </div>
      </div>
    </div>
  );
}
