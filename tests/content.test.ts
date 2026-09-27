/**
 * Перевірка реального контенту: схеми, структура курсу, посилання related і файли слайдів.
 * Ті самі правила діють під час збирання сайту — тут вони ловлять помилку раніше.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  buildLinkIndex,
  parseCourse,
  resolveRelated,
  validateCourseContent,
  type LectureEntry,
  type SessionEntry,
} from '../src/lib/content/course';
import { lectureSchema, sessionSchema } from '../src/lib/content/schemas';

const CONTENT = join(process.cwd(), 'src', 'content');
const course = parseCourse(readFileSync(join(process.cwd(), 'src', 'data', 'course.yaml'), 'utf8'));

function frontmatter(path: string): unknown {
  const text = readFileSync(path, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) throw new Error(`${path}: немає frontmatter`);
  return parseYaml(match[1] ?? '');
}

function contentFiles(dir: string, templates = false): string[] {
  return readdirSync(join(CONTENT, dir))
    .filter((name) => /\.mdx?$/.test(name) && name.startsWith('_') === templates)
    .sort();
}

const idOf = (name: string) => name.replace(/\.mdx?$/, '');

const lectures: LectureEntry[] = contentFiles('lectures').map((name) => ({
  id: idOf(name),
  data: lectureSchema.parse(frontmatter(join(CONTENT, 'lectures', name))),
}));

const sessions: SessionEntry[] = contentFiles('sessions').map((name) => ({
  id: idOf(name),
  data: sessionSchema.parse(frontmatter(join(CONTENT, 'sessions', name))),
}));

describe('контент курсу', () => {
  it('лекції й заняття узгоджені зі структурою курсу', () => {
    expect(lectures.length).toBeGreaterThan(0);
    expect(sessions.length).toBeGreaterThan(0);
    expect(validateCourseContent(course, lectures, sessions)).toEqual([]);
  });

  it('усі посилання related ведуть на наявні сторінки', () => {
    const index = buildLinkIndex(lectures, sessions);
    for (const lecture of lectures) {
      expect(() =>
        resolveRelated(lecture.data.related, index, `Лекція «${lecture.id}»`),
      ).not.toThrow();
    }
  });

  it('файли слайдів існують у public/', () => {
    for (const lecture of lectures) {
      const { slides } = lecture.data;
      if (slides?.startsWith('/')) {
        expect(existsSync(join(process.cwd(), 'public', slides)), slides).toBe(true);
      }
    }
  });

  it('назви файлів лекцій придатні для адрес сторінок', () => {
    for (const lecture of lectures) expect(lecture.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('шаблони для копіювання проходять перевірку схем', () => {
    for (const name of contentFiles('lectures', true)) {
      expect(() => lectureSchema.parse(frontmatter(join(CONTENT, 'lectures', name)))).not.toThrow();
    }
    const sessionTemplates = contentFiles('sessions', true);
    expect(sessionTemplates.length).toBeGreaterThan(0);
    for (const name of sessionTemplates) {
      expect(() => sessionSchema.parse(frontmatter(join(CONTENT, 'sessions', name)))).not.toThrow();
    }
  });
});

describe('схеми', () => {
  it('ловлять одруківки в назвах полів', () => {
    const result = lectureSchema.safeParse({
      number: 1,
      title: 'Т',
      module: 1,
      topic: 1,
      draf: true,
    });
    expect(result.success).toBe(false);
  });

  it('перевіряють шлях до слайдів', () => {
    const base = { number: 1, title: 'Т', module: 1, topic: 1 };
    expect(lectureSchema.safeParse({ ...base, slides: 'files/a.pdf' }).success).toBe(false);
    expect(lectureSchema.safeParse({ ...base, slides: '/files/slides/a.pdf' }).success).toBe(true);
    expect(lectureSchema.safeParse({ ...base, slides: 'https://example.com/a.pdf' }).success).toBe(
      true,
    );
  });

  it('заняття має бути лабораторною або практичним', () => {
    const base = { number: 1, title: 'Т', hours: 2, topic: 1 };
    expect(sessionSchema.safeParse({ ...base, kind: 'lab' }).success).toBe(true);
    expect(sessionSchema.safeParse({ ...base, kind: 'seminar' }).success).toBe(false);
  });
});
