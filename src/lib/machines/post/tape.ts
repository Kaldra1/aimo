/**
 * Стрічка машини Поста та її текстова нотація.
 *
 * Нотація: `1` — комірка з міткою, `0` — порожня; `1^3` або `1³` — три однакові комірки поспіль;
 * `[1]` чи `[0]` — каретка навпроти цієї комірки (`[1]^3` — на першій з трьох). Якщо позначки
 * немає, каретка стоїть на першому символі запису. Приклад: `1^2 0 [1] 1` = 11011.
 */

export interface PostTape {
  /** Номери комірок із мітками. Стрічка нескінченна в обидва боки. */
  readonly marks: ReadonlySet<number>;
  /** Номер комірки навпроти каретки. Перший символ запису — комірка 0. */
  readonly head: number;
}

export type TapeParseResult = { ok: true; value: PostTape } | { ok: false; error: string };

/** Найбільша довжина стрічки в нотації — захист від записів на кшталт `1^999999999`. */
export const MAX_TAPE_CELLS = 10_000;

const SUPERSCRIPT_DIGITS = new Map(
  [...'⁰¹²³⁴⁵⁶⁷⁸⁹'].map((digit, value) => [digit, String(value)] as const),
);

export function parseTape(text: string): TapeParseResult {
  const cells: boolean[] = [];
  let head: number | null = null;
  let i = 0;

  const fail = (message: string): TapeParseResult => ({ ok: false, error: message });
  const skipSpaces = () => {
    while (i < text.length && /\s/.test(text[i]!)) i++;
  };
  const describe = (index: number) =>
    index < text.length ? `«${text[index]}» (позиція ${index + 1})` : 'кінець запису';

  while (true) {
    skipSpaces();
    if (i >= text.length) break;

    let bracketed = false;
    if (text[i] === '[') {
      bracketed = true;
      i++;
      skipSpaces();
    }
    const symbol = text[i];
    if (symbol !== '0' && symbol !== '1') {
      return fail(
        bracketed
          ? `Після «[» очікується 0 або 1, а знайдено ${describe(i)}.`
          : `Незрозумілий символ ${describe(i)}: використовуйте 0, 1, ^ і [ ].`,
      );
    }
    i++;
    if (bracketed) {
      skipSpaces();
      if (text[i] !== ']') return fail(`Очікується «]», а знайдено ${describe(i)}.`);
      i++;
    }

    let count = 1;
    const beforeExponent = i;
    skipSpaces();
    if (text[i] === '^') {
      i++;
      skipSpaces();
      const start = i;
      while (i < text.length && /[0-9]/.test(text[i]!)) i++;
      if (start === i)
        return fail(`Після «^» потрібне число повторень, а знайдено ${describe(i)}.`);
      count = Number(text.slice(start, i));
    } else if (SUPERSCRIPT_DIGITS.has(text[i] ?? '')) {
      let digits = '';
      while (i < text.length && SUPERSCRIPT_DIGITS.has(text[i]!)) {
        digits += SUPERSCRIPT_DIGITS.get(text[i]!);
        i++;
      }
      count = Number(digits);
    } else {
      i = beforeExponent;
    }

    if (count < 1) return fail('Кількість повторень має бути щонайменше 1.');
    if (cells.length + count > MAX_TAPE_CELLS) {
      return fail(`Задовгий запис: стрічка в нотації — до ${MAX_TAPE_CELLS} комірок.`);
    }
    if (bracketed) {
      if (head !== null) return fail('Каретку можна позначити лише один раз.');
      head = cells.length;
    }
    for (let k = 0; k < count; k++) cells.push(symbol === '1');
  }

  const marks = new Set<number>();
  cells.forEach((marked, index) => {
    if (marked) marks.add(index);
  });
  return { ok: true, value: { marks, head: head ?? 0 } };
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
