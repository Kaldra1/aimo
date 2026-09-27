/**
 * Програма машини Тюрінга — таблиця переходів: рядки — символи алфавіту (і λ), стовпці — стани
 * q0…qN. Клітинка — команда `<символ><рух><стан>`: `1Rq0`, `λLq1`, `0N!`.
 *
 * Рух: L / R / N (також `<`, `>`, `.`). Новий стан: `q2` або `2`, `!` — зупинка.
 * Скорочення: символ і стан, які не змінюються, можна не писати (`Rq1`, `1L`, `R`).
 * Текстовий формат (імпорт/експорт): `q0, 1 -> 1, R, q0`.
 */
import type { ParseMessage, ParseResult } from '../types';
import { BLANK, normalizeSymbol, parseAlphabet } from './alphabet';

export type Move = 'L' | 'R' | 'N';

export interface TuringRule {
  /** Стан і символ, для яких діє правило. */
  readonly state: number;
  readonly symbol: string;
  readonly write: string;
  readonly move: Move;
  /** Новий стан; null — зупинка «!». */
  readonly next: number | null;
}

export interface TuringProgram {
  /** Зовнішній алфавіт (без λ). */
  readonly alphabet: readonly string[];
  /** Рядки таблиці: алфавіт і λ. */
  readonly symbols: readonly string[];
  /** Кількість станів: q0 … q(states − 1). Початковий стан — q0. */
  readonly states: number;
  readonly rules: ReadonlyMap<string, TuringRule>;
}

/** Таблиця переходів у тому вигляді, в якому її редагують. */
export interface TuringTable {
  /** Алфавіт, як його ввів користувач. */
  alphabet: string;
  states: number;
  /** Вміст клітинок; ключ — cellKey(стан, символ). Порожні клітинки не зберігаються. */
  cells: Readonly<Record<string, string>>;
}

/** Повідомлення про таблицю: клітинка (стан і символ) або таблиця загалом (null). */
export interface TableMessage {
  state: number | null;
  symbol: string | null;
  message: string;
}

export type TableParseResult =
  | { ok: true; value: TuringProgram; warnings: TableMessage[] }
  | { ok: false; errors: TableMessage[]; warnings: TableMessage[] };

export const MAX_STATES = 100;

export const cellKey = (state: number, symbol: string) => `q${state} ${symbol}`;

const MOVES = new Map<string, Move>([
  ['L', 'L'],
  ['R', 'R'],
  ['N', 'N'],
  ['<', 'L'],
  ['>', 'R'],
  ['.', 'N'],
]);

export const stateName = (state: number | null) => (state === null ? '!' : `q${state}`);

/** Канонічний запис клітинки: `1Rq0`, `0N!`. */
export function formatCell(rule: Pick<TuringRule, 'write' | 'move' | 'next'>): string {
  return `${rule.write}${rule.move}${stateName(rule.next)}`;
}

/** Рядок текстового формату: `q0, 1 -> 1, R, q0`. */
export function formatRuleLine(rule: TuringRule): string {
  return `q${rule.state}, ${rule.symbol} -> ${rule.write}, ${rule.move}, ${stateName(rule.next)}`;
}

interface CellContext {
  state: number;
  symbol: string;
  isSymbol: (symbol: string) => boolean;
}

type CellResult = { ok: true; rule: TuringRule | null } | { ok: false; error: string };

function parseNext(text: string, current: number): number | null | undefined {
  if (text === '') return current;
  if (text === '!') return null;
  const match = /^[qQ]?(\d+)$/.exec(text);
  return match ? Number(match[1]) : undefined;
}

/** Розбирає клітинку таблиці з урахуванням скорочень. Порожня клітинка — правила немає. */
export function parseCell(text: string, context: CellContext): CellResult {
  const chars = [...text].filter((c) => !/\s/u.test(c));
  if (chars.length === 0) return { ok: true, rule: null };

  const first = chars[0]!;
  const second = chars[1];
  const isSymbol = (c: string) => c === BLANK || c === '_' || context.isSymbol(c);

  let write: string;
  let move: Move;
  let rest: string;
  if (second !== undefined && isSymbol(first) && MOVES.has(second)) {
    write = normalizeSymbol(first);
    move = MOVES.get(second)!;
    rest = chars.slice(2).join('');
  } else if (MOVES.has(first)) {
    write = context.symbol;
    move = MOVES.get(first)!;
    rest = chars.slice(1).join('');
  } else if (isSymbol(first)) {
    return { ok: false, error: `Після символу «${first}» потрібен рух: L, R або N.` };
  } else {
    return { ok: false, error: `Символу «${first}» немає в алфавіті.` };
  }

  const next = parseNext(rest, context.state);
  if (next === undefined) {
    return { ok: false, error: `Незрозумілий новий стан «${rest}»: пишіть q2, 2 або !.` };
  }
  return { ok: true, rule: { state: context.state, symbol: context.symbol, write, move, next } };
}

function haltWarning(rules: Iterable<TuringRule>): string | null {
  for (const rule of rules) if (rule.next === null) return null;
  return 'У програмі немає переходу в стан зупинки «!»: машина не зможе зупинитися штатно.';
}

/** Програма з таблиці переходів. Помилки прив'язані до клітинок. */
export function buildProgram(table: TuringTable): TableParseResult {
  const errors: TableMessage[] = [];
  const warnings: TableMessage[] = [];
  const alphabet = parseAlphabet(table.alphabet);
  if (!alphabet.ok) {
    return {
      ok: false,
      errors: [{ state: null, symbol: null, message: alphabet.error }],
      warnings,
    };
  }
  const states = Math.min(Math.max(1, Math.floor(table.states)), MAX_STATES);
  const symbols = [...alphabet.symbols, BLANK];
  const known = new Set(alphabet.symbols);
  const rules = new Map<string, TuringRule>();

  for (let state = 0; state < states; state++) {
    for (const symbol of symbols) {
      const text = table.cells[cellKey(state, symbol)] ?? '';
      const result = parseCell(text, { state, symbol, isSymbol: (c) => known.has(c) });
      if (!result.ok) {
        errors.push({ state, symbol, message: result.error });
      } else if (result.rule) {
        if (result.rule.next !== null && result.rule.next >= states) {
          errors.push({
            state,
            symbol,
            message: `Стану q${result.rule.next} немає в таблиці: додайте стан або виправте перехід.`,
          });
        } else {
          rules.set(cellKey(state, symbol), result.rule);
        }
      }
    }
  }

  const noHalt = haltWarning(rules.values());
  if (noHalt && rules.size > 0) warnings.push({ state: null, symbol: null, message: noHalt });
  if (errors.length > 0) return { ok: false, errors, warnings };
  return {
    ok: true,
    value: { alphabet: alphabet.symbols, symbols, states, rules },
    warnings,
  };
}

/** Таблиця з програми (після імпорту тексту): клітинки в канонічному записі. */
export function tableFromProgram(program: TuringProgram, alphabet: string): TuringTable {
  const cells: Record<string, string> = {};
  for (const [key, rule] of program.rules) cells[key] = formatCell(rule);
  return { alphabet, states: program.states, cells };
}

/** Текстовий формат програми: правила по станах, у порядку символів таблиці. */
export function formatProgram(program: TuringProgram): string {
  const lines: string[] = [];
  for (let state = 0; state < program.states; state++) {
    for (const symbol of program.symbols) {
      const rule = program.rules.get(cellKey(state, symbol));
      if (rule) lines.push(formatRuleLine(rule));
    }
  }
  return lines.join('\n');
}

const LINE = /^[qQ]?(\d+)\s*,\s*(\S)\s*(?:->|→)\s*(.*)$/u;

const withoutComment = (raw: string) => {
  const commentAt = raw.indexOf('//');
  return (commentAt >= 0 ? raw.slice(0, commentAt) : raw).trim();
};

/** Рядок текстового формату (від 1), де задане правило для стану й символу; null — немає. */
export function findRuleLine(source: string, state: number, symbol: string): number | null {
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = LINE.exec(withoutComment(lines[i]!));
    if (match && Number(match[1]) === state && normalizeSymbol(match[2]!) === symbol) return i + 1;
  }
  return null;
}

/**
 * Розбирає текстовий формат `q0, 1 -> 1, R, q0` (один рядок — одне правило, коментар після `//`).
 * Праворуч від стрілки можна писати й клітинку зі скороченнями: `q0, 1 -> Rq1`.
 * Якщо алфавіт не задано, він складається із символів, що трапляються в правилах.
 */
export function parse(
  source: string,
  options: { alphabet?: string } = {},
): ParseResult<TuringProgram> {
  const errors: ParseMessage[] = [];
  const warnings: ParseMessage[] = [];
  const lines = source.split(/\r?\n/);

  let alphabet: string[] | null = null;
  if (options.alphabet !== undefined) {
    const parsed = parseAlphabet(options.alphabet);
    if (!parsed.ok) return { ok: false, errors: [{ line: 0, message: parsed.error }], warnings };
    alphabet = parsed.symbols;
  }
  const inferred: string[] = [];
  const isSymbol = (c: string) => (alphabet ? alphabet.includes(c) : true);
  const note = (c: string) => {
    if (c !== BLANK && !inferred.includes(c)) inferred.push(c);
  };

  const rules = new Map<string, TuringRule>();
  const ruleLines = new Map<string, number>();
  let maxState = 0;

  lines.forEach((raw, index) => {
    const line = index + 1;
    const text = withoutComment(raw);
    if (text === '') return;
    const match = LINE.exec(text);
    if (!match) {
      errors.push({ line, message: 'Очікується правило у вигляді «q0, 1 -> 1, R, q0».' });
      return;
    }
    const state = Number(match[1]);
    const symbol = normalizeSymbol(match[2]!);
    const right = match[3]!.trim();
    if (symbol !== BLANK && !isSymbol(symbol)) {
      errors.push({ line, message: `Символу «${symbol}» немає в алфавіті.` });
      return;
    }
    if (state >= MAX_STATES) {
      errors.push({ line, message: `Забагато станів: до q${MAX_STATES - 1}.` });
      return;
    }

    let rule: TuringRule;
    const parts = right.split(',').map((p) => p.trim());
    if (parts.length === 3) {
      const [writeText, moveText, nextText] = parts as [string, string, string];
      const write = normalizeSymbol(writeText);
      const move = MOVES.get(moveText);
      const next = parseNext(nextText, state);
      if ([...writeText].length !== 1 || (write !== BLANK && !isSymbol(write))) {
        errors.push({ line, message: `Незрозумілий символ для запису «${writeText}».` });
        return;
      }
      if (!move) {
        errors.push({
          line,
          message: `Незрозумілий рух «${moveText}»: використовуйте L, R або N.`,
        });
        return;
      }
      if (next === undefined || nextText === '') {
        errors.push({
          line,
          message: `Незрозумілий новий стан «${nextText}»: пишіть q2, 2 або !.`,
        });
        return;
      }
      rule = { state, symbol, write, move, next };
    } else {
      const cell = parseCell(right, { state, symbol, isSymbol });
      if (!cell.ok) {
        errors.push({ line, message: cell.error });
        return;
      }
      if (!cell.rule) {
        errors.push({ line, message: 'Після «->» потрібна команда, наприклад «1, R, q0».' });
        return;
      }
      rule = cell.rule;
    }

    const key = cellKey(state, symbol);
    const existing = ruleLines.get(key);
    if (existing !== undefined) {
      errors.push({
        line,
        message: `Правило для q${state}, ${symbol} вже задане в рядку ${existing}.`,
      });
      return;
    }
    note(symbol);
    note(rule.write);
    maxState = Math.max(maxState, state, rule.next ?? 0);
    rules.set(key, rule);
    ruleLines.set(key, line);
  });

  if (maxState >= MAX_STATES) {
    errors.push({ line: 0, message: `Забагато станів: до q${MAX_STATES - 1}.` });
  }
  const noHalt = haltWarning(rules.values());
  if (noHalt && rules.size > 0) warnings.push({ line: 0, message: noHalt });
  if (errors.length > 0) return { ok: false, errors, warnings };

  const finalAlphabet = alphabet ?? inferred;
  const program: TuringProgram = {
    alphabet: finalAlphabet,
    symbols: [...finalAlphabet, BLANK],
    states: maxState + 1,
    rules,
  };
  return { ok: true, value: program, warnings };
}
