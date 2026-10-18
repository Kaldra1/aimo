/**
 * Варіанти занять: структура даних і, якщо є локальні еталони (solutions/variants, поза git),
 * перевірка кожного прикладу з умови еталонною схемою.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import * as markov from '../machines/markov';
import { parseVariants, slotOf, splitExample, tasksOf, VARIANTS } from './variants';

const DATA_DIR = join(process.cwd(), 'src', 'data', 'variants');
const SOLUTIONS_DIR = join(process.cwd(), 'solutions', 'variants');
const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.yaml'));

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
  it.skipIf(!existsSync(solutionsFile) || data.machine !== 'markov')(
    'еталонні схеми дають результати з прикладів',
    () => {
      const solutions = parseYaml(readFileSync(solutionsFile, 'utf8')) as {
        levels: { blocks: string[][] }[];
      };
      const failures: string[] = [];
      data.levels.forEach((level, l) =>
        level.blocks.forEach((versions, b) =>
          versions.forEach((task, v) => {
            const where = `${'★'.repeat(level.stars)} блок ${b + 1} версія ${v + 1}`;
            const source = solutions.levels[l]?.blocks[b]?.[v];
            if (!source) return failures.push(`${where}: немає еталона`);
            const scheme = markov.parse(source);
            if (!scheme.ok) return failures.push(`${where}: ${scheme.errors[0]?.message}`);
            if (scheme.warnings.length) failures.push(`${where}: ${scheme.warnings[0]?.message}`);
            for (const example of task.examples) {
              const { input, output } = splitExample(example);
              const result = markov.run(markov.createState(scheme.value, input), {
                maxSteps: 10_000,
              });
              if (result.status !== 'halted' || result.state.word !== output) {
                failures.push(
                  `${where}: ${example}, отримано ${result.status} «${result.state.word}»`,
                );
              }
            }
          }),
        ),
      );
      expect(failures).toEqual([]);
    },
  );
});
