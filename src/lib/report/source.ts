/**
 * Дані для звіту з роботи (лише під час збирання): розділи сторінки заняття й умови варіанта.
 * Кабінет студента завантажує їх як /reports/<заняття>/<варіант>.json.
 */
import { readFileSync } from 'node:fs';
import type { TaskMachine } from '../cloud/solutions';
import { sessionShortLabel } from '../content/course';
import { checkableSessions, loadVariants, loadVariantTests } from '../variants/load';
import { tasksOf, testsKey } from '../variants/variants';
import type { LabReportInput } from './model';
import { extractSections } from './sections';

/** Заняття, для яких кабінет формує звіт: усі з автоперевіркою варіантів. */
export const REPORT_SESSIONS = new Set(checkableSessions());

export interface ReportLevelSource {
  stars: 1 | 2 | 3;
  statement: string;
  examples: string[];
  /** Тести рядками «вхід → вихід». */
  tests: string[];
}

export interface ReportSource {
  session: string;
  machine: TaskMachine;
  variant: number;
  levels: ReportLevelSource[];
  lab: Omit<LabReportInput, 'student' | 'variant' | 'levels'>;
}

const PROGRAM_TITLE: Record<TaskMachine, string> = {
  post: 'Текст програми',
  turing: 'Таблиця переходів',
  markov: 'Схема підстановок',
  flowchart: 'Схема алгоритму',
};

export function reportSource(
  session: { id: string; kind: 'lab' | 'practical'; number: number; title: string },
  variant: number,
): ReportSource {
  const data = loadVariants(session.id);
  const machine = data.machine as TaskMachine;
  const tests = loadVariantTests(session.id) ?? {};
  const sections = extractSections(readFileSync(`src/content/sessions/${session.id}.mdx`, 'utf8'));
  const text = (name: string) => sections.get(name)?.paragraphs ?? [];
  return {
    session: session.id,
    machine,
    variant,
    levels: tasksOf(data, variant).map((t, i) => ({
      stars: (i + 1) as 1 | 2 | 3,
      statement: t.task,
      examples: t.examples,
      tests: tests[testsKey(variant, i + 1)] ?? [],
    })),
    lab: {
      kind: session.kind,
      number: session.number,
      title: session.title,
      label: sessionShortLabel(session.kind, session.number),
      goal: text('Мета'),
      equipment: text('Обладнання'),
      // Умовності подання даних — абзаци розділу «Варіанти», що починаються з «Якщо».
      conventions: text('Варіанти').filter((p) => p.startsWith('Якщо')),
      questions: sections.get('Контрольні запитання')?.items ?? [],
      programTitle: PROGRAM_TITLE[machine],
    },
  };
}
