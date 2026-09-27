/**
 * Посилання всередині сайту. Сайт живе в підкаталозі GitHub Pages (`/aimo/`),
 * тому шляхи від кореня (`/labs/1/`) треба доповнювати базовим шляхом.
 */

/** Нормалізує базовий шлях до вигляду `/aimo` (без скісної риски в кінці) або `''`. */
export function normalizeBase(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, '');
  if (trimmed === '') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Додає базовий шлях до посилання від кореня сайту. Зовнішні адреси, якорі,
 * відносні шляхи й уже доповнені посилання повертає без змін.
 */
export function withBase(href: string, base: string): string {
  const prefix = normalizeBase(base);
  if (prefix === '' || !href.startsWith('/') || href.startsWith('//')) return href;
  if (href === prefix || href.startsWith(`${prefix}/`) || href.startsWith(`${prefix}#`)) {
    return href;
  }
  return `${prefix}${href}`;
}

/** Шлях сторінки сайту з урахуванням base: `url('/labs/1/')` → `/aimo/labs/1/`. */
export function url(path: string): string {
  return withBase(path.startsWith('/') ? path : `/${path}`, import.meta.env.BASE_URL);
}
