/** Номери, ключі й адреси завдань варіантів — без zod і yaml, щоб не обтяжувати острови. */

export const BLOCKS = 10;
export const VERSIONS = 3;
export const VARIANTS = BLOCKS * VERSIONS;

/** Блок і версія для варіанта з номером n (від 1 до 30). */
export function slotOf(n: number): { block: number; version: number } {
  return { block: (n - 1) % BLOCKS, version: Math.floor((n - 1) / BLOCKS) };
}

/** «abab → aa» → { input: 'abab', output: 'aa' }; λ — порожнє слово. */
export function splitExample(example: string): { input: string; output: string } {
  const [input = '', output = ''] = example.split(' → ');
  const word = (text: string) => (text.trim() === 'λ' ? '' : text.trim());
  return { input: word(input), output: word(output) };
}

/** Ключ тестів для завдання з `stars` зірками варіанта n. */
export function testsKey(n: number, stars: number): string {
  const { block, version } = slotOf(n);
  return `${stars}-${block + 1}-${version + 1}`;
}

/** Ідентифікатор завдання варіанта для прогресу й автозбереження: practical-02/v7/2. */
export const variantTaskId = (session: string, n: number, stars: number) =>
  `${session}/v${n}/${stars}`;

/** Адреса сторінки завдання варіанта. */
export const variantTaskPath = (session: string, n: number, stars: number) =>
  `/variants/${session}/${n}/${stars}/`;
