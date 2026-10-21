/**
 * Індивідуальні варіанти занять: 3 рівні складності × 10 блоків × 3 версії.
 * Варіант N (номер у журналі) отримує з кожного рівня блок ((N − 1) mod 10) + 1, версію ⌈N / 10⌉:
 * студенти 3, 13 і 23 мають ту саму ідею, але різні умови.
 */
import { parse as parseYaml } from 'yaml';
import { z } from 'astro/zod';
import { MACHINES } from '../machines/meta';

export const BLOCKS = 10;
export const VERSIONS = 3;
export const VARIANTS = BLOCKS * VERSIONS;

const taskSchema = z.strictObject({
  /** Для машин — алфавіт; для інших занять (C++, сортування) поля немає. */
  alphabet: z.string().trim().min(1).optional(),
  task: z.string().trim().min(1),
  /** Приклади «вхід → результат»; λ — порожнє слово. */
  examples: z.array(z.string().includes(' → ')).default([]),
});

const levelSchema = z.strictObject({
  stars: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  blocks: z.array(z.array(taskSchema).length(VERSIONS)).length(BLOCKS),
});

export const variantsSchema = z.strictObject({
  machine: z.enum(MACHINES).optional(),
  levels: z.array(levelSchema).length(3),
});

export type VariantTask = z.output<typeof taskSchema>;
export type VariantsData = z.output<typeof variantsSchema>;

export function parseVariants(text: string): VariantsData {
  return variantsSchema.parse(parseYaml(text));
}

/** Блок і версія для варіанта з номером n (від 1 до 30). */
export function slotOf(n: number): { block: number; version: number } {
  return { block: (n - 1) % BLOCKS, version: Math.floor((n - 1) / BLOCKS) };
}

/** Три завдання варіанта n: ★, ★★, ★★★. */
export function tasksOf(data: VariantsData, n: number): VariantTask[] {
  const { block, version } = slotOf(n);
  return data.levels.map((level) => level.blocks[block]![version]!);
}

/** «abab → aa» → { input: 'abab', output: 'aa' }; λ — порожнє слово. */
export function splitExample(example: string): { input: string; output: string } {
  const [input = '', output = ''] = example.split(' → ');
  const word = (text: string) => (text.trim() === 'λ' ? '' : text.trim());
  return { input: word(input), output: word(output) };
}

/** Тести завдань варіантів для автоперевірки: ключ «<зірки>-<блок>-<версія>» → «вхід → результат». */
export const variantTestsSchema = z.record(
  z.string().regex(/^[1-3]-([1-9]|10)-[1-3]$/),
  z.array(z.string().includes(' → ')).min(1),
);

export function parseVariantTests(text: string): Record<string, string[]> {
  return variantTestsSchema.parse(parseYaml(text));
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
