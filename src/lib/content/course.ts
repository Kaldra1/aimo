import { parse as parseYaml } from 'yaml';
import { MACHINE_META } from '../machines/meta';
import {
  courseSchema,
  type Course,
  type LectureData,
  SESSION_KINDS,
  type SessionData,
  type SessionKind,
} from './schemas';

export { MACHINE_META };

export interface Topic {
  number: number;
  title: string;
  module: number;
}

export interface LectureEntry {
  id: string;
  data: LectureData;
}

export interface SessionEntry {
  id: string;
  data: SessionData;
}

export const SESSION_META: Record<
  SessionKind,
  {
    title: string;
    plural: string;
    short: string;
    segment: string;
    prev: string;
    next: string;
  }
> = {
  lab: {
    title: 'Лабораторна робота',
    plural: 'Лабораторні роботи',
    short: 'ЛР',
    segment: 'labs',
    prev: 'Попередня робота',
    next: 'Наступна робота',
  },
  practical: {
    title: 'Практичне заняття',
    plural: 'Практичні заняття',
    short: 'ПЗ',
    segment: 'practicals',
    prev: 'Попереднє заняття',
    next: 'Наступне заняття',
  },
};

/** Розбирає й перевіряє `src/data/course.yaml`. */
export function parseCourse(text: string): Course {
  const course = courseSchema.parse(parseYaml(text));
  const problems = [
    ...duplicates(course.modules.map((m) => m.number)).map(
      (n) => `Змістовий модуль ${n} описано кілька разів`,
    ),
    ...duplicates(topicsOf(course).map((t) => t.number)).map(
      (n) => `Тему ${n} описано кілька разів`,
    ),
  ];
  if (problems.length > 0) throw new Error(`course.yaml: ${problems.join('; ')}`);
  return course;
}

export function topicsOf(course: Course): Topic[] {
  return course.modules.flatMap((module) =>
    module.topics.map((topic) => ({ ...topic, module: module.number })),
  );
}

export function findTopic(course: Course, number: number): Topic | undefined {
  return topicsOf(course).find((topic) => topic.number === number);
}

export const moduleLabel = (number: number) => `Змістовий модуль ${number}`;
export const topicLabel = (number: number) => `Тема ${number}`;
export const lectureLabel = (number: number) => `Лекція ${number}`;
export const sessionLabel = (kind: SessionKind, number: number) =>
  `${SESSION_META[kind].title} №${number}`;
export const sessionShortLabel = (kind: SessionKind, number: number) =>
  `${SESSION_META[kind].short}${number}`;

export const lecturePath = (id: string) => `/lectures/${id}/`;
export const sessionPath = (kind: SessionKind, number: number) =>
  `/${SESSION_META[kind].segment}/${number}/`;

/** Чернетки видно в dev-режимі; у продакшн-збірці вони показуються як «Скоро». */
export function isPublished(draft: boolean, showDrafts: boolean): boolean {
  return showDrafts || !draft;
}

export function sortLectures<T extends LectureEntry>(lectures: T[]): T[] {
  return [...lectures].sort((a, b) => a.data.number - b.data.number);
}

export function sortSessions<T extends SessionEntry>(sessions: T[]): T[] {
  const kindOrder = (kind: SessionKind) => SESSION_KINDS.indexOf(kind);
  return [...sessions].sort(
    (a, b) => kindOrder(a.data.kind) - kindOrder(b.data.kind) || a.data.number - b.data.number,
  );
}

/** Попередній і наступний опублікований елемент відсортованого списку. */
export function neighbors<T>(
  items: readonly T[],
  isCurrent: (item: T) => boolean,
  isVisible: (item: T) => boolean,
): { prev: T | undefined; next: T | undefined } {
  const index = items.findIndex(isCurrent);
  if (index === -1) return { prev: undefined, next: undefined };
  const prev = items.slice(0, index).reverse().find(isVisible);
  const next = items.slice(index + 1).find(isVisible);
  return { prev, next };
}

/** Перевіряє узгодженість лекцій і занять зі структурою курсу. Повертає список проблем. */
export function validateCourseContent(
  course: Course,
  lectures: readonly LectureEntry[],
  sessions: readonly SessionEntry[],
): string[] {
  const problems: string[] = [];

  for (const n of duplicates(lectures.map((l) => l.data.number))) {
    const files = lectures.filter((l) => l.data.number === n).map((l) => l.id);
    problems.push(`Номер лекції ${n} повторюється: ${files.join(', ')}`);
  }
  for (const lecture of lectures) {
    const topic = findTopic(course, lecture.data.topic);
    if (!topic) {
      problems.push(`Лекція «${lecture.id}»: теми ${lecture.data.topic} немає в course.yaml`);
    } else if (topic.module !== lecture.data.module) {
      problems.push(
        `Лекція «${lecture.id}»: тема ${topic.number} належить до модуля ${topic.module}, а вказано модуль ${lecture.data.module}`,
      );
    }
  }

  for (const kind of SESSION_KINDS) {
    const ofKind = sessions.filter((s) => s.data.kind === kind);
    for (const n of duplicates(ofKind.map((s) => s.data.number))) {
      const files = ofKind.filter((s) => s.data.number === n).map((s) => s.id);
      problems.push(`${SESSION_META[kind].title} №${n} повторюється: ${files.join(', ')}`);
    }
  }
  for (const session of sessions) {
    if (!findTopic(course, session.data.topic)) {
      problems.push(`Заняття «${session.id}»: теми ${session.data.topic} немає в course.yaml`);
    }
  }

  return problems;
}

export interface LinkTarget {
  path: string;
  title: string;
  draft: boolean;
}

/** Нормалізує посилання з поля `related`: `/labs/1/` → `labs/1`. */
export function normalizeRef(ref: string): string {
  return ref.trim().replace(/^\/+|\/+$/g, '');
}

/** Усі сторінки, на які можна послатися в полі `related`. */
export function buildLinkIndex(
  lectures: readonly LectureEntry[],
  sessions: readonly SessionEntry[],
): Map<string, LinkTarget> {
  const index = new Map<string, LinkTarget>();
  for (const lecture of lectures) {
    const path = lecturePath(lecture.id);
    index.set(normalizeRef(path), {
      path,
      title: `${lectureLabel(lecture.data.number)}. ${lecture.data.title}`,
      draft: lecture.data.draft,
    });
  }
  for (const session of sessions) {
    const path = sessionPath(session.data.kind, session.data.number);
    index.set(normalizeRef(path), {
      path,
      title: `${sessionLabel(session.data.kind, session.data.number)}. ${session.data.title}`,
      draft: session.data.draft,
    });
  }
  for (const machine of Object.values(MACHINE_META)) {
    index.set(normalizeRef(machine.path), {
      path: machine.path,
      title: `Емулятор: ${machine.title}`,
      draft: !machine.ready,
    });
  }
  return index;
}

/** Перетворює поле `related` на посилання. Невідоме посилання — помилка збирання. */
export function resolveRelated(
  refs: readonly string[],
  index: ReadonlyMap<string, LinkTarget>,
  source: string,
): LinkTarget[] {
  const unknown = refs.filter((ref) => !index.has(normalizeRef(ref)));
  if (unknown.length > 0) {
    throw new Error(
      `${source}: невідомі посилання в полі related: ${unknown.map((r) => `«${r}»`).join(', ')}. ` +
        'Приклади правильних: «labs/1», «practicals/2», «lectures/03-post-machine», «emulators/post».',
    );
  }
  return refs.map((ref) => index.get(normalizeRef(ref)) as LinkTarget);
}

export interface TopicGroup<L, S> {
  topic: Topic;
  lectures: L[];
  sessions: S[];
}

export interface ModuleGroup<L, S> {
  number: number;
  title: string;
  topics: TopicGroup<L, S>[];
}

/** Групує лекції й заняття за змістовими модулями й темами (порядок — як у course.yaml). */
export function groupByTopic<L extends LectureEntry, S extends SessionEntry>(
  course: Course,
  lectures: readonly L[],
  sessions: readonly S[],
): ModuleGroup<L, S>[] {
  return course.modules.map((module) => ({
    number: module.number,
    title: module.title,
    topics: module.topics.map((topic) => ({
      topic: { ...topic, module: module.number },
      lectures: sortLectures(lectures.filter((l) => l.data.topic === topic.number)),
      sessions: sortSessions(sessions.filter((s) => s.data.topic === topic.number)),
    })),
  }));
}

function duplicates(values: readonly number[]): number[] {
  const seen = new Set<number>();
  const repeated = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}
