// Edge Function: створення акаунтів студентів і скидання паролів. Лише для викладача.
// Ключ service_role є тільки тут, на сервері Supabase; у браузер він не потрапляє.
//
// POST { action: 'import', group: 'ki2406', students: [{ journal: 7, fullName: '…' }] }
//   → { created: [{ login, password, fullName }], skipped: [{ journal, reason }] }
// POST { action: 'reset', userId: '…' } → { login, password }
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

/** Технічна пошта акаунта: студент входить за логіном, сайт сам дописує домен. */
const LOGIN_DOMAIN = 'students.aimo.invalid';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

// Без схожих символів (0/O, 1/l/I), щоб пароль легко переписати з папірця.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
function password(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const loginOf = (group: string, journal: number) => `${group}-${String(journal).padStart(2, '0')}`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Лише POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Хто викликає: перевіряємо токен і чи є користувач у таблиці викладачів.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller.user) return json({ error: 'Потрібен вхід' }, 401);
  const { data: teacher } = await admin
    .from('teachers')
    .select('user_id')
    .eq('user_id', caller.user.id)
    .maybeSingle();
  if (!teacher) return json({ error: 'Лише для викладача' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Тіло запиту — не JSON' }, 400);
  }

  if (body.action === 'import') {
    const group = String(body.group ?? '');
    const { data: known } = await admin.from('groups').select('id').eq('id', group).maybeSingle();
    if (!known) return json({ error: `Групи «${group}» немає` }, 400);
    const list = Array.isArray(body.students) ? body.students : [];
    const created: { login: string; password: string; fullName: string }[] = [];
    const skipped: { journal: unknown; reason: string }[] = [];

    for (const item of list) {
      const journal = Number((item as Record<string, unknown>).journal);
      const fullName = String((item as Record<string, unknown>).fullName ?? '').trim();
      if (!Number.isInteger(journal) || journal < 1 || journal > 99 || fullName === '') {
        skipped.push({ journal, reason: 'немає номера або ПІБ' });
        continue;
      }
      const login = loginOf(group, journal);
      const { data: existing } = await admin
        .from('students')
        .select('user_id')
        .eq('login', login)
        .maybeSingle();
      if (existing) {
        skipped.push({ journal, reason: `${login} уже є` });
        continue;
      }
      const secret = password();
      const { data: user, error } = await admin.auth.admin.createUser({
        email: `${login}@${LOGIN_DOMAIN}`,
        password: secret,
        email_confirm: true,
      });
      if (error || !user.user) {
        skipped.push({ journal, reason: error?.message ?? 'не вдалося створити акаунт' });
        continue;
      }
      const { error: insertError } = await admin.from('students').insert({
        user_id: user.user.id,
        login,
        group_id: group,
        journal,
        full_name: fullName,
      });
      if (insertError) {
        await admin.auth.admin.deleteUser(user.user.id);
        skipped.push({ journal, reason: insertError.message });
        continue;
      }
      created.push({ login, password: secret, fullName });
    }
    return json({ created, skipped });
  }

  if (body.action === 'reset') {
    const userId = String(body.userId ?? '');
    const { data: student } = await admin
      .from('students')
      .select('login')
      .eq('user_id', userId)
      .maybeSingle();
    if (!student) return json({ error: 'Студента не знайдено' }, 404);
    const secret = password();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: secret });
    if (error) return json({ error: error.message }, 500);
    return json({ login: student.login, password: secret });
  }

  return json({ error: 'Невідома дія' }, 400);
});
