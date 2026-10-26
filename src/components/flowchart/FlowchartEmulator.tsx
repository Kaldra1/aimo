/** Острів конструктора блок-схем: ядро з src/lib/machines/flowchart, UI малює схему й стан. */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  BLOCK_META,
  BLOCK_TYPES,
  compile,
  createState,
  describeEnv,
  deserialize,
  END,
  findNode,
  FLOWCHART_EXAMPLES,
  insertAt,
  layout,
  makeNode,
  nextId,
  positionOf,
  removeNode,
  run,
  serialize,
  shapeOutline,
  step,
  toSvg,
  updateText,
  type BlockType,
  type FlowEvent,
  type FlowExample,
  type FlowNode,
  type FlowProgram,
  type FlowSaved,
  type Slot,
} from '../../lib/machines/flowchart';
import { decodeShareHash, shareUrl } from '../../lib/machines/share';
import { CommentPanel } from '../emulator/CommentPanel';
import { ExecutionLog, type LogColumn } from '../emulator/ExecutionLog';
import { ProgramActions, type Notice } from '../emulator/ProgramActions';
import { RunControls } from '../emulator/RunControls';
import {
  DEFAULT_LIMIT,
  DEFAULT_SPEED_INDEX,
  downloadText,
  errorText,
  readStorage,
  speedAt,
  statusOf,
  useRunner,
  writeStorage,
  type EmulatorApi,
} from '../emulator/support';

const STORAGE_KEY = 'aimo:emulator:flowchart';
const MACHINE = { step, run };
const FIRST = FLOWCHART_EXAMPLES[0]!;
const DEFAULT: FlowSaved = { tree: FIRST.tree, input: FIRST.input, comment: FIRST.comment };

export interface FlowchartEmulatorProps {
  storageKey?: string;
  initial?: FlowSaved;
  examples?: readonly FlowExample[];
  fileName?: string;
  /** Повідомляє про зміни: скомпільована схема (null — у ній помилки) і все, що зберігається. */
  onChange?: (program: FlowProgram | null, saved: FlowSaved) => void;
  onReady?: (api: EmulatorApi) => void;
  actions?: ComponentChildren;
}

interface Menu {
  slot: Slot;
  x: number;
  y: number;
}

export default function FlowchartEmulator({
  storageKey = STORAGE_KEY,
  initial: start = DEFAULT,
  examples = FLOWCHART_EXAMPLES,
  fileName = 'flowchart.json',
  onChange,
  onReady,
  actions,
}: FlowchartEmulatorProps) {
  const [tree, setTree] = useState<FlowNode[]>(start.tree);
  const [inputText, setInputText] = useState(start.input);
  const [comment, setComment] = useState(start.comment);
  const [selected, setSelected] = useState<number | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [restored, setRestored] = useState(false);
  const [resets, setResets] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const compiled = useMemo(() => compile(tree), [tree]);
  const program = compiled.ok ? compiled.value : null;
  const errors = useMemo(
    () => new Map((compiled.ok ? [] : compiled.errors).map((e) => [e.id, e.message])),
    [compiled],
  );
  const initial = useMemo(
    () => (program ? createState(program, inputText) : null),
    [program, inputText],
  );
  const picture = useMemo(() => layout(tree), [tree]);

  const { snapshot, runner } = useRunner(MACHINE, initial, {
    limit: DEFAULT_LIMIT,
    speed: speedAt(DEFAULT_SPEED_INDEX),
  });
  useEffect(() => runner.reset(initial), [runner, initial, resets]);
  useEffect(() => runner.setSpeed(speedAt(speedIndex)), [runner, speedIndex]);

  const saved: FlowSaved = { tree, input: inputText, comment };
  const load = (next: FlowSaved) => {
    setTree(next.tree);
    setInputText(next.input);
    setComment(next.comment);
    setSelected(null);
    setMenu(null);
  };

  const readShared = (): FlowSaved | null => {
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
      () => writeStorage(storageKey, serialize({ tree, input: inputText, comment })),
      400,
    );
    return () => clearTimeout(timer);
  }, [storageKey, restored, tree, inputText, comment]);

  useEffect(() => {
    onChange?.(program, { tree, input: inputText, comment });
  }, [onChange, program, tree, inputText, comment]);

  useEffect(() => {
    onReady?.({
      loadInput: (text) => {
        setInputText(text);
        setResets((count) => count + 1);
      },
    });
  }, [onReady]);

  // Esc закриває меню вставки.
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  // Схема на все вікно: Esc згортає (якщо не відкрито меню), сторінка під нею не прокручується.
  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !menu) setExpanded(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded, menu]);

  const { state, playing, limitReached } = snapshot;
  const touched = state !== null && (state.steps > 0 || state.status !== 'running');
  const canContinue = state !== null && state.status === 'running' && !limitReached;
  const position = state && touched ? positionOf(state) : null;
  const lastNode =
    touched && snapshot.log.length > 0 ? snapshot.log[snapshot.log.length - 1]!.node : null;
  const activeKey = position ? position.node : state?.status === 'crashed' ? lastNode : null;
  const problem =
    program === null
      ? 'У схемі є помилки в блоках (позначені червоним) — виправте їх, щоб запустити.'
      : null;
  const status = statusOf(snapshot, problem);
  const editing = !playing;

  const selectedNode = selected === null ? undefined : findNode(tree, selected);

  const insert = (type: BlockType) => {
    if (!menu) return;
    const node = makeNode(type, nextId(tree));
    setTree(insertAt(tree, menu.slot, node));
    setSelected(node.id);
    setMenu(null);
  };
  const remove = () => {
    if (!selectedNode) return;
    const nested =
      (selectedNode.yes?.length ?? 0) +
      (selectedNode.no?.length ?? 0) +
      (selectedNode.body?.length ?? 0);
    if (nested > 0 && !window.confirm('Видалити блок разом із вкладеними блоками?')) return;
    setTree(removeNode(tree, selectedNode.id));
    setSelected(null);
  };

  const onExample = (id: string) => {
    const example = examples.find((e) => e.id === id);
    if (!example) return;
    if (
      tree.length > 0 &&
      !window.confirm('Замінити поточну схему прикладом? Зміни буде втрачено.')
    )
      return;
    load({ tree: example.tree, input: example.input, comment: example.comment });
    setNotice({ kind: 'info', text: `Завантажено приклад «${example.title}».` });
  };
  const onNew = () => {
    if (tree.length > 0 && !window.confirm('Почати нову порожню схему? Поточну буде втрачено.'))
      return;
    load({ tree: [], input: '', comment: '' });
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
  const onSvg = () => {
    const url = URL.createObjectURL(new Blob([toSvg(picture)], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'схема.svg';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice({ kind: 'info', text: 'Схему збережено як схема.svg — її можна вставити у звіт.' });
  };

  const onKeyActivate = (action: () => void) => (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const nameOf = (id: number) => {
    if (id === END) return 'Кінець';
    const n = findNode(tree, id);
    return n ? `${BLOCK_META[n.type].title}: ${n.text}` : '';
  };
  const LOG_COLUMNS: LogColumn<FlowEvent>[] = [
    { header: 'Крок', cell: (e) => e.step },
    { header: 'Блок', cell: (e) => nameOf(e.node), mono: true },
    { header: 'Дія', cell: (e) => e.text, mono: true },
  ];

  const blockEditor = selectedNode ? (
    <>
      <label class="field" for="flowchart-block-text">
        <span class="field__label">{BLOCK_META[selectedNode.type].title}</span>
        <textarea
          id="flowchart-block-text"
          class="input input--mono"
          rows={3}
          value={selectedNode.text}
          readOnly={!editing}
          spellcheck={false}
          aria-invalid={errors.has(selectedNode.id)}
          onInput={(event) => setTree(updateText(tree, selectedNode.id, event.currentTarget.value))}
        />
      </label>
      {errors.has(selectedNode.id) && (
        <p class="message message--error">{errors.get(selectedNode.id)}</p>
      )}
      <p class="panel__hint">{BLOCK_META[selectedNode.type].hint}</p>
      <button type="button" class="button button--secondary" disabled={!editing} onClick={remove}>
        Видалити блок
      </button>
    </>
  ) : (
    <p class="panel__hint">Виберіть блок на схемі, щоб змінити його текст.</p>
  );

  const vars = state ? describeEnv(state.env) : [];
  const output = state?.output ?? [];

  return (
    <div class="emulator flowchart">
      <ProgramActions
        idPrefix="flowchart"
        examples={examples}
        onExample={onExample}
        extra={
          <>
            <button
              type="button"
              class="button button--secondary"
              onClick={onNew}
              disabled={playing}
            >
              Нова схема
            </button>
            <button type="button" class="button button--secondary" onClick={onSvg}>
              Зберегти SVG
            </button>
            {actions}
          </>
        }
        onSave={onSave}
        onOpenFile={onOpenFile}
        onShare={() => void onShare()}
        notice={notice}
      />

      <RunControls
        idPrefix="flowchart"
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
        <section
          class={`panel flowchart-canvas${expanded ? ' is-expanded' : ''}`}
          aria-labelledby="flowchart-title"
          {...(expanded ? { role: 'dialog', 'aria-modal': 'true' } : {})}
        >
          <div class="panel__header">
            <h2 id="flowchart-title" class="panel__title">
              Схема алгоритму
            </h2>
            {expanded && (
              <div class="flowchart-canvas__run">
                <button
                  type="button"
                  class="button button--secondary"
                  disabled={!canContinue}
                  onClick={() => runner.stepOnce()}
                >
                  Крок
                </button>
                {playing ? (
                  <button
                    type="button"
                    class="button button--secondary"
                    onClick={() => runner.pause()}
                  >
                    Пауза
                  </button>
                ) : (
                  <button
                    type="button"
                    class="button button--primary"
                    disabled={!canContinue}
                    onClick={() => runner.play()}
                  >
                    Пуск
                  </button>
                )}
                <button
                  type="button"
                  class="button button--secondary"
                  disabled={!(touched || playing)}
                  onClick={() => runner.reset(initial)}
                >
                  Скинути
                </button>
                <span class={`flowchart-canvas__status status--${status.kind}`} role="status">
                  {status.text}
                </span>
              </div>
            )}
            <button
              type="button"
              class="button button--secondary"
              aria-pressed={expanded}
              onClick={() => {
                setExpanded(!expanded);
                setMenu(null);
              }}
            >
              {expanded ? 'Згорнути' : 'На все вікно'}
            </button>
          </div>
          <p class="panel__hint">
            Натисніть <b>+</b> на лінії, щоб вставити блок; натисніть блок, щоб змінити його текст.
          </p>
          <div class="flowchart-canvas__scroll">
            <svg
              class="flowchart-svg"
              width={picture.width}
              height={picture.height}
              viewBox={`0 0 ${picture.width} ${picture.height}`}
              role="group"
              aria-label="Схема алгоритму"
            >
              <defs>
                <marker
                  id="flowchart-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto"
                >
                  <path d="M0,1 L9,5 L0,9" class="flowchart-arrow" />
                </marker>
              </defs>
              {picture.lines.map((ln, i) => (
                <polyline
                  key={`l${i}`}
                  class="flowchart-line"
                  points={ln.points.map((p) => p.join(',')).join(' ')}
                  marker-end={ln.arrow ? 'url(#flowchart-arrow)' : undefined}
                />
              ))}
              {picture.labels.map((lb, i) => (
                <text
                  key={`t${i}`}
                  class="flowchart-label"
                  x={lb.x}
                  y={lb.y}
                  text-anchor={lb.anchor}
                >
                  {lb.text}
                </text>
              ))}
              {picture.shapes.map((s) => {
                const outline = shapeOutline(s);
                const Tag = outline.tag;
                const error = s.id !== null ? errors.get(s.id) : undefined;
                const cls = [
                  'flowchart-shape',
                  s.id === null ? 'is-terminator' : '',
                  s.id !== null && s.id === selected ? 'is-selected' : '',
                  activeKey !== null && s.key === activeKey && (s.id !== null || s.key === END)
                    ? 'is-current'
                    : '',
                  state?.status === 'crashed' && s.key === activeKey ? 'is-crashed' : '',
                  error ? 'is-error' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const select = () => {
                  if (s.id !== null && editing) {
                    setSelected(s.id);
                    setMenu(null);
                  }
                };
                return (
                  <g
                    key={`s${s.key}${s.id ?? 'term'}`}
                    class="flowchart-block"
                    {...(s.id !== null
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          'aria-label': `${nameOf(s.id)}${error ? ` — помилка: ${error}` : ''}`,
                          onClick: select,
                          onKeyDown: onKeyActivate(select),
                        }
                      : {})}
                  >
                    <Tag class={cls} {...outline.attrs} />
                    {s.lines.map((t, i) => (
                      <text
                        key={i}
                        class="flowchart-text"
                        x={s.x}
                        y={s.y + s.h / 2 + (i - (s.lines.length - 1) / 2) * 14 + 4}
                        text-anchor="middle"
                      >
                        {t}
                      </text>
                    ))}
                    {error && <title>{error}</title>}
                  </g>
                );
              })}
              {editing &&
                picture.plus.map((p, i) => {
                  const open = () => setMenu({ slot: p.slot, x: p.x, y: p.y });
                  return (
                    <g
                      key={`p${i}`}
                      class="flowchart-plus"
                      transform={`translate(${p.x},${p.y})`}
                      role="button"
                      tabIndex={0}
                      aria-label="Вставити блок"
                      onClick={open}
                      onKeyDown={onKeyActivate(open)}
                    >
                      <circle r={8} />
                      <path d="M-4,0 H4 M0,-4 V4" />
                    </g>
                  );
                })}
            </svg>
            {menu && (
              <div
                class="flowchart-menu"
                style={{ left: `${menu.x + 14}px`, top: `${menu.y - 10}px` }}
                role="menu"
              >
                {BLOCK_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="menuitem"
                    class="flowchart-menu__item"
                    onClick={() => insert(type)}
                  >
                    {BLOCK_META[type].title}
                  </button>
                ))}
                <button
                  type="button"
                  class="flowchart-menu__item is-cancel"
                  onClick={() => setMenu(null)}
                >
                  Скасувати
                </button>
              </div>
            )}
          </div>
          {expanded && (
            <aside class="flowchart-canvas__side" aria-label="Блок і вивід">
              <h3 class="panel__title">Блок</h3>
              {blockEditor}
              <h3 class="panel__title">Вивід</h3>
              <pre class="flowchart-output">{output.length ? output.join('\n') : ' '}</pre>
            </aside>
          )}
        </section>

        <div class="emulator__side">
          <section class="panel" aria-labelledby="flowchart-block-title">
            <h2 id="flowchart-block-title" class="panel__title">
              Блок
            </h2>
            {expanded ? (
              <p class="panel__hint">Схему розгорнуто на все вікно — блок редагується там.</p>
            ) : (
              blockEditor
            )}
          </section>

          <section class="panel" aria-labelledby="flowchart-input-title">
            <h2 id="flowchart-input-title" class="panel__title">
              Вхідні дані
            </h2>
            <label class="field" for="flowchart-input">
              <span class="field__label">Значення через пробіл</span>
              <input
                id="flowchart-input"
                class="input input--mono"
                value={inputText}
                readOnly={playing}
                spellcheck={false}
                autocomplete="off"
                onInput={(event) => setInputText(event.currentTarget.value)}
              />
            </label>
            <p class="panel__hint">
              Блоки «Введення» читають значення по черзі: <code>12 18</code> — спершу 12, потім 18.
            </p>
          </section>

          <section class="panel" aria-labelledby="flowchart-output-title">
            <h2 id="flowchart-output-title" class="panel__title">
              Вивід
            </h2>
            <pre class="flowchart-output">{output.length ? output.join('\n') : ' '}</pre>
          </section>

          <section class="panel" aria-labelledby="flowchart-vars-title">
            <h2 id="flowchart-vars-title" class="panel__title">
              Змінні
            </h2>
            {vars.length === 0 ? (
              <p class="panel__hint">Тут з’являться змінні та їхні значення.</p>
            ) : (
              <table class="flowchart-vars">
                <tbody>
                  {vars.map((v) => (
                    <tr key={v.name}>
                      <th scope="row" class="mono">
                        {v.name}
                      </th>
                      <td class="mono">{v.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <CommentPanel id="flowchart-comment" value={comment} onInput={setComment} />

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
