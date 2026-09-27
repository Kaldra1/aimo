import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeBaseLinks from './src/lib/markdown/rehype-base-links';

/** Сайт публікується як GitHub Pages проєкту: https://kaldra1.github.io/aimo/ */
const SITE = 'https://kaldra1.github.io';
const BASE = '/aimo';

type UnicodeRange = [string, ...string[]];

// Діапазони Unicode з CSS пакетів @fontsource: браузер завантажує лише потрібні файли.
const LATIN: UnicodeRange = [
  'U+0000-00FF',
  'U+0131',
  'U+0152-0153',
  'U+02BB-02BC',
  'U+02C6',
  'U+02DA',
  'U+02DC',
  'U+0304',
  'U+0308',
  'U+0329',
  'U+2000-206F',
  'U+20AC',
  'U+2122',
  'U+2191',
  'U+2193',
  'U+2212',
  'U+2215',
  'U+FEFF',
  'U+FFFD',
];
const CYRILLIC: UnicodeRange = ['U+0301', 'U+0400-045F', 'U+0490-0491', 'U+04B0-04B1', 'U+2116'];
const GREEK: UnicodeRange = [
  'U+0370-0377',
  'U+037A-037F',
  'U+0384-038A',
  'U+038C',
  'U+038E-03A1',
  'U+03A3-03FF',
];

/** Self-hosted шрифти з npm-пакетів @fontsource — без звернень до CDN. */
function fontsource(
  pkg: string,
  weights: number[],
  subsets: Record<string, UnicodeRange>,
): {
  variants: [
    { weight: number; style: 'normal'; src: [string]; unicodeRange: UnicodeRange },
    ...{ weight: number; style: 'normal'; src: [string]; unicodeRange: UnicodeRange }[],
  ];
} {
  const variants = weights.flatMap((weight) =>
    Object.entries(subsets).map(([subset, unicodeRange]) => ({
      weight,
      style: 'normal' as const,
      src: [`./node_modules/@fontsource/${pkg}/files/${pkg}-${subset}-${weight}-normal.woff2`] as [
        string,
      ],
      unicodeRange,
    })),
  );
  const [first, ...rest] = variants;
  if (!first) throw new Error(`Не задано жодного варіанта шрифту ${pkg}`);
  return { variants: [first, ...rest] };
}

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  integrations: [mdx(), preact()],
  vite: {
    build: {
      rolldownOptions: {
        onLog(level, log, handler) {
          // Astro 7 позначає кожен MDX-файл директивою "use astro:head-inject", яку Rolldown
          // не зберігає під час бандлінгу. Astro її не читає (стилі передаються через метадані
          // модулів), тож попередження лише засмічує лог збирання.
          if (log.code === 'MODULE_LEVEL_DIRECTIVE' && log.message.includes('astro:head-inject')) {
            return;
          }
          handler(level, log);
        },
      },
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex, [rehypeBaseLinks, { base: BASE }]],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-body',
      fallbacks: ['sans-serif'],
      options: fontsource('inter', [400, 600], { latin: LATIN, cyrillic: CYRILLIC }),
    },
    {
      provider: fontProviders.local(),
      name: 'Manrope',
      cssVariable: '--font-heading',
      fallbacks: ['sans-serif'],
      options: fontsource('manrope', [700], { latin: LATIN, cyrillic: CYRILLIC }),
    },
    {
      provider: fontProviders.local(),
      name: 'Roboto Mono',
      cssVariable: '--font-mono',
      fallbacks: ['monospace'],
      options: fontsource('roboto-mono', [400, 700], {
        latin: LATIN,
        cyrillic: CYRILLIC,
        greek: GREEK,
      }),
    },
  ],
});
