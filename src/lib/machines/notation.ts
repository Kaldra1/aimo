/**
 * Спільна нотація вхідної стрічки для машин Поста й Тюрінга: символи підряд, `x^3` або `x³` —
 * три однакові символи поспіль, `[x]` — каретка навпроти цієї комірки (`[x]^3` — на першій
 * з трьох). Пробіли ігноруються. Без позначки каретка стоїть на першому символі запису.
 */

export interface CellsParseOptions {
  /** Чи може символ стояти на стрічці. */
  isSymbol: (symbol: string) => boolean;
  /** Повідомлення про недопустимий символ; position — номер символу в записі (від 1). */
  unknown: (symbol: string, position: number) => string;
  /** Що очікується після «[», наприклад «0 або 1». */
  expected: string;
  maxCells: number;
}

export type CellsParseResult =
  { ok: true; cells: string[]; head: number } | { ok: false; error: string };

const SUPERSCRIPT_DIGITS = new Map(
  [...'⁰¹²³⁴⁵⁶⁷⁸⁹'].map((digit, value) => [digit, String(value)] as const),
);

export function parseCells(text: string, options: CellsParseOptions): CellsParseResult {
  const chars = [...text];
  const cells: string[] = [];
  let head: number | null = null;
  let i = 0;

  const fail = (error: string): CellsParseResult => ({ ok: false, error });
  const skipSpaces = () => {
    while (i < chars.length && /\s/u.test(chars[i]!)) i++;
  };
  const describe = (index: number) =>
    index < chars.length ? `«${chars[index]}» (позиція ${index + 1})` : 'кінець запису';

  while (true) {
    skipSpaces();
    if (i >= chars.length) break;

    let bracketed = false;
    if (chars[i] === '[') {
      bracketed = true;
      i++;
      skipSpaces();
    }
    const symbol = chars[i];
    if (symbol === undefined || !options.isSymbol(symbol)) {
      if (bracketed) {
        return fail(`Після «[» очікується ${options.expected}, а знайдено ${describe(i)}.`);
      }
      return fail(options.unknown(symbol ?? '', i + 1));
    }
    i++;
    if (bracketed) {
      skipSpaces();
      if (chars[i] !== ']') return fail(`Очікується «]», а знайдено ${describe(i)}.`);
      i++;
    }

    let count = 1;
    const beforeExponent = i;
    skipSpaces();
    if (chars[i] === '^') {
      i++;
      skipSpaces();
      const start = i;
      while (i < chars.length && /[0-9]/.test(chars[i]!)) i++;
      if (start === i) {
        return fail(`Після «^» потрібне число повторень, а знайдено ${describe(i)}.`);
      }
      count = Number(chars.slice(start, i).join(''));
    } else if (SUPERSCRIPT_DIGITS.has(chars[i] ?? '')) {
      let digits = '';
      while (i < chars.length && SUPERSCRIPT_DIGITS.has(chars[i]!)) {
        digits += SUPERSCRIPT_DIGITS.get(chars[i]!);
        i++;
      }
      count = Number(digits);
    } else {
      i = beforeExponent;
    }

    if (count < 1) return fail('Кількість повторень має бути щонайменше 1.');
    if (cells.length + count > options.maxCells) {
      return fail(`Задовгий запис: стрічка в нотації — до ${options.maxCells} комірок.`);
    }
    if (bracketed) {
      if (head !== null) return fail('Каретку можна позначити лише один раз.');
      head = cells.length;
    }
    for (let k = 0; k < count; k++) cells.push(symbol);
  }

  return { ok: true, cells, head: head ?? 0 };
}
