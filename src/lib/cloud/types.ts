/** Дані з бази й опис занять, які сторінки передають островам кабінету й дашборду. */

/** Заняття курсу (лабораторна чи практична) — з контенту сайту. */
export interface SessionMeta {
  /** practical-02 */
  id: string;
  /** ПР-2 */
  label: string;
  title: string;
  topic: number;
  /** Чи є автоперевірка варіантів (розв'язки збираються в базу). */
  checkable: boolean;
  /** Машина, на якій розв'язують варіанти з автоперевіркою. */
  machine?: 'post' | 'turing' | 'markov' | 'flowchart' | undefined;
}

export interface SolveRow {
  user_id: string;
  task_id: string;
  session: string;
  variant: number;
  stars: 1 | 2 | 3;
  program: string;
  solved_at: string;
  updated_at: string;
}

export interface StudentRow {
  user_id: string;
  login: string;
  group_id: string;
  journal: number;
  full_name: string;
  email: string | null;
}

export interface GroupRow {
  id: string;
  title: string;
}

export interface SessionDateRow {
  group_id: string;
  session: string;
  date: string;
}

export interface GradeRow {
  user_id: string;
  item: string;
  grade: 2 | 3 | 4 | 5;
}

/** Місцева дата з рядка YYYY-MM-DD (без зсуву часового поясу). */
export function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

const dateFormat = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatStamp = (iso: string) => dateFormat.format(new Date(iso));
