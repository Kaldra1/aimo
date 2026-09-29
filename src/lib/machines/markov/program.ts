/**
 * Схема нормального алгоритму Маркова: одна підстановка в рядку.
 *
 *   ab -> ba      звичайна підстановка α → β
 *   a ->. b       заключна α →· β (також «=>», «→·», «→.»)
 *   λ -> #        порожня ліва частина: β дописується на початок слова
 *   #a -> λ       порожня права частина: α стирається
 *
 * Порожнє слово — λ, ε або нічого. Пробіли не враховуються. Коментар — після «//».
 */
import type { ParseMessage, ParseResult } from '../types';

/** Позначка порожнього слова. */
export const EMPTY_WORD = 'λ';
const EMPTY_ALIASES = new Set(['λ', 'ε']);

export interface MarkovRule {
  /** Номер підстановки в схемі, від 1. */
  readonly number: number;
  /** Рядок тексту схеми, від 1. */
  readonly line: number;
  /** Ліва частина α; '' — порожнє слово. */
  readonly left: string;
  /** Права частина β; '' — порожнє слово. */
  readonly right: string;
  /** Заключна підстановка: після неї алгоритм зупиняється. */
  readonly final: boolean;
}

export interface MarkovProgram {
  readonly rules: readonly MarkovRule[];
}

/** Стрілки: довші варіанти перевіряються раніше за коротші з тим самим початком. */
const ARROWS: readonly { text: string; final: boolean }[] = [
  { text: '→·', final: true },
  { text: '→.', final: true },
  { text: '→', final: false },
  { text: '->.', final: true },
  { text: '->', final: false },
  { text: '=>', final: true },
];

interface Arrow {
  index: number;
  end: number;
  final: boolean;
}

/** Перша стрілка в рядку. «→ ·» з пробілом теж означає заключну підстановку. */
function findArrow(code: string): Arrow | null {
  for (let i = 0; i < code.length; i++) {
    const arrow = ARROWS.find((a) => code.startsWith(a.text, i));
    if (!arrow) continue;
    let end = i + arrow.text.length;
    let final = arrow.final;
    if (!final) {
      let j = end;
      while (j < code.length && /\s/u.test(code[j]!)) j++;
      if (code[j] === '·') {
        final = true;
        end = j + 1;
      }
    }
    return { index: i, end, final };
  }
  return null;
}

/** Відокремлює коментар після «//». */
function stripComment(line: string): string {
  const at = line.indexOf('//');
  return at === -1 ? line : line.slice(0, at);
}

export type WordResult = { ok: true; word: string } | { ok: false; error: string };

/** Алфавіт: кожен символ рядка — окремий символ; пробіли й коми не враховуються. */
export function parseAlphabet(
  text: string,
): { ok: true; symbols: string[] } | { ok: false; error: string } {
  const symbols: string[] = [];
  for (const symbol of text) {
    if (/[\s,]/u.test(symbol)) continue;
    if (EMPTY_ALIASES.has(symbol)) {
      return {
        ok: false,
        error: `Символ «${symbol}» не можна додати до алфавіту: він позначає порожнє слово.`,
      };
    }
    if (!symbols.includes(symbol)) symbols.push(symbol);
  }
  return { ok: true, symbols };
}

/**
 * Слово зі схеми чи з поля введення: пробіли не враховуються, λ, ε або нічого — порожнє слово.
 * Якщо задано алфавіт, кожен символ має до нього належати.
 */
export function parseWord(text: string, alphabet: readonly string[] | null = null): WordResult {
  const word = text.replace(/\s+/gu, '');
  if (EMPTY_ALIASES.has(word)) return { ok: true, word: '' };
  for (const symbol of word) {
    if (EMPTY_ALIASES.has(symbol)) {
      return {
        ok: false,
        error: `«${symbol}» позначає порожнє слово й не може стояти поруч з іншими символами.`,
      };
    }
    if (alphabet && !alphabet.includes(symbol)) {
      return { ok: false, error: `Символу «${symbol}» немає в алфавіті.` };
    }
  }
  return { ok: true, word };
}

export const formatWord = (word: string) => (word === '' ? EMPTY_WORD : word);

/** Підстановка для показу: `ab → ba`, `a →· λ`. */
export function formatRule(rule: Pick<MarkovRule, 'left' | 'right' | 'final'>): string {
  return `${formatWord(rule.left)} ${rule.final ? '→·' : '→'} ${formatWord(rule.right)}`;
}

export interface ParseOptions {
  /** Алфавіт для перевірки символів; null або порожній рядок — не перевіряти. */
  alphabet?: string | null;
}

export function parse(source: string, options: ParseOptions = {}): ParseResult<MarkovProgram> {
  const errors: ParseMessage[] = [];
  const warnings: ParseMessage[] = [];

  let symbols: string[] | null = null;
  if (options.alphabet && options.alphabet.trim() !== '') {
    const alphabet = parseAlphabet(options.alphabet);
    if (!alphabet.ok) errors.push({ line: 0, message: alphabet.error });
    else if (alphabet.symbols.length > 0) symbols = alphabet.symbols;
  }

  const rules: MarkovRule[] = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const code = stripComment(raw).trim();
    if (code === '') return;

    const arrow = findArrow(code);
    if (!arrow) {
      errors.push({
        line,
        message: 'Немає стрілки. Підстановку записують так: «ab -> ba», заключну — «a ->. b».',
      });
      return;
    }
    const rest = code.slice(arrow.end);
    if (findArrow(rest)) {
      errors.push({ line, message: 'У рядку кілька стрілок: пишіть одну підстановку в рядку.' });
      return;
    }
    const left = parseWord(code.slice(0, arrow.index), symbols);
    const right = parseWord(rest, symbols);
    if (!left.ok || !right.ok) {
      errors.push({ line, message: (!left.ok ? left : (right as { error: string })).error });
      return;
    }
    rules.push({
      number: rules.length + 1,
      line,
      left: left.word,
      right: right.word,
      final: arrow.final,
    });
  });

  if (rules.length === 0 && errors.length === 0) {
    errors.push({
      line: 0,
      message: 'Схема порожня: додайте хоча б одну підстановку, наприклад «a -> b».',
    });
  }

  // Підстановка, ліва частина якої містить ліву частину вищої, ніколи не спрацює:
  // де трапляється її α, там є й α вищої підстановки, а та перевіряється раніше.
  rules.forEach((rule, j) => {
    const blocker = rules.slice(0, j).find((earlier) => rule.left.includes(earlier.left));
    if (!blocker) return;
    warnings.push({
      line: rule.line,
      message:
        blocker.left === ''
          ? `Підстановка ${rule.number} ніколи не спрацює: вище стоїть підстановка ${blocker.number} з порожньою лівою частиною, а вона застосовна завжди.`
          : `Підстановка ${rule.number} ніколи не спрацює: її ліва частина містить «${blocker.left}» — ліву частину підстановки ${blocker.number}, яка стоїть вище.`,
    });
  });

  return errors.length > 0
    ? { ok: false, errors, warnings }
    : { ok: true, value: { rules }, warnings };
}
