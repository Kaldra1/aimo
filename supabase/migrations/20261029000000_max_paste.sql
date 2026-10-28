-- Найбільша вставка за один раз: дрібні вставки (скопіював свій рядок) відрізняються від
-- вставленої цілої програми. null — розв'язок збережено до того, як сайт почав це рахувати.

alter table public.solves
  add column max_paste integer check (max_paste >= 0);

create or replace function public.solves_server_dates() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.solved_at := now();
  else
    new.solved_at := old.solved_at;
    new.pastes := greatest(new.pastes, old.pastes);
    new.pasted_chars := greatest(new.pasted_chars, old.pasted_chars);
    new.file_loads := greatest(new.file_loads, old.file_loads);
    new.max_paste := greatest(new.max_paste, old.max_paste);
  end if;
  new.updated_at := now();
  return new;
end;
$$;
