/**
 * Варіанти занять: структура даних і, якщо є локальні еталони (solutions/variants, поза git),
 * перевірка кожного прикладу з умови еталонною схемою.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { checkProgram, parseProgram, testsFromLines, type TaskMachine } from '../cloud/solutions';
import { parseVariants, parseVariantTests, slotOf, tasksOf, testsKey, VARIANTS } from './variants';

const DATA_DIR = join(process.cwd(), 'src', 'data', 'variants');
const SOLUTIONS_DIR = join(process.cwd(), 'solutions', 'variants');
const files = readdirSync(DATA_DIR).filter(
  (f) => f.endsWith('.yaml') && !f.endsWith('.tests.yaml'),
);

describe('slotOf', () => {
  it('3, 13 і 23 — один блок, різні версії', () => {
    expect([3, 13, 23].map(slotOf)).toEqual([
      { block: 2, version: 0 },
      { block: 2, version: 1 },
      { block: 2, version: 2 },
    ]);
    expect(slotOf(30)).toEqual({ block: 9, version: 2 });
  });
});

describe.each(files)('%s', (file) => {
  const data = parseVariants(readFileSync(join(DATA_DIR, file), 'utf8'));

  it('30 різних комплектів по 3 завдання', () => {
    const sets = Array.from({ length: VARIANTS }, (_, i) =>
      tasksOf(data, i + 1)
        .map((t) => t.task + t.examples.join())
        .join('|'),
    );
    expect(new Set(sets).size).toBe(VARIANTS);
    expect(data.levels.map((l) => l.stars)).toEqual([1, 2, 3]);
  });

  const solutionsFile = join(SOLUTIONS_DIR, file);
  const machine = data.machine;
  const checkable =
    machine === 'markov' || machine === 'post' || machine === 'turing' || machine === 'flowchart';
  it.skipIf(!existsSync(solutionsFile) || !checkable)(
    'еталонні програми дають результати з прикладів',
    () => {
      const failures = checkReferences(
        solutionsFile,
        machine as TaskMachine,
        (l, b, v) => data.levels[l]!.blocks[b]![v]!.examples,
      );
      expect(failures).toEqual([]);
    },
  );
});

describe('тести автоперевірки варіантів', () => {
  const testFiles = readdirSync(DATA_DIR).filter((f) => f.endsWith('.tests.yaml'));
  it.each(testFiles)('%s — є для кожного з 90 завдань', (file) => {
    const tests = parseVariantTests(readFileSync(join(DATA_DIR, file), 'utf8'));
    const keys = Array.from({ length: VARIANTS }, (_, i) => i + 1).flatMap((n) =>
      [1, 2, 3].map((stars) => testsKey(n, stars)),
    );
    expect(keys.filter((key) => !tests[key])).toEqual([]);
  });

  it.each(testFiles)('%s — еталонні програми проходять усі тести', (file) => {
    const name = file.replace('.tests.yaml', '');
    const solutionsFile = join(SOLUTIONS_DIR, `${name}.yaml`);
    if (!existsSync(solutionsFile)) return;
    const machine = parseVariants(readFileSync(join(DATA_DIR, `${name}.yaml`), 'utf8')).machine;
    const tests = parseVariantTests(readFileSync(join(DATA_DIR, file), 'utf8'));
    const failures = checkReferences(
      solutionsFile,
      (machine ?? 'markov') as TaskMachine,
      (l, b, v) => tests[`${l + 1}-${b + 1}-${v + 1}`] ?? [],
    );
    expect(failures).toEqual([]);
  });
});

/** Проганяє кожну еталонну програму на рядках «вхід → результат»; повертає розбіжності. */
function checkReferences(
  solutionsFile: string,
  machine: TaskMachine,
  linesOf: (level: number, block: number, version: number) => readonly string[],
): string[] {
  const solutions = parseYaml(readFileSync(solutionsFile, 'utf8')) as {
    levels: { blocks: string[][] }[];
  };
  const failures: string[] = [];
  solutions.levels.forEach((level, l) =>
    level.blocks.forEach((versions, b) =>
      versions.forEach((source, v) => {
        const where = `${'★'.repeat(l + 1)} блок ${b + 1} версія ${v + 1}`;
        const program = parseProgram(machine, source);
        if (!program) return failures.push(`${where}: еталон не розбирається`);
        const lines = linesOf(l, b, v);
        const report = checkProgram(machine, program, testsFromLines(lines), 100_000);
        for (const r of report.results) {
          if (!r.passed) failures.push(`${where}: ${lines[r.number - 1]}, ${r.verdict}`);
        }
      }),
    ),
  );
  return failures;
}
