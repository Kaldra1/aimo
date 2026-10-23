import { describe, expect, it } from 'vitest';
import {
  credentialsCsv,
  LOGIN_DOMAIN,
  loginFromEmail,
  loginOf,
  loginToEmail,
  parseRoster,
} from './accounts';
import { fingerprint, parseVariantTaskId, recheck } from './solutions';

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
    expect(fingerprint('a -> b // заміна\nb ->. ')).toBe(fingerprint('a→b\n  b →· λ'));
    expect(fingerprint('a -> b\nb -> a')).not.toBe(fingerprint('b -> a\na -> b'));
  });

  it('повторна перевірка', () => {
    const lines = ['ab → b', 'aab → b', 'b → b'];
    expect(recheck('a -> λ', lines)).toBe('ok');
    expect(recheck('b -> λ', lines)).toBe('fail');
    expect(recheck('a -> ', undefined)).toBe('unknown');
  });
});
