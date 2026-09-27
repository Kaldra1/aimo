/**
 * Стрічка машини Тюрінга: нескінченна в обидва боки, зберігаються лише непорожні комірки.
 * Вхідні дані — у тій самій нотації, що й для машини Поста: `19[9]`, `1^5`, `[λ]01`.
 */
import { parseCells } from '../notation';
import { BLANK, normalizeSymbol } from './alphabet';

export interface TuringTape {
  /** Непорожні комірки: номер → символ. */
  readonly cells: ReadonlyMap<number, string>;
  readonly head: number;
}

export type TuringTapeResult = { ok: true; value: TuringTape } | { ok: false; error: string };

export const MAX_TAPE_CELLS = 10_000;

export function readCell(tape: TuringTape, index: number): string {
  return tape.cells.get(index) ?? BLANK;
}

/** Розбирає вхідну стрічку; символи мають належати алфавіту (λ або `_` — порожня комірка). */
export function parseTape(text: string, alphabet: readonly string[]): TuringTapeResult {
  const parsed = parseCells(text, {
    isSymbol: (symbol) => symbol === BLANK || symbol === '_' || alphabet.includes(symbol),
    unknown: (symbol, position) => `Символу «${symbol}» немає в алфавіті (позиція ${position}).`,
    expected: 'символ алфавіту або λ',
    maxCells: MAX_TAPE_CELLS,
  });
  if (!parsed.ok) return parsed;
  const cells = new Map<number, string>();
  parsed.cells.forEach((raw, index) => {
    const symbol = normalizeSymbol(raw);
    if (symbol !== BLANK) cells.set(index, symbol);
  });
  return { ok: true, value: { cells, head: parsed.head } };
}

/** Межі запису: від крайнього непорожнього символу (або каретки) до крайнього праворуч. */
function bounds(tape: TuringTape): [number, number] {
  let low = tape.head;
  let high = tape.head;
  for (const index of tape.cells.keys()) {
    if (index < low) low = index;
    if (index > high) high = index;
  }
  return [low, high];
}

/** Вхідна стрічка в нотації з позначкою каретки: `19[9]`, `λλ[1]`. */
export function formatTape(tape: TuringTape): string {
  const [low, high] = bounds(tape);
  let text = '';
  for (let i = low; i <= high; i++) {
    const symbol = readCell(tape, i);
    text += i === tape.head ? `[${symbol}]` : symbol;
  }
  return text;
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

export function subscript(value: number): string {
  return [...String(value)].map((digit) => SUBSCRIPTS[Number(digit)]).join('');
}

/**
 * Конфігурація `α qᵢ β`: слово ліворуч від каретки, стан, слово від каретки праворуч.
 * Приклад: `12q₀9`. Після зупинки замість стану — `!`.
 */
export function formatConfiguration(tape: TuringTape, state: number | null): string {
  const [low, high] = bounds(tape);
  let left = '';
  let right = '';
  for (let i = low; i <= high; i++) {
    if (i < tape.head) left += readCell(tape, i);
    else right += readCell(tape, i);
  }
  return `${left}${state === null ? '!' : `q${subscript(state)}`}${right}`;
}
