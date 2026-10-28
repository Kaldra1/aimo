/**
 * Дашборд викладача: журнал оцінок (як таблиця групи), заняття × ★/★★/★★★ з датами й схемами,
 * повторна перевірка й однакові схеми, акаунти студентів. Оцінки спершу змінюються в чернетці
 * й потрапляють у базу лише після «Підтвердити зміни».
 */
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { credentialsCsv, parseRoster } from '../../lib/cloud/accounts';
import { explain, getClient } from '../../lib/cloud/client';
import { fingerprint, recheck, type Recheck } from '../../lib/cloud/solutions';
import { pasteDescription, pasteLevel, type PasteLevel } from '../../lib/cloud/paste-level';
import {
  formatStamp,
  localDate,
  type GradeRow,
  type GroupRow,
  type SessionDateRow,
  type SessionMeta,
  type SolveRow,
  type StudentRow,
} from '../../lib/cloud/types';
import {
  GRADE_LABELS,
  recommendGrade,
  type Grade,
  type Recommendation,
} from '../../lib/grading/grade';
import {
  averageOf,
  cellKey,
  draftToWrites,
  editDraft,
  formatMean,
  JOURNAL_TOPICS,
  parseGradeInput,
  SEMESTER_ITEM,
  type Average,
  type Draft,
} from '../../lib/grading/journal';
import { testsKey } from '../../lib/variants/ids';
import { downloadText } from '../emulator/support';
import LoginForm from './LoginForm';
import { useAuth } from './useAuth';

type Tests = Record<string, Record<string, string[]>>;

interface Props {
  sessions: SessionMeta[];
  /** Тести варіантів для повторної перевірки: заняття → ключ «зірки-блок-версія» → рядки. */
  tests: Tests;
}

interface Data {
  groups: GroupRow[];
  students: StudentRow[];
  solves: SolveRow[];
  dates: SessionDateRow[];
  grades: GradeRow[];
}

type Tab = 'journal' | 'session' | 'students';

export default function TeacherDashboard(props: Props) {
  const { state, error, signIn, signOut } = useAuth();

  if (state.status === 'disabled') {
    return <p class="message message--warning">Вхід на сайт ще не налаштовано.</p>;
  }
  if (state.status === 'loading') return <p class="panel__hint">Завантаження…</p>;
  if (state.status === 'signed-out') {
    return <LoginForm onSubmit={signIn} error={error} hint="Вхід для викладача — за поштою." />;
  }
  if (!state.profile.teacher) {
    return (
      <div class="panel cloud-card">
        <p>Дашборд доступний лише викладачеві.</p>
        <button type="button" class="button button--secondary" onClick={signOut}>
          Вийти
        </button>
      </div>
    );
  }
  return <Dashboard {...props} email={state.session.user.email ?? ''} onSignOut={signOut} />;
}

/** Оцінки: збережені в базі, чернетка й рекомендації. Спільне для журналу й таблиці заняття. */
interface GradeBook {
  saved: (userId: string, item: string) => Grade | null;
  value: (userId: string, item: string) => Grade | null;
  changed: (userId: string, item: string) => boolean;
  edit: (userId: string, item: string, value: Grade | null) => void;
  recommend: (userId: string, session: string) => Recommendation;
}

function Dashboard({
  sessions,
  tests,
  email,
  onSignOut,
}: Props & { email: string; onSignOut: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('journal');
  const [groupId, setGroupId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>(
    sessions.find((s) => s.checkable)?.id ?? sessions[0]?.id ?? '',
  );
  const [draft, setDraft] = useState<Draft>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const client = await getClient();
    const [groups, students, solves, dates, grades] = await Promise.all([
      client.from('groups').select('*').order('id'),
      client.from('students').select('*').order('journal'),
      client.from('solves').select('*'),
      client.from('session_dates').select('*'),
      client.from('grades').select('*'),
    ]);
    const failed = groups.error ?? students.error ?? solves.error ?? dates.error ?? grades.error;
    setLoadError(failed ? explain(failed) : null);
    setData({
      groups: (groups.data ?? []) as GroupRow[],
      students: (students.data ?? []) as StudentRow[],
      solves: (solves.data ?? []) as SolveRow[],
      dates: (dates.data ?? []) as SessionDateRow[],
      grades: (grades.data ?? []) as GradeRow[],
    });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (groupId === '' && data?.groups[0]) setGroupId(data.groups[0].id);
  }, [data, groupId]);

  // Незбережені оцінки: браузер попередить, якщо закрити вкладку.
  useEffect(() => {
    if (draft.size === 0) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft]);

  const machineOf = useMemo(
    () => new Map(sessions.map((s) => [s.id, s.machine ?? 'markov'] as const)),
    [sessions],
  );

  // Повторна перевірка всіх збережених схем — один раз на завантаження даних.
  const checks = useMemo(() => {
    const result = new Map<string, Recheck>();
    for (const solve of data?.solves ?? []) {
      result.set(
        solveKey(solve.user_id, solve.session, solve.stars),
        recheck(
          machineOf.get(solve.session) ?? 'markov',
          solve.program,
          tests[solve.session]?.[testsKey(solve.variant, solve.stars)],
        ),
      );
    }
    return result;
  }, [data, tests, machineOf]);

  const book = useMemo<GradeBook | null>(() => {
    if (!data) return null;
    const savedMap = new Map(
      data.grades.map((g) => [cellKey(g.user_id, g.item), g.grade as Grade]),
    );
    const groupOf = new Map(data.students.map((s) => [s.user_id, s.group_id]));
    const saved = (userId: string, item: string) => savedMap.get(cellKey(userId, item)) ?? null;
    return {
      saved,
      value: (userId, item) => {
        const key = cellKey(userId, item);
        return draft.has(key) ? draft.get(key)! : saved(userId, item);
      },
      changed: (userId, item) => draft.has(cellKey(userId, item)),
      edit: (userId, item, value) =>
        setDraft((current) =>
          editDraft(current, cellKey(userId, item), value, saved(userId, item)),
        ),
      recommend: (userId, session) => {
        const date = data.dates.find(
          (d) => d.group_id === groupOf.get(userId) && d.session === session,
        )?.date;
        return recommendGrade(
          data.solves
            .filter((s) => s.user_id === userId && s.session === session)
            .filter((s) => checks.get(solveKey(userId, session, s.stars)) !== 'fail')
            .map((s) => ({ stars: s.stars, solvedAt: new Date(s.solved_at) })),
          date ? localDate(date) : null,
        );
      },
    };
  }, [data, draft, checks]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const client = await getClient();
    const { upserts, deletes } = draftToWrites(draft);
    const failed: string[] = [];
    if (upserts.length > 0) {
      const { error } = await client.from('grades').upsert(upserts);
      if (error) failed.push(explain(error));
    }
    for (const row of deletes) {
      const { error } = await client.from('grades').delete().match(row);
      if (error) failed.push(explain(error));
    }
    await reload();
    if (failed.length > 0) {
      setSaveError(`Не все збережено: ${failed[0]}`);
    } else {
      setDraft(new Map());
    }
    setSaving(false);
  };

  const discard = () => {
    if (window.confirm(`Скасувати незбережені зміни (${draft.size})?`)) setDraft(new Map());
  };

  if (data === null || book === null) return <p class="panel__hint">Завантаження…</p>;

  const students = data.students.filter((s) => s.group_id === groupId);
  const session = sessions.find((s) => s.id === sessionId);

  return (
    <div class="cloud-stack">
      <div class="cloud-toolbar">
        <label class="field field--inline">
          <span class="field__label">Група</span>
          <select class="input" value={groupId} onChange={(e) => setGroupId(e.currentTarget.value)}>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <div class="cloud-tabs" role="tablist" aria-label="Розділ дашборду">
          {(
            [
              ['journal', 'Журнал'],
              ['session', 'Заняття'],
              ['students', 'Студенти'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              class={`button ${tab === key ? 'button--primary' : 'button--secondary'}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span class="cloud-muted">{email}</span>
        <button
          type="button"
          class="button button--secondary"
          onClick={() => void reload()}
          title="Підтягнути нові розв’язки студентів. Незбережені оцінки лишаються."
        >
          Оновити
        </button>
        <button type="button" class="button button--secondary" onClick={onSignOut}>
          Вийти
        </button>
      </div>
      {loadError && <p class="message message--error">{loadError}</p>}

      {tab === 'journal' && (
        <JournalTable
          sessions={sessions}
          groupId={groupId}
          students={students}
          dates={data.dates}
          book={book}
        />
      )}
      {tab === 'session' && (
        <>
          <label class="field field--inline">
            <span class="field__label">Заняття</span>
            <select
              class="input"
              value={sessionId}
              onChange={(e) => setSessionId(e.currentTarget.value)}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}. {s.title}
                </option>
              ))}
            </select>
          </label>
          {session && (
            <SessionTable
              key={`${groupId}/${sessionId}`}
              session={session}
              groupId={groupId}
              students={students}
              data={data}
              checks={checks}
              book={book}
              onChanged={reload}
            />
          )}
        </>
      )}
      {tab === 'students' && (
        <StudentsPanel groupId={groupId} students={students} onChanged={reload} />
      )}

      {(draft.size > 0 || saveError) && (
        <div class="cloud-confirm" role="region" aria-label="Незбережені оцінки">
          <span>
            Незбережених змін: <strong>{draft.size}</strong>
          </span>
          {saveError && <span class="message message--error">{saveError}</span>}
          <button
            type="button"
            class="button button--secondary"
            disabled={saving || draft.size === 0}
            onClick={discard}
          >
            Скасувати
          </button>
          <button
            type="button"
            class="button button--primary"
            disabled={saving || draft.size === 0}
            onClick={() => void save()}
          >
            {saving ? 'Зберігаємо…' : 'Підтвердити зміни'}
          </button>
        </div>
      )}
    </div>
  );
}

const solveKey = (userId: string, session: string, stars: number) =>
  `${userId}/${session}/${stars}`;

// ---------- Клітинка оцінки ----------

/** Перехід між клітинками стрілками й Enter, як у таблиці. */
function moveFocus(input: HTMLInputElement, dRow: number, dCol: number): boolean {
  const row = Number(input.dataset.row) + dRow;
  const col = Number(input.dataset.col) + dCol;
  const next = input
    .closest('table')
    ?.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`);
  if (!next) return false;
  next.focus();
  next.select();
  return true;
}

function GradeCell({
  book,
  userId,
  item,
  label,
  hint,
  hintTitle,
  row,
  col,
}: {
  book: GradeBook;
  userId: string;
  item: string;
  label: string;
  /** Що показати сірим, коли оцінки немає: рекомендація чи середнє. */
  hint: string;
  hintTitle?: string;
  row: number;
  col: number;
}) {
  const value = book.value(userId, item);
  const changed = book.changed(userId, item);
  const saved = book.saved(userId, item);
  const title = [hintTitle, changed ? `Було: ${saved ?? 'порожньо'}. Ще не збережено.` : undefined]
    .filter(Boolean)
    .join(' ');
  return (
    <input
      class={`cloud-cell${changed ? ' is-changed' : ''}`}
      inputMode="numeric"
      maxLength={1}
      aria-label={label}
      title={title || undefined}
      placeholder={hint}
      data-row={row}
      data-col={col}
      value={value === null ? '' : String(value)}
      onFocus={(e) => e.currentTarget.select()}
      onInput={(e) => {
        const input = e.currentTarget;
        const parsed = parseGradeInput(input.value);
        if (parsed === undefined) {
          input.value = value === null ? '' : String(value);
          return;
        }
        book.edit(userId, item, parsed);
      }}
      onKeyDown={(e) => {
        const input = e.currentTarget;
        const moves: Record<string, [number, number]> = {
          Enter: [e.shiftKey ? -1 : 1, 0],
          ArrowDown: [1, 0],
          ArrowUp: [-1, 0],
          ArrowRight: [0, 1],
          ArrowLeft: [0, -1],
        };
        const move = moves[e.key];
        if (move && moveFocus(input, move[0], move[1])) e.preventDefault();
      }}
    />
  );
}

const averageHint = (average: Average) =>
  average.grade === null ? '' : `${average.grade}${average.missing > 0 ? '…' : ''}`;

const averageTitle = (average: Average, parts: string) =>
  average.mean === null
    ? `Ще немає оцінок (${parts}).`
    : `Середнє ${formatMean(average.mean)} → ${average.grade} (вниз)` +
      (average.missing > 0 ? `, нездане (${average.missing}) — як 2` : '') +
      ` (${parts}). Сірим — підказка; впишіть оцінку, щоб зафіксувати.`;

// ---------- Журнал ----------

function JournalTable({
  sessions,
  groupId,
  students,
  dates,
  book,
}: {
  sessions: SessionMeta[];
  groupId: string;
  students: StudentRow[];
  dates: SessionDateRow[];
  book: GradeBook;
}) {
  const meta = new Map(sessions.map((s) => [s.id, s]));
  const columns = JOURNAL_TOPICS.flatMap((topic) => topic.sessions).filter((id) => meta.has(id));
  const dateOf = (session: string) => {
    const date = dates.find((d) => d.group_id === groupId && d.session === session)?.date;
    return date
      ? localDate(date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
      : '';
  };

  return (
    <section class="panel cloud-card" aria-label="Журнал оцінок">
      <p class="panel__hint">
        Впишіть оцінку 2–5 або зітріть її; Enter і стрілки переходять між клітинками. Сірим —
        підказка: за заняття — рекомендована з розв’язків, за тему й семестр — середнє, де нездане
        рахується як 2, округлене вниз («…» — є нездане). Зміни потрапляють у базу після
        «Підтвердити зміни».
      </p>
      <div class="cloud-table">
        <table class="cloud-journal">
          <thead>
            <tr>
              <th scope="col">№</th>
              <th scope="col">Студент</th>
              <th scope="col" class="cloud-journal__total">
                Семестр
              </th>
              {JOURNAL_TOPICS.map((topic) => (
                <th key={topic.item} scope="col" class="cloud-journal__topic">
                  {topic.label}
                </th>
              ))}
              {columns.map((id) => (
                <th key={id} scope="col">
                  {meta.get(id)!.label}
                  <span class="cloud-journal__date">{dateOf(id)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, row) => {
              const userId = student.user_id;
              const topicAverages = JOURNAL_TOPICS.map((topic) =>
                averageOf(topic.sessions.map((id) => book.value(userId, id))),
              );
              const semester = averageOf(
                JOURNAL_TOPICS.map(
                  (topic, i) => book.value(userId, topic.item) ?? topicAverages[i]!.grade,
                ),
              );
              return (
                <tr key={userId}>
                  <td>{student.journal}</td>
                  <th scope="row">{student.full_name}</th>
                  <td class="cloud-journal__total">
                    <GradeCell
                      book={book}
                      userId={userId}
                      item={SEMESTER_ITEM}
                      label={`${student.full_name}: семестрова`}
                      hint={averageHint(semester)}
                      hintTitle={averageTitle(
                        semester,
                        JOURNAL_TOPICS.map((t) => t.label).join(', '),
                      )}
                      row={row}
                      col={0}
                    />
                  </td>
                  {JOURNAL_TOPICS.map((topic, i) => (
                    <td key={topic.item} class="cloud-journal__topic">
                      <GradeCell
                        book={book}
                        userId={userId}
                        item={topic.item}
                        label={`${student.full_name}: ${topic.label}`}
                        hint={averageHint(topicAverages[i]!)}
                        hintTitle={averageTitle(
                          topicAverages[i]!,
                          topic.sessions.map((id) => meta.get(id)?.label ?? id).join(', '),
                        )}
                        row={row}
                        col={1 + i}
                      />
                    </td>
                  ))}
                  {columns.map((id, j) => {
                    const rec = book.recommend(userId, id);
                    return (
                      <td key={id}>
                        <GradeCell
                          book={book}
                          userId={userId}
                          item={id}
                          label={`${student.full_name}: ${meta.get(id)!.label}`}
                          hint={rec.grade === null ? '' : String(rec.grade)}
                          hintTitle={
                            rec.grade === null ? undefined : `Рекомендована: ${rec.reason}`
                          }
                          row={row}
                          col={1 + JOURNAL_TOPICS.length + j}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {students.length === 0 && <p class="panel__hint">У групі ще немає студентів.</p>}
    </section>
  );
}

const gradeText = (grade: Grade | null) => (grade ? `${grade} (${GRADE_LABELS[grade]})` : '—');

// ---------- Заняття ----------

function SessionTable({
  session,
  groupId,
  students,
  data,
  checks,
  book,
  onChanged,
}: {
  session: SessionMeta;
  groupId: string;
  students: StudentRow[];
  data: Data;
  checks: ReadonlyMap<string, Recheck>;
  book: GradeBook;
  onChanged: () => Promise<void>;
}) {
  const dateRow = data.dates.find((d) => d.group_id === groupId && d.session === session.id);
  const [open, setOpen] = useState<string | null>(null);

  // Однакові схеми в межах заняття й рівня — серед усіх груп.
  const twins = useMemo(() => {
    const byKey = new Map<string, SolveRow[]>();
    for (const solve of data.solves) {
      if (solve.session !== session.id) continue;
      const key = `${solve.stars}:${fingerprint(session.machine ?? 'markov', solve.program)}`;
      byKey.set(key, [...(byKey.get(key) ?? []), solve]);
    }
    const loginOf = new Map(data.students.map((s) => [s.user_id, s.login]));
    const result = new Map<string, string[]>();
    for (const group of byKey.values()) {
      if (group.length < 2) continue;
      for (const solve of group) {
        result.set(
          `${solve.user_id}/${solve.stars}`,
          group.filter((s) => s !== solve).map((s) => loginOf.get(s.user_id) ?? '?'),
        );
      }
    }
    return result;
  }, [data.solves, data.students, session.id, session.machine]);

  const openSolve = open
    ? data.solves.find((s) => `${s.user_id}/${s.stars}` === open && s.session === session.id)
    : undefined;

  return (
    <section class="panel cloud-card" aria-label={`${session.label}: розв’язки`}>
      <SessionDate
        groupId={groupId}
        session={session.id}
        value={dateRow?.date}
        onChanged={onChanged}
      />
      {!session.checkable && (
        <p class="panel__hint">
          Для цього заняття автоперевірки немає — розв’язки в базу не потрапляють, оцінку ставите
          вручну.
        </p>
      )}
      <div class="cloud-table">
        <table>
          <thead>
            <tr>
              <th scope="col">№</th>
              <th scope="col">Студент</th>
              <th scope="col">★</th>
              <th scope="col">★★</th>
              <th scope="col">★★★</th>
              <th scope="col">Рекомендована</th>
              <th scope="col">Остаточна</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, row) => {
              const mine = data.solves.filter(
                (s) => s.user_id === student.user_id && s.session === session.id,
              );
              const rec = book.recommend(student.user_id, session.id);
              return (
                <tr key={student.user_id}>
                  <td>{student.journal}</td>
                  <th scope="row">
                    {student.full_name}
                    <span class="cloud-muted"> · {student.login}</span>
                  </th>
                  {([1, 2, 3] as const).map((stars) => {
                    const solve = mine.find((s) => s.stars === stars);
                    if (!solve) return <td key={stars}>—</td>;
                    const key = `${student.user_id}/${stars}`;
                    const check = checks.get(solveKey(student.user_id, session.id, stars));
                    const twin = twins.get(key);
                    return (
                      <td key={stars}>
                        <button
                          type="button"
                          class={`cloud-solve${check === 'fail' ? ' is-failed' : ''}`}
                          aria-expanded={open === key}
                          onClick={() => setOpen(open === key ? null : key)}
                          title={`${
                            check === 'fail'
                              ? 'Повторна перевірка не пройдена'
                              : check === 'unknown'
                                ? 'Тестів для повторної перевірки немає'
                                : 'Повторна перевірка пройдена'
                          }. Уперше розв’язано ${formatStamp(solve.solved_at)}, востаннє — ${formatStamp(solve.updated_at)}`}
                        >
                          {check === 'fail' ? '✗' : check === 'ok' ? '✓' : '?'}{' '}
                          {formatStamp(solve.updated_at)}
                        </button>
                        <PasteMark solve={solve} />
                        {twin && (
                          <span class="cloud-twin" title={`Така сама схема: ${twin.join(', ')}`}>
                            = {twin.join(', ')}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td title={rec.reason}>{gradeText(rec.grade)}</td>
                  <td>
                    <GradeCell
                      book={book}
                      userId={student.user_id}
                      item={session.id}
                      label={`${student.full_name}: остаточна за ${session.label}`}
                      hint={rec.grade === null ? '' : String(rec.grade)}
                      row={row}
                      col={0}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {students.length === 0 && <p class="panel__hint">У групі ще немає студентів.</p>}
      {openSolve && (
        <div class="cloud-program">
          <p class="field__label">
            {data.students.find((s) => s.user_id === openSolve.user_id)?.login} · варіант{' '}
            {openSolve.variant} · {'★'.repeat(openSolve.stars)} · востаннє збережено{' '}
            {formatStamp(openSolve.updated_at)}
          </p>
          <p class={`cloud-paste-note is-${pasteLevel(openSolve)}`}>
            {pasteDescription(openSolve)}
          </p>
          <pre>{openSolve.program}</pre>
        </div>
      )}
    </section>
  );
}

const MARK: Record<Exclude<PasteLevel, 'unknown'>, string> = {
  self: '✎ сам',
  small: '⎘',
  big: '⚠ ⎘',
};

/** Позначка біля розв’язку: набрано самостійно, дрібні вставки чи великий вставлений шмат. */
function PasteMark({ solve }: { solve: SolveRow }) {
  const level = pasteLevel(solve);
  if (level === 'unknown') return null;
  const text = pasteDescription(solve);
  const pastes = solve.pastes ?? 0;
  return (
    <span class={`cloud-paste is-${level}`} title={text} aria-label={text}>
      {MARK[level]}
      {level !== 'self' && pastes > 0 && ` ${pastes}×${solve.pasted_chars ?? 0}`}
      {(solve.file_loads ?? 0) > 0 && ' 📄'}
    </span>
  );
}

function SessionDate({
  groupId,
  session,
  value,
  onChanged,
}: {
  groupId: string;
  session: string;
  value: string | undefined;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const change = async (date: string) => {
    const client = await getClient();
    const { error: failed } =
      date === ''
        ? await client.from('session_dates').delete().match({ group_id: groupId, session })
        : await client.from('session_dates').upsert({ group_id: groupId, session, date });
    setError(failed ? explain(failed) : null);
    await onChanged();
  };
  return (
    <div class="cloud-row">
      <label class="field field--inline">
        <span class="field__label">Дата заняття в групі</span>
        <input
          class="input"
          type="date"
          value={value ?? ''}
          onChange={(e) => void change(e.currentTarget.value)}
        />
      </label>
      <span class="cloud-muted">
        {value ? 'Від неї рахуються терміни.' : 'Без дати термін не враховується.'}
      </span>
      {error && <span class="message message--error">{error}</span>}
    </div>
  );
}

// ---------- Студенти ----------

interface Credentials {
  login: string;
  password: string;
  fullName: string;
}

async function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const client = await getClient();
  const { data, error } = await client.functions.invoke('admin-students', { body });
  if (error) {
    // Текст помилки функції лежить у відповіді.
    const context = (error as { context?: Response }).context;
    const detail = context
      ? ((await context.json().catch(() => null)) as { error?: string } | null)
      : null;
    throw new Error(detail?.error ?? explain(error));
  }
  return data as T;
}

function StudentsPanel({
  groupId,
  students,
  onChanged,
}: {
  groupId: string;
  students: StudentRow[];
  onChanged: () => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [issued, setIssued] = useState<Credentials[]>([]);
  const roster = useMemo(() => parseRoster(text), [text]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ text: await action(), error: false });
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
      await onChanged();
    }
  };

  const importRoster = () =>
    run(async () => {
      const result = await callAdmin<{
        created: Credentials[];
        skipped: { journal: number; reason: string }[];
      }>({ action: 'import', group: groupId, students: roster.rows });
      setIssued((list) => [...list, ...result.created]);
      setText('');
      const skipped = result.skipped.map((s) => `№${s.journal}: ${s.reason}`).join('; ');
      return `Створено акаунтів: ${result.created.length}.${skipped ? ` Пропущено — ${skipped}.` : ''}`;
    });

  const reset = (student: StudentRow) => {
    if (!window.confirm(`Скинути пароль для ${student.full_name} (${student.login})?`)) return;
    void run(async () => {
      const result = await callAdmin<{ login: string; password: string }>({
        action: 'reset',
        userId: student.user_id,
      });
      setIssued((list) => [...list, { ...result, fullName: student.full_name }]);
      return `Новий пароль для ${result.login} — у таблиці нижче.`;
    });
  };

  return (
    <div class="cloud-stack">
      <section class="panel cloud-card" aria-labelledby="roster-title">
        <h2 id="roster-title" class="panel__title">
          Додати студентів
        </h2>
        <p class="panel__hint">
          Скопіюйте з таблиці два стовпці — номер у журналі й ПІБ — і вставте сюди. Для кожного буде
          створено акаунт із логіном «група-номер» і випадковим паролем. Наявні акаунти не
          змінюються.
        </p>
        <textarea
          class="input input--mono cloud-roster"
          rows={8}
          aria-label="Список групи"
          placeholder={'1\tПрізвище Ім’я По батькові\n2\t…'}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        {roster.errors.length > 0 && (
          <p class="message message--warning">{roster.errors.join('; ')}</p>
        )}
        <button
          type="button"
          class="button button--primary"
          disabled={busy || roster.rows.length === 0 || groupId === ''}
          onClick={() => void importRoster()}
        >
          Створити акаунти ({roster.rows.length})
        </button>
      </section>

      {message && (
        <p class={`message${message.error ? ' message--error' : ''}`} role="status">
          {message.text}
        </p>
      )}

      {issued.length > 0 && (
        <section class="panel cloud-card" aria-labelledby="issued-title">
          <div class="panel__header">
            <h2 id="issued-title" class="panel__title">
              Видані паролі
            </h2>
            <button
              type="button"
              class="button button--primary"
              onClick={() => downloadText(`паролі-${groupId}.csv`, credentialsCsv(issued))}
            >
              Завантажити CSV
            </button>
          </div>
          <p class="message message--warning">
            Паролі показано лише зараз і ніде не збережено. Завантажте CSV або перепишіть, перш ніж
            закрити сторінку.
          </p>
          <div class="cloud-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">ПІБ</th>
                  <th scope="col">Логін</th>
                  <th scope="col">Пароль</th>
                </tr>
              </thead>
              <tbody>
                {issued.map((c) => (
                  <tr key={`${c.login}-${c.password}`}>
                    <td>{c.fullName}</td>
                    <td>
                      <code>{c.login}</code>
                    </td>
                    <td>
                      <code>{c.password}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section class="panel cloud-card" aria-labelledby="accounts-title">
        <h2 id="accounts-title" class="panel__title">
          Акаунти групи ({students.length})
        </h2>
        <div class="cloud-table">
          <table>
            <thead>
              <tr>
                <th scope="col">№</th>
                <th scope="col">ПІБ</th>
                <th scope="col">Логін</th>
                <th scope="col">Пошта</th>
                <th scope="col">Пароль</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.user_id}>
                  <td>{student.journal}</td>
                  <td>{student.full_name}</td>
                  <td>
                    <code>{student.login}</code>
                  </td>
                  <td>{student.email ?? <span class="cloud-muted">не вказано</span>}</td>
                  <td>
                    <button
                      type="button"
                      class="button button--secondary"
                      disabled={busy}
                      onClick={() => reset(student)}
                    >
                      Скинути
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
