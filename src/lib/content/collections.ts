import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import courseSource from '../../data/course.yaml?raw';
import { MACHINES } from '../machines/meta';
import { validateTask } from '../tasks/validate';
import { url } from '../url';
import {
  buildLinkIndex,
  findTopic,
  isPublished,
  parseCourse,
  sortLectures,
  sortSessions,
  validateCourseContent,
} from './course';

export type Lecture = CollectionEntry<'lectures'>;
export type Session = CollectionEntry<'sessions'>;
export type Task = CollectionEntry<'tasks'>;

/** Чернетки показуємо повністю лише в dev-режимі (`npm run dev`). */
export const SHOW_DRAFTS = import.meta.env.DEV;

export const course = parseCourse(courseSource);

export const published = (entry: { data: { draft: boolean } }) =>
  isPublished(entry.data.draft, SHOW_DRAFTS);

/** Лекції й заняття, відсортовані й перевірені на узгодженість зі структурою курсу. */
export async function loadContent(): Promise<{ lectures: Lecture[]; sessions: Session[] }> {
  const [lectures, sessions] = await Promise.all([
    getCollection('lectures'),
    getCollection('sessions'),
  ]);
  const problems = validateCourseContent(course, lectures, sessions);
  if (problems.length > 0) {
    throw new Error(`Помилки в контенті курсу:\n- ${problems.join('\n- ')}`);
  }
  return { lectures: sortLectures(lectures), sessions: sortSessions(sessions) };
}

export async function loadLinkIndex() {
  const { lectures, sessions } = await loadContent();
  return buildLinkIndex(lectures, sessions);
}

/** Посилання на слайди лекції. Файл у public/ має існувати, інакше збирання зупиниться. */
export function slidesHref(lecture: Lecture): string | undefined {
  const { slides } = lecture.data;
  if (!slides) return undefined;
  if (!slides.startsWith('/')) return slides;
  if (!existsSync(join(process.cwd(), 'public', slides))) {
    throw new Error(
      `Лекція «${lecture.id}»: файл слайдів «${slides}» не знайдено. ` +
        `Покладіть його в public${slides} або виправте поле slides.`,
    );
  }
  return url(slides);
}

/** Опубліковані задачі, перевірені й упорядковані: за машиною, потім за номером. */
export async function loadTasks(): Promise<Task[]> {
  const tasks = await getCollection('tasks');
  const problems = tasks.flatMap((task) => [
    ...validateTask(task.id, task.data),
    ...(findTopic(course, task.data.topic)
      ? []
      : [`Задача «${task.id}»: теми ${task.data.topic} немає в course.yaml`]),
  ]);
  if (problems.length > 0) {
    throw new Error(`Помилки в задачах:\n- ${problems.join('\n- ')}`);
  }
  return tasks
    .filter(published)
    .sort(
      (a, b) =>
        MACHINES.indexOf(a.data.machine) - MACHINES.indexOf(b.data.machine) ||
        a.id.localeCompare(b.id),
    );
}
