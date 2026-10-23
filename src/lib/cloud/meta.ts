/** Опис занять і тем для кабінету й дашборду (лише під час збирання). */
import { course, loadContent } from '../content/collections';
import { sessionShortLabel, topicLabel } from '../content/course';
import { checkableSessions, loadVariantTests } from '../variants/load';
import type { SessionMeta, TopicMeta } from './types';

export async function loadCloudMeta(): Promise<{
  sessions: SessionMeta[];
  topics: TopicMeta[];
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
    }));
  const topics = course.modules
    .flatMap((m) => m.topics)
    .map((t) => ({ number: t.number, label: topicLabel(t.number), title: t.title }));
  const tests = Object.fromEntries([...checkable].map((id) => [id, loadVariantTests(id) ?? {}]));
  return { sessions: metas, topics, tests };
}
