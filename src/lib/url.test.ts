import { describe, expect, it } from 'vitest';
import { normalizeBase, withBase } from './url';

describe('normalizeBase', () => {
  it.each([
    ['/aimo', '/aimo'],
    ['/aimo/', '/aimo'],
    ['aimo', '/aimo'],
    ['/', ''],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBase(input)).toBe(expected);
  });
});

describe('withBase', () => {
  it('додає базовий шлях до посилання від кореня', () => {
    expect(withBase('/labs/1/', '/aimo')).toBe('/aimo/labs/1/');
    expect(withBase('/files/slides/lecture-03.pdf', '/aimo/')).toBe(
      '/aimo/files/slides/lecture-03.pdf',
    );
    expect(withBase('/', '/aimo')).toBe('/aimo/');
  });

  it('не змінює вже доповнені посилання', () => {
    expect(withBase('/aimo/labs/1/', '/aimo')).toBe('/aimo/labs/1/');
    expect(withBase('/aimo', '/aimo')).toBe('/aimo');
    expect(withBase('/aimo#top', '/aimo')).toBe('/aimo#top');
  });

  it('не плутає шлях, що лише починається з тих самих літер', () => {
    expect(withBase('/aimo-extra/', '/aimo')).toBe('/aimo/aimo-extra/');
  });

  it('не чіпає зовнішні, відносні й якірні посилання', () => {
    expect(withBase('https://example.com/a', '/aimo')).toBe('https://example.com/a');
    expect(withBase('//cdn.example.com/x.js', '/aimo')).toBe('//cdn.example.com/x.js');
    expect(withBase('#section', '/aimo')).toBe('#section');
    expect(withBase('relative/page/', '/aimo')).toBe('relative/page/');
    expect(withBase('mailto:teacher@example.com', '/aimo')).toBe('mailto:teacher@example.com');
  });

  it('без базового шляху повертає посилання як є', () => {
    expect(withBase('/labs/1/', '/')).toBe('/labs/1/');
  });
});
