import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { lectureSchema, pageSchema, sessionSchema, taskSchema } from './lib/content/schemas';

// Файли, що починаються з «_», — шаблони для копіювання, на сайт вони не потрапляють.
const CONTENT_FILES = '**/[^_]*.{md,mdx}';

const lectures = defineCollection({
  loader: glob({ pattern: CONTENT_FILES, base: './src/content/lectures' }),
  schema: lectureSchema,
});

const sessions = defineCollection({
  loader: glob({ pattern: CONTENT_FILES, base: './src/content/sessions' }),
  schema: sessionSchema,
});

const pages = defineCollection({
  loader: glob({ pattern: CONTENT_FILES, base: './src/content/pages' }),
  schema: pageSchema,
});

const tasks = defineCollection({
  loader: glob({ pattern: CONTENT_FILES, base: './src/content/tasks' }),
  schema: taskSchema,
});

export const collections = { lectures, sessions, pages, tasks };
