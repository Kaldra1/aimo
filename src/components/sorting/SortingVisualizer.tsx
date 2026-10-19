/** Острів візуалізатора простих сортувань: траєкторія з src/lib/sorting, UI лише показує крок. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import '../../styles/emulator.css';
import '../../styles/sorting.css';
import {
  ALGORITHMS,
  DEFAULT_ARRAY,
  makePreset,
  parseArray,
  traceSort,
  type Preset,
  type SortAlgorithm,
  type SortStep,
} from '../../lib/sorting/trace';

const SPEEDS = [0.5, 1, 2, 4, 8] as const;
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'random', label: 'Випадковий' },
  { id: 'nearly', label: 'Майже відсортований' },
  { id: 'sorted', label: 'Відсортований' },
  { id: 'reversed', label: 'Зворотний' },
];

function barState(step: SortStep, index: number): string {
  if (step.kind === 'swap' && step.active.includes(index)) return 'is-swap';
  if (step.kind === 'shift' && step.active.includes(index)) return 'is-swap';
  if (step.active.includes(index)) return 'is-active';
  if (step.min === index) return 'is-min';
  if (step.sorted.includes(index)) return 'is-sorted';
  return '';
}

export interface SortingVisualizerProps {
  /** Стрілки й PageDown/PageUp крокують масивом; у лекції вимкнено, щоб гортати сторінку. */
  hotkeys?: boolean;
}

export default function SortingVisualizer({ hotkeys = true }: SortingVisualizerProps) {
  const [algorithm, setAlgorithm] = useState<SortAlgorithm>('bubble');
  const [text, setText] = useState(DEFAULT_ARRAY.join(', '));
  const [values, setValues] = useState<number[]>(DEFAULT_ARRAY);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const parsed = useMemo(() => parseArray(text), [text]);
  const steps = useMemo(() => traceSort(algorithm, values), [algorithm, values]);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const atEnd = index >= steps.length - 1;
  const info = ALGORITHMS[algorithm];

  // Нова траєкторія — з початку.
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [steps]);

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), 1000 / speed);
    return () => clearTimeout(timer);
  }, [playing, index, atEnd, speed]);

  // Стрілки й кнопки пульта-презентера (PageDown/PageUp) — крок уперед і назад.
  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        setPlaying(false);
        setIndex((i) => Math.min(i + 1, steps.length - 1));
        event.preventDefault();
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        setPlaying(false);
        setIndex((i) => Math.max(i - 1, 0));
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps, hotkeys]);

  const applyText = () => {
    if (parsed.ok) setValues(parsed.values);
  };

  const applyPreset = (preset: Preset) => {
    const next = makePreset(preset, 8);
    setText(next.join(', '));
    setValues(next);
  };

  const numeric = step.array.filter((x): x is number => x !== null);
  if (step.key) numeric.push(step.key.value);
  const max = Math.max(1, ...numeric.map((x) => Math.abs(x)));
  const height = (x: number) => `${Math.max(4, (Math.abs(x) / max) * 100)}%`;
  const codeLines = info.code.split('\n');

  return (
    <div class="sorting">
      <div class="sorting__setup">
        <fieldset class="segmented">
          <legend class="visually-hidden">Метод сортування</legend>
          {(Object.keys(ALGORITHMS) as SortAlgorithm[]).map((id) => (
            <label key={id}>
              <input
                type="radio"
                name="sort-algorithm"
                checked={algorithm === id}
                onChange={() => setAlgorithm(id)}
              />
              <span>{ALGORITHMS[id].title}</span>
            </label>
          ))}
        </fieldset>

        <form
          class="sorting__input"
          onSubmit={(event) => {
            event.preventDefault();
            applyText();
          }}
        >
          <label class="field" for="sort-array">
            <span class="field__label">Масив</span>
            <input
              id="sort-array"
              class="input input--mono"
              value={text}
              aria-invalid={!parsed.ok}
              onInput={(event) => setText(event.currentTarget.value)}
            />
          </label>
          <button type="submit" class="button button--secondary" disabled={!parsed.ok}>
            Застосувати
          </button>
        </form>
        <div class="sorting__presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              class="button button--secondary"
              onClick={() => applyPreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {!parsed.ok && <p class="message message--error">{parsed.error}</p>}
      </div>

      <section class="sorting__stage" aria-label="Масив">
        <div class="sorting__keyrow" aria-hidden="true">
          {step.array.map((_, i) => (
            <div key={i} class="sorting__keyslot">
              {step.key && step.key.at === i && (
                <div class="sorting__key">
                  <div class="sorting__bar is-key" style={{ height: height(step.key.value) }} />
                  <span class="sorting__value">{step.key.value}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <ol class="sorting__bars">
          {step.array.map((value, i) => (
            <li key={i} class={`sorting__cell ${barState(step, i)}`}>
              <div class="sorting__column">
                {value === null ? (
                  <div class="sorting__bar is-hole" />
                ) : (
                  <div class="sorting__bar" style={{ height: height(value) }} />
                )}
              </div>
              <span class="sorting__value">{value ?? '—'}</span>
              <span class="sorting__index">{i}</span>
            </li>
          ))}
        </ol>
        <p class="sorting__text" aria-live="polite">
          {step.text}
        </p>
      </section>

      <div class="sorting__controls">
        <div class="sorting__buttons">
          <button
            type="button"
            class="button button--secondary"
            disabled={index === 0}
            onClick={() => {
              setPlaying(false);
              setIndex(index - 1);
            }}
          >
            ← Назад
          </button>
          <button
            type="button"
            class="button button--secondary"
            disabled={atEnd}
            onClick={() => {
              setPlaying(false);
              setIndex(index + 1);
            }}
          >
            Крок →
          </button>
          <button
            type="button"
            class="button button--primary"
            disabled={atEnd && !playing}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? 'Пауза' : 'Пуск'}
          </button>
          <button
            type="button"
            class="button button--secondary"
            disabled={index === 0}
            onClick={() => {
              setPlaying(false);
              setIndex(0);
            }}
          >
            Скинути
          </button>
        </div>
        <label class="sorting__speed">
          <span class="field__label">Швидкість: {speed} крок/с</span>
          <input
            type="range"
            min={0}
            max={SPEEDS.length - 1}
            value={SPEEDS.indexOf(speed as (typeof SPEEDS)[number])}
            onInput={(event) => setSpeed(SPEEDS[Number(event.currentTarget.value)] ?? 1)}
          />
        </label>
        <dl class="sorting__counters">
          <div>
            <dt>Крок</dt>
            <dd>
              {index} з {steps.length - 1}
            </dd>
          </div>
          <div>
            <dt>Порівнянь</dt>
            <dd>{step.comparisons}</dd>
          </div>
          <div>
            <dt>{info.moves}</dt>
            <dd>{step.moves}</dd>
          </div>
        </dl>
      </div>

      <div class="sorting__bottom">
        <section class="panel" aria-labelledby="sort-code-title">
          <h3 id="sort-code-title" class="panel__title">
            Код (лекція 11)
          </h3>
          <pre class="sorting__code">
            {codeLines.map((line, i) => (
              <span key={i} class={`sorting__line${step.line === i + 1 ? ' is-current' : ''}`}>
                <span class="sorting__lineno">{i + 1}</span>
                {line}
                {'\n'}
              </span>
            ))}
          </pre>
        </section>
        <section class="panel" aria-labelledby="sort-legend-title">
          <h3 id="sort-legend-title" class="panel__title">
            Позначення
          </h3>
          <ul class="sorting__legend">
            <li>
              <span class="sorting__swatch is-active" /> порівнюються
            </li>
            <li>
              <span class="sorting__swatch is-swap" />{' '}
              {algorithm === 'insertion' ? 'зсув' : 'обмін'}
            </li>
            {algorithm === 'selection' && (
              <li>
                <span class="sorting__swatch is-min" /> поточний мінімум
              </li>
            )}
            {algorithm === 'insertion' && (
              <li>
                <span class="sorting__swatch is-key" /> ключ, який вставляємо
              </li>
            )}
            <li>
              <span class="sorting__swatch is-sorted" /> уже на своєму місці
            </li>
          </ul>
          {hotkeys && (
            <p class="panel__hint">
              Клавіші: → або PageDown — крок уперед, ← або PageUp — назад. Пульт для презентацій теж
              працює.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
