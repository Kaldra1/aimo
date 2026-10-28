# Supabase: вхід студентів і дашборд викладача

Проєкт `aimo` (регіон Europe), адреса `https://jftlshycidftaihgbnvr.supabase.co`.
Сайт знає лише адресу й публічний ключ publishable — вони в `src/lib/cloud/client.ts`.
Ключ `service_role` і пароль бази нікуди в репозиторій не потрапляють.

## Перше налаштування

1. **Схема бази.** Dashboard → SQL Editor → New query → вставити весь
   `migrations/20261023000000_init.sql` → Run.
2. **Заборонити самостійну реєстрацію.** Authentication → Sign In / Providers →
   вимкнути «Allow new users to sign up». Акаунти студентів створює дашборд.
3. **Функція акаунтів.** Edge Functions → Deploy a new function → Via Editor →
   назва `admin-students`, вставити `functions/admin-students/index.ts` → Deploy.
   Або з терміналу: `npx supabase login`, потім
   `npx supabase functions deploy admin-students --project-ref jftlshycidftaihgbnvr --use-api`.
4. **Акаунт викладача.** Authentication → Users → Add user → Create new user: своя пошта й
   пароль, «Auto Confirm User». Потім у SQL Editor:

   ```sql
   insert into public.teachers (user_id)
   select id from auth.users where email = 'kaldra1@gmail.com';
   ```

5. Увійти на `/teacher/`, вкладка «Студенти»: вибрати групу, вставити з таблиці стовпці
   «№» і «ПІБ», «Створити акаунти», завантажити CSV з паролями.

## Як це влаштовано

- Студент входить за логіном `ki2406-07`; сайт перетворює його на технічну пошту
  `ki2406-07@students.aimo.invalid`. Справжню пошту студент вказує в кабінеті — без неї
  змінити пароль не можна.
- Розв'язок записується в `solves`, коли студент пройшов перевірку свого варіанта.
  Дату ставить сервер; чужі варіанти RLS не пускає.
- Дашборд повторно перевіряє збережені схеми на тестах, підсвічує однакові схеми й рахує
  рекомендовані оцінки (`src/lib/grading/grade.ts`). Остаточні ставить викладач.
- `.github/workflows/keep-alive.yml` пінгує базу двічі на тиждень, щоб безкоштовний проєкт
  не ставав на паузу.

## Оновлення схеми

Нові міграції застосовуються так само: SQL Editor → New query → вставити файл → Run.

- `migrations/20261028000000_paste_tracking.sql` — лічильники вставок готового тексту в
  редактор (Ctrl+V, перетягування) і завантажень програми з файлу. До застосування сайт
  зберігає розв'язки як раніше, просто без лічильників.
