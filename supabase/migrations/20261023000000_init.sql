-- АІМО: вхід студентів і дашборд викладача.
-- Акаунти створює викладач (функція admin-students); самостійної реєстрації немає.
-- ПІБ і пошта студентів живуть лише тут, під RLS: студент бачить себе, викладач — усіх.

-- ---------- Ролі ----------

create table public.teachers (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.teachers enable row level security;

create function public.is_teacher() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.teachers where user_id = auth.uid());
$$;

create policy "teacher sees self" on public.teachers
  for select to authenticated using (user_id = auth.uid());

-- ---------- Групи й студенти ----------

create table public.groups (
  id text primary key check (id ~ '^[a-z]+[0-9]+$'), -- ki2406
  title text not null                                 -- КІ-2406
);

alter table public.groups enable row level security;

create policy "groups readable" on public.groups
  for select to authenticated using (true);
create policy "teacher manages groups" on public.groups
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create table public.students (
  user_id uuid primary key references auth.users (id) on delete cascade,
  login text not null unique check (login ~ '^[a-z]+[0-9]+-[0-9]{2}$'), -- ki2406-07
  group_id text not null references public.groups (id),
  journal smallint not null check (journal between 1 and 99),        -- № у журналі = варіант
  full_name text not null,
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  unique (group_id, journal)
);

alter table public.students enable row level security;

create policy "student sees self" on public.students
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());
create policy "teacher manages students" on public.students
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- Студент сам може змінити лише свою пошту.
create function public.set_my_email(new_email text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if new_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Некоректна адреса пошти';
  end if;
  update public.students set email = lower(trim(new_email)) where user_id = auth.uid();
  if not found then
    raise exception 'Ви не студент курсу';
  end if;
end;
$$;

revoke all on function public.set_my_email(text) from public, anon;
grant execute on function public.set_my_email(text) to authenticated;

-- ---------- Розв'язки ----------

-- task_id — як на сайті: practical-02/v7/2 (заняття, варіант, кількість зірок).
create table public.solves (
  user_id uuid not null references public.students (user_id) on delete cascade,
  task_id text not null check (task_id ~ '^[a-z]+-[0-9]{2}/v[0-9]{1,2}/[1-3]$'),
  session text generated always as (split_part(task_id, '/', 1)) stored,
  variant smallint generated always as (substring(split_part(task_id, '/', 2) from 2)::smallint) stored,
  stars smallint generated always as (split_part(task_id, '/', 3)::smallint) stored,
  program text not null check (length(program) <= 20000),
  solved_at timestamptz not null default now(),  -- перше розв'язання, ставить сервер
  updated_at timestamptz not null default now(), -- остання збережена схема
  primary key (user_id, task_id)
);

alter table public.solves enable row level security;

-- Дати ставить сервер: студент не може «підкрутити» термін.
create function public.solves_server_dates() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.solved_at := now();
  else
    new.solved_at := old.solved_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger solves_server_dates before insert or update on public.solves
  for each row execute function public.solves_server_dates();

create policy "solves readable" on public.solves
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());

-- Студент записує лише свої розв'язки й лише свого варіанта.
create policy "student inserts own variant" on public.solves
  for insert to authenticated with check (
    user_id = auth.uid()
    and variant = (select journal from public.students where user_id = auth.uid())
  );
create policy "student updates own variant" on public.solves
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and variant = (select journal from public.students where user_id = auth.uid())
  );
create policy "teacher deletes solves" on public.solves
  for delete to authenticated using (public.is_teacher());

-- ---------- Дати занять і оцінки ----------

-- Дати різні для груп: від них рахуються терміни рекомендованої оцінки.
create table public.session_dates (
  group_id text not null references public.groups (id) on delete cascade,
  session text not null check (session ~ '^[a-z]+-[0-9]{2}$'),
  date date not null,
  primary key (group_id, session)
);

alter table public.session_dates enable row level security;

create policy "dates readable" on public.session_dates
  for select to authenticated using (true);
create policy "teacher manages dates" on public.session_dates
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- Остаточні оцінки викладача. item: practical-02 (заняття), topic-2 (тема), semester.
create table public.grades (
  user_id uuid not null references public.students (user_id) on delete cascade,
  item text not null check (item ~ '^([a-z]+-[0-9]{2}|topic-[0-9]+|semester)$'),
  grade smallint not null check (grade between 2 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, item)
);

alter table public.grades enable row level security;

create policy "grades readable" on public.grades
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());
create policy "teacher manages grades" on public.grades
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- ---------- Пінг проти паузи безкоштовного проєкту ----------

create function public.ping() returns text
language sql stable
as $$ select 'ok'::text $$;

grant execute on function public.ping() to anon;

-- ---------- Початкові дані ----------

insert into public.groups (id, title) values
  ('ki2406', 'КІ-2406'),
  ('ki2407', 'КІ-2407'),
  ('ki2408', 'КІ-2408');

insert into public.session_dates (group_id, session, date) values
  ('ki2406', 'lab-01', '2026-09-09'), ('ki2407', 'lab-01', '2026-09-11'), ('ki2408', 'lab-01', '2026-09-11'),
  ('ki2406', 'lab-02', '2026-09-23'), ('ki2407', 'lab-02', '2026-09-25'), ('ki2408', 'lab-02', '2026-09-25'),
  ('ki2406', 'practical-01', '2026-10-07'), ('ki2407', 'practical-01', '2026-10-09'), ('ki2408', 'practical-01', '2026-10-09');
