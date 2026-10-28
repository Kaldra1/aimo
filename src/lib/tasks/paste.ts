/**
 * Скільки разів у редактор програми вставляли готовий текст (Ctrl+V, меню, перетягування)
 * і завантажували програму з файлу. Студентові не показується: лічильники йдуть разом із
 * розв’язком у базу, і викладач бачить їх у дашборді.
 * Поля вхідних даних, алфавіту й коментаря не рахуються — це не код.
 */
import { readStorage, writeStorage } from '../../components/emulator/support';

export interface PasteStats {
  /** Скільки разів вставляли текст у програму. */
  pastes: number;
  /** Скільки символів вставили загалом. */
  chars: number;
  /** Скільки разів завантажували програму з файлу. */
  files: number;
}

const EMPTY: PasteStats = { pastes: 0, chars: 0, files: 0 };
const key = (taskId: string) => `aimo:task-meta:${taskId}`;
const NOT_CODE = /-(input|alphabet|comment)$/;

export function pasteStats(taskId: string): PasteStats {
  try {
    const value = JSON.parse(readStorage(key(taskId)) ?? 'null') as Partial<PasteStats> | null;
    if (!value) return { ...EMPTY };
    const n = (x: unknown) => (typeof x === 'number' && x >= 0 ? Math.floor(x) : 0);
    return { pastes: n(value.pastes), chars: n(value.chars), files: n(value.files) };
  } catch {
    return { ...EMPTY };
  }
}

function add(taskId: string, change: Partial<PasteStats>) {
  const stats = pasteStats(taskId);
  writeStorage(
    key(taskId),
    JSON.stringify({
      pastes: stats.pastes + (change.pastes ?? 0),
      chars: stats.chars + (change.chars ?? 0),
      files: stats.files + (change.files ?? 0),
    }),
  );
}

const isCode = (target: EventTarget | null) =>
  !(target instanceof HTMLElement && NOT_CODE.test(target.id));

/** Слухає вставки в межах root; повертає функцію, що знімає слухачів. */
export function trackPastes(root: HTMLElement, taskId: string): () => void {
  const onPaste = (event: ClipboardEvent) => {
    if (!isCode(event.target)) return;
    const text = event.clipboardData?.getData('text') ?? '';
    if (text) add(taskId, { pastes: 1, chars: text.length });
  };
  const onDrop = (event: DragEvent) => {
    if (!isCode(event.target)) return;
    const text = event.dataTransfer?.getData('text') ?? '';
    if (text) add(taskId, { pastes: 1, chars: text.length });
  };
  const onChange = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'file' && target.files?.length) {
      add(taskId, { files: 1 });
    }
  };
  root.addEventListener('paste', onPaste, true);
  root.addEventListener('drop', onDrop, true);
  root.addEventListener('change', onChange, true);
  return () => {
    root.removeEventListener('paste', onPaste, true);
    root.removeEventListener('drop', onDrop, true);
    root.removeEventListener('change', onChange, true);
  };
}
