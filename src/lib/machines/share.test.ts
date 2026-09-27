import { describe, expect, it } from 'vitest';
import { decodeShareHash, encodeShareHash, readEnvelope, writeEnvelope } from './share';

describe('формат збереження', () => {
  it('записує поле machine і version', () => {
    const text = writeEnvelope('post', { program: 'p', input: 'i' });
    expect(JSON.parse(text)).toEqual({ machine: 'post', version: 1, program: 'p', input: 'i' });
  });

  it.each([
    ['не JSON', /не JSON/],
    ['[1, 2]', /немає програми/],
    ['{"version": 1}', /поле machine/],
    ['{"machine": "post"}', /поле version/],
    ['{"machine": "post", "version": 2, "program": ""}', /новішою версією/],
    ['{"machine": "post", "version": 1}', /немає поля program/],
    ['{"machine": "markov", "version": 1}', /нормальних алгоритмів Маркова/],
  ])('відхиляє %s', (text, message) => {
    expect(() => readEnvelope('post', text, ['program'])).toThrow(message);
  });
});

describe('посилання «Поділитися»', () => {
  it('стискає й відновлює текст з кирилицею та спецсимволами', () => {
    const text = writeEnvelope('post', {
      program: '1. → 2 // «так» & ні + 100%\n2. !',
      input: '1³',
    });
    const hash = encodeShareHash(text);
    expect(hash).toMatch(/^s=[A-Za-z0-9+\-$]+$/);
    expect(decodeShareHash(`#${hash}`)).toBe(text);
    expect(decodeShareHash(hash)).toBe(text);
  });

  it('повертає null для відсутнього або пошкодженого стану', () => {
    expect(decodeShareHash('')).toBeNull();
    expect(decodeShareHash('#other=1')).toBeNull();
    expect(decodeShareHash('#s=@@@')).toBeNull();
  });
});
