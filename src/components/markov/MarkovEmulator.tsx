/** Острів емулятора нормальних алгоритмів Маркова: ядро з src/lib/machines/markov, UI лише малює стан. */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  createState,
  deserialize,
  formatRule,
  formatWord,
  MARKOV_EXAMPLES,
  parse,
  parseAlphabet,
  parseWord,
  positionOf,
  run,
  serialize,
  step,
  type MarkovEvent,
  type MarkovExample,
  type MarkovProgram,
  type MarkovRule,
  type MarkovSaved,
} from '../../lib/machines/markov';
import { decodeShareHash, shareUrl } from '../../lib/machines/share';
import { CodeEditor } from '../emulator/CodeEditor';
import { CommentPanel } from '../emulator/CommentPanel';
import { ProgramActions, type Notice } from '../emulator/ProgramActions';
import { RunControls } from '../emulator/RunControls';
import {
  DEFAULT_LIMIT,
  DEFAULT_SPEED_INDEX,
  downloadText,
  errorText,
  formatNumber,
  readStorage,
  speedAt,
  statusOf,
  useRunner,
  writeStorage,
  type EmulatorApi,
} from '../emulator/support';

const STORAGE_KEY = 'aimo:emulator:markov';
const MACHINE = { step, run };
const FIRST = MARKOV_EXAMPLES[0]!;
const DEFAULT: MarkovSaved = {
  program: FIRST.program,
  input: FIRST.input,
  alphabet: FIRST.alphabet,
  checkAlphabet: true,
  comment: FIRST.comment,
};
const SCHEME_ERRORS = 'У схемі є помилки — виправте їх, щоб запустити.';

/** Слово з підсвіченим фрагментом; порожній фрагмент — вузька позначка місця. */
function Highlighted({
  word,
  from,
  length,
  kind,
}: {
  word: string;
  from: number;
  length: number;
  kind: 'before' | 'after';
}) {
  const mark =
    length > 0 ? (
      <mark class={`markov-mark markov-mark--${kind}`}>{word.slice(from, from + length)}</mark>
    ) : (
      <span class={`markov-gap markov-gap--${kind}`} aria-hidden="true" />
    );
  return (
    <>
      {word.slice(0, from)}
      {mark}
      {word.slice(from + length)}
      {word === '' && <span class="markov-empty">λ</span>}
    </>
  );
}

const ruleLabel = (rule: MarkovRule) => `${rule.number}) ${formatRule(rule)}`;

export interface MarkovEmulatorProps {
  /** Ключ автозбереження в localStorage; у кожної задачі — свій. */
  storageKey?: string;
  /** Схема, слово й алфавіт, якщо нічого не збережено. */
  initial?: MarkovSaved;
  /** Вбудовані приклади; на сторінці задачі їх немає. */
  examples?: readonly MarkovExample[];
  /** Ім'я файлу для кнопки «Зберегти». */
  fileName?: string;
  /** Повідомляє про зміни: розібрана схема (null — у ній помилки) і все, що зберігається. */
  onChange?: (program: MarkovProgram | null, saved: MarkovSaved) => void;
  /** Передає сторінці задачі керування вхідним словом. */
  onReady?: (api: EmulatorApi) => void;
  /** Додаткові кнопки в панелі дій. */
  actions?: ComponentChildren;
}

export default function MarkovEmulator({
  storageKey = STORAGE_KEY,
  initial: start = DEFAULT,
  examples = MARKOV_EXAMPLES,
  fileName = 'markov-algorithm.json',
  onChange,
  onReady,
  actions,
}: MarkovEmulatorProps) {
  const [source, setSource] = useState(start.program);
  const [inputText, setInputText] = useState(start.input);
  const [alphabet, setAlphabet] = useState(start.alphabet);
  const [checkAlphabet, setCheckAlphabet] = useState(start.checkAlphabet);
  const [comment, setComment] = useState(start.comment);
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [restored, setRestored] = useState(false);
  const [resets, setResets] = useState(0);
  const traceRef = useRef<HTMLDivElement>(null);

  const alphabetText = checkAlphabet ? alphabet : null;
  const parsed = useMemo(() => parse(source, { alphabet: alphabetText }), [source, alphabetText]);
  const symbols = useMemo(() => {
    if (alphabetText === null) return null;
    const result = parseAlphabet(alphabetText);
    return result.ok && result.symbols.length > 0 ? result.symbols : null;
  }, [alphabetText]);
  const inputParsed = useMemo(() => parseWord(inputText, symbols), [inputText, symbols]);
  const program = parsed.ok ? parsed.value : null;
  const initial = useMemo(
    () => (program && inputParsed.ok ? createState(program, inputParsed.word) : null),
    [program, inputParsed],
  );

  const { snapshot, runner } = useRunner(MACHINE, initial, {
    limit: DEFAULT_LIMIT,
    speed: speedAt(DEFAULT_SPEED_INDEX),
  });
  // Нова схема чи нове слово — починаємо спочатку; лічильник скидань — для того самого слова ззовні.
  useEffect(() => runner.reset(initial), [runner, initial, resets]);
  useEffect(() => runner.setSpeed(speedAt(speedIndex)), [runner, speedIndex]);

  const saved: MarkovSaved = {
    program: source,
    input: inputText,
    alphabet,
    checkAlphabet,
    comment,
  };

  const load = (next: MarkovSaved) => {
    setSource(next.program);
    setInputText(next.input);
    setAlphabet(next.alphabet);
    setCheckAlphabet(next.checkAlphabet);
    setComment(next.comment);
  };

  /** Схема з посилання «Поділитися» (`#s=…`). Хеш прибираємо, щоб далі діяло автозбереження. */
  const readShared = (): MarkovSaved | null => {
    const shared = decodeShareHash(window.location.hash);
    if (shared === null) return null;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    try {
      const result = deserialize(shared);
      setNotice({ kind: 'info', text: 'Відкрито схему з посилання.' });
      return result;
    } catch (error) {
      setNotice({ kind: 'error', text: `Посилання пошкоджене: ${errorText(error)}` });
      return null;
    }
  };

  // Відкриття: посилання «Поділитися» має пріоритет над автозбереженням.
  useEffect(() => {
    let restoredState = readShared();
    if (restoredState === null) {
      const stored = readStorage(storageKey);
      if (stored !== null) {
        try {
          restoredState = deserialize(stored);
        } catch {
          restoredState = null;
        }
      }
    }
    if (restoredState !== null) load(restoredState);
    setRestored(true);

    const onHashChange = () => {
      const shared = readShared();
      if (shared !== null) load(shared);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [storageKey]);

  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(
      () =>
        writeStorage(
          storageKey,
          serialize({ program: source, input: inputText, alphabet, checkAlphabet, comment }),
        ),
      400,
    );
    return () => clearTimeout(timer);
  }, [storageKey, restored, source, inputText, alphabet, checkAlphabet, comment]);

  // Сторінка задачі дізнається про кожну зміну схеми, щоб перевіряти саме її.
  useEffect(() => {
    onChange?.(program, { program: source, input: inputText, alphabet, checkAlphabet, comment });
  }, [onChange, program, source, inputText, alphabet, checkAlphabet, comment]);

  // Функція використовує лише сетери стану, тож лишається правильною, поки острів відкритий.
  useEffect(() => {
    onReady?.({
      loadInput: (text) => {
        setInputText(text);
        setResets((count) => count + 1);
      },
    });
  }, [onReady]);

  const { state, playing, limitReached } = snapshot;
  const log: readonly MarkovEvent[] = snapshot.log;

  // Нові рядки трасувальної таблиці — прокручуємо її донизу.
  useEffect(() => {
    const box = traceRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [snapshot.logged]);

  const touched = state !== null && (state.steps > 0 || state.status !== 'running');
  const canContinue = state !== null && state.status === 'running' && !limitReached;
  const position = state && touched ? positionOf(state) : null;
  const last = touched ? state?.last : undefined;

  const problem =
    program === null
      ? SCHEME_ERRORS
      : !inputParsed.ok
        ? 'Виправте вхідне слово, щоб запустити.'
        : null;
  let status = statusOf(snapshot, problem);
  if (problem === null && state?.status === 'halted') {
    const steps = formatNumber(state.steps);
    status = {
      kind: 'halted',
      text:
        state.stop === 'final'
          ? `Зупинка: спрацювала заключна підстановка ${state.last?.rule.number ?? ''}. Виконано кроків: ${steps}.`
          : `Зупинка: жодна підстановка не застосовна. Виконано кроків: ${steps}.`,
    };
  }

  const onExample = (id: string) => {
    const example = examples.find((e) => e.id === id);
    if (!example) return;
    const modified = source.trim() !== '' && !examples.some((e) => e.program === source);
    if (modified && !window.confirm('Замінити поточну схему прикладом? Зміни буде втрачено.'))
      return;
    load({
      program: example.program,
      input: example.input,
      alphabet: example.alphabet,
      checkAlphabet: true,
      comment: example.comment,
    });
    setNotice({ kind: 'info', text: `Завантажено приклад «${example.title}».` });
  };

  const onSave = () => {
    downloadText(fileName, serialize(saved));
    setNotice({ kind: 'info', text: `Схему збережено у файл ${fileName}.` });
  };

  const onOpenFile = (content: string) => {
    try {
      load(deserialize(content));
      setNotice({ kind: 'info', text: 'Схему завантажено з файлу.' });
    } catch (error) {
      setNotice({ kind: 'error', text: `Не вдалося відкрити файл: ${errorText(error)}` });
    }
  };

  const onShare = async () => {
    const url = shareUrl(window.location.href, serialize(saved));
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ kind: 'info', text: 'Посилання скопійовано в буфер обміну.' });
    } catch {
      window.prompt('Скопіюйте посилання:', url);
    }
  };

  const copyTrace = async () => {
    const lines = [
      'Крок\tПідстановка\tСлово до\tСлово після',
      ...log.map((e) =>
        [e.step, ruleLabel(e.rule), formatWord(e.before), formatWord(e.after)].join('\t'),
      ),
    ];
    if (state && state.status !== 'running') lines.push('', status.text);
    const text = `${lines.join('\n')}\n`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice({
        kind: 'info',
        text: 'Трасувальну таблицю скопійовано — її можна вставити у звіт.',
      });
    } catch {
      downloadText('markov-trace.txt', text);
      setNotice({ kind: 'info', text: 'Трасувальну таблицю збережено у файл markov-trace.txt.' });
    }
  };

  const word = state?.word ?? (inputParsed.ok ? inputParsed.word : null);
  const errors = parsed.ok ? [] : parsed.errors;

  return (
    <div class="emulator markov">
      <ProgramActions
        idPrefix="markov"
        examples={examples}
        onExample={onExample}
        extra={actions}
        onSave={onSave}
        onOpenFile={onOpenFile}
        onShare={() => void onShare()}
        notice={notice}
      />

      <section class="markov-word" aria-labelledby="markov-word-title">
        <h2 id="markov-word-title" class="markov-word__title">
          Слово
        </h2>
        <p class="markov-word__current">
          {word === null ? (
            <span class="markov-empty">—</span>
          ) : last ? (
            <Highlighted
              word={word}
              from={last.index}
              length={last.rule.right.length}
              kind="after"
            />
          ) : (
            formatWord(word)
          )}
        </p>
        {last ? (
          <dl class="markov-word__change">
            <div>
              <dt>Підстановка</dt>
              <dd>
                <code>{ruleLabel(last.rule)}</code>
              </dd>
            </div>
            <div>
              <dt>До заміни</dt>
              <dd class="mono">
                <Highlighted
                  word={last.before}
                  from={last.index}
                  length={last.rule.left.length}
                  kind="before"
                />
              </dd>
            </div>
          </dl>
        ) : (
          <p class="panel__hint">
            {state?.status === 'halted'
              ? 'Жодна підстановка не застосовна до цього слова.'
              : 'Натисніть «Крок» або «Пуск»: жовтим буде підсвічено замінюваний фрагмент, зеленим — те, що з’явилося натомість.'}
          </p>
        )}
      </section>

      <RunControls
        idPrefix="markov"
        canStep={canContinue}
        canPlay={canContinue && !playing}
        canPause={playing}
        canReset={touched || playing}
        onStep={() => runner.stepOnce()}
        onPlay={() => runner.play()}
        onPause={() => runner.pause()}
        onReset={() => runner.reset(initial)}
        speedIndex={speedIndex}
        onSpeedIndex={setSpeedIndex}
        limit={snapshot.limit}
        onLimit={(limit) => runner.setLimit(limit)}
        steps={state?.steps ?? 0}
        status={status}
      />

      <div class="emulator__workspace">
        <section class="panel" aria-labelledby="markov-program-title">
          <div class="panel__header">
            <h2 id="markov-program-title" class="panel__title">
              Схема підстановок
            </h2>
          </div>

          <div class="markov-alphabet">
            <label class="field" for="markov-alphabet">
              <span class="field__label">Алфавіт</span>
              <input
                id="markov-alphabet"
                class="input input--mono"
                value={alphabet}
                readOnly={playing}
                disabled={!checkAlphabet}
                spellcheck={false}
                autocomplete="off"
                aria-describedby="markov-alphabet-help"
                onInput={(event) => setAlphabet(event.currentTarget.value)}
              />
            </label>
            <label class="markov-check">
              <input
                type="checkbox"
                checked={checkAlphabet}
                disabled={playing}
                onChange={(event) => setCheckAlphabet(event.currentTarget.checked)}
              />
              <span>Перевіряти символи за алфавітом</span>
            </label>
          </div>
          <p id="markov-alphabet-help" class="panel__hint">
            Букви підряд, наприклад <code>ab#</code>. До алфавіту входять і допоміжні букви
            (маркери). Порожнє слово λ додавати не треба.
          </p>

          <CodeEditor
            id="markov-program"
            labelledBy="markov-program-title"
            value={source}
            onInput={setSource}
            errors={errors}
            warnings={parsed.warnings}
            currentLine={position?.line ?? null}
            follow={playing}
            readOnly={playing}
          />
          <p class="panel__hint">
            Одна підстановка в рядку: <code>ab -&gt; ba</code>, заключна — <code>a -&gt;. b</code>{' '}
            (або <code>=&gt;</code>, <code>→</code>, <code>→·</code>). Порожнє слово —{' '}
            <code>λ</code> або нічого. Коментар — після <code>//</code>.
          </p>

          {program && (
            <div class="markov-rules">
              <h3 class="markov-rules__title">Підстановки за порядком</h3>
              <ol class="markov-rules__list">
                {program.rules.map((rule) => (
                  <li
                    key={rule.number}
                    class={`markov-rules__item${position?.rule === rule.number ? ' is-active' : ''}`}
                    aria-current={position?.rule === rule.number ? 'step' : undefined}
                  >
                    <span class="markov-rules__number">{rule.number})</span>
                    <code>{formatRule(rule)}</code>
                    {rule.final && <span class="markov-rules__final">заключна</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <div class="emulator__side">
          <section class="panel" aria-labelledby="markov-input-title">
            <h2 id="markov-input-title" class="panel__title">
              Вхідне слово
            </h2>
            <label class="field" for="markov-input">
              <span class="field__label">Слово</span>
              <input
                id="markov-input"
                class="input input--mono"
                value={inputText}
                readOnly={playing}
                spellcheck={false}
                autocomplete="off"
                aria-invalid={!inputParsed.ok}
                aria-describedby="markov-input-help"
                onInput={(event) => setInputText(event.currentTarget.value)}
              />
            </label>
            {!inputParsed.ok && <p class="message message--error">{inputParsed.error}</p>}
            <p id="markov-input-help" class="panel__hint">
              Букви підряд; <code>λ</code> або порожнє поле — порожнє слово.
            </p>
          </section>

          <CommentPanel id="markov-comment" value={comment} onInput={setComment} />

          <section class="panel markov-trace" aria-labelledby="markov-trace-title">
            <div class="panel__header">
              <h2 id="markov-trace-title" class="panel__title">
                Трасувальна таблиця
              </h2>
              <button
                type="button"
                class="button button--secondary"
                disabled={log.length === 0}
                onClick={() => void copyTrace()}
              >
                Копіювати як текст
              </button>
            </div>
            {log.length === 0 ? (
              <p class="panel__hint">
                Тут з’являтиметься кожен крок: підстановка, слово до й після.
              </p>
            ) : (
              <div class="markov-trace__scroll" ref={traceRef}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Крок</th>
                      <th scope="col">Підстановка</th>
                      <th scope="col">Слово до</th>
                      <th scope="col">Слово після</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((e) => (
                      <tr key={e.step}>
                        <td>{e.step}</td>
                        <td class="mono">{ruleLabel(e.rule)}</td>
                        <td class="mono">
                          <Highlighted
                            word={e.before}
                            from={e.index}
                            length={e.rule.left.length}
                            kind="before"
                          />
                        </td>
                        <td class="mono">
                          <Highlighted
                            word={e.after}
                            from={e.index}
                            length={e.rule.right.length}
                            kind="after"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {snapshot.logged > log.length && (
              <p class="panel__hint">
                Показано останні {formatNumber(log.length)} з {formatNumber(snapshot.logged)}{' '}
                кроків.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
