/**
 * Перевірка файлів задач під час збирання сайту й у тестах: тести мають розбиратися в нотації
 * машини, алфавіт — бути коректним, заготовка — без помилок. Повідомлення — для автора задачі.
 */
import { MACHINE_META } from '../machines/meta';
import * as post from '../machines/post';
import * as turing from '../machines/turing';
import type { TaskData } from '../content/schemas';
import { parseTuringWord } from './check';

export function validateTask(fileId: string, task: TaskData): string[] {
  const problems: string[] = [];
  const where = `Задача «${fileId}»`;
  const report = (message: string) => problems.push(`${where}: ${message}`);

  if (task.id !== fileId) {
    report(`поле id («${task.id}») має збігатися з назвою файлу без розширення`);
  }
  if (!task.id.startsWith(`${task.machine}-`)) {
    report(`ідентифікатор задачі для машини ${task.machine} має починатися з «${task.machine}-»`);
  }
  if (!MACHINE_META[task.machine].ready) {
    report(
      `емулятор «${MACHINE_META[task.machine].title}» ще не готовий, задачі для нього додавати зарано`,
    );
    return problems;
  }

  task.tests.forEach((test, index) => {
    if (test.checkHead && !test.expected.includes('[')) {
      report(`тест ${index + 1}: checkHead: true, але в expected не позначено каретку дужками`);
    }
  });

  if (task.machine === 'post') {
    task.tests.forEach((test, index) => {
      for (const [field, text] of [
        ['input', test.input],
        ['expected', test.expected],
      ] as const) {
        const tape = post.parseTape(text);
        if (!tape.ok) report(`тест ${index + 1}, поле ${field}: ${tape.error}`);
      }
    });
    if (task.starter.trim() !== '') {
      const parsed = post.parse(task.starter);
      if (!parsed.ok) report(`заготовка містить помилки: ${parsed.errors[0]?.message ?? ''}`);
    }
  }

  if (task.machine === 'turing') {
    const alphabet = turing.parseAlphabet(task.alphabet);
    if (!alphabet.ok) {
      report(`алфавіт: ${alphabet.error}`);
      return problems;
    }
    if (alphabet.symbols.length === 0) {
      report('для машини Тюрінга потрібно вказати алфавіт (поле alphabet)');
      return problems;
    }
    task.tests.forEach((test, index) => {
      const input = turing.parseTape(test.input, alphabet.symbols);
      if (!input.ok) report(`тест ${index + 1}, поле input: ${input.error}`);
      const expected = parseTuringWord(test.expected);
      if (!expected.ok) {
        report(`тест ${index + 1}, поле expected: ${expected.error}`);
        return;
      }
      const foreign = [...expected.cells.values()].filter((s) => !alphabet.symbols.includes(s));
      if (foreign.length > 0) {
        report(`тест ${index + 1}, поле expected: символу «${foreign[0]}» немає в алфавіті задачі`);
      }
    });
    if (task.starter.trim() !== '') {
      const parsed = turing.parse(task.starter, { alphabet: task.alphabet });
      if (!parsed.ok) report(`заготовка містить помилки: ${parsed.errors[0]?.message ?? ''}`);
    }
  }

  return problems;
}
