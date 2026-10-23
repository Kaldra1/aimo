/**
 * Дашборд викладача: група × заняття × ★/★★/★★★ з датами й схемами, повторна перевірка,
 * однакові схеми, рекомендовані й остаточні оцінки, акаунти студентів.
 */
import { Fragment } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { credentialsCsv, parseRoster } from '../../lib/cloud/accounts';
import { explain, getClient } from '../../lib/cloud/client';
import { fingerprint, recheck, type Recheck } from '../../lib/cloud/solutions';
import {
  formatStamp,
  localDate,
  type GradeRow,
  type GroupRow,
  type SessionDateRow,
  type SessionMeta,
  type SolveRow,
  type StudentRow,
  type TopicMeta,
} from '../../lib/cloud/types';
import {
  averageRecommendation,
  GRADE_LABELS,
  recommendGrade,
  type Grade,
} from '../../lib/grading/grade';
import { testsKey } from '../../lib/variants/ids';
import { downloadText } from '../emulator/support';
import LoginForm from './LoginForm';
import { useAuth } from './useAuth';

interface Props {
  sessions: SessionMeta[];
  topics: TopicMeta[];
  /** Тести варіантів для повторної перевірки: заняття → ключ «зірки-блок-версія» → рядки. */
  tests: Record<string, Record<string, string[]>>;
}

interface Data {
  groups: GroupRow[];
  students: StudentRow[];
  solves: SolveRow[];
  dates: SessionDateRow[];
  grades: GradeRow[];
}

type Tab = 'session' | 'summary' | 'students';

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

function Dashboard({
  sessions,
  topics,
  tests,
  email,
  onSignOut,
}: Props & { email: string; onSignOut: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('session');
  const [groupId, setGroupId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>(
    sessions.find((s) => s.checkable)?.id ?? sessions[0]?.id ?? '',
  );

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

  if (data === null) return <p class="panel__hint">Завантаження…</p>;

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
              ['session', 'Заняття'],
              ['summary', 'Зведена'],
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
        <button type="button" class="button button--secondary" onClick={() => void reload()}>
          Оновити
        </button>
        <button type="button" class="button button--secondary" onClick={onSignOut}>
          Вийти
        </button>
      </div>
      {loadError && <p class="message message--error">{loadError}</p>}

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
              tests={tests[session.id]}
              onChanged={reload}
            />
          )}
        </>
      )}
      {tab === 'summary' && (
        <SummaryTable
          sessions={sessions}
          topics={topics}
          students={students}
          grades={data.grades}
          onChanged={reload}
        />
      )}
      {tab === 'students' && (
        <StudentsPanel groupId={groupId} students={students} onChanged={reload} />
      )}
    </div>
  );
}

// ---------- Оцінки ----------

const GRADES: readonly Grade[] = [5, 4, 3, 2];

function GradeSelect({
  userId,
  item,
  grades,
  label,
  onChanged,
}: {
  userId: string;
  item: string;
  grades: GradeRow[];
  label: string;
  onChanged: () => Promise<void>;
}) {
  const current = grades.find((g) => g.user_id === userId && g.item === item)?.grade;
  const [error, setError] = useState<string | null>(null);
  const change = async (value: string) => {
    const client = await getClient();
    const { error: failed } =
      value === ''
        ? await client.from('grades').delete().match({ user_id: userId, item })
        : await client.from('grades').upsert({ user_id: userId, item, grade: Number(value) });
    setError(failed ? explain(failed) : null);
    await onChanged();
  };
  return (
    <select
      class="input cloud-grade"
      aria-label={label}
      title={error ?? undefined}
      aria-invalid={error ? 'true' : undefined}
      value={current === undefined ? '' : String(current)}
      onChange={(e) => void change(e.currentTarget.value)}
    >
      <option value="">—</option>
      {GRADES.map((g) => (
        <option key={g} value={String(g)}>
          {g}
        </option>
      ))}
    </select>
  );
}

const gradeText = (grade: Grade | null) => (grade ? `${grade} (${GRADE_LABELS[grade]})` : '—');

// ---------- Заняття ----------

function SessionTable({
  session,
  groupId,
  students,
  data,
  tests,
  onChanged,
}: {
  session: SessionMeta;
  groupId: string;
  students: StudentRow[];
  data: Data;
  tests: Record<string, string[]> | undefined;
  onChanged: () => Promise<void>;
}) {
  const dateRow = data.dates.find((d) => d.group_id === groupId && d.session === session.id);
  const sessionDate = dateRow ? localDate(dateRow.date) : null;
  const [open, setOpen] = useState<string | null>(null);

  // Однакові схеми в межах заняття й рівня — серед усіх груп.
  const twins = useMemo(() => {
    const byKey = new Map<string, SolveRow[]>();
    for (const solve of data.solves) {
      if (solve.session !== session.id) continue;
      const key = `${solve.stars}:${fingerprint(solve.program)}`;
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
  }, [data.solves, data.students, session.id]);

  const checks = useMemo(() => {
    const result = new Map<string, Recheck>();
    for (const solve of data.solves) {
      if (solve.session !== session.id) continue;
      result.set(
        `${solve.user_id}/${solve.stars}`,
        recheck(solve.program, tests?.[testsKey(solve.variant, solve.stars)]),
      );
    }
    return result;
  }, [data.solves, session.id, tests]);

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
            {students.map((student) => {
              const mine = data.solves.filter(
                (s) => s.user_id === student.user_id && s.session === session.id,
              );
              const rec = recommendGrade(
                mine
                  .filter((s) => checks.get(`${s.user_id}/${s.stars}`) !== 'fail')
                  .map((s) => ({ stars: s.stars, solvedAt: new Date(s.solved_at) })),
                sessionDate,
              );
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
                    const check = checks.get(key);
                    const twin = twins.get(key);
                    return (
                      <td key={stars}>
                        <button
                          type="button"
                          class={`cloud-solve${check === 'fail' ? ' is-failed' : ''}`}
                          aria-expanded={open === key}
                          onClick={() => setOpen(open === key ? null : key)}
                          title={
                            check === 'fail'
                              ? 'Повторна перевірка не пройдена'
                              : check === 'unknown'
                                ? 'Тестів для повторної перевірки немає'
                                : 'Повторна перевірка пройдена'
                          }
                        >
                          {check === 'fail' ? '✗' : check === 'ok' ? '✓' : '?'}{' '}
                          {formatStamp(solve.solved_at)}
                        </button>
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
                    <GradeSelect
                      userId={student.user_id}
                      item={session.id}
                      grades={data.grades}
                      label={`${student.full_name}: остаточна за ${session.label}`}
                      onChanged={onChanged}
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
          <pre>{openSolve.program}</pre>
        </div>
      )}
    </section>
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

// ---------- Зведена ----------

function SummaryTable({
  sessions,
  topics,
  students,
  grades,
  onChanged,
}: {
  sessions: SessionMeta[];
  topics: TopicMeta[];
  students: StudentRow[];
  grades: GradeRow[];
  onChanged: () => Promise<void>;
}) {
  const used = topics.filter((t) => sessions.some((s) => s.topic === t.number));
  const finalOf = (userId: string, item: string) =>
    (grades.find((g) => g.user_id === userId && g.item === item)?.grade ?? null) as Grade | null;

  return (
    <section class="panel cloud-card" aria-label="Зведена відомість">
      <p class="panel__hint">
        Тематична рекомендована — середнє остаточних оцінок занять теми; семестрова — середнє
        остаточних тематичних. Наведіть на рекомендацію, щоб побачити пояснення.
      </p>
      <div class="cloud-table">
        <table>
          <thead>
            <tr>
              <th scope="col">№</th>
              <th scope="col">Студент</th>
              {used.map((topic) => (
                <th key={topic.number} scope="col" colSpan={2}>
                  {topic.label}:{' '}
                  {sessions
                    .filter((s) => s.topic === topic.number)
                    .map((s) => s.label)
                    .join(', ')}
                </th>
              ))}
              <th scope="col" colSpan={2}>
                Семестрова
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const topicItems = used.map((topic) => {
                const rec = averageRecommendation(
                  sessions
                    .filter((s) => s.topic === topic.number)
                    .map((s) => ({ label: s.label, grade: finalOf(student.user_id, s.id) })),
                );
                return { topic, rec };
              });
              const semester = averageRecommendation(
                used.map((topic) => ({
                  label: topic.label,
                  grade: finalOf(student.user_id, `topic-${topic.number}`),
                })),
              );
              return (
                <tr key={student.user_id}>
                  <td>{student.journal}</td>
                  <th scope="row">{student.full_name}</th>
                  {topicItems.map(({ topic, rec }) => (
                    <Fragment key={topic.number}>
                      <td title={rec.reason}>
                        {rec.grade ?? '—'}
                        <span class="cloud-muted">
                          {' '}
                          (
                          {sessions
                            .filter((s) => s.topic === topic.number)
                            .map((s) => finalOf(student.user_id, s.id) ?? '·')
                            .join(' ')}
                          )
                        </span>
                      </td>
                      <td>
                        <GradeSelect
                          userId={student.user_id}
                          item={`topic-${topic.number}`}
                          grades={grades}
                          label={`${student.full_name}: остаточна за ${topic.label}`}
                          onChanged={onChanged}
                        />
                      </td>
                    </Fragment>
                  ))}
                  <td title={semester.reason}>{semester.grade ?? '—'}</td>
                  <td>
                    <GradeSelect
                      userId={student.user_id}
                      item="semester"
                      grades={grades}
                      label={`${student.full_name}: семестрова`}
                      onChanged={onChanged}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
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
