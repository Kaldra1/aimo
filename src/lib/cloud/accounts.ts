/**
 * Логіни студентів і списки груп. Чисті функції без мережі — їх ділять сторінка входу,
 * дашборд викладача й тести.
 */

/** Технічна пошта акаунта (та сама, що в функції admin-students). */
export const LOGIN_DOMAIN = 'students.aimo.invalid';

/** Логін студента: група латиницею, дефіс, номер у журналі з двох цифр — ki2406-07. */
export const LOGIN = /^[a-z]+[0-9]+-[0-9]{2}$/;

export const loginOf = (group: string, journal: number) =>
  `${group}-${String(journal).padStart(2, '0')}`;

const CYRILLIC_TO_LATIN: Record<string, string> = { к: 'k', і: 'i', i: 'i', k: 'k' };

/**
 * Що ввів користувач → пошта для Supabase. Пошту (викладач) лишаємо як є; логін студента
 * приводимо до вигляду ki2406-07: «КІ-2406-7», «ki2406 07» теж підходять.
 */
export function loginToEmail(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (text.includes('@')) return text;
  const match = /^([a-zа-яії]+)-?\s*([0-9]+)[-\s_]+([0-9]{1,2})$/.exec(text);
  if (!match) return null;
  const letters = [...match[1]!].map((c) => CYRILLIC_TO_LATIN[c] ?? c).join('');
  if (!/^[a-z]+$/.test(letters)) return null;
  const login = loginOf(`${letters}${match[2]}`, Number(match[3]));
  return LOGIN.test(login) ? `${login}@${LOGIN_DOMAIN}` : null;
}

/** Логін студента з технічної пошти або null для інших адрес. */
export function loginFromEmail(email: string | undefined): string | null {
  if (!email?.endsWith(`@${LOGIN_DOMAIN}`)) return null;
  return email.slice(0, -LOGIN_DOMAIN.length - 1);
}

export interface RosterRow {
  journal: number;
  fullName: string;
}

export interface Roster {
  rows: RosterRow[];
  /** Рядки, які не вдалося розібрати, з номерами (від 1). */
  errors: string[];
}

/**
 * Список групи, скопійований із таблиці: «№ ⇥ ПІБ» (Google Sheets дає табуляцію),
 * також «№;ПІБ», «№,ПІБ» або «№ ПІБ». Порожні рядки й рядки без номера пропускаються.
 */
export function parseRoster(text: string): Roster {
  const rows: RosterRow[] = [];
  const errors: string[] = [];
  const seen = new Set<number>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    const match = /^(\d{1,2})[\t;,.\s]+(.+)$/.exec(line);
    if (!match) {
      // Заголовки таблиці («№», «ПІБ») просто пропускаємо.
      if (!/^\d/.test(line)) return;
      errors.push(`Рядок ${index + 1}: немає ПІБ`);
      return;
    }
    const journal = Number(match[1]);
    const fullName = match[2]!.split('\t')[0]!.replace(/\s+/g, ' ').trim();
    if (journal < 1) {
      errors.push(`Рядок ${index + 1}: номер має бути від 1`);
    } else if (seen.has(journal)) {
      errors.push(`Рядок ${index + 1}: номер ${journal} повторюється`);
    } else if (fullName === '') {
      errors.push(`Рядок ${index + 1}: немає ПІБ`);
    } else {
      seen.add(journal);
      rows.push({ journal, fullName });
    }
  });
  return { rows, errors };
}

const BOM = String.fromCharCode(0xfeff);

/** CSV для роздачі паролів (з BOM, щоб Excel прочитав кирилицю). */
export function credentialsCsv(
  rows: readonly { login: string; password: string; fullName: string }[],
): string {
  const cell = (value: string) =>
    /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = rows.map((r) => [r.fullName, r.login, r.password].map(cell).join(';'));
  return `${BOM}ПІБ;Логін;Пароль\n${lines.join('\n')}\n`;
}
