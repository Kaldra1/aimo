/** Кабінет студента: вхід, пошта й пароль, розв’язані завдання з датами й оцінки. */
import { useCallback, useEffect, useState } from 'preact/hooks';
import { explain, getClient } from '../../lib/cloud/client';
import { parseVariantTaskId, programFromSaved, programText } from '../../lib/cloud/solutions';
import {
  formatStamp,
  localDate,
  type GradeRow,
  type SessionDateRow,
  type SessionMeta,
  type SolveRow,
} from '../../lib/cloud/types';
import { GRADE_LABELS, type Grade } from '../../lib/grading/grade';
import { JOURNAL_TOPICS, SEMESTER_ITEM } from '../../lib/grading/journal';
import { LocalProgressStore } from '../../lib/tasks/progress';
import { taskStorageKey } from '../../lib/tasks/meta';
import { url } from '../../lib/url';
import { variantTaskPath } from '../../lib/variants/ids';
import { readStorage } from '../emulator/support';
import LoginForm from './LoginForm';
import { useAuth } from './useAuth';
import type { Profile } from '../../lib/cloud/client';

interface Props {
  sessions: SessionMeta[];
}

export default function Cabinet({ sessions }: Props) {
  const { state, error, signIn, signOut } = useAuth();

  if (state.status === 'disabled') {
    return (
      <p class="message message--warning">
        Вхід на сайт ще не налаштовано. Поки що розв’язки зберігаються лише у вашому браузері.
      </p>
    );
  }
  if (state.status === 'loading') return <p class="panel__hint">Завантаження…</p>;
  if (state.status === 'signed-out') {
    return (
      <LoginForm
        onSubmit={signIn}
        error={error}
        hint="Логін і пароль видає викладач. Логін — група й номер у журналі, наприклад ki2406-07."
      />
    );
  }
  const { profile } = state;
  if (!profile.student) {
    return (
      <div class="panel cloud-card">
        <p>
          Ви увійшли як {state.session.user.email}.{' '}
          {profile.teacher ? (
            <a href={url('/teacher/')}>Перейти до дашборду викладача</a>
          ) : (
            'Цей акаунт не прив’язано до студента.'
          )}
        </p>
        <button type="button" class="button button--secondary" onClick={signOut}>
          Вийти
        </button>
      </div>
    );
  }
  return <StudentView profile={profile} sessions={sessions} onSignOut={signOut} />;
}

function StudentView({
  profile,
  sessions,
  onSignOut,
}: {
  profile: Profile;
  sessions: SessionMeta[];
  onSignOut: () => void;
}) {
  const student = profile.student!;
  const [solves, setSolves] = useState<SolveRow[] | null>(null);
  const [dates, setDates] = useState<SessionDateRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState(student.email);

  const reload = useCallback(async () => {
    const client = await getClient();
    const [s, d, g] = await Promise.all([
      client.from('solves').select('*').eq('user_id', profile.userId),
      client.from('session_dates').select('*').eq('group_id', student.groupId),
      client.from('grades').select('*').eq('user_id', profile.userId),
    ]);
    const failed = s.error ?? d.error ?? g.error;
    if (failed) setLoadError(explain(failed));
    setSolves((s.data ?? []) as SolveRow[]);
    setDates((d.data ?? []) as SessionDateRow[]);
    setGrades((g.data ?? []) as GradeRow[]);
  }, [profile.userId, student.groupId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div class="cloud-stack">
      <section class="panel cloud-card" aria-labelledby="me-title">
        <div class="panel__header">
          <h2 id="me-title" class="panel__title">
            {student.fullName}
          </h2>
          <button type="button" class="button button--secondary" onClick={onSignOut}>
            Вийти
          </button>
        </div>
        <p>
          Логін <code>{profile.login}</code> · ваш варіант — <strong>{student.journal}</strong>
        </p>
      </section>

      <AccountSettings email={email} onEmail={setEmail} />

      <section class="panel cloud-card" aria-labelledby="solves-title">
        <div class="panel__header">
          <h2 id="solves-title" class="panel__title">
            Індивідуальні завдання
          </h2>
          <LocalImport
            journal={student.journal}
            sessions={sessions}
            solves={solves}
            onDone={reload}
          />
        </div>
        {loadError && <p class="message message--error">{loadError}</p>}
        {solves === null ? (
          <p class="panel__hint">Завантаження…</p>
        ) : (
          <SolvesTable
            sessions={sessions}
            journal={student.journal}
            solves={solves}
            dates={dates}
            grades={grades}
          />
        )}
      </section>
    </div>
  );
}

function AccountSettings({
  email,
  onEmail,
}: {
  email: string | null;
  onEmail: (email: string) => void;
}) {
  const [draft, setDraft] = useState(email ?? '');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ text: await action(), error: false });
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const saveEmail = (event: Event) => {
    event.preventDefault();
    void run(async () => {
      const client = await getClient();
      const { error } = await client.rpc('set_my_email', { new_email: draft });
      if (error) throw new Error(explain(error));
      onEmail(draft.trim().toLowerCase());
      return 'Пошту збережено.';
    });
  };

  const savePassword = (event: Event) => {
    event.preventDefault();
    void run(async () => {
      if (password.length < 8) throw new Error('Пароль має бути щонайменше з 8 символів.');
      if (password !== repeat) throw new Error('Паролі не збігаються.');
      const client = await getClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(explain(error));
      setPassword('');
      setRepeat('');
      return 'Пароль змінено.';
    });
  };

  return (
    <section class="panel cloud-card" aria-labelledby="account-title">
      <h2 id="account-title" class="panel__title">
        Пошта й пароль
      </h2>
      <form class="cloud-row" onSubmit={saveEmail}>
        <label class="field">
          <span class="field__label">Пошта</span>
          <input
            class="input"
            type="email"
            autocomplete="email"
            required
            value={draft}
            onInput={(e) => setDraft(e.currentTarget.value)}
          />
        </label>
        <button type="submit" class="button button--secondary" disabled={busy}>
          Зберегти пошту
        </button>
      </form>
      {email ? (
        <form class="cloud-row" onSubmit={savePassword}>
          <label class="field">
            <span class="field__label">Новий пароль</span>
            <input
              class="input"
              type="password"
              autocomplete="new-password"
              required
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </label>
          <label class="field">
            <span class="field__label">Ще раз</span>
            <input
              class="input"
              type="password"
              autocomplete="new-password"
              required
              value={repeat}
              onInput={(e) => setRepeat(e.currentTarget.value)}
            />
          </label>
          <button type="submit" class="button button--secondary" disabled={busy}>
            Змінити пароль
          </button>
        </form>
      ) : (
        <p class="panel__hint">
          Щоб змінити пароль, спершу вкажіть свою пошту: через неї можна буде відновити доступ.
        </p>
      )}
      {message && (
        <p class={`message${message.error ? ' message--error' : ''}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}

/** Розв'язки свого варіанта, зроблені в цьому браузері до входу, — у базу. */
function LocalImport({
  journal,
  sessions,
  solves,
  onDone,
}: {
  journal: number;
  sessions: SessionMeta[];
  solves: SolveRow[] | null;
  onDone: () => Promise<void>;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<{ taskId: string; program: string }[]>([]);

  useEffect(() => {
    if (solves === null) return;
    const known = new Set(solves.map((s) => s.task_id));
    const local = Object.keys(new LocalProgressStore().get().solved);
    setPending(
      local.flatMap((taskId) => {
        const ref = parseVariantTaskId(taskId);
        if (!ref || ref.variant !== journal || known.has(taskId)) return [];
        const saved = readStorage(taskStorageKey(taskId));
        if (saved === null) return [];
        const machine = sessions.find((s) => s.id === ref.session)?.machine;
        if (!machine) return [];
        const program = programFromSaved(machine, saved);
        return program ? [{ taskId, program: programText(machine, program) }] : [];
      }),
    );
  }, [solves, journal, sessions]);

  if (pending.length === 0) return status ? <span class="panel__hint">{status}</span> : null;

  const upload = async () => {
    const client = await getClient();
    const { data } = await client.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    const { error } = await client
      .from('solves')
      .upsert(pending.map((p) => ({ user_id: userId, task_id: p.taskId, program: p.program })));
    setStatus(error ? explain(error) : 'Надіслано.');
    await onDone();
  };

  return (
    <button type="button" class="button button--primary" onClick={upload}>
      Надіслати розв’язки з цього браузера ({pending.length})
    </button>
  );
}

function SolvesTable({
  sessions,
  journal,
  solves,
  dates,
  grades,
}: {
  sessions: SessionMeta[];
  journal: number;
  solves: SolveRow[];
  dates: SessionDateRow[];
  grades: GradeRow[];
}) {
  // Лише оцінки, які викладач підтвердив у дашборді (чернетки в базу не потрапляють).
  const gradeOf = (item: string) => grades.find((g) => g.item === item)?.grade as Grade | undefined;
  const gradeText = (grade: Grade | undefined) =>
    grade ? `${grade} (${GRADE_LABELS[grade]})` : '—';
  const shown = sessions.filter(
    (s) => s.checkable || solves.some((x) => x.session === s.id) || gradeOf(s.id) !== undefined,
  );
  const labelOf = (id: string) => sessions.find((s) => s.id === id)?.label ?? id;
  return (
    <>
      {shown.length === 0 ? (
        <p class="panel__hint">Поки немає занять з автоперевіркою чи оцінками.</p>
      ) : (
        <div class="cloud-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Заняття</th>
                <th scope="col">★</th>
                <th scope="col">★★</th>
                <th scope="col">★★★</th>
                <th scope="col">Оцінка</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((session) => {
                const mine = solves.filter((s) => s.session === session.id);
                const date = dates.find((d) => d.session === session.id)?.date;
                return (
                  <tr key={session.id}>
                    <th scope="row">
                      {session.label}
                      {date && (
                        <span class="cloud-muted">
                          {' '}
                          · {localDate(date).toLocaleDateString('uk-UA')}
                        </span>
                      )}
                    </th>
                    {([1, 2, 3] as const).map((stars) => {
                      const solve = mine.find((s) => s.stars === stars);
                      return (
                        <td key={stars}>
                          {solve ? (
                            <span class="cloud-ok">✓ {formatStamp(solve.solved_at)}</span>
                          ) : session.checkable ? (
                            <a href={url(variantTaskPath(session.id, journal, stars))}>Виконати</a>
                          ) : (
                            '—'
                          )}
                        </td>
                      );
                    })}
                    <td>{gradeText(gradeOf(session.id))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 class="cloud-subtitle">Тематичні й семестрова оцінки</h3>
      <div class="cloud-table">
        <table>
          <tbody>
            {JOURNAL_TOPICS.map((topic) => (
              <tr key={topic.item}>
                <th scope="row">
                  {topic.label}
                  <span class="cloud-muted"> · {topic.sessions.map(labelOf).join(', ')}</span>
                </th>
                <td>{gradeText(gradeOf(topic.item))}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Семестрова</th>
              <td>{gradeText(gradeOf(SEMESTER_ITEM))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="panel__hint">
        Тут лише оцінки, які викладач уже виставив. Порожньо («—») — оцінки ще немає.
      </p>
    </>
  );
}
