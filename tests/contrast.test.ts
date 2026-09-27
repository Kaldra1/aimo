/** Контраст кольорів дизайн-токенів за WCAG 2.1 (рівень AA) для світлої й темної тем. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');

function colors(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Не знайдено блок ${selector}`);
  const body = css.slice(start, css.indexOf('}', start));
  const result: Record<string, string> = {};
  for (const match of body.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    result[match[1]!] = match[2]!;
  }
  return result;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const light = colors(':root');
const themes = {
  світла: light,
  темна: { ...light, ...colors(":root[data-theme='dark']") },
};

/** [колір, фон, мінімальний контраст]: 4.5 — текст, 3 — межі й елементи інтерфейсу. */
const PAIRS: Array<[string, string, number]> = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surface-strong', 4.5],
  ['text-muted', 'bg', 4.5],
  ['text-muted', 'surface', 4.5],
  ['primary', 'bg', 4.5],
  ['primary', 'surface', 4.5],
  ['primary', 'primary-soft', 4.5],
  ['primary-hover', 'bg', 4.5],
  ['on-primary', 'primary', 4.5],
  ['on-primary', 'primary-hover', 4.5],
  ['on-accent', 'accent', 4.5],
  ['text', 'accent-soft', 4.5],
  ['accent-text', 'bg', 4.5],
  ['accent-text', 'accent-soft', 4.5],
  ['danger', 'bg', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['text', 'danger-soft', 4.5],
  ['text', 'primary-soft', 4.5],
  ['border-strong', 'bg', 3],
  ['border-strong', 'surface', 3],
  ['focus', 'bg', 3],
  ['focus', 'surface', 3],
  ['primary', 'primary-soft', 3],
];

describe.each(Object.entries(themes))('тема: %s', (_name, palette) => {
  it.each(PAIRS)('%s на %s ≥ %d:1', (foreground, background, min) => {
    const fg = palette[foreground];
    const bg = palette[background];
    expect(fg, `немає токена --color-${foreground}`).toBeDefined();
    expect(bg, `немає токена --color-${background}`).toBeDefined();
    expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(min);
  });

  // Каретка емулятора — бурштинова рамка з темним обведенням: помітною має бути хоча б одна лінія.
  it.each(['bg', 'surface'])('каретка помітна на %s', (background) => {
    const best = Math.max(
      contrast(palette['accent']!, palette[background]!),
      contrast(palette['on-accent']!, palette[background]!),
    );
    expect(best).toBeGreaterThanOrEqual(3);
  });
});
