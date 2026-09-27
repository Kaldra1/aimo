/**
 * Програма машини Поста: один рядок — одна команда.
 *
 *   1. → 2      крок праворуч, перехід до команди 2
 *   2. ? 1, 3   якщо комірка порожня — до 1, якщо з міткою — до 3
 *   3. X 4      стерти мітку
 *   4. ← 5      крок ліворуч
 *   5. !        зупинка
 *
 * Аліаси: `->` і `>` замість «→», `<-` і `<` замість «←», `v` і `x` замість V і X.
 * Пробіли довільні, коментар — після `//` або `;`.
 */
import type { ParseMessage, ParseResult } from '../types';

export type PostOp = 'right' | 'left' | 'mark' | 'erase' | 'check' | 'halt';

interface CommandBase {
  /** Номер команди, заданий користувачем. */
  readonly number: number;
  /** Рядок програми (від 1). */
  readonly line: number;
  readonly comment?: string;
}

export type PostCommand =
  | (CommandBase & { readonly op: 'right' | 'left' | 'mark' | 'erase'; readonly next: number })
  | (CommandBase & { readonly op: 'check'; readonly ifEmpty: number; readonly ifMarked: number })
  | (CommandBase & { readonly op: 'halt' });

export interface PostProgram {
  /** Команди в порядку рядків програми. */
  readonly commands: readonly PostCommand[];
  readonly byNumber: ReadonlyMap<number, PostCommand>;
  /** Виконання починається з команди з найменшим номером. */
  readonly start: number;
}

export const OP_SYMBOLS: Record<PostOp, string> = {
  right: '→',
  left: '←',
  mark: 'V',
  erase: 'X',
  check: '?',
  halt: '!',
};

const MAX_NUMBER = 999_999;

type Token =
  | { kind: 'number'; value: number; text: string }
  | { kind: 'dot' | 'comma'; text: string }
  | { kind: 'op'; op: PostOp; text: string }
  | { kind: 'unknown'; text: string };

/** Відокремлює коментар (`//` або `;`) від коду рядка. */
export function splitComment(line: string): { code: string; comment: string | null } {
  const slash = line.indexOf('//');
  const semicolon = line.indexOf(';');
  const positions = [slash, semicolon].filter((p) => p >= 0);
  if (positions.length === 0) return { code: line, comment: null };
  const at = Math.min(...positions);
  const markerLength = at === slash ? 2 : 1;
  return { code: line.slice(0, at), comment: line.slice(at + markerLength).trim() };
}

const LETTER_OPS = new Map<string, PostOp>([
  ['V', 'mark'],
  ['v', 'mark'],
  ['X', 'erase'],
  ['x', 'erase'],
  // Кирилична «Х» виглядає так само, як латинська X, тож приймаємо і її.
  ['Х', 'erase'],
  ['х', 'erase'],
]);

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i]!;
    const next = code[i + 1];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9]/.test(ch)) {
      let end = i;
      while (end < code.length && /[0-9]/.test(code[end]!)) end++;
      const text = code.slice(i, end);
      tokens.push({ kind: 'number', value: Number(text), text });
      i = end;
    } else if (ch === '.') {
      tokens.push({ kind: 'dot', text: ch });
      i++;
    } else if (ch === ',') {
      tokens.push({ kind: 'comma', text: ch });
      i++;
    } else if (ch === '-' && next === '>') {
      tokens.push({ kind: 'op', op: 'right', text: '->' });
      i += 2;
    } else if (ch === '<' && next === '-') {
      tokens.push({ kind: 'op', op: 'left', text: '<-' });
      i += 2;
    } else if (ch === '→' || ch === '>') {
      tokens.push({ kind: 'op', op: 'right', text: ch });
      i++;
    } else if (ch === '←' || ch === '<') {
      tokens.push({ kind: 'op', op: 'left', text: ch });
      i++;
    } else if (ch === '?') {
      tokens.push({ kind: 'op', op: 'check', text: ch });
      i++;
    } else if (ch === '!') {
      tokens.push({ kind: 'op', op: 'halt', text: ch });
      i++;
    } else if (/\p{L}/u.test(ch)) {
      let end = i;
      while (end < code.length && /\p{L}/u.test(code[end]!)) end++;
      const word = code.slice(i, end);
      const op = LETTER_OPS.get(word);
      tokens.push(op ? { kind: 'op', op, text: word } : { kind: 'unknown', text: word });
      i = end;
    } else {
      tokens.push({ kind: 'unknown', text: ch });
      i++;
    }
  }
  return tokens;
}

type LineResult =
  | { kind: 'empty' }
  | { kind: 'command'; command: PostCommand }
  | { kind: 'error'; message: string };

function parseLine(text: string, line: number): LineResult {
  const { code, comment } = splitComment(text);
  const tokens = tokenize(code);
  if (tokens.length === 0) return { kind: 'empty' };

  const withComment = comment ? { comment } : {};
  const error = (message: string): LineResult => ({ kind: 'error', message });
  const rest = (from: number) =>
    tokens
      .slice(from)
      .map((t) => t.text)
      .join(' ');

  const [numberToken, dotToken, opToken] = tokens;
  if (numberToken?.kind !== 'number') {
    return error('Рядок має починатися з номера команди, наприклад «1. → 2».');
  }
  const number = numberToken.value;
  if (number > MAX_NUMBER) return error(`Завеликий номер команди: до ${MAX_NUMBER}.`);
  if (dotToken?.kind !== 'dot') return error(`Після номера потрібна крапка: «${number}. …».`);
  if (!opToken) return error(`Після «${number}.» не вказано команду.`);
  if (opToken.kind !== 'op') {
    return error(`Невідома команда «${opToken.text}». Допустимі: →, ←, V, X, ?, !.`);
  }

  const target = (token: Token | undefined): number | null =>
    token?.kind === 'number' && token.value <= MAX_NUMBER ? token.value : null;

  switch (opToken.op) {
    case 'halt': {
      if (tokens.length > 3) return error(`Після «!» нічого не пишуть, а тут «${rest(3)}».`);
      return { kind: 'command', command: { number, line, op: 'halt', ...withComment } };
    }
    case 'check': {
      const ifEmpty = target(tokens[3]);
      const hasComma = tokens[4]?.kind === 'comma';
      const ifMarked = target(tokens[hasComma ? 5 : 4]);
      const used = hasComma ? 6 : 5;
      if (ifEmpty === null || ifMarked === null) {
        return error(
          'Для «?» потрібні два номери: «? a, b» — куди перейти, якщо комірка порожня, і куди, якщо в ній мітка.',
        );
      }
      if (tokens.length > used) return error(`Зайві символи після команди: «${rest(used)}».`);
      return {
        kind: 'command',
        command: { number, line, op: 'check', ifEmpty, ifMarked, ...withComment },
      };
    }
    default: {
      const next = target(tokens[3]);
      if (next === null) {
        return error(`Після «${OP_SYMBOLS[opToken.op]}» потрібен номер наступної команди.`);
      }
      if (tokens.length > 4) return error(`Зайві символи після команди: «${rest(4)}».`);
      return {
        kind: 'command',
        command: { number, line, op: opToken.op, next, ...withComment },
      };
    }
  }
}

/** Номери команд, до яких переходить команда. */
export function targetsOf(command: PostCommand): number[] {
  switch (command.op) {
    case 'halt':
      return [];
    case 'check':
      return [command.ifEmpty, command.ifMarked];
    default:
      return [command.next];
  }
}

export function parse(source: string): ParseResult<PostProgram> {
  const errors: ParseMessage[] = [];
  const warnings: ParseMessage[] = [];
  const commands: PostCommand[] = [];
  const byNumber = new Map<number, PostCommand>();

  source.split(/\r?\n/).forEach((text, index) => {
    const line = index + 1;
    const result = parseLine(text, line);
    if (result.kind === 'error') {
      errors.push({ line, message: result.message });
    } else if (result.kind === 'command') {
      const existing = byNumber.get(result.command.number);
      if (existing) {
        errors.push({
          line,
          message: `Команда ${result.command.number} вже є в рядку ${existing.line}.`,
        });
      } else {
        byNumber.set(result.command.number, result.command);
        commands.push(result.command);
      }
    }
  });

  if (commands.length === 0 && errors.length === 0) {
    errors.push({
      line: 0,
      message: 'Програма порожня: додайте хоча б одну команду, наприклад «1. !».',
    });
  }

  for (const command of commands) {
    for (const target of new Set(targetsOf(command))) {
      if (!byNumber.has(target)) {
        warnings.push({
          line: command.line,
          message: `Команди ${target} немає в програмі: якщо машина дійде до цього переходу, буде аварійна зупинка.`,
        });
      }
    }
  }
  if (commands.length > 0 && !commands.some((c) => c.op === 'halt')) {
    warnings.push({
      line: 0,
      message: 'У програмі немає команди «!»: машина не зможе зупинитися штатно.',
    });
  }

  if (errors.length > 0) return { ok: false, errors, warnings };
  const start = Math.min(...commands.map((c) => c.number));
  return { ok: true, value: { commands, byNumber, start }, warnings };
}

/** Команда в канонічному записі: `2. ? 1, 3`. */
export function formatCommand(command: PostCommand): string {
  const head = `${command.number}. ${OP_SYMBOLS[command.op]}`;
  switch (command.op) {
    case 'halt':
      return head;
    case 'check':
      return `${head} ${command.ifEmpty}, ${command.ifMarked}`;
    default:
      return `${head} ${command.next}`;
  }
}

function withCommentText(text: string, comment: string | undefined): string {
  return comment ? `${text} // ${comment}` : text;
}

/**
 * Нумерує команди 1, 2, 3… у порядку рядків і оновлює переходи. Порожні рядки й коментарі
 * лишаються на місці. Переходи до неіснуючих команд не змінюються. null — якщо в програмі помилки.
 */
export function renumber(source: string): string | null {
  const parsed = parse(source);
  if (!parsed.ok) return null;
  const mapping = new Map(parsed.value.commands.map((c, index) => [c.number, index + 1]));
  const map = (n: number) => mapping.get(n) ?? n;
  const lines = source.split(/\r?\n/);
  for (const command of parsed.value.commands) {
    const renamed: PostCommand =
      command.op === 'halt'
        ? { ...command, number: map(command.number) }
        : command.op === 'check'
          ? {
              ...command,
              number: map(command.number),
              ifEmpty: map(command.ifEmpty),
              ifMarked: map(command.ifMarked),
            }
          : { ...command, number: map(command.number), next: map(command.next) };
    lines[command.line - 1] = withCommentText(formatCommand(renamed), command.comment);
  }
  return lines.join('\n');
}

/** Рядок табличного режиму: Номер | Команда | Перехід | Коментар. */
export interface PostRow {
  number: string;
  /** Символ команди або '' для рядка лише з коментарем. */
  op: string;
  target: string;
  comment: string;
}

export const ROW_OPS = ['→', '←', 'V', 'X', '?', '!'] as const;

/** Рядки таблиці з тексту програми. null — якщо в програмі є помилки. */
export function rowsFromSource(source: string): PostRow[] | null {
  const parsed = parse(source);
  if (!parsed.ok) return null;
  const byLine = new Map(parsed.value.commands.map((c) => [c.line, c]));
  const rows: PostRow[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    const command = byLine.get(index + 1);
    if (command) {
      const target =
        command.op === 'halt'
          ? ''
          : command.op === 'check'
            ? `${command.ifEmpty}, ${command.ifMarked}`
            : String(command.next);
      rows.push({
        number: String(command.number),
        op: OP_SYMBOLS[command.op],
        target,
        comment: command.comment ?? '',
      });
      return;
    }
    const { comment } = splitComment(text);
    if (comment) rows.push({ number: '', op: '', target: '', comment });
  });
  return rows;
}

/** Текст програми з рядків таблиці: кожен рядок таблиці — рядок програми. */
export function sourceFromRows(rows: readonly PostRow[]): string {
  return rows
    .map((row) => {
      const number = row.number.trim();
      const target = row.target.trim();
      const comment = row.comment.trim();
      if (!number && !row.op && !target) return comment ? `// ${comment}` : '';
      const code = [`${number}.`, row.op, target].filter(Boolean).join(' ');
      return withCommentText(code, comment);
    })
    .join('\n');
}
