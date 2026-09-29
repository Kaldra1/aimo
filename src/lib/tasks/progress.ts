/**
 * Прогрес розв'язання задач. Зараз він зберігається лише в localStorage браузера студента;
 * якщо колись з'явиться серверне збереження, досить нової реалізації інтерфейсу ProgressStore.
 */

/** Розв'язані задачі: id задачі → дата розв'язання (ISO 8601). */
export interface TaskProgress {
  readonly solved: Readonly<Record<string, string>>;
}

export interface ProgressStore {
  get(): TaskProgress;
  /** Позначає задачу розв'язаною. Дата першого розв'язання не змінюється. */
  markSolved(taskId: string): void;
  /** Прогрес у вигляді JSON-файлу для перенесення на інший комп'ютер. */
  export(): string;
  /**
   * Додає прогрес із файлу до наявного (нічого не втрачається). Повертає кількість
   * задач, що стали розв'язаними. Некоректний файл — помилка з поясненням українською.
   */
  import(json: string): number;
}

export const PROGRESS_KEY = 'aimo:progress';
const FORMAT = 'aimo-progress';
const VERSION = 1;

const EMPTY: TaskProgress = { solved: {} };

/** Сховище з тим самим інтерфейсом, що й localStorage (у тестах — підробка). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Читає й перевіряє файл прогресу. */
export function parseProgress(json: string): TaskProgress {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Файл пошкоджений або це не JSON.');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('У файлі немає прогресу задач.');
  }
  const record = data as Record<string, unknown>;
  if (record.format !== FORMAT) throw new Error('Це не файл прогресу задач цього сайту.');
  if (typeof record.version !== 'number' || record.version > VERSION) {
    throw new Error('Файл створено новішою версією сайту. Оновіть сторінку.');
  }
  const solved = record.solved;
  if (typeof solved !== 'object' || solved === null || Array.isArray(solved)) {
    throw new Error('У файлі немає переліку розв’язаних задач.');
  }
  const result: Record<string, string> = {};
  for (const [id, date] of Object.entries(solved)) {
    if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) {
      throw new Error(`Задача «${id}»: незрозуміла дата розв’язання.`);
    }
    result[id] = date;
  }
  return { solved: result };
}

export function serializeProgress(progress: TaskProgress): string {
  return `${JSON.stringify({ format: FORMAT, version: VERSION, solved: progress.solved }, null, 2)}\n`;
}

/** Об'єднує два записи прогресу; для задачі, розв'язаної в обох, лишається раніша дата. */
export function mergeProgress(base: TaskProgress, extra: TaskProgress): TaskProgress {
  const solved: Record<string, string> = { ...base.solved };
  for (const [id, date] of Object.entries(extra.solved)) {
    const current = solved[id];
    if (current === undefined || Date.parse(date) < Date.parse(current)) solved[id] = date;
  }
  return { solved };
}

export class LocalProgressStore implements ProgressStore {
  constructor(
    private readonly storage: KeyValueStorage | null = browserStorage(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  get(): TaskProgress {
    const text = this.read();
    if (text === null) return EMPTY;
    try {
      return parseProgress(text);
    } catch {
      return EMPTY; // пошкоджений запис не повинен ламати сторінку
    }
  }

  markSolved(taskId: string): void {
    const progress = this.get();
    if (progress.solved[taskId] !== undefined) return;
    this.write({ solved: { ...progress.solved, [taskId]: this.now().toISOString() } });
  }

  export(): string {
    return serializeProgress(this.get());
  }

  import(json: string): number {
    const incoming = parseProgress(json);
    const current = this.get();
    const merged = mergeProgress(current, incoming);
    this.write(merged);
    return Object.keys(merged.solved).length - Object.keys(current.solved).length;
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(PROGRESS_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private write(progress: TaskProgress): void {
    try {
      this.storage?.setItem(PROGRESS_KEY, serializeProgress(progress));
    } catch {
      // Сховище недоступне (приватний режим, заборона сайту) — прогрес просто не збережеться.
    }
  }
}

/** localStorage, якщо він доступний (у приватному режимі чи з вимкненим сховищем — ні). */
function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
