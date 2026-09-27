import { useState } from 'preact/hooks';
import { IconPause, IconPlay, IconReset, IconStep } from './icons';
import {
  formatNumber,
  MAX_LIMIT,
  SPEEDS,
  speedAt,
  speedLabel,
  speedText,
  type StatusKind,
} from './support';

interface Props {
  idPrefix: string;
  canStep: boolean;
  canPlay: boolean;
  canPause: boolean;
  canReset: boolean;
  onStep: () => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  speedIndex: number;
  onSpeedIndex: (index: number) => void;
  limit: number;
  onLimit: (limit: number) => void;
  steps: number;
  status: { kind: StatusKind; text: string };
}

/** Кнопки Крок / Пуск / Пауза / Скинути, швидкість, ліміт кроків, лічильник і статус-бар. */
export function RunControls(props: Props) {
  const { idPrefix, speedIndex, limit, status } = props;
  const speed = speedAt(speedIndex);
  const [limitText, setLimitText] = useState(String(limit));

  const commitLimit = (text: string) => {
    const value = Number(text);
    if (Number.isInteger(value) && value >= 1 && value <= MAX_LIMIT) {
      props.onLimit(value);
      setLimitText(String(value));
    } else {
      setLimitText(String(limit));
    }
  };

  return (
    <section class="run-panel" aria-label="Керування виконанням">
      <div class="run-controls">
        <div class="run-controls__buttons">
          <button
            type="button"
            class="button button--secondary"
            onClick={props.onStep}
            disabled={!props.canStep}
          >
            <IconStep />
            Крок
          </button>
          <button
            type="button"
            class="button button--primary"
            onClick={props.onPlay}
            disabled={!props.canPlay}
          >
            <IconPlay />
            Пуск
          </button>
          <button
            type="button"
            class="button button--secondary"
            onClick={props.onPause}
            disabled={!props.canPause}
          >
            <IconPause />
            Пауза
          </button>
          <button
            type="button"
            class="button button--secondary"
            onClick={props.onReset}
            disabled={!props.canReset}
          >
            <IconReset />
            Скинути
          </button>
        </div>

        <div class="run-controls__settings">
          <label class="field field--inline" for={`${idPrefix}-speed`}>
            <span class="field__label">Швидкість</span>
            <input
              id={`${idPrefix}-speed`}
              type="range"
              min={0}
              max={SPEEDS.length - 1}
              step={1}
              value={speedIndex}
              aria-valuetext={speedText(speed)}
              onInput={(event) => props.onSpeedIndex(Number(event.currentTarget.value))}
            />
            <output class="field__value" for={`${idPrefix}-speed`}>
              {speedLabel(speed)}
            </output>
          </label>

          <label class="field field--inline" for={`${idPrefix}-limit`}>
            <span class="field__label">Ліміт кроків</span>
            <input
              id={`${idPrefix}-limit`}
              class="input input--number"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_LIMIT}
              value={limitText}
              onInput={(event) => setLimitText(event.currentTarget.value)}
              onChange={(event) => commitLimit(event.currentTarget.value)}
              onBlur={(event) => commitLimit(event.currentTarget.value)}
            />
          </label>

          <p class="run-controls__steps">
            Кроків: <strong>{formatNumber(props.steps)}</strong>
          </p>
        </div>
      </div>

      <p class={`status status--${status.kind}`} role="status">
        {status.text}
      </p>
    </section>
  );
}
