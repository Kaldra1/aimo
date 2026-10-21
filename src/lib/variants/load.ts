/** Дані варіантів зі src/data/variants: таблиці завдань і тести для автоперевірки (лише під час збирання). */
import { parseVariants, parseVariantTests, type VariantsData } from './variants';

const variantFiles = import.meta.glob<string>('../../data/variants/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const name = (path: string) =>
  path
    .split('/')
    .pop()!
    .replace(/\.yaml$/, '');

export function loadVariants(id: string): VariantsData {
  const source = variantFiles[`../../data/variants/${id}.yaml`];
  if (source === undefined) {
    throw new Error(`Варіанти «${id}»: файл src/data/variants/${id}.yaml не знайдено`);
  }
  return parseVariants(source);
}

/** Тести для автоперевірки або null, якщо для заняття їх немає (наприклад, завдання на C++). */
export function loadVariantTests(id: string): Record<string, string[]> | null {
  const source = variantFiles[`../../data/variants/${id}.tests.yaml`];
  return source === undefined ? null : parseVariantTests(source);
}

/** Заняття, для яких є і варіанти, і тести. */
export function checkableSessions(): string[] {
  return Object.keys(variantFiles)
    .map(name)
    .filter((id) => !id.endsWith('.tests') && variantFiles[`../../data/variants/${id}.tests.yaml`]);
}
