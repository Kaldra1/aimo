/** Розв'язки в базі: розбір ідентифікатора задачі, нормалізація схем і повторна перевірка. */
import { formatRule, parse, type MarkovProgram } from '../machines/markov';
import { checkMarkov, DEFAULT_MAX_STEPS, type TaskTest } from '../tasks/check';
import { splitExample } from '../variants/ids';

export interface VariantRef {
  session: string;
  variant: number;
  stars: 1 | 2 | 3;
}

/** practical-02/v7/2 → { session: 'practical-02', variant: 7, stars: 2 } */
export function parseVariantTaskId(id: string): VariantRef | null {
  const match = /^([a-z]+-\d{2})\/v(\d{1,2})\/([1-3])$/.exec(id);
  if (!match) return null;
  return {
    session: match[1]!,
    variant: Number(match[2]),
    stars: Number(match[3]) as 1 | 2 | 3,
  };
}

/** Схема для збереження: правила в одному записі, без коментарів і зайвих пробілів. */
export const programText = (program: MarkovProgram) => program.rules.map(formatRule).join('\n');

/**
 * Ключ для пошуку однакових схем: порядок правил важливий (алгоритм Маркова від нього залежить),
 * а пробіли й вигляд стрілки — ні.
 */
export function fingerprint(text: string): string {
  const parsed = parse(text);
  const lines = parsed.ok ? programText(parsed.value) : text;
  return lines.replace(/\s+/g, '');
}

/** Тести варіанта з рядків «вхід → вихід». */
export const testsFromLines = (lines: readonly string[]): TaskTest[] =>
  lines.map((line) => {
    const { input, output } = splitExample(line);
    return { input, expected: output, checkHead: false };
  });

export type Recheck = 'ok' | 'fail' | 'unknown';

/** Повторна перевірка збереженої схеми на тестах варіанта. */
export function recheck(text: string, lines: readonly string[] | undefined): Recheck {
  if (!lines) return 'unknown';
  const parsed = parse(text);
  if (!parsed.ok) return 'fail';
  return checkMarkov(parsed.value, testsFromLines(lines), DEFAULT_MAX_STEPS).solved ? 'ok' : 'fail';
}
