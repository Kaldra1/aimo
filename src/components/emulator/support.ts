/** Допоміжні функції островів емуляторів: швидкість, сховище браузера, файли. */
import { useEffect, useState } from 'preact/hooks';
import { plural } from '../../lib/plural';
import {
  INSTANT,
  MachineRunner,
  type RunnerMachine,
  type RunnerOptions,
  type RunnerSnapshot,
} from '../../lib/machines/runner';
import type { BaseState } from '../../lib/machines/types';

/** Позиції повзунка швидкості: кроків за секунду, остання — «миттєво». */
export const SPEEDS: readonly number[] = [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, INSTANT];
export const DEFAULT_SPEED_INDEX = 4;
export const DEFAULT_LIMIT = 10_000;
export const MAX_LIMIT = 1_000_000;

export function speedAt(index: number): number {
  return SPEEDS[Math.min(Math.max(index, 0), SPEEDS.length - 1)] ?? 1;
}

export function speedLabel(speed: number): string {
  return speed === INSTANT ? 'миттєво' : `${plural(speed, ['крок', 'кроки', 'кроків'])}/с`;
}

export function speedText(speed: number): string {
  return speed === INSTANT ? 'миттєво' : `${plural(speed, ['крок', 'кроки', 'кроків'])} за секунду`;
}

const numberFormat = new Intl.NumberFormat('uk-UA');

export const formatNumber = (value: number) => numberFormat.format(value);

/** localStorage може бути недоступним (приватний режим, заборона сайту) — тоді просто без нього. */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Сховище недоступне або заповнене — автозбереження не працює, але емулятор працює.
  }
}

/** Пропонує браузеру зберегти текст у файл. */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Підписка острова на MachineRunner. */
export function useRunner<S extends BaseState, P, E>(
  machine: RunnerMachine<S, P, E>,
  initial: S | null,
  options: RunnerOptions,
): { snapshot: RunnerSnapshot<S, E>; runner: MachineRunner<S, P, E> } {
  const [runner] = useState(() => new MachineRunner(machine, initial, options));
  const [snapshot, setSnapshot] = useState(() => runner.getSnapshot());
  useEffect(() => {
    const unsubscribe = runner.subscribe(() => setSnapshot(runner.getSnapshot()));
    return () => {
      unsubscribe();
      runner.dispose();
    };
  }, [runner]);
  return { snapshot, runner };
}

export type StatusKind = 'idle' | 'running' | 'paused' | 'halted' | 'crashed' | 'limit' | 'error';

export const PROGRAM_ERRORS = 'У програмі є помилки — виправте їх, щоб запустити.';

/** Текст статус-бару за станом виконання. problem — чому запуск неможливий (помилки тощо). */
export function statusOf(
  snapshot: RunnerSnapshot<BaseState, unknown>,
  problem: string | null,
): { kind: StatusKind; text: string } {
  const { state } = snapshot;
  if (problem !== null || state === null) {
    return { kind: 'error', text: problem ?? PROGRAM_ERRORS };
  }
  if (state.status === 'halted') {
    return { kind: 'halted', text: `Зупинка. Виконано кроків: ${formatNumber(state.steps)}.` };
  }
  if (state.status === 'crashed') {
    return { kind: 'crashed', text: `Аварійна зупинка: ${state.error ?? 'невідома причина'}.` };
  }
  if (snapshot.limitReached) {
    return {
      kind: 'limit',
      text: `Перевищено ліміт кроків (${formatNumber(snapshot.limit)}). Можливе зациклення.`,
    };
  }
  if (snapshot.playing) return { kind: 'running', text: 'Виконується…' };
  if (state.steps === 0) return { kind: 'idle', text: 'Готово до запуску.' };
  return { kind: 'paused', text: 'Пауза.' };
}
