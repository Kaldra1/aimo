/**
 * Звіт з роботи в браузері: програми студента для кожного рівня варіанта, перевірка на тестах
 * і файл .docx. Програма береться з автозбереження цього браузера (там і коментарі), якщо вона
 * проходить тести, інакше — розв’язок, надісланий у базу.
 */
import {
  checkProgram,
  parseProgram,
  programFromSaved,
  programText,
  testsFromLines,
  LONG_MAX_STEPS,
  type AnyProgram,
  type TaskMachine,
} from '../cloud/solutions';
import * as post from '../machines/post';
import { shareUrl } from '../machines/share';
import { taskStorageKey } from '../tasks/meta';
import { url } from '../url';
import { variantTaskId } from '../variants/ids';
import { readStorage } from '../../components/emulator/support';
import { buildLabReport, type LevelReport, type ReportModel } from './model';
import type { ReportLevelSource, ReportSource } from './source';

const EMULATOR_PATH: Record<TaskMachine, string> = {
  post: '/emulators/post/',
  turing: '/emulators/turing/',
  markov: '/emulators/markov/',
  flowchart: '/emulators/flowchart/',
};

interface Candidate {
  program: AnyProgram;
  text: string;
  idea: string;
  /** Збережений стан емулятора для посилання «Поділитися». */
  saved: string | null;
}

function fromLocal(machine: TaskMachine, saved: string): Candidate | null {
  const program = programFromSaved(machine, saved);
  if (!program) return null;
  let text = programText(machine, program);
  let idea = '';
  try {
    const record = JSON.parse(saved) as { comment?: unknown; program?: unknown };
    if (typeof record.comment === 'string') idea = record.comment;
    // Для машини Поста лишаємо текст студента з його коментарями до команд.
    if (machine === 'post' && typeof record.program === 'string') {
      const own = record.program.trim();
      if (own && parseProgram('post', own)) text = own;
    }
  } catch {
    // автозбереження пошкоджене — лишаємо нормалізований текст
  }
  return { program, text, idea, saved };
}

function fromCloud(machine: TaskMachine, text: string): Candidate | null {
  const program = parseProgram(machine, text);
  if (!program) return null;
  const saved = machine === 'post' ? post.serialize(text, '') : null;
  return { program, text: programText(machine, program), idea: '', saved };
}

function levelReport(
  source: ReportSource,
  level: ReportLevelSource,
  cloudProgram: string | undefined,
): LevelReport {
  const { machine } = source;
  const base = { stars: level.stars, statement: level.statement, examples: level.examples };
  const tests = testsFromLines(level.tests);
  const check = (c: Candidate) => checkProgram(machine, c.program, tests, LONG_MAX_STEPS);

  const saved = readStorage(
    taskStorageKey(variantTaskId(source.session, source.variant, level.stars)),
  );
  const local = saved === null ? null : fromLocal(machine, saved);
  const cloud = cloudProgram === undefined ? null : fromCloud(machine, cloudProgram);
  const localReport = local ? check(local) : null;
  const chosen = local && localReport?.solved ? local : (cloud ?? local);
  if (!chosen) return { ...base, program: null, idea: '', tests: [], shareUrl: null };
  const report = chosen === local && localReport ? localReport : check(chosen);
  const page = new URL(url(EMULATOR_PATH[machine]), window.location.href).href;
  return {
    ...base,
    program: chosen.text,
    idea: chosen.idea,
    tests: report.results.map((r) => ({
      input: r.input,
      expected: r.expected,
      actual: r.passed ? r.expected || '—' : (r.actual ?? r.reason ?? '—'),
      steps: r.steps,
      passed: r.passed,
    })),
    shareUrl: chosen.saved === null ? null : shareUrl(page, chosen.saved),
  };
}

/** Модель звіту; cloudPrograms — розв’язки з бази за кількістю зірок. */
export function collectReport(
  source: ReportSource,
  student: { name: string; group: string },
  cloudPrograms: Map<number, string>,
): ReportModel {
  return buildLabReport({
    ...source.lab,
    student,
    variant: source.variant,
    levels: source.levels.map((l) => levelReport(source, l, cloudPrograms.get(l.stars))),
  });
}

/** Сформувати .docx і віддати браузеру на збереження. */
export async function downloadReport(model: ReportModel): Promise<void> {
  const { renderDocx } = await import('./render');
  const blob = await renderDocx(model);
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = model.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}
