/**
 * Наскільки розв’язок схожий на вставлений готовим (наприклад, з відповіді ШІ):
 * - self — сайт стежив за редактором, вставок не було;
 * - small — дрібні вставки: скопіював свій рядок, щоб не набирати ще раз;
 * - big — за один раз вставили великий шмат програми;
 * - unknown — розв’язок збережено до того, як сайт почав стежити.
 */
import { plural } from '../plural';
import type { SolveRow } from './types';

export type PasteLevel = 'self' | 'small' | 'big' | 'unknown';

/** Вставка від стількох символів — завжди велика. */
export const BIG_PASTE = 40;
/** Менша вставка велика, якщо це щонайменше половина програми (і не коротша за це). */
export const MIN_BIG_PASTE = 20;

type PasteFields = Pick<
  SolveRow,
  'program' | 'pastes' | 'pasted_chars' | 'file_loads' | 'max_paste'
>;

/** Найбільша вставка за раз; для старих записів без неї — відома лише за однієї вставки. */
function largest(solve: PasteFields): number | null {
  if (solve.max_paste !== null && solve.max_paste !== undefined) return solve.max_paste;
  return (solve.pastes ?? 0) === 1 ? (solve.pasted_chars ?? 0) : null;
}

export function pasteLevel(solve: PasteFields): PasteLevel {
  const pastes = solve.pastes ?? 0;
  if ((solve.file_loads ?? 0) > 0) return 'big';
  if (pastes === 0) {
    // max_paste з'явився разом із повним стеженням: без нього нулі нічого не доводять.
    return solve.max_paste === null || solve.max_paste === undefined ? 'unknown' : 'self';
  }
  const max = largest(solve);
  if (max === null) return 'small';
  return max >= BIG_PASTE || (max >= MIN_BIG_PASTE && max * 2 >= solve.program.length)
    ? 'big'
    : 'small';
}

/** Опис для підказки й розгорнутого розв’язку. */
export function pasteDescription(solve: PasteFields): string {
  const level = pasteLevel(solve);
  if (level === 'unknown') return 'Збережено до того, як сайт почав стежити за вставками';
  if (level === 'self') return 'Набрано в редакторі, вставок не було';
  const parts: string[] = [];
  const pastes = solve.pastes ?? 0;
  if (pastes > 0) {
    const max = largest(solve);
    parts.push(
      `вставки: ${plural(pastes, ['раз', 'рази', 'разів'])}, ${solve.pasted_chars ?? 0} симв.` +
        (max === null ? '' : `, найбільша — ${max}`) +
        ` (у програмі ${solve.program.length})`,
    );
  }
  if ((solve.file_loads ?? 0) > 0) {
    parts.push(
      `програму завантажено з файлу: ${plural(solve.file_loads!, ['раз', 'рази', 'разів'])}`,
    );
  }
  const text = parts.join('; ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
