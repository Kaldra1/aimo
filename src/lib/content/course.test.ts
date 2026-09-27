import { describe, expect, it } from 'vitest';
import {
  buildLinkIndex,
  groupByTopic,
  isPublished,
  neighbors,
  normalizeRef,
  parseCourse,
  resolveRelated,
  sortSessions,
  validateCourseContent,
  type LectureEntry,
  type SessionEntry,
} from './course';
import type { SessionKind } from './schemas';

const COURSE_YAML = `
title: Курс
short: К
audience: Студенти
modules:
  - number: 1
    title: Перший модуль
    topics:
      - number: 1
        title: Перша тема
      - number: 2
        title: Друга тема
  - number: 2
    title: Другий модуль
    topics:
      - number: 3
        title: Третя тема
`;

const course = parseCourse(COURSE_YAML);

function lecture(id: string, number: number, topic: number, module: number, draft = false) {
  return { id, data: { number, title: `Лекція ${number}`, module, topic, related: [], draft } };
}

function session(kind: SessionKind, number: number, topic: number, draft = false): SessionEntry {
  return {
    id: `${kind}-${number}`,
    data: { kind, number, title: `Заняття ${number}`, hours: 2, topic, draft },
  };
}

describe('parseCourse', () => {
  it('читає модулі й теми', () => {
    expect(course.modules).toHaveLength(2);
    expect(course.modules[1]?.topics[0]?.title).toBe('Третя тема');
  });

  it('відхиляє повторні номери тем', () => {
    const broken = COURSE_YAML.replace('number: 3', 'number: 2');
    expect(() => parseCourse(broken)).toThrow(/Тему 2 описано кілька разів/);
  });

  it('відхиляє файл без обов’язкових полів', () => {
    expect(() => parseCourse('title: Курс')).toThrow();
  });
});

describe('validateCourseContent', () => {
  it('приймає узгоджений контент', () => {
    const lectures = [lecture('a', 1, 1, 1), lecture('b', 2, 3, 2)];
    const sessions = [session('lab', 1, 2), session('practical', 1, 3)];
    expect(validateCourseContent(course, lectures, sessions)).toEqual([]);
  });

  it('знаходить повторні номери, невідомі теми й невідповідність модуля', () => {
    const lectures = [lecture('a', 1, 1, 1), lecture('b', 1, 9, 1), lecture('c', 3, 3, 1)];
    const sessions = [session('lab', 1, 2), session('lab', 1, 7), session('practical', 1, 1)];
    const problems = validateCourseContent(course, lectures, sessions);
    expect(problems).toEqual([
      'Номер лекції 1 повторюється: a, b',
      'Лекція «b»: теми 9 немає в course.yaml',
      'Лекція «c»: тема 3 належить до модуля 2, а вказано модуль 1',
      'Лабораторна робота №1 повторюється: lab-1, lab-1',
      'Заняття «lab-1»: теми 7 немає в course.yaml',
    ]);
  });
});

describe('isPublished', () => {
  it('чернетку видно лише в dev-режимі', () => {
    expect(isPublished(true, true)).toBe(true);
    expect(isPublished(true, false)).toBe(false);
    expect(isPublished(false, false)).toBe(true);
  });
});

describe('neighbors', () => {
  const items = [1, 2, 3, 4, 5];
  const odd = (n: number) => n % 2 === 1;

  it('пропускає неопубліковані елементи', () => {
    expect(neighbors(items, (n) => n === 3, odd)).toEqual({ prev: 1, next: 5 });
  });

  it('на краях повертає undefined', () => {
    expect(
      neighbors(
        items,
        (n) => n === 1,
        () => true,
      ),
    ).toEqual({ prev: undefined, next: 2 });
    expect(
      neighbors(
        items,
        (n) => n === 5,
        () => true,
      ),
    ).toEqual({ prev: 4, next: undefined });
  });

  it('для відсутнього елемента нічого не повертає', () => {
    expect(
      neighbors(
        items,
        (n) => n === 42,
        () => true,
      ),
    ).toEqual({
      prev: undefined,
      next: undefined,
    });
  });
});

describe('related', () => {
  const lectures: LectureEntry[] = [lecture('03-post-machine', 3, 2, 1)];
  const sessions = [session('lab', 1, 2, true)];
  const index = buildLinkIndex(lectures, sessions);

  it('нормалізує посилання', () => {
    expect(normalizeRef('/labs/1/')).toBe('labs/1');
    expect(normalizeRef(' emulators/post ')).toBe('emulators/post');
  });

  it('перетворює посилання на заголовки й адреси', () => {
    expect(
      resolveRelated(['labs/1', '/lectures/03-post-machine/', 'emulators/post'], index, 'тест'),
    ).toEqual([
      { path: '/labs/1/', title: 'Лабораторна робота №1. Заняття 1', draft: true },
      { path: '/lectures/03-post-machine/', title: 'Лекція 3. Лекція 3', draft: false },
      { path: '/emulators/post/', title: 'Емулятор: Машина Поста', draft: expect.any(Boolean) },
    ]);
  });

  it('невідоме посилання зупиняє збирання з поясненням', () => {
    expect(() => resolveRelated(['labs/9', 'labs/1'], index, 'Лекція «x»')).toThrow(
      /Лекція «x»: невідомі посилання в полі related: «labs\/9»/,
    );
  });
});

describe('groupByTopic', () => {
  it('групує за модулями й темами у порядку course.yaml', () => {
    const lectures = [lecture('b', 2, 1, 1), lecture('a', 1, 1, 1), lecture('c', 3, 3, 2)];
    const sessions = [session('practical', 1, 1), session('lab', 2, 1), session('lab', 1, 1)];
    const groups = groupByTopic(course, lectures, sessions);

    expect(groups.map((m) => m.topics.map((t) => t.topic.number))).toEqual([[1, 2], [3]]);
    const first = groups[0]!.topics[0]!;
    expect(first.lectures.map((l) => l.id)).toEqual(['a', 'b']);
    expect(first.sessions.map((s) => s.id)).toEqual(['lab-1', 'lab-2', 'practical-1']);
    expect(groups[0]!.topics[1]!.lectures).toEqual([]);
  });

  it('сортує заняття: спочатку лабораторні, потім практичні', () => {
    const sorted = sortSessions([session('practical', 1, 1), session('lab', 3, 1)]);
    expect(sorted.map((s) => s.id)).toEqual(['lab-3', 'practical-1']);
  });
});
