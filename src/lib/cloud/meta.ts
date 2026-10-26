/** Опис занять і тем для кабінету й дашборду (лише під час збирання). */
import { loadContent } from '../content/collections';
import { sessionShortLabel } from '../content/course';
import { checkableSessions, loadVariants, loadVariantTests } from '../variants/load';
import type { SessionMeta } from './types';

/** Машина варіантів заняття (у файлі варіантів), за замовчуванням — алгоритми Маркова. */
function machineOf(id: string): SessionMeta['machine'] {
  const machine = loadVariants(id).machine;
  return machine === 'post' || machine === 'turing' ? machine : 'markov';
}

export async function loadCloudMeta(): Promise<{
  sessions: SessionMeta[];
  tests: Record<string, Record<string, string[]>>;
}> {
  const { sessions } = await loadContent();
  const checkable = new Set(checkableSessions());
  const order = (kind: string) => (kind === 'lab' ? 0 : 1);
  const metas = [...sessions]
    .sort(
      (a, b) =>
        a.data.topic - b.data.topic ||
        order(a.data.kind) - order(b.data.kind) ||
        a.data.number - b.data.number,
    )
    .map((s) => ({
      id: s.id,
      label: sessionShortLabel(s.data.kind, s.data.number),
      title: s.data.title,
      topic: s.data.topic,
      checkable: checkable.has(s.id),
      machine: checkable.has(s.id) ? machineOf(s.id) : undefined,
    }));
  const tests = Object.fromEntries([...checkable].map((id) => [id, loadVariantTests(id) ?? {}]));
  return { sessions: metas, tests };
}
