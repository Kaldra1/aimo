/**
 * Кнопка «Звіт» на сторінці завдання варіанта: збирає з цього браузера програми студента
 * для всіх трьох рівнів варіанта, проганяє тести й завантажує звіт .docx.
 */
import { useEffect, useState } from 'preact/hooks';
import { cloudEnabled, getClient, hasStoredSession, loadProfile } from '../../lib/cloud/client';
import {
  checkProgram,
  parseProgram,
  programFromSaved,
  programText,
  testsFromLines,
  LONG_MAX_STEPS,
  type TaskMachine,
} from '../../lib/cloud/solutions';
import { shareUrl } from '../../lib/machines/share';
import { buildLabReport, type LabReportInput, type LevelReport } from '../../lib/report/model';
import { taskStorageKey } from '../../lib/tasks/meta';
import { url } from '../../lib/url';
import { variantTaskId } from '../../lib/variants/ids';
import { readStorage, writeStorage } from '../emulator/support';

export interface ReportLevel {
  stars: 1 | 2 | 3;
  statement: string;
  examples: string[];
  tests: string[];
}

interface Props {
  session: string;
  machine: TaskMachine;
  variant: number;
  levels: ReportLevel[];
  lab: Omit<LabReportInput, 'student' | 'variant' | 'levels'>;
}

const STUDENT_KEY = 'aimo:report:student';
const EMULATOR_PATH: Record<TaskMachine, string> = {
  post: '/emulators/post/',
  turing: '/emulators/turing/',
  markov: '/emulators/markov/',
  flowchart: '/emulators/flowchart/',
};

/** ki2406 → КІ-2406 */
const groupTitle = (id: string) => {
  const m = /^([a-z]+)(\d+)$/.exec(id);
  if (!m) return id;
  const letters = m[1]!.replace(/k/g, 'К').replace(/i/g, 'І').toUpperCase();
  return `${letters}-${m[2]}`;
};

function readLevel(
  session: string,
  machine: TaskMachine,
  variant: number,
  level: ReportLevel,
): LevelReport {
  const base = { stars: level.stars, statement: level.statement, examples: level.examples };
  const saved = readStorage(taskStorageKey(variantTaskId(session, variant, level.stars)));
  const program = saved === null ? null : programFromSaved(machine, saved);
  if (saved === null || program === null) {
    return { ...base, program: null, idea: '', tests: [], shareUrl: null };
  }
  // Для машини Поста лишаємо текст студента з його коментарями до команд.
  let text = programText(machine, program);
  let idea = '';
  try {
    const record = JSON.parse(saved) as { comment?: unknown; program?: unknown };
    if (typeof record.comment === 'string') idea = record.comment;
    if (machine === 'post' && typeof record.program === 'string') {
      const own = record.program.trim();
      if (own && parseProgram('post', own)) text = own;
    }
  } catch {
    // автозбереження пошкоджене — лишаємо нормалізований текст
  }
  const report = checkProgram(machine, program, testsFromLines(level.tests), LONG_MAX_STEPS);
  const page = new URL(url(EMULATOR_PATH[machine]), window.location.href).href;
  return {
    ...base,
    program: text,
    idea,
    tests: report.results.map((r) => ({
      input: r.input,
      expected: r.expected,
      actual: r.passed ? r.expected || '—' : (r.actual ?? r.reason ?? '—'),
      steps: r.steps,
      passed: r.passed,
    })),
    shareUrl: shareUrl(page, saved),
  };
}

export default function ReportButton({ session, machine, variant, levels, lab }: Props) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(readStorage(STUDENT_KEY) ?? 'null') as {
        name?: string;
        group?: string;
      } | null;
      if (stored?.name) setName(stored.name);
      if (stored?.group) setGroup(stored.group);
    } catch {
      // нічого не збережено
    }
    if (!cloudEnabled || !hasStoredSession()) return;
    void (async () => {
      const client = await getClient();
      const { data } = await client.auth.getSession();
      if (!data.session) return;
      const profile = await loadProfile(data.session);
      if (profile.student) {
        setName(profile.student.fullName.split(/\s+/).slice(0, 2).join(' '));
        setGroup(groupTitle(profile.student.groupId));
      }
    })();
  }, []);

  const download = async () => {
    setBusy(true);
    setMessage(null);
    try {
      writeStorage(STUDENT_KEY, JSON.stringify({ name, group }));
      const model = buildLabReport({
        ...lab,
        student: { name, group },
        variant,
        levels: levels.map((l) => readLevel(session, machine, variant, l)),
      });
      const { renderDocx } = await import('../../lib/report/render');
      const blob = await renderDocx(model);
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = model.fileName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 0);
      const solved =
        model.sections
          .find((s) => s.title === 'Розв’язання')
          ?.blocks.filter((b) => b.kind === 'code').length ?? 0;
      setMessage({
        text: `Звіт ${model.fileName} завантажено (програм у звіті: ${solved}). Допишіть у Word висновки й відповіді на контрольні запитання.`,
        error: false,
      });
    } catch (e) {
      setMessage({
        text: `Не вдалося сформувати звіт: ${e instanceof Error ? e.message : String(e)}`,
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="panel report-panel" aria-labelledby="report-title">
      <h2 id="report-title" class="panel__title">
        Звіт
      </h2>
      <p class="panel__hint">
        Звіт у Word за правилами оформлення: тема, мета, обладнання, завдання вашого варіанта,
        програми всіх розв’язаних рівнів з коментарями й результатами перевірки на тестах. Програми
        беруться з цього браузера.
      </p>
      <div class="report-panel__fields">
        <label class="field" for="report-name">
          <span class="field__label">Прізвище та ім’я</span>
          <input
            id="report-name"
            class="input"
            value={name}
            autocomplete="name"
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <label class="field" for="report-group">
          <span class="field__label">Група</span>
          <input
            id="report-group"
            class="input"
            value={group}
            placeholder="КІ-2406"
            onInput={(e) => setGroup(e.currentTarget.value)}
          />
        </label>
      </div>
      <button
        type="button"
        class="button button--primary"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? 'Формуємо…' : 'Завантажити звіт (.docx)'}
      </button>
      {message && (
        <p class={`message${message.error ? ' message--error' : ''}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
