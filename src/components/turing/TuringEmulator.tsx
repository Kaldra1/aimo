/** Острів емулятора машини Тюрінга: ядро з src/lib/machines/turing, UI лише малює стан. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { INSTANT } from '../../lib/machines/runner';
import { decodeShareHash, shareUrl } from '../../lib/machines/share';
import {
  BLANK,
  buildProgram,
  configurationState,
  createState,
  deserialize,
  findRuleLine,
  flattenTable,
  formatConfiguration,
  formatProgram,
  formatTape,
  parse,
  parseAlphabet,
  parseTape,
  positionOf,
  readCell,
  run,
  serialize,
  stateName,
  step,
  subscript,
  tableFromProgram,
  TURING_EXAMPLES,
  type TuringExample,
  type TuringRule,
  type TuringSaved,
  type TuringState,
  type TuringTable,
  type TuringTape,
} from '../../lib/machines/turing';
import { CodeEditor } from '../emulator/CodeEditor';
import { CommentPanel } from '../emulator/CommentPanel';
import { ExecutionLog, type LogColumn } from '../emulator/ExecutionLog';
import { IconLeft, IconRight } from '../emulator/icons';
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
import { Tape } from '../emulator/Tape';
import { TransitionTable } from './TransitionTable';

const STORAGE_KEY = 'aimo:emulator:turing';
const MACHINE = { step, run };
const DEFAULT = TURING_EXAMPLES[0]!;
const EMPTY_TAPE: TuringTape = { cells: new Map(), head: 0 };

const tableOf = (example: TuringExample): TuringTable => ({
  alphabet: example.alphabet,
  states: example.states,
  cells: flattenTable(example.table),
});

/** Рядок журналу: крок 0 — початкова конфігурація без правила. */
interface LogEntry {
  step: number;
  rule: TuringRule | null;
  state: TuringState;
}

const configuration = (state: TuringState) => formatConfiguration(state, configurationState(state));

const LOG_COLUMNS: readonly LogColumn<LogEntry>[] = [
  { header: 'Крок', cell: (entry) => entry.step },
  {
    header: 'Правило',
    cell: ({ rule }) =>
      rule
        ? `q${rule.state}, ${rule.symbol} → ${rule.write}, ${rule.move}, ${stateName(rule.next)}`
        : '—',
    mono: true,
  },
  { header: 'Конфігурація', cell: (entry) => configuration(entry.state), mono: true },
];

type Mode = 'table' | 'text';

export default function TuringEmulator() {
  const [table, setTable] = useState<TuringTable>(() => tableOf(DEFAULT));
  const [inputText, setInputText] = useState(DEFAULT.input);
  const [comment, setComment] = useState(DEFAULT.comment);
  const [mode, setMode] = useState<Mode>('table');
  const [text, setText] = useState('');
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [restored, setRestored] = useState(false);

  const alphabet = useMemo(() => parseAlphabet(table.alphabet), [table.alphabet]);
  const built = useMemo(() => buildProgram(table), [table]);
  const textParsed = useMemo(
    () => (mode === 'text' ? parse(text, { alphabet: table.alphabet }) : null),
    [mode, text, table.alphabet],
  );
  const inputParsed = useMemo(
    () => (alphabet.ok ? parseTape(inputText, alphabet.symbols) : null),
    [inputText, alphabet],
  );

  const program = textParsed
    ? textParsed.ok
      ? textParsed.value
      : null
    : built.ok
      ? built.value
      : null;
  const inputTape = inputParsed?.ok ? inputParsed.value : null;
  const initial = useMemo(
    () => (program && inputTape ? createState(program, inputTape) : null),
    [program, inputTape],
  );

  const { snapshot, runner } = useRunner(MACHINE, initial, {
    limit: DEFAULT_LIMIT,
    speed: speedAt(DEFAULT_SPEED_INDEX),
  });
  useEffect(() => runner.reset(initial), [runner, initial]);
  useEffect(() => runner.setSpeed(speedAt(speedIndex)), [runner, speedIndex]);

  const load = (saved: TuringSaved) => {
    setTable(saved.table);
    setInputText(saved.input);
    setComment(saved.comment);
    setMode('table');
  };

  /** Програма з посилання «Поділитися» (`#s=…`). Хеш прибираємо, щоб далі діяло автозбереження. */
  const readShared = (): TuringSaved | null => {
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
      () => writeStorage(STORAGE_KEY, serialize(table, inputText, comment)),
      400,
    );
    return () => clearTimeout(timer);
  }, [restored, table, inputText, comment]);

  const { state, playing, limitReached } = snapshot;
  const tape: TuringTape = state ?? inputTape ?? EMPTY_TAPE;
  const started = state !== null && state.steps > 0;
  const tapeEditable = !playing && !started && inputTape !== null;
  const canContinue = state !== null && state.status === 'running' && !limitReached;
  const position =
    state && (started || playing || state.status !== 'running') ? positionOf(state) : null;
  const speed = speedAt(speedIndex);
  const transitionMs = playing
    ? speed === INSTANT
      ? 0
      : Math.min(200, Math.round(600 / speed))
    : 150;
  const symbols = alphabet.ok ? [...alphabet.symbols, BLANK] : [BLANK];
  const badge = state
    ? state.status === 'halted'
      ? '!'
      : `q${subscript(state.current)}`
    : `q${subscript(0)}`;

  const problem = !alphabet.ok
    ? 'Виправте алфавіт, щоб запустити.'
    : program === null
      ? PROGRAM_ERRORS
      : inputTape === null
        ? 'Виправте вхідні дані, щоб запустити.'
        : null;

  const moveHead = (head: number) => {
    if (!inputTape) return;
    setInputText(formatTape({ cells: inputTape.cells, head }));
  };

  const setCell = (key: string, value: string) => {
    const cells = { ...table.cells };
    if (value === '') delete cells[key];
    else cells[key] = value;
    setTable({ ...table, cells });
  };

  const addState = () => setTable({ ...table, states: table.states + 1 });

  const removeState = () => {
    const last = table.states - 1;
    const prefix = `q${last} `;
    const used = Object.entries(table.cells).some(
      ([key, value]) => key.startsWith(prefix) && value.trim() !== '',
    );
    if (used && !window.confirm(`Видалити стан q${last} разом з його правилами?`)) return;
    const cells = Object.fromEntries(
      Object.entries(table.cells).filter(([key]) => !key.startsWith(prefix)),
    );
    setTable({ ...table, states: last, cells });
  };

  const onText = (value: string) => {
    setText(value);
    const parsed = parse(value, { alphabet: table.alphabet });
    if (parsed.ok) setTable(tableFromProgram(parsed.value, table.alphabet));
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'text') {
      if (!built.ok) return;
      setText(formatProgram(built.value));
    }
    setMode(next);
  };

  const onExample = (id: string) => {
    const example = TURING_EXAMPLES.find((e) => e.id === id);
    if (!example) return;
    const isExample = TURING_EXAMPLES.some(
      (e) =>
        e.alphabet === table.alphabet &&
        JSON.stringify(flattenTable(e.table)) === JSON.stringify(table.cells),
    );
    const empty = Object.keys(table.cells).length === 0;
    if (
      !empty &&
      !isExample &&
      !window.confirm('Замінити поточну програму прикладом? Зміни буде втрачено.')
    )
      return;
    load({ table: tableOf(example), input: example.input, comment: example.comment });
    setNotice({ kind: 'info', text: `Завантажено приклад «${example.title}».` });
  };

  const onSave = () => {
    downloadText('turing-machine.json', serialize(table, inputText, comment));
    setNotice({ kind: 'info', text: 'Програму збережено у файл turing-machine.json.' });
  };

  const onOpenFile = (content: string) => {
    try {
      load(deserialize(content));
      setNotice({ kind: 'info', text: 'Програму завантажено з файлу.' });
    } catch (error) {
      setNotice({ kind: 'error', text: `Не вдалося відкрити файл: ${errorText(error)}` });
    }
  };

  const onShare = async () => {
    const url = shareUrl(window.location.href, serialize(table, inputText, comment));
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ kind: 'info', text: 'Посилання скопійовано в буфер обміну.' });
    } catch {
      window.prompt('Скопіюйте посилання:', url);
    }
  };

  const tableErrors = built.ok ? [] : built.errors;
  const tableMessages = [
    ...tableErrors.map((m) => ({ ...m, kind: 'error' as const })),
    ...built.warnings.map((m) => ({ ...m, kind: 'warning' as const })),
  ].filter((m) => !(m.state === null && m.symbol === null && !alphabet.ok));

  return (
    <div class="emulator">
      <ProgramActions
        idPrefix="turing"
        examples={TURING_EXAMPLES}
        onExample={onExample}
        onSave={onSave}
        onOpenFile={onOpenFile}
        onShare={() => void onShare()}
        notice={notice}
      />

      <section class="tape-panel" aria-labelledby="turing-tape-title">
        <h2 id="turing-tape-title" class="visually-hidden">
          Стрічка
        </h2>
        <Tape
          head={tape.head}
          cellAt={(index) => {
            const symbol = readCell(tape, index);
            return {
              text: symbol,
              filled: symbol !== BLANK,
              label: `Комірка ${index}: ${symbol === BLANK ? 'порожня (λ)' : symbol}`,
            };
          }}
          editable={tapeEditable}
          transitionMs={transitionMs}
          onCellClick={moveHead}
          onHeadChange={moveHead}
          caretBadge={badge}
          describedBy="turing-tape-help turing-configuration"
        />
        <div class="tape-panel__footer">
          <p id="turing-configuration" class="tape-panel__notation">
            Конфігурація:{' '}
            <code>{formatConfiguration(tape, state ? configurationState(state) : 0)}</code>
          </p>
          <div class="tape-panel__caret">
            <button
              type="button"
              class="button button--secondary"
              disabled={!tapeEditable}
              onClick={() => moveHead(tape.head - 1)}
            >
              <IconLeft />
              Каретка ліворуч
            </button>
            <button
              type="button"
              class="button button--secondary"
              disabled={!tapeEditable}
              onClick={() => moveHead(tape.head + 1)}
            >
              Каретка праворуч
              <IconRight />
            </button>
          </div>
        </div>
        <p id="turing-tape-help" class="tape-panel__hint">
          {tapeEditable
            ? 'Клік по комірці ставить туди каретку; її можна й перетягнути. Слово на стрічці задається в полі «Вхідні дані».'
            : started || playing
              ? 'Щоб змінити вхідні дані, натисніть «Скинути».'
              : 'Виправте вхідні дані, щоб працювати зі стрічкою.'}
        </p>
      </section>

      <RunControls
        idPrefix="turing"
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
        status={statusOf(snapshot, problem)}
      />

      <div class="emulator__workspace">
        <section class="panel" aria-labelledby="turing-program-title">
          <div class="panel__header">
            <h2 id="turing-program-title" class="panel__title">
              Програма
            </h2>
            <fieldset class="segmented">
              <legend class="visually-hidden">Режим редактора</legend>
              <label>
                <input
                  type="radio"
                  name="turing-mode"
                  checked={mode === 'table'}
                  disabled={mode === 'text' && !textParsed?.ok}
                  onChange={() => switchMode('table')}
                />
                <span>Таблиця</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="turing-mode"
                  checked={mode === 'text'}
                  disabled={mode === 'table' && !built.ok}
                  onChange={() => switchMode('text')}
                />
                <span>Текст</span>
              </label>
            </fieldset>
          </div>

          <label class="field" for="turing-alphabet">
            <span class="field__label">Зовнішній алфавіт A</span>
            <input
              id="turing-alphabet"
              class="input input--mono"
              value={table.alphabet}
              readOnly={playing}
              spellcheck={false}
              autocomplete="off"
              aria-invalid={!alphabet.ok}
              aria-describedby="turing-alphabet-help"
              onInput={(event) => setTable({ ...table, alphabet: event.currentTarget.value })}
            />
          </label>
          {!alphabet.ok && <p class="message message--error">{alphabet.error}</p>}
          <p id="turing-alphabet-help" class="panel__hint">
            Символи підряд, наприклад <code>0123456789</code>. Порожній символ λ додається
            автоматично.
          </p>

          {mode === 'table' ? (
            <>
              <TransitionTable
                symbols={symbols}
                states={table.states}
                cells={table.cells}
                onCell={setCell}
                onAddState={addState}
                onRemoveState={removeState}
                errors={tableErrors}
                active={position}
                activeKind={state?.status === 'crashed' ? 'error' : 'current'}
                readOnly={playing}
              />
              {tableMessages.length > 0 && (
                <ul class="code-editor__messages">
                  {tableMessages.map((m, i) => (
                    <li key={i} class={`message message--${m.kind}`}>
                      <span class="message__label">
                        {m.kind === 'error' ? 'Помилка.' : 'Попередження.'}
                      </span>{' '}
                      {m.state !== null && m.symbol !== null ? `q${m.state}, ${m.symbol}: ` : ''}
                      {m.message}
                    </li>
                  ))}
                </ul>
              )}
              <p class="panel__hint">
                Клітинка — команда «символ, рух, стан»: <code>1Rq0</code>, <code>λLq1</code>,{' '}
                <code>0N!</code>. Незмінні символ і стан можна не писати: <code>Rq1</code>,{' '}
                <code>1L</code>, <code>R</code>. Порожня клітинка — правила немає.
              </p>
            </>
          ) : (
            <>
              <CodeEditor
                id="turing-program"
                labelledBy="turing-program-title"
                value={text}
                onInput={onText}
                errors={textParsed && !textParsed.ok ? textParsed.errors : []}
                warnings={textParsed?.warnings ?? []}
                currentLine={position ? findRuleLine(text, position.state, position.symbol) : null}
                follow={playing}
                readOnly={playing}
              />
              <p class="panel__hint">
                Одне правило в рядку: <code>q0, 1 -&gt; 1, R, q0</code>. Текст можна скопіювати або
                вставити сюди програму.
              </p>
            </>
          )}
          {mode === 'table' && !built.ok && (
            <p class="panel__hint">
              Текстовий режим стане доступним, коли в таблиці не буде помилок.
            </p>
          )}
        </section>

        <div class="emulator__side">
          <section class="panel" aria-labelledby="turing-input-title">
            <h2 id="turing-input-title" class="panel__title">
              Вхідні дані
            </h2>
            <label class="field" for="turing-input">
              <span class="field__label">Слово на стрічці</span>
              <input
                id="turing-input"
                class="input input--mono"
                value={inputText}
                readOnly={playing}
                spellcheck={false}
                autocomplete="off"
                aria-invalid={inputParsed !== null && !inputParsed.ok}
                aria-describedby="turing-input-help"
                onInput={(event) => setInputText(event.currentTarget.value)}
              />
            </label>
            {inputParsed && !inputParsed.ok && (
              <p class="message message--error">{inputParsed.error}</p>
            )}
            <p id="turing-input-help" class="panel__hint">
              Символи алфавіту підряд; <code>λ</code> або <code>_</code> — порожня комірка,{' '}
              <code>[9]</code> — каретка на цьому символі, <code>1^5</code> — п’ять однакових
              поспіль. Без позначки каретка стоїть на першому символі.
            </p>
          </section>

          <CommentPanel id="turing-comment" value={comment} onInput={setComment} />

          <ExecutionLog
            entries={snapshot.log}
            total={snapshot.logged}
            columns={LOG_COLUMNS}
            rowKey={(entry) => entry.step}
            leading={initial ? { step: 0, rule: null, state: initial } : undefined}
          />
        </div>
      </div>
    </div>
  );
}
