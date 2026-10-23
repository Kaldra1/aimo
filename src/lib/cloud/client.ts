/**
 * Підключення до Supabase. Ключ publishable публічний за призначенням: доступ до даних
 * обмежують правила RLS у базі (supabase/migrations). Для іншого проєкту адресу й ключ можна
 * підмінити під час збирання (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY); порожні значення
 * вимикають вхід — тоді прогрес лише в браузері. Бібліотека завантажується, коли потрібна.
 */
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { loginFromEmail } from './accounts';

const URL =
  (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) ??
  'https://jftlshycidftaihgbnvr.supabase.co';
const KEY =
  (import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined) ??
  'sb_publishable_fPm1kFWr9U-V67adtRAvaA_sklR4TZx';

export const cloudEnabled = Boolean(URL && KEY);

let clientPromise: Promise<SupabaseClient> | null = null;

export function getClient(): Promise<SupabaseClient> {
  if (!cloudEnabled) return Promise.reject(new Error('Вхід на сайт ще не налаштовано.'));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'aimo:auth' },
    }),
  );
  return clientPromise;
}

/** Чи є збережений вхід — без завантаження бібліотеки (для сторінок задач). */
export function hasStoredSession(): boolean {
  if (!cloudEnabled) return false;
  try {
    return window.localStorage.getItem('aimo:auth') !== null;
  } catch {
    return false;
  }
}

export interface Profile {
  userId: string;
  /** Логін студента (ki2406-07) або null для викладача. */
  login: string | null;
  teacher: boolean;
  student: {
    groupId: string;
    journal: number;
    fullName: string;
    email: string | null;
  } | null;
}

export async function loadProfile(session: Session): Promise<Profile> {
  const client = await getClient();
  const userId = session.user.id;
  const [teacher, student] = await Promise.all([
    client.from('teachers').select('user_id').eq('user_id', userId).maybeSingle(),
    client
      .from('students')
      .select('group_id, journal, full_name, email')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  const row = student.data as {
    group_id: string;
    journal: number;
    full_name: string;
    email: string | null;
  } | null;
  return {
    userId,
    login: loginFromEmail(session.user.email),
    teacher: teacher.data !== null,
    student: row && {
      groupId: row.group_id,
      journal: row.journal,
      fullName: row.full_name,
      email: row.email,
    },
  };
}

/** Повідомлення Supabase → зрозуміле студентові. */
export function explain(error: { message: string } | null | undefined): string {
  const message = error?.message ?? '';
  if (/invalid login credentials/i.test(message)) return 'Неправильний логін або пароль.';
  if (/password should be at least/i.test(message)) return 'Пароль закороткий.';
  if (/same.*password|different from the old/i.test(message)) {
    return 'Новий пароль має відрізнятися від старого.';
  }
  if (/fetch|network/i.test(message)) return 'Немає зв’язку з сервером. Спробуйте ще раз.';
  if (/row-level security/i.test(message)) return 'Немає доступу.';
  return message || 'Щось пішло не так.';
}

/** Зберігає розв'язок, якщо студент увійшов. Тихо нічого не робить, якщо ні. */
export async function saveSolve(
  taskId: string,
  program: string,
): Promise<'saved' | 'skipped' | 'foreign'> {
  if (!hasStoredSession()) return 'skipped';
  const client = await getClient();
  const { data } = await client.auth.getSession();
  if (!data.session) return 'skipped';
  const { error } = await client
    .from('solves')
    .upsert({ user_id: data.session.user.id, task_id: taskId, program });
  // RLS не пускає чужий варіант: розв'язувати можна, але в кабінет він не потрапляє.
  if (error && /row-level security/i.test(error.message)) return 'foreign';
  if (error) throw new Error(explain(error));
  return 'saved';
}
