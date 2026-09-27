/**
 * Українська форма множини: `plural(21, ['лекція', 'лекції', 'лекцій'])` → «21 лекція».
 * Форми: [1, 2–4, 5–20 і 0].
 */
export function plural(count: number, forms: readonly [string, string, string]): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  let form = forms[2];
  if (mod10 === 1 && mod100 !== 11) form = forms[0];
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms[1];
  return `${count} ${form}`;
}
