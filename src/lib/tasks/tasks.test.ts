/**
 * Перевірка файлів задач із src/content/tasks і локальних еталонних розв'язків.
 *
 * Еталонні розв'язки не зберігаються в репозиторії (див. .gitignore): це файли
 * solutions/<id задачі>.json у форматі кнопки «Зберегти» емулятора. Якщо розв'язку немає,
 * його тест пропускається.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { taskSchema, type TaskData } from '../content/schemas';
import * as post from '../machines/post';
import * as turing from '../machines/turing';
import { checkPost, checkTuring, type CheckReport } from './check';
import { validateTask } from './validate';

const ROOT = process.cwd();
const TASKS_DIR = join(ROOT, 'src', 'content', 'tasks');
const SOLUTIONS_DIR = join(ROOT, 'solutions');

function readTask(file: string): TaskData {
  const text = readFileSync(join(TASKS_DIR, file), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) throw new Error(`${file}: немає frontmatter`);
  return taskSchema.parse(parseYaml(match[1]!));
}

/** Перевіряє збережену програму (формат кнопки «Зберегти») на тестах задачі. */
function checkSaved(task: TaskData, saved: string): CheckReport {
  if (task.machine === 'post') {
    const parsed = post.parse(post.deserialize(saved).program);
    if (!parsed.ok) throw new Error(parsed.errors.map((e) => e.message).join('; '));
    return checkPost(parsed.value, task.tests, task.maxSteps);
  }
  if (task.machine === 'turing') {
    const built = turing.buildProgram(turing.deserialize(saved).table);
    if (!built.ok) throw new Error(built.errors.map((e) => e.message).join('; '));
    return checkTuring(built.value, task.tests, task.maxSteps);
  }
  throw new Error(`Перевірка для машини ${task.machine} ще не реалізована`);
}

const files = readdirSync(TASKS_DIR).filter((f) => /\.mdx?$/.test(f) && !f.startsWith('_'));

describe('файли задач', () => {
  it('задачі є', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s — коректна', (file) => {
    const task = readTask(file);
    expect(validateTask(file.replace(/\.mdx?$/, ''), task)).toEqual([]);
  });
});

const solutionPath = (file: string) => join(SOLUTIONS_DIR, file.replace(/\.mdx?$/, '.json'));
const withSolution = files.filter((file) => existsSync(solutionPath(file)));
const withoutSolution = files.filter((file) => !existsSync(solutionPath(file)));

describe('еталонні розв’язки (локальні, поза git)', () => {
  if (withSolution.length > 0) {
    it.each(withSolution)('%s — розв’язок проходить усі тести', (file) => {
      const report = checkSaved(readTask(file), readFileSync(solutionPath(file), 'utf8'));
      const failed = report.results.filter((r) => !r.passed);
      expect(failed.map((r) => `тест ${r.number} (${r.input}): ${r.reason}`)).toEqual([]);
    });
  }
  if (withoutSolution.length > 0) {
    it.skip.each(withoutSolution)('%s — розв’язку в solutions/ немає', () => {});
  }
});
