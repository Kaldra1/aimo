/**
 * Стрічка машини Поста та її текстова нотація.
 *
 * Нотація: `1` — комірка з міткою, `0` — порожня; `1^3` або `1³` — три однакові комірки поспіль;
 * `[1]` чи `[0]` — каретка навпроти цієї комірки (`[1]^3` — на першій з трьох). Якщо позначки
 * немає, каретка стоїть на першому символі запису. Приклад: `1^2 0 [1] 1` = 11011.
 */
import { parseCells } from '../notation';

export interface PostTape {
  /** Номери комірок із мітками. Стрічка нескінченна в обидва боки. */
  readonly marks: ReadonlySet<number>;
  /** Номер комірки навпроти каретки. Перший символ запису — комірка 0. */
  readonly head: number;
}

export type TapeParseResult = { ok: true; value: PostTape } | { ok: false; error: string };

/** Найбільша довжина стрічки в нотації — захист від записів на кшталт `1^999999999`. */
export const MAX_TAPE_CELLS = 10_000;

export function parseTape(text: string): TapeParseResult {
  const parsed = parseCells(text, {
    isSymbol: (symbol) => symbol === '0' || symbol === '1',
    unknown: (symbol, position) =>
      `Незрозумілий символ «${symbol}» (позиція ${position}): використовуйте 0, 1, ^ і [ ].`,
    expected: '0 або 1',
    maxCells: MAX_TAPE_CELLS,
  });
  if (!parsed.ok) return parsed;
  const marks = new Set<number>();
  parsed.cells.forEach((symbol, index) => {
    if (symbol === '1') marks.add(index);
  });
  return { ok: true, value: { marks, head: parsed.head } };
}

interface Segment {
  from: number;
  to: number;
  marked: boolean;
}

/**
 * Записує стрічку в нотації: від крайньої лівої до крайньої правої мітки (разом із кареткою),
 * каретку завжди позначено дужками. Приклад: `[0] 0^2 1`.
 */
export function formatTape(tape: PostTape): string {
  const sorted = [...tape.marks].sort((a, b) => a - b);
  const low = Math.min(tape.head, sorted[0] ?? tape.head);
  const high = Math.max(tape.head, sorted[sorted.length - 1] ?? tape.head);

  // Відрізки однакових комірок; для розрідженої стрічки це O(k log k), а не O(довжини).
  const segments: Segment[] = [];
  let cursor = low;
  for (let k = 0; k < sorted.length;) {
    const start = sorted[k]!;
    let end = start;
    while (k + 1 < sorted.length && sorted[k + 1] === end + 1) {
      k++;
      end = sorted[k]!;
    }
    k++;
    if (start > cursor) segments.push({ from: cursor, to: start - 1, marked: false });
    segments.push({ from: start, to: end, marked: true });
    cursor = end + 1;
  }
  if (cursor <= high) segments.push({ from: cursor, to: high, marked: false });

  const tokens: string[] = [];
  const run = (length: number, marked: boolean) => {
    if (length <= 0) return;
    const symbol = marked ? '1' : '0';
    tokens.push(length === 1 ? symbol : `${symbol}^${length}`);
  };
  for (const segment of segments) {
    if (tape.head < segment.from || tape.head > segment.to) {
      run(segment.to - segment.from + 1, segment.marked);
      continue;
    }
    run(tape.head - segment.from, segment.marked);
    tokens.push(segment.marked ? '[1]' : '[0]');
    run(segment.to - tape.head, segment.marked);
  }
  return tokens.join(' ');
}
