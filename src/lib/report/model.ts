/**
 * Звіт з лабораторної як дані: розділи з абзацами, лістингами й таблицями. Будується з умови
 * варіанта, програм студента (автозбереження сторінок завдань) і результатів перевірки;
 * у .docx його перетворює render.ts.
 */

export type Block =
  | { kind: 'p'; text: string; placeholder?: boolean }
  | { kind: 'h2'; text: string }
  | { kind: 'code'; lines: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'list'; items: string[] }
  /** Рисунок PNG; width і height — розмір на сторінці в пікселях (96 точок на дюйм). */
  | { kind: 'image'; data: Uint8Array; width: number; height: number };

export interface ReportSection {
  title: string;
  blocks: Block[];
}

export interface ReportModel {
  fileName: string;
  /** «ЛАБОРАТОРНА РОБОТА №1» */
  heading: string;
  /** «Бороденко Катерина, КІ-2406» */
  student: string;
  sections: ReportSection[];
}

export interface TestRow {
  input: string;
  expected: string;
  actual: string;
  steps: number;
  passed: boolean;
}

export interface LevelReport {
  stars: 1 | 2 | 3;
  statement: string;
  examples: string[];
  /** Текст програми; null — завдання ще не розв’язували на сайті. */
  program: string | null;
  /** Як показати програму (таблиця, рисунок); без нього — лістинг тексту програми. */
  listing?: Block[];
  /** Ідея розв’язку (блок «Коментар» емулятора). */
  idea: string;
  tests: TestRow[];
  shareUrl: string | null;
}

export interface LabReportInput {
  kind: 'lab' | 'practical';
  number: number;
  title: string;
  /** «ЛР1» для імені файлу. */
  label: string;
  student: { name: string; group: string };
  variant: number;
  goal: string[];
  equipment: string[];
  /** Умовності подання даних (абзац перед таблицею варіантів). */
  conventions: string[];
  questions: string[];
  levels: LevelReport[];
  /** Як називати програму у звіті: «Текст програми», «Таблиця переходів», «Схема підстановок». */
  programTitle: string;
}

const LEVEL_NAME = { 1: 'базова складність', 2: 'середня складність', 3: 'підвищена складність' };
const starsText = (n: 1 | 2 | 3) => `${'★'.repeat(n)} (${LEVEL_NAME[n]})`;

/** Ім’я файлу без недозволених символів: «ЛР1_Бороденко_КІ-2406.docx». */
export function reportFileName(label: string, name: string, group: string): string {
  const clean = (s: string) =>
    s
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_');
  const surname = clean(name.split(/\s+/)[0] ?? '');
  return [clean(label), surname, clean(group)].filter(Boolean).join('_') + '.docx';
}

export function buildLabReport(input: LabReportInput): ReportModel {
  const kindTitle = input.kind === 'lab' ? 'ЛАБОРАТОРНА РОБОТА' : 'ПРАКТИЧНА РОБОТА';
  const student = [input.student.name.trim(), input.student.group.trim()]
    .filter(Boolean)
    .join(', ');
  const sections: ReportSection[] = [];

  sections.push({ title: 'Тема', blocks: [{ kind: 'p', text: input.title }] });
  sections.push({ title: 'Мета', blocks: input.goal.map((text) => ({ kind: 'p', text })) });
  sections.push({
    title: 'Обладнання',
    blocks: input.equipment.map((text) => ({ kind: 'p', text })),
  });

  const task: Block[] = [{ kind: 'p', text: `Варіант ${input.variant}.` }];
  for (const level of input.levels) {
    task.push({ kind: 'h2', text: `Завдання ${starsText(level.stars)}` });
    task.push({ kind: 'p', text: level.statement });
    if (level.examples.length)
      task.push({ kind: 'p', text: `Приклади: ${level.examples.join('; ')}.` });
  }
  for (const text of input.conventions) task.push({ kind: 'p', text });
  sections.push({ title: 'Завдання', blocks: task });

  const solution: Block[] = [];
  for (const level of input.levels) {
    if (level.program === null && level.stars > 1) continue;
    solution.push({ kind: 'h2', text: `Завдання ${starsText(level.stars)}` });
    if (level.program === null) {
      solution.push({
        kind: 'p',
        text: '[Завдання ще не розв’язано на сайті.]',
        placeholder: true,
      });
      continue;
    }
    solution.push({ kind: 'p', text: 'Ідея розв’язку.' });
    const idea = level.idea.trim();
    if (idea) for (const text of idea.split(/\n+/)) solution.push({ kind: 'p', text: text.trim() });
    else
      solution.push({
        kind: 'p',
        text: '[Опишіть ідею розв’язку кількома реченнями.]',
        placeholder: true,
      });
    solution.push({ kind: 'p', text: `${input.programTitle}:` });
    solution.push(...(level.listing ?? [{ kind: 'code', lines: level.program.split(/\r?\n/) }]));
    if (level.tests.length) {
      const passed = level.tests.filter((t) => t.passed).length;
      solution.push({
        kind: 'p',
        text: `Результати перевірки на тестах (пройдено ${passed} з ${level.tests.length}):`,
      });
      solution.push({
        kind: 'table',
        header: ['№', 'Вхідні дані', 'Очікуваний результат', 'Результат', 'Кроків'],
        rows: level.tests.map((t, i) => [
          String(i + 1),
          t.input || '—',
          t.expected || '—',
          t.actual,
          String(t.steps),
        ]),
      });
    }
    if (level.shareUrl)
      solution.push({ kind: 'p', text: `Посилання на програму: ${level.shareUrl}` });
  }
  sections.push({ title: 'Розв’язання', blocks: solution });

  sections.push({
    title: 'Висновки',
    blocks: [
      {
        kind: 'p',
        text: '[Що вдалося, які помилки траплялися під час налагодження і як їх виправлено.]',
        placeholder: true,
      },
    ],
  });
  if (input.questions.length) {
    sections.push({
      title: 'Відповіді на контрольні запитання',
      blocks: [{ kind: 'list', items: input.questions }],
    });
  }

  return {
    fileName: reportFileName(input.label, input.student.name, input.student.group),
    heading: `${kindTitle} №${input.number}`,
    student,
    sections,
  };
}
