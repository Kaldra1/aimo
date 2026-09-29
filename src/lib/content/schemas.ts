import { z } from 'astro/zod';
import { MACHINES } from '../machines/meta';

export { MACHINES, type MachineId } from '../machines/meta';

// Повідомлення про помилки валідації — українською: їх бачить автор контенту.
z.config(z.locales.uk());

export const SESSION_KINDS = ['lab', 'practical'] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

const positiveInt = z.number().int().positive();

/** Слайди: шлях від кореня сайту (`/files/slides/…`) або повна адреса `https://…`. */
const slidesPath = z
  .string()
  .trim()
  .refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), {
    message: 'Шлях до слайдів має починатися з «/» (файл у public/) або з «https://»',
  });

export const lectureSchema = z.strictObject({
  number: positiveInt,
  title: z.string().trim().min(1),
  module: positiveInt,
  topic: positiveInt,
  slides: slidesPath.optional(),
  related: z.array(z.string().trim().min(1)).default([]),
  draft: z.boolean().default(false),
});

export const sessionSchema = z.strictObject({
  kind: z.enum(SESSION_KINDS),
  number: positiveInt,
  title: z.string().trim().min(1),
  hours: z.number().positive(),
  topic: positiveInt,
  emulator: z.enum(MACHINES).optional(),
  draft: z.boolean().default(false),
});

export const pageSchema = z.strictObject({
  title: z.string().trim().min(1),
});

/** Ідентифікатор задачі: машина, дефіс, номер із трьох цифр — `post-001`. */
export const TASK_ID = /^(post|turing|markov)-\d{3}$/;

export const taskTestSchema = z.strictObject({
  /** Вхідна стрічка в нотації машини. */
  input: z.string(),
  /** Очікуваний стан стрічки після зупинки. */
  expected: z.string(),
  /** Чи перевіряти положення каретки (у expected її позначають дужками). */
  checkHead: z.boolean().default(false),
});

export const taskSchema = z.strictObject({
  id: z.string().regex(TASK_ID, 'Ідентифікатор задачі має вигляд post-001, turing-002 тощо'),
  machine: z.enum(MACHINES),
  title: z.string().trim().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  topic: positiveInt,
  related: z.array(z.string().trim().min(1)).default([]),
  /** Заготовка програми: текст програми Поста або правила Тюрінга `q0, 1 -> 1, R, q0`. */
  starter: z.string().default(''),
  /** Алфавіт задачі (для Тюрінга). Студент може додати до нього допоміжні символи. */
  alphabet: z.string().default(''),
  /** Ліміт кроків на один тест. */
  maxSteps: positiveInt.max(1_000_000).optional(),
  tests: z.array(taskTestSchema).min(1),
  hints: z.array(z.string().trim().min(1)).default([]),
  draft: z.boolean().default(false),
});

const topicSchema = z.strictObject({
  number: positiveInt,
  title: z.string().trim().min(1),
});

export const courseSchema = z.strictObject({
  title: z.string().trim().min(1),
  short: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  modules: z
    .array(
      z.strictObject({
        number: positiveInt,
        title: z.string().trim().min(1),
        topics: z.array(topicSchema).min(1),
      }),
    )
    .min(1),
});

export type TaskData = z.output<typeof taskSchema>;
export type LectureData = z.output<typeof lectureSchema>;
export type SessionData = z.output<typeof sessionSchema>;
export type Course = z.output<typeof courseSchema>;
