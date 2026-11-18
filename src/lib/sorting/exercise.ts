/**
 * Тренажер трасування для варіантів ПР-3 і ПР-4: студент вводить масив після кожного етапу
 * (проходу, кроку h, злиття, розбиття…) і лічильники, а сайт звіряє з еталоном.
 * Етапи рахуємо тут, лічильники — з візуалізатора (traceSort), щоб вони збігалися з ним і з кодом лекцій.
 */
import { ALGORITHMS, traceSort, type SortAlgorithm } from './trace';

export type ExerciseAlgorithm = Exclude<SortAlgorithm, 'counting'>;

export interface Exercise {
  algorithms: ExerciseAlgorithm[];
  array: number[];
  /** Чи питати кількість інверсій (ПР-3). */
  inversions: boolean;
}

/** Що вважається етапом для кожного алгоритму — підпис рядка в тренажері. */
export const STAGE_LABEL: Record<ExerciseAlgorithm, (k: number) => string> = {
  bubble: (k) => `Після проходу ${k}`,
  selection: (k) => `Після кроку ${k}`,
  insertion: (k) => `Після кроку ${k}`,
  shell: (k) => `Після кроку ${k}`,
  merge: (k) => `Після злиття ${k}`,
  quick: (k) => `Після розбиття ${k}`,
  heap: (k) => (k === 1 ? 'Купа після побудови' : `Після вибору максимуму ${k - 1}`),
};

/** Масив після кожного етапу. */
export function stagesOf(algorithm: ExerciseAlgorithm, input: readonly number[]): number[][] {
  const a = [...input];
  const n = a.length;
  const out: number[][] = [];
  const snap = () => out.push([...a]);
  const swap = (i: number, j: number) => {
    [a[i], a[j]] = [a[j]!, a[i]!];
  };

  if (algorithm === 'bubble') {
    for (let pass = 0; pass < n - 1; pass++) {
      let swapped = false;
      for (let j = 0; j < n - 1 - pass; j++) {
        if (a[j]! > a[j + 1]!) {
          swap(j, j + 1);
          swapped = true;
        }
      }
      snap();
      if (!swapped) break;
    }
  } else if (algorithm === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let min = i;
      for (let j = i + 1; j < n; j++) if (a[j]! < a[min]!) min = j;
      if (min !== i) swap(i, min);
      snap();
    }
  } else if (algorithm === 'insertion' || algorithm === 'shell') {
    const gaps: number[] = [];
    if (algorithm === 'insertion') gaps.push(1);
    else for (let h = Math.floor(n / 2); h > 0; h = Math.floor(h / 2)) gaps.push(h);
    for (const h of gaps) {
      for (let i = h; i < n; i++) {
        const key = a[i]!;
        let j = i;
        while (j >= h && a[j - h]! > key) {
          a[j] = a[j - h]!;
          j -= h;
        }
        a[j] = key;
        if (algorithm === 'insertion') snap();
      }
      if (algorithm === 'shell') snap();
    }
  } else if (algorithm === 'merge') {
    const sort = (left: number, right: number) => {
      if (right - left <= 1) return;
      const mid = left + Math.floor((right - left) / 2);
      sort(left, mid);
      sort(mid, right);
      const merged: number[] = [];
      let i = left;
      let j = mid;
      while (i < mid && j < right) merged.push(a[i]! <= a[j]! ? a[i++]! : a[j++]!);
      while (i < mid) merged.push(a[i++]!);
      while (j < right) merged.push(a[j++]!);
      merged.forEach((v, k) => (a[left + k] = v));
      snap();
    };
    sort(0, n);
  } else if (algorithm === 'quick') {
    const sort = (low: number, high: number) => {
      if (low >= high) return;
      const pivot = a[high]!;
      let i = low;
      for (let j = low; j < high; j++) {
        if (a[j]! < pivot) {
          swap(i, j);
          i++;
        }
      }
      swap(i, high);
      snap();
      sort(low, i - 1);
      sort(i + 1, high);
    };
    sort(0, n - 1);
  } else {
    const sift = (start: number, size: number) => {
      let i = start;
      for (;;) {
        let largest = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < size && a[l]! > a[largest]!) largest = l;
        if (r < size && a[r]! > a[largest]!) largest = r;
        if (largest === i) return;
        swap(i, largest);
        i = largest;
      }
    };
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) sift(i, n);
    snap();
    for (let end = n - 1; end > 0; end--) {
      swap(0, end);
      sift(0, end);
      snap();
    }
  }
  return out;
}

/** Лічильники так, як їх рахує візуалізатор: порівняння ключів і переміщення (обміни чи зсуви). */
export function countsOf(algorithm: ExerciseAlgorithm, input: readonly number[]) {
  const last = traceSort(algorithm, input).at(-1)!;
  return { comparisons: last.comparisons, moves: last.moves };
}

/** Кількість інверсій: пар i < j з a[i] > a[j]. */
export function inversionsOf(input: readonly number[]): number {
  let count = 0;
  for (let i = 0; i < input.length; i++) {
    for (let j = i + 1; j < input.length; j++) if (input[i]! > input[j]!) count++;
  }
  return count;
}

/** Назва лічильника переміщень для алгоритму: «обмінів», «зсувів» чи «переміщень». */
export function movesLabel(algorithm: ExerciseAlgorithm): string {
  const label = ALGORITHMS[algorithm].moves.toLowerCase();
  return label;
}

export interface AlgorithmAnswer {
  stages: string[];
  comparisons: string;
  moves: string;
}

export interface Answer {
  algorithms: Partial<Record<ExerciseAlgorithm, AlgorithmAnswer>>;
  inversions: string;
}

/** «1, 5 ,3» або «1 5 3» → [1, 5, 3]; null — не масив цілих чисел. */
export function parseNumbers(text: string): number[] | null {
  const parts = text
    .trim()
    .replace(/^\[|\]$/g, '')
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (parts.length === 0 || parts.some((p) => !/^-?\d+$/.test(p))) return null;
  return parts.map(Number);
}

const sameArray = (a: readonly number[] | null, b: readonly number[]) =>
  a !== null && a.length === b.length && a.every((v, i) => v === b[i]);

const sameNumber = (text: string, value: number) =>
  /^\s*-?\d+\s*$/.test(text) && Number(text) === value;

export interface AlgorithmVerdict {
  /** По одному на етап еталона; зайві рядки студента — помилка. */
  stages: boolean[];
  extraStages: boolean;
  comparisons: boolean;
  moves: boolean;
  ok: boolean;
}

export interface Verdict {
  algorithms: Partial<Record<ExerciseAlgorithm, AlgorithmVerdict>>;
  inversions: boolean | null;
  solved: boolean;
}

export function checkAnswer(exercise: Exercise, answer: Answer): Verdict {
  const algorithms: Verdict['algorithms'] = {};
  let solved = true;
  for (const algorithm of exercise.algorithms) {
    const expected = stagesOf(algorithm, exercise.array);
    const counts = countsOf(algorithm, exercise.array);
    const given = answer.algorithms[algorithm] ?? { stages: [], comparisons: '', moves: '' };
    const filled = given.stages.filter((s) => s.trim() !== '');
    const stages = expected.map((stage, k) =>
      sameArray(parseNumbers(given.stages[k] ?? ''), stage),
    );
    const extraStages = filled.length > expected.length;
    const verdict: AlgorithmVerdict = {
      stages,
      extraStages,
      comparisons: sameNumber(given.comparisons, counts.comparisons),
      moves: sameNumber(given.moves, counts.moves),
      ok: false,
    };
    verdict.ok = stages.every(Boolean) && !extraStages && verdict.comparisons && verdict.moves;
    if (!verdict.ok) solved = false;
    algorithms[algorithm] = verdict;
  }
  const inversions = exercise.inversions
    ? sameNumber(answer.inversions, inversionsOf(exercise.array))
    : null;
  if (inversions === false) solved = false;
  return { algorithms, inversions, solved };
}

// ---------- Рядок тестів варіанта і текст розв'язку для бази ----------

const KNOWN = new Set<string>([
  'bubble',
  'selection',
  'insertion',
  'shell',
  'merge',
  'quick',
  'heap',
]);

/**
 * Рядок тестів «bubble,selection,insertion+inv → 30 1 15 5» (src/data/variants/*.tests.yaml) → вправа.
 * «+inv» — питати кількість інверсій.
 */
export function exerciseFromLine(line: string): Exercise | null {
  const [head = '', tail = ''] = line.split(' → ');
  const inversions = head.trim().endsWith('+inv');
  const algorithms = head
    .replace('+inv', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const array = parseNumbers(tail);
  if (!array || algorithms.length === 0 || algorithms.some((a) => !KNOWN.has(a))) return null;
  return { algorithms: algorithms as ExerciseAlgorithm[], array, inversions };
}

/** Відповідь → текст для збереження й показу викладачу. */
export function answerText(exercise: Exercise, answer: Answer): string {
  const lines: string[] = [`Масив: ${exercise.array.join(' ')}`];
  for (const algorithm of exercise.algorithms) {
    const given = answer.algorithms[algorithm];
    lines.push('', `## ${algorithm} — ${ALGORITHMS[algorithm].title}`);
    (given?.stages ?? [])
      .filter((s) => s.trim() !== '')
      .forEach((stage, k) =>
        lines.push(`${k + 1}: ${(parseNumbers(stage) ?? [stage.trim()]).join(' ')}`),
      );
    lines.push(
      `порівнянь: ${given?.comparisons.trim() ?? ''}; ${movesLabel(algorithm)}: ${given?.moves.trim() ?? ''}`,
    );
  }
  if (exercise.inversions) lines.push('', `інверсій: ${answer.inversions.trim()}`);
  return lines.join('\n');
}

/** Збережений текст → відповідь; null — текст не розбирається. */
export function answerFromText(text: string): Answer | null {
  const answer: Answer = { algorithms: {}, inversions: '' };
  let current: AlgorithmAnswer | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const header = /^## (\w+)/.exec(line);
    if (header) {
      if (!KNOWN.has(header[1]!)) return null;
      current = { stages: [], comparisons: '', moves: '' };
      answer.algorithms[header[1] as ExerciseAlgorithm] = current;
      continue;
    }
    const stage = /^\d+: (.*)$/.exec(line);
    if (stage && current) {
      current.stages.push(stage[1]!);
      continue;
    }
    const counts = /^порівнянь: (-?\d*); [^:]+: (-?\d*)$/.exec(line);
    if (counts && current) {
      current.comparisons = counts[1]!;
      current.moves = counts[2]!;
      continue;
    }
    const inv = /^інверсій: (-?\d*)$/.exec(line);
    if (inv) answer.inversions = inv[1]!;
  }
  return Object.keys(answer.algorithms).length > 0 ? answer : null;
}

/** Повторна перевірка збереженого розв'язку за рядками тестів варіанта. */
export function recheckSorting(text: string, lines: readonly string[]): boolean {
  const exercise = lines[0] ? exerciseFromLine(lines[0]) : null;
  const answer = answerFromText(text);
  return exercise !== null && answer !== null && checkAnswer(exercise, answer).solved;
}
