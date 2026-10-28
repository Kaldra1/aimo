-- Вставки готового тексту в редактор програми: скільки разів вставляли (Ctrl+V, меню,
-- перетягування), скільки символів і скільки разів завантажували програму з файлу.
-- Рахує сайт; студент їх не бачить, викладач — у дашборді.

alter table public.solves
  add column pastes integer not null default 0 check (pastes >= 0),
  add column pasted_chars integer not null default 0 check (pasted_chars >= 0),
  add column file_loads integer not null default 0 check (file_loads >= 0);

-- Лічильники лише ростуть: повторне збереження без вставок не стирає вже записані.
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
  end if;
  new.updated_at := now();
  return new;
end;
$$;
