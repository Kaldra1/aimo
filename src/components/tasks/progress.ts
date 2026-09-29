/** Прогрес задач в островах: читання після завантаження сторінки й оновлення між вкладками. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  LocalProgressStore,
  PROGRESS_KEY,
  type ProgressStore,
  type TaskProgress,
} from '../../lib/tasks/progress';

/** Подія, якою острови на одній сторінці повідомляють одне одному про зміну прогресу. */
const PROGRESS_EVENT = 'aimo:progress';

export function notifyProgress(): void {
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

/**
 * Прогрес із localStorage. До завантаження сторінки в браузері (і під час збирання сайту)
 * прогрес невідомий — null, щоб не показувати «0 розв’язано» замість справжнього значення.
 */
export function useProgress(): { progress: TaskProgress | null; store: ProgressStore } {
  const store = useMemo(() => new LocalProgressStore(), []);
  const [progress, setProgress] = useState<TaskProgress | null>(null);

  useEffect(() => {
    const refresh = () => setProgress(store.get());
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROGRESS_KEY || event.key === null) refresh();
    };
    refresh();
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [store]);

  return { progress, store };
}
