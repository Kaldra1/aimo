/**
 * Траєкторії простих сортувань для візуалізатора: кожен крок — знімок масиву, що відбулося,
 * рядок коду з лекції 11 і лічильники. Траєкторію будуємо наперед: так можна крокувати й назад.
 * Лічильники рахуються так само, як у лекції 11: бульбашка й вибір — порівняння й обміни,
 * вставки — порівняння (зокрема те, що завершує цикл) і зсуви.
 */

export type SortAlgorithm = 'bubble' | 'selection' | 'insertion';

export type StepKind =
  | 'start'
  | 'compare'
  | 'swap'
  | 'no-swap'
  | 'new-min'
  | 'take'
  | 'shift'
  | 'place'
  | 'pass-end'
  | 'done';

export interface SortStep {
  kind: StepKind;
  /** Масив після кроку; null — «дірка», з якої вставки підняли ключ. */
  array: (number | null)[];
  /** Індекси, які підсвічувати як активні (порівняння, обмін, зсув). */
  active: number[];
  /** Уже відсортовані позиції. */
  sorted: number[];
  /** Вибір: поточний мінімум. */
  min: number | null;
  /** Вставки: піднятий ключ і місце над масивом, де він «висить». */
  key: { value: number; at: number } | null;
  /** Рядок коду з лекції 11 (від 1). */
  line: number;
  comparisons: number;
  moves: number;
  /** Пояснення українською. */
  text: string;
}

export const ALGORITHMS: Record<SortAlgorithm, { title: string; moves: string; code: string }> = {
  bubble: {
    title: 'Бульбашкою',
    moves: 'Обмінів',
    code: `void bubbleSort(vector<int>& a) {
    int n = a.size();
    for (int pass = 0; pass < n - 1; pass++) {
        bool swapped = false;
        for (int j = 0; j < n - 1 - pass; j++) {
            if (a[j] > a[j + 1]) {
                swap(a[j], a[j + 1]);
                swapped = true;
            }
        }
        if (!swapped) break;    // обмінів не було — масив відсортовано
    }
}`,
  },
  selection: {
    title: 'Вибором',
    moves: 'Обмінів',
    code: `void selectionSort(vector<int>& a) {
    int n = a.size();
    for (int i = 0; i < n - 1; i++) {
        int minIndex = i;
        for (int j = i + 1; j < n; j++) {
            if (a[j] < a[minIndex]) minIndex = j;
        }
        if (minIndex != i) swap(a[i], a[minIndex]);
    }
}`,
  },
  insertion: {
    title: 'Вставками',
    moves: 'Зсувів',
    code: `void insertionSort(vector<int>& a) {
    int n = a.size();
    for (int i = 1; i < n; i++) {
        int key = a[i];
        int j = i - 1;
        while (j >= 0 && a[j] > key) {
            a[j + 1] = a[j];    // зсуваємо більший елемент праворуч
            j--;
        }
        a[j + 1] = key;         // вставляємо на звільнене місце
    }
}`,
  },
};

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

class Recorder {
  readonly steps: SortStep[] = [];
  comparisons = 0;
  moves = 0;
  sorted = new Set<number>();
  constructor(public array: (number | null)[]) {}

  push(
    kind: StepKind,
    line: number,
    text: string,
    extra: { active?: number[]; min?: number | null; key?: SortStep['key'] } = {},
  ) {
    this.steps.push({
      kind,
      array: [...this.array],
      active: extra.active ?? [],
      sorted: [...this.sorted].sort((a, b) => a - b),
      min: extra.min ?? null,
      key: extra.key ?? null,
      line,
      comparisons: this.comparisons,
      moves: this.moves,
      text,
    });
  }
}

const v = (x: number | null) => String(x);

function bubble(input: number[]): SortStep[] {
  const r = new Recorder([...input]);
  const a = r.array as number[];
  const n = a.length;
  r.push('start', 2, 'Початковий масив. Порівнюватимемо сусідні елементи.');
  for (let pass = 0; pass < n - 1; pass++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - pass; j++) {
      r.comparisons++;
      const greater = a[j]! > a[j + 1]!;
      r.push(
        'compare',
        6,
        `Прохід ${pass + 1}: порівнюємо ${a[j]} і ${a[j + 1]} — ${greater ? 'лівий більший, міняємо' : 'порядок правильний'}.`,
        { active: [j, j + 1] },
      );
      if (greater) {
        [a[j], a[j + 1]] = [a[j + 1]!, a[j]!];
        r.moves++;
        swapped = true;
        r.push('swap', 7, `Обмін: ${a[j]} і ${a[j + 1]} помінялися місцями.`, {
          active: [j, j + 1],
        });
      }
    }
    r.sorted.add(n - 1 - pass);
    if (!swapped) {
      range(0, n).forEach((i) => r.sorted.add(i));
      r.push('pass-end', 11, `За прохід ${pass + 1} не було жодного обміну — масив відсортовано.`);
      break;
    }
    r.push(
      'pass-end',
      11,
      `Кінець проходу ${pass + 1}: ${a[n - 1 - pass]} «спливло» на своє місце.`,
    );
  }
  range(0, n).forEach((i) => r.sorted.add(i));
  r.push('done', 13, 'Готово: масив відсортовано.');
  return r.steps;
}

function selection(input: number[]): SortStep[] {
  const r = new Recorder([...input]);
  const a = r.array as number[];
  const n = a.length;
  r.push('start', 2, 'Початковий масив. Шукатимемо мінімум невідсортованої частини.');
  for (let i = 0; i < n - 1; i++) {
    let minIndex = i;
    r.push('new-min', 4, `Крок ${i + 1}: вважаємо мінімумом ${a[i]} (позиція ${i}).`, {
      active: [i],
      min: i,
    });
    for (let j = i + 1; j < n; j++) {
      r.comparisons++;
      const less = a[j]! < a[minIndex]!;
      r.push(
        'compare',
        6,
        `Порівнюємо ${a[j]} з мінімумом ${a[minIndex]} — ${less ? 'новий мінімум' : 'мінімум не змінюється'}.`,
        { active: [j], min: minIndex },
      );
      if (less) {
        minIndex = j;
        r.push('new-min', 6, `Новий мінімум: ${a[j]} (позиція ${j}).`, { active: [j], min: j });
      }
    }
    if (minIndex !== i) {
      [a[i], a[minIndex]] = [a[minIndex]!, a[i]!];
      r.moves++;
      r.sorted.add(i);
      r.push('swap', 8, `Обмін: мінімум ${a[i]} стає на позицію ${i}.`, {
        active: [i, minIndex],
      });
    } else {
      r.sorted.add(i);
      r.push('no-swap', 8, `Мінімум ${a[i]} уже на позиції ${i} — обмін не потрібен.`, {
        active: [i],
      });
    }
  }
  range(0, n).forEach((i) => r.sorted.add(i));
  r.push('done', 10, 'Готово: масив відсортовано.');
  return r.steps;
}

function insertion(input: number[]): SortStep[] {
  const r = new Recorder([...input]);
  const a = r.array;
  const n = a.length;
  if (n > 0) r.sorted.add(0);
  r.push('start', 2, 'Початковий масив. Перший елемент — уже впорядкована частина.');
  for (let i = 1; i < n; i++) {
    const key = a[i]!;
    a[i] = null;
    r.push('take', 4, `Крок ${i}: беремо ключ ${key} і звільняємо його місце.`, {
      key: { value: key, at: i },
    });
    let j = i - 1;
    while (j >= 0) {
      r.comparisons++;
      const greater = a[j]! > key;
      r.push(
        'compare',
        6,
        `Порівнюємо ${a[j]} з ключем ${key} — ${greater ? 'більший, зсуваємо праворуч' : 'не більший, місце знайдено'}.`,
        { active: [j], key: { value: key, at: j + 1 } },
      );
      if (!greater) break;
      a[j + 1] = a[j]!;
      a[j] = null;
      r.moves++;
      r.push('shift', 7, `Зсув: ${a[j + 1]} переходить на позицію ${j + 1}.`, {
        active: [j + 1],
        key: { value: key, at: j },
      });
      j--;
    }
    a[j + 1] = key;
    range(0, i + 1).forEach((k) => r.sorted.add(k));
    r.push('place', 10, `Вставляємо ключ ${key} на позицію ${j + 1}.`, { active: [j + 1] });
  }
  range(0, n).forEach((k) => r.sorted.add(k));
  r.push('done', 12, 'Готово: масив відсортовано.');
  return r.steps;
}

export function traceSort(algorithm: SortAlgorithm, input: readonly number[]): SortStep[] {
  const data = [...input];
  if (algorithm === 'bubble') return bubble(data);
  if (algorithm === 'selection') return selection(data);
  return insertion(data);
}

/** Масив з тексту «5, 2, 4, 1, 3» (коми або пробіли). */
export function parseArray(
  text: string,
): { ok: true; values: number[] } | { ok: false; error: string } {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: 'Введіть хоча б одне число.' };
  if (parts.length > MAX_LENGTH) {
    return { ok: false, error: `Не більше ${MAX_LENGTH} чисел — інакше стовпчики не вмістяться.` };
  }
  const values: number[] = [];
  for (const part of parts) {
    if (!/^-?\d{1,3}$/.test(part)) {
      return { ok: false, error: `«${part}» — не ціле число від −999 до 999.` };
    }
    values.push(Number(part));
  }
  return { ok: true, values };
}

export const MAX_LENGTH = 16;

export type Preset = 'random' | 'sorted' | 'reversed' | 'nearly';

/** Набір даних для демонстрації: випадковий, відсортований, зворотний, майже відсортований. */
export function makePreset(
  preset: Preset,
  n: number,
  random: () => number = Math.random,
): number[] {
  const values = Array.from({ length: n }, () => 1 + Math.floor(random() * 20));
  if (preset === 'random') return values;
  values.sort((x, y) => x - y);
  if (preset === 'reversed') return values.reverse();
  if (preset === 'nearly' && n > 2) {
    const i = Math.floor(random() * (n - 1));
    [values[i], values[i + 1]] = [values[i + 1]!, values[i]!];
  }
  return values;
}

export const DEFAULT_ARRAY = [5, 2, 4, 1, 3];
export const valueText = v;
