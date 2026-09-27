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

export type LectureData = z.output<typeof lectureSchema>;
export type SessionData = z.output<typeof sessionSchema>;
export type Course = z.output<typeof courseSchema>;
