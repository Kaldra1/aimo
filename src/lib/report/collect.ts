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
import * as flowchart from '../machines/flowchart';
import * as markov from '../machines/markov';
import * as post from '../machines/post';
import * as turing from '../machines/turing';
import { tableFromProgram } from '../machines/turing/program';
import { shareUrl } from '../machines/share';
import { taskStorageKey } from '../tasks/meta';
import { url } from '../url';
import { variantTaskId } from '../variants/ids';
import { readStorage } from '../../components/emulator/support';
import { flowchartSvg, programBlocks } from './listing';
import { buildLabReport, type Block, type LevelReport, type ReportModel } from './model';
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
    // Для машин Поста й Маркова лишаємо текст студента з його коментарями.
    if ((machine === 'post' || machine === 'markov') && typeof record.program === 'string') {
      const own = record.program.trim();
      if (own && parseProgram(machine, own)) text = own;
    }
  } catch {
    // автозбереження пошкоджене — лишаємо нормалізований текст
  }
  return { program, text, idea, saved };
}

/** Стан емулятора для посилання «Поділитися», коли є лише розв’язок з бази. */
function savedOf(machine: TaskMachine, program: AnyProgram): string {
  if (machine === 'post') return post.serialize(programText('post', program), '');
  if (machine === 'markov') {
    return markov.serialize({
      program: programText('markov', program),
      input: '',
      alphabet: '',
      checkAlphabet: false,
      comment: '',
    });
  }
  if (machine === 'turing') {
    const p = program as turing.TuringProgram;
    return turing.serialize(tableFromProgram(p, p.alphabet.join('')), '');
  }
  return flowchart.serialize({
    tree: [...(program as flowchart.FlowProgram).tree],
    input: '',
    comment: '',
  });
}

/** Рисунок схеми: SVG → PNG удвічі щільніше, у межах сторінки (17 × 23 см). */
async function flowchartImage(program: AnyProgram): Promise<Block> {
  const { svg, width, height } = flowchartSvg(program);
  const scale = Math.min(1, 640 / width, 870 / height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const image = new Image();
  const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    image.src = href;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('не вдалося намалювати схему');
    return { kind: 'image', data: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
  } finally {
    URL.revokeObjectURL(href);
  }
}

function fromCloud(machine: TaskMachine, text: string): Candidate | null {
  const program = parseProgram(machine, text);
  if (!program) return null;
  return {
    program,
    text: programText(machine, program),
    idea: '',
    saved: savedOf(machine, program),
  };
}

async function levelReport(
  source: ReportSource,
  level: ReportLevelSource,
  cloudProgram: string | undefined,
): Promise<LevelReport> {
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
    listing:
      machine === 'flowchart'
        ? [await flowchartImage(chosen.program)]
        : programBlocks(machine, chosen.program, chosen.text),
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
export async function collectReport(
  source: ReportSource,
  student: { name: string; group: string },
  cloudPrograms: Map<number, string>,
): Promise<ReportModel> {
  const levels = await Promise.all(
    source.levels.map((l) => levelReport(source, l, cloudPrograms.get(l.stars))),
  );
  return buildLabReport({ ...source.lab, student, variant: source.variant, levels });
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
