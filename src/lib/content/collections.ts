import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import courseSource from '../../data/course.yaml?raw';
import { url } from '../url';
import {
  buildLinkIndex,
  isPublished,
  parseCourse,
  sortLectures,
  sortSessions,
  validateCourseContent,
} from './course';

export type Lecture = CollectionEntry<'lectures'>;
export type Session = CollectionEntry<'sessions'>;

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
