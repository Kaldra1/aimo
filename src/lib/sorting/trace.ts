/**
 * Траєкторії сортувань для візуалізатора: кожен крок — знімок масиву, що відбулося, рядок коду
 * з лекції 11 або 12 і лічильники. Траєкторію будуємо наперед: так можна крокувати й назад.
 * Лічильники рахуються так само, як у лекціях: бульбашка й вибір — порівняння й обміни,
 * вставки й Шелл — порівняння (зокрема те, що завершує цикл) і зсуви.
 */

export type SortAlgorithm =
  'bubble' | 'selection' | 'insertion' | 'shell' | 'merge' | 'quick' | 'heap' | 'counting';

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
  | 'split'
  | 'copy'
  | 'error'
  | 'done';

/** Допоміжний масив під основним: буфер злиття або лічильники підрахунку. */
export interface AuxRow {
  label: string;
  values: (number | null)[];
  active: number[];
  /** Підписи комірок (для лічильників — значення 0…k), інакше — індекси. */
  labels?: number[];
}

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
  /** Швидке сортування: опорний елемент. */
  pivot: number | null;
  /** Відрізок, з яким зараз працює алгоритм: [від, до) — решту приглушено. */
  range: [number, number] | null;
  /** Вставки й Шелл: піднятий ключ і місце над масивом, де він «висить». */
  key: { value: number; at: number } | null;
  aux: AuxRow | null;
  /** Рядок коду з лекції (від 1). */
  line: number;
  comparisons: number;
  moves: number;
  /** Пояснення українською. */
  text: string;
}

export interface AlgorithmInfo {
  title: string;
  lecture: 11 | 12;
  moves: string;
  code: string;
}

export const ALGORITHMS: Record<SortAlgorithm, AlgorithmInfo> = {
  bubble: {
    title: 'Бульбашкою',
    lecture: 11,
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
    lecture: 11,
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
    lecture: 11,
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
  shell: {
    title: 'Шелла',
    lecture: 12,
    moves: 'Зсувів',
    code: `void shellSort(vector<int>& a) {
    int n = a.size();
    for (int h = n / 2; h > 0; h /= 2) {
        for (int i = h; i < n; i++) {          // вставки з кроком h
            int key = a[i];
            int j = i;
            while (j >= h && a[j - h] > key) {
                a[j] = a[j - h];
                j -= h;
            }
            a[j] = key;
        }
    }
}`,
  },
  merge: {
    title: 'Злиттям',
    lecture: 12,
    moves: 'Копіювань',
    code: `void mergeParts(vector<int>& a, int left, int mid, int right, vector<int>& buffer) {
    int i = left, j = mid, k = left;
    while (i < mid && j < right) {
        buffer[k++] = (a[i] <= a[j]) ? a[i++] : a[j++];   // <= зберігає стійкість
    }
    while (i < mid) buffer[k++] = a[i++];
    while (j < right) buffer[k++] = a[j++];
    for (int t = left; t < right; t++) a[t] = buffer[t];
}

void mergeSort(vector<int>& a, int left, int right, vector<int>& buffer) {
    if (right - left <= 1) return;                        // базовий випадок
    int mid = left + (right - left) / 2;
    mergeSort(a, left, mid, buffer);
    mergeSort(a, mid, right, buffer);
    mergeParts(a, left, mid, right, buffer);
}

void mergeSort(vector<int>& a) {
    vector<int> buffer(a.size());
    mergeSort(a, 0, a.size(), buffer);
}`,
  },
  quick: {
    title: 'Швидке',
    lecture: 12,
    moves: 'Обмінів',
    code: `int partition(vector<int>& a, int low, int high) {
    int pivot = a[high];
    int i = low;
    for (int j = low; j < high; j++) {
        if (a[j] < pivot) {
            swap(a[i], a[j]);
            i++;
        }
    }
    swap(a[i], a[high]);          // опорний на остаточне місце
    return i;
}

void quickSort(vector<int>& a, int low, int high) {
    if (low >= high) return;
    int p = partition(a, low, high);
    quickSort(a, low, p - 1);
    quickSort(a, p + 1, high);
}`,
  },
  heap: {
    title: 'Пірамідальне',
    lecture: 12,
    moves: 'Обмінів',
    code: `void siftDown(vector<int>& a, int i, int size) {
    while (true) {
        int largest = i;
        int left = 2 * i + 1, right = 2 * i + 2;
        if (left < size && a[left] > a[largest]) largest = left;
        if (right < size && a[right] > a[largest]) largest = right;
        if (largest == i) return;
        swap(a[i], a[largest]);
        i = largest;
    }
}

void heapSort(vector<int>& a) {
    int n = a.size();
    for (int i = n / 2 - 1; i >= 0; i--) siftDown(a, i, n);   // побудова купи
    for (int end = n - 1; end > 0; end--) {
        swap(a[0], a[end]);                                      // максимум у кінець
        siftDown(a, 0, end);
    }
}`,
  },
  counting: {
    title: 'Підрахунком',
    lecture: 12,
    moves: 'Записів',
    code: `void countingSort(vector<int>& a, int k) {       // усі елементи в межах 0..k
    vector<int> count(k + 1, 0);
    for (int x : a) count[x]++;
    int pos = 0;
    for (int value = 0; value <= k; value++) {
        while (count[value]-- > 0) a[pos++] = value;
    }
}`,
  },
};

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

interface Extra {
  active?: number[];
  min?: number | null;
  pivot?: number | null;
  range?: [number, number] | null;
  key?: SortStep['key'];
  aux?: AuxRow | null;
}

class Recorder {
  readonly steps: SortStep[] = [];
  comparisons = 0;
  moves = 0;
  sorted = new Set<number>();
  /** Допоміжний рядок останнього кроку — лишається видимим і на кроці «Готово». */
  lastAux: AuxRow | null = null;
  constructor(public array: (number | null)[]) {}

  push(kind: StepKind, line: number, text: string, extra: Extra = {}) {
    if (extra.aux) this.lastAux = extra.aux;
    this.steps.push({
      kind,
      array: [...this.array],
      active: extra.active ?? [],
      sorted: [...this.sorted].sort((a, b) => a - b),
      min: extra.min ?? null,
      pivot: extra.pivot ?? null,
      range: extra.range ?? null,
      key: extra.key ?? null,
      aux: extra.aux ? { ...extra.aux, values: [...extra.aux.values] } : null,
      line,
      comparisons: this.comparisons,
      moves: this.moves,
      text,
    });
  }

  finish(line: number) {
    range(0, this.array.length).forEach((i) => this.sorted.add(i));
    this.push('done', line, 'Готово: масив відсортовано.', {
      aux: this.lastAux ? { ...this.lastAux, active: [] } : null,
    });
    return this.steps;
  }
}

// ---------- Лекція 11 ----------

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
  return r.finish(13);
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
    r.sorted.add(i);
    if (minIndex !== i) {
      [a[i], a[minIndex]] = [a[minIndex]!, a[i]!];
      r.moves++;
      r.push('swap', 8, `Обмін: мінімум ${a[i]} стає на позицію ${i}.`, {
        active: [i, minIndex],
      });
    } else {
      r.push('no-swap', 8, `Мінімум ${a[i]} уже на позиції ${i} — обмін не потрібен.`, {
        active: [i],
      });
    }
  }
  return r.finish(10);
}

/** Вставки з кроком gap: при gap = 1 — звичайні вставки (лекція 11), інакше — прохід Шелла. */
function gappedInsertion(r: Recorder, gap: number, lines: Record<string, number>, shell: boolean) {
  const a = r.array;
  const n = a.length;
  for (let i = gap; i < n; i++) {
    const key = a[i]!;
    a[i] = null;
    r.push(
      'take',
      lines.take!,
      shell
        ? `Крок h = ${gap}: беремо ключ ${key} (позиція ${i}).`
        : `Крок ${i}: беремо ключ ${key} і звільняємо його місце.`,
      { key: { value: key, at: i } },
    );
    let j = shell ? i : i - 1;
    while (shell ? j >= gap : j >= 0) {
      const other = shell ? j - gap : j;
      r.comparisons++;
      const greater = a[other]! > key;
      r.push(
        'compare',
        lines.compare!,
        `Порівнюємо ${a[other]} з ключем ${key} — ${greater ? 'більший, зсуваємо' : 'не більший, місце знайдено'}.`,
        { active: [other], key: { value: key, at: shell ? j : j + 1 } },
      );
      if (!greater) break;
      const to = shell ? j : j + 1;
      a[to] = a[other]!;
      a[other] = null;
      r.moves++;
      r.push('shift', lines.shift!, `Зсув: ${a[to]} переходить на позицію ${to}.`, {
        active: [to],
        key: { value: key, at: other },
      });
      j -= shell ? gap : 1;
    }
    const at = shell ? j : j + 1;
    a[at] = key;
    if (!shell) range(0, i + 1).forEach((k) => r.sorted.add(k));
    r.push('place', lines.place!, `Вставляємо ключ ${key} на позицію ${at}.`, { active: [at] });
  }
}

function insertion(input: number[]): SortStep[] {
  const r = new Recorder([...input]);
  if (input.length > 0) r.sorted.add(0);
  r.push('start', 2, 'Початковий масив. Перший елемент — уже впорядкована частина.');
  gappedInsertion(r, 1, { take: 4, compare: 6, shift: 7, place: 10 }, false);
  return r.finish(12);
}

// ---------- Лекція 12 ----------

function shell(input: number[]): SortStep[] {
  const r = new Recorder([...input]);
  const n = input.length;
  r.push('start', 2, 'Початковий масив. Спершу впорядкуємо елементи, віддалені на крок h.');
  for (let h = Math.floor(n / 2); h > 0; h = Math.floor(h / 2)) {
    r.push('pass-end', 3, `Новий крок h = ${h}: вставки серед елементів, віддалених на ${h}.`);
    gappedInsertion(r, h, { take: 5, compare: 7, shift: 8, place: 11 }, true);
  }
  return r.finish(14);
}

function merge(input: number[]): SortStep[] {
  const r = new Recorder([...input]);
  const a = r.array as number[];
  const n = a.length;
  const buffer: (number | null)[] = Array(n).fill(null);
  const aux = (active: number[] = []): AuxRow => ({ label: 'Буфер', values: buffer, active });
  r.push('start', 20, 'Початковий масив і порожній буфер такого самого розміру.', { aux: aux() });

  const parts = (left: number, mid: number, right: number) => {
    let i = left;
    let j = mid;
    let k = left;
    const span: [number, number] = [left, right];
    while (i < mid && j < right) {
      r.comparisons++;
      const takeLeft = a[i]! <= a[j]!;
      r.push(
        'compare',
        4,
        `Зливаємо [${left}…${mid - 1}] і [${mid}…${right - 1}]: порівнюємо ${a[i]} і ${a[j]} — менший іде в буфер.`,
        { active: [i, j], range: span, aux: aux() },
      );
      const from = takeLeft ? i++ : j++;
      buffer[k] = a[from]!;
      r.moves++;
      r.push('take', 4, `${a[from]} → буфер[${k}].`, {
        active: [from],
        range: span,
        aux: aux([k]),
      });
      k++;
    }
    while (i < mid || j < right) {
      const from = i < mid ? i++ : j++;
      buffer[k] = a[from]!;
      r.moves++;
      r.push(
        'take',
        i <= mid && from < mid ? 6 : 7,
        `Дописуємо залишок: ${a[from]} → буфер[${k}].`,
        {
          active: [from],
          range: span,
          aux: aux([k]),
        },
      );
      k++;
    }
    for (let t = left; t < right; t++) a[t] = buffer[t]!;
    r.moves += right - left;
    r.push(
      'copy',
      8,
      `Копіюємо злиту частину з буфера назад: [${left}…${right - 1}] упорядковано.`,
      {
        active: range(left, right),
        range: span,
        aux: aux(range(left, right)),
      },
    );
  };

  const sort = (left: number, right: number) => {
    if (right - left <= 1) return;
    const mid = left + Math.floor((right - left) / 2);
    r.push(
      'split',
      13,
      `Ділимо [${left}…${right - 1}] навпіл: [${left}…${mid - 1}] і [${mid}…${right - 1}].`,
      {
        range: [left, right],
        aux: aux(),
      },
    );
    sort(left, mid);
    sort(mid, right);
    parts(left, mid, right);
  };

  sort(0, n);
  return r.finish(21);
}

function quick(input: number[]): SortStep[] {
  const r = new Recorder([...input]);
  const a = r.array as number[];
  r.push('start', 15, 'Початковий масив. Опорним щоразу беремо останній елемент відрізка.');

  const partition = (low: number, high: number) => {
    const pivot = a[high]!;
    const span: [number, number] = [low, high + 1];
    r.push('split', 2, `Розбиття [${low}…${high}]: опорний ${pivot}.`, {
      pivot: high,
      range: span,
    });
    let i = low;
    for (let j = low; j < high; j++) {
      r.comparisons++;
      const less = a[j]! < pivot;
      r.push(
        'compare',
        5,
        `Порівнюємо ${a[j]} з опорним ${pivot} — ${less ? 'менший, у ліву частину' : 'не менший, лишається'}.`,
        { active: [j], pivot: high, range: span },
      );
      if (less) {
        [a[i], a[j]] = [a[j]!, a[i]!];
        r.moves++;
        r.push(
          'swap',
          6,
          i === j ? `${a[i]} уже на місці (i = j = ${i}).` : `Обмін: ${a[i]} ↔ ${a[j]}.`,
          {
            active: [i, j],
            pivot: high,
            range: span,
          },
        );
        i++;
      }
    }
    [a[i], a[high]] = [a[high]!, a[i]!];
    r.moves++;
    r.sorted.add(i);
    r.push(
      'swap',
      10,
      `Опорний ${pivot} стає на остаточне місце ${i}: ліворуч менші, праворуч не менші.`,
      {
        active: [i, high],
        pivot: i,
        range: span,
      },
    );
    return i;
  };

  const sort = (low: number, high: number) => {
    if (low > high) return;
    if (low === high) {
      r.sorted.add(low);
      return;
    }
    const p = partition(low, high);
    sort(low, p - 1);
    sort(p + 1, high);
  };

  sort(0, a.length - 1);
  return r.finish(19);
}

function heap(input: number[]): SortStep[] {
  const r = new Recorder([...input]);
  const a = r.array as number[];
  const n = a.length;
  r.push('start', 14, 'Початковий масив — двійкове дерево: нащадки a[i] — це a[2i+1] і a[2i+2].');

  const siftDown = (start: number, size: number) => {
    let i = start;
    const span: [number, number] = [0, size];
    while (true) {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < size) {
        r.comparisons++;
        r.push('compare', 5, `Порівнюємо вузол ${a[largest]} з лівим нащадком ${a[left]}.`, {
          active: [largest, left],
          range: span,
        });
        if (a[left]! > a[largest]!) largest = left;
      }
      if (right < size) {
        r.comparisons++;
        r.push(
          'compare',
          6,
          `Порівнюємо найбільший поки ${a[largest]} з правим нащадком ${a[right]}.`,
          {
            active: [largest, right],
            range: span,
          },
        );
        if (a[right]! > a[largest]!) largest = right;
      }
      if (largest === i) return;
      [a[i], a[largest]] = [a[largest]!, a[i]!];
      r.moves++;
      r.push('swap', 8, `Просіювання: ${a[i]} піднімається, ${a[largest]} опускається.`, {
        active: [i, largest],
        range: span,
      });
      i = largest;
    }
  };

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    r.push('pass-end', 15, `Побудова купи: просіюємо вузол ${i} (${a[i]}).`, {
      active: [i],
      range: [0, n],
    });
    siftDown(i, n);
  }
  if (n > 1)
    r.push('pass-end', 15, `Купа побудована: найбільший елемент ${a[0]} у корені.`, {
      range: [0, n],
    });
  for (let end = n - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end]!, a[0]!];
    r.moves++;
    r.sorted.add(end);
    r.push('swap', 17, `Максимум ${a[end]} переносимо в кінець — на позицію ${end}.`, {
      active: [0, end],
      range: [0, end],
    });
    siftDown(0, end);
  }
  return r.finish(20);
}

export const COUNTING_MAX = 30;

function counting(input: number[]): SortStep[] {
  const r = new Recorder([...input]);
  const a = r.array as number[];
  if (input.some((x) => x < 0 || x > COUNTING_MAX)) {
    r.push(
      'error',
      1,
      `Сортування підрахунком тут працює з цілими від 0 до ${COUNTING_MAX}: змініть масив.`,
    );
    return r.steps;
  }
  const k = Math.max(0, ...input);
  const count = Array<number>(k + 1).fill(0);
  const labels = range(0, k + 1);
  const aux = (active: number[] = []): AuxRow => ({
    label: 'count',
    values: count,
    active,
    labels,
  });
  r.push('start', 2, `Значення від 0 до ${k}: заводимо ${k + 1} лічильників, усі нулі.`, {
    aux: aux(),
  });
  a.forEach((x, i) => {
    count[x]!++;
    r.push('take', 3, `Зустріли ${x} — count[${x}] = ${count[x]}.`, { active: [i], aux: aux([x]) });
  });
  let pos = 0;
  for (let value = 0; value <= k; value++) {
    while (count[value]! > 0) {
      count[value]!--;
      a[pos] = value;
      r.moves++;
      r.sorted.add(pos);
      r.push(
        'place',
        6,
        `Записуємо ${value} на позицію ${pos} (лишилося count[${value}] = ${count[value]}).`,
        {
          active: [pos],
          aux: aux([value]),
        },
      );
      pos++;
    }
  }
  return r.finish(8);
}

export function traceSort(algorithm: SortAlgorithm, input: readonly number[]): SortStep[] {
  const data = [...input];
  switch (algorithm) {
    case 'bubble':
      return bubble(data);
    case 'selection':
      return selection(data);
    case 'insertion':
      return insertion(data);
    case 'shell':
      return shell(data);
    case 'merge':
      return merge(data);
    case 'quick':
      return quick(data);
    case 'heap':
      return heap(data);
    case 'counting':
      return counting(data);
  }
}

export const MAX_LENGTH = 16;
export const MIN_LENGTH = 2;

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

export type Preset = 'random' | 'sorted' | 'reversed' | 'nearly';

/**
 * Набір різних чисел (без повторів) для демонстрації: випадковий, відсортований, зворотний,
 * майже відсортований. Числа — від 1 до max(20, n), тож підходять і для підрахунку.
 */
export function makePreset(
  preset: Preset,
  n: number,
  random: () => number = Math.random,
): number[] {
  const size = Math.min(Math.max(Math.round(n), MIN_LENGTH), MAX_LENGTH);
  const pool = Array.from({ length: Math.max(20, size) }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const values = pool.slice(0, size);
  if (preset === 'random') return values;
  values.sort((x, y) => x - y);
  if (preset === 'reversed') return values.reverse();
  if (preset === 'nearly' && size > 2) {
    const i = Math.floor(random() * (size - 1));
    [values[i], values[i + 1]] = [values[i + 1]!, values[i]!];
  }
  return values;
}

export const DEFAULT_ARRAY = [5, 2, 4, 1, 3];
