/** Зовнішній алфавіт машини Тюрінга. Порожній символ λ додається автоматично. */

export const BLANK = 'λ';

/** Символи, що мають особливе значення в нотації і таблиці. */
const RESERVED = new Map<string, string>([
  [BLANK, 'порожній символ λ додається автоматично'],
  ['_', '«_» означає порожній символ λ'],
  ['!', '«!» позначає стан зупинки'],
  ['[', 'дужки позначають каретку у вхідних даних'],
  [']', 'дужки позначають каретку у вхідних даних'],
  ['^', '«^» означає повторення у вхідних даних'],
]);

export type AlphabetResult = { ok: true; symbols: string[] } | { ok: false; error: string };

/**
 * Розбирає алфавіт: кожен символ рядка — окремий символ алфавіту. Пробіли й коми ігноруються,
 * повтори відкидаються.
 */
export function parseAlphabet(text: string): AlphabetResult {
  const symbols: string[] = [];
  for (const symbol of text) {
    if (/[\s,]/u.test(symbol)) continue;
    const reason = RESERVED.get(symbol);
    if (reason) {
      return { ok: false, error: `Символ «${symbol}» не можна додати до алфавіту: ${reason}.` };
    }
    if (!symbols.includes(symbol)) symbols.push(symbol);
  }
  return { ok: true, symbols };
}

/** `_` у введенні означає порожній символ. */
export function normalizeSymbol(symbol: string): string {
  return symbol === '_' ? BLANK : symbol;
}
