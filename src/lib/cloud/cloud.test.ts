import { describe, expect, it } from 'vitest';
import {
  credentialsCsv,
  LOGIN_DOMAIN,
  loginFromEmail,
  loginOf,
  loginToEmail,
  parseRoster,
} from './accounts';
import { fingerprint, parseProgram, parseVariantTaskId, programText, recheck } from './solutions';

describe('логіни', () => {
  it('група й номер з двох цифр', () => {
    expect(loginOf('ki2406', 7)).toBe('ki2406-07');
    expect(loginOf('ki2406', 26)).toBe('ki2406-26');
  });

  it('введений логін → технічна пошта, з поблажками до запису', () => {
    const email = `ki2406-07@${LOGIN_DOMAIN}`;
    for (const input of ['ki2406-07', ' KI2406-07 ', 'ki2406-7', 'КІ-2406-07', 'кі2406 07']) {
      expect(loginToEmail(input), input).toBe(email);
    }
    expect(loginToEmail('teacher@example.com')).toBe('teacher@example.com');
    expect(loginToEmail('петренко')).toBeNull();
    expect(loginToEmail('ki2406-123')).toBeNull();
  });

  it('логін із технічної пошти', () => {
    expect(loginFromEmail(`ki2407-11@${LOGIN_DOMAIN}`)).toBe('ki2407-11');
    expect(loginFromEmail('teacher@example.com')).toBeNull();
    expect(loginFromEmail(undefined)).toBeNull();
  });
});

describe('список групи', () => {
  it('рядки з Google Sheets (табуляція), заголовки й порожні рядки пропускаються', () => {
    const roster = parseRoster('№\tПІБ\n1\tАрістова Марія Дмитрівна\n\n2;Бобруйко  Ярослав\n');
    expect(roster.rows).toEqual([
      { journal: 1, fullName: 'Арістова Марія Дмитрівна' },
      { journal: 2, fullName: 'Бобруйко Ярослав' },
    ]);
    expect(roster.errors).toEqual([]);
  });

  it('зайві стовпці після ПІБ відкидаються', () => {
    expect(parseRoster('5\tБуряк Нікіта\t\t5\tн').rows).toEqual([
      { journal: 5, fullName: 'Буряк Нікіта' },
    ]);
  });

  it('повтори й рядки без ПІБ — помилки', () => {
    const roster = parseRoster('1\tА\n1\tБ\n3');
    expect(roster.rows).toHaveLength(1);
    expect(roster.errors).toEqual(['Рядок 2: номер 1 повторюється', 'Рядок 3: немає ПІБ']);
  });

  it('CSV для роздачі паролів', () => {
    const csv = credentialsCsv([{ fullName: 'Іван; Петров', login: 'ki2406-01', password: 'abc' }]);
    expect(csv).toBe('﻿ПІБ;Логін;Пароль\n"Іван; Петров";ki2406-01;abc\n');
  });
});

describe('розв’язки', () => {
  it('ідентифікатор завдання варіанта', () => {
    expect(parseVariantTaskId('practical-02/v7/2')).toEqual({
      session: 'practical-02',
      variant: 7,
      stars: 2,
    });
    expect(parseVariantTaskId('markov-001')).toBeNull();
  });

  it('однакові схеми не залежать від пробілів, стрілок і коментарів', () => {
    expect(fingerprint('markov', 'a -> b // заміна\nb ->. ')).toBe(
      fingerprint('markov', 'a→b\n  b →· λ'),
    );
    expect(fingerprint('markov', 'a -> b\nb -> a')).not.toBe(
      fingerprint('markov', 'b -> a\na -> b'),
    );
  });

  it('повторна перевірка', () => {
    const lines = ['ab → b', 'aab → b', 'b → b'];
    expect(recheck('markov', 'a -> λ', lines)).toBe('ok');
    expect(recheck('markov', 'b -> λ', lines)).toBe('fail');
    expect(recheck('markov', 'a -> ', undefined)).toBe('unknown');
  });
});

describe('розв’язки машин Поста й Тюрінга', () => {
  it('Тюрінг: алфавіт з допоміжними символами переживає збереження', () => {
    const program = parseProgram('turing', '// алфавіт: abX\nq0, a -> X, R, q0\nq0, λ -> λ, N, !');
    expect(program).not.toBeNull();
    const text = programText('turing', program!);
    expect(text.startsWith('// алфавіт: abX')).toBe(true);
    expect(recheck('turing', text, ['[a]a → XX', '[a] → X'])).toBe('ok');
    expect(recheck('turing', text, ['[b] → b'])).toBe('fail');
  });

  it('Пост: текст програми й повторна перевірка', () => {
    const text = programText('post', parseProgram('post', '1. X 2\n2. !')!);
    expect(text).toBe('1. X 2\n2. !');
    expect(recheck('post', text, ['[1] 1^2 → 1^2'])).toBe('ok');
    expect(fingerprint('post', '1.  X 2 // стерти\n2. !')).toBe(fingerprint('post', text));
  });
});
