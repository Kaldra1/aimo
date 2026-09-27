import { describe, expect, it } from 'vitest';
import { plural } from './plural';

const LECTURES = ['лекція', 'лекції', 'лекцій'] as const;

describe('plural', () => {
  it.each([
    [0, '0 лекцій'],
    [1, '1 лекція'],
    [2, '2 лекції'],
    [4, '4 лекції'],
    [5, '5 лекцій'],
    [11, '11 лекцій'],
    [12, '12 лекцій'],
    [14, '14 лекцій'],
    [20, '20 лекцій'],
    [21, '21 лекція'],
    [22, '22 лекції'],
    [111, '111 лекцій'],
    [112, '112 лекцій'],
    [122, '122 лекції'],
  ])('%i', (count, expected) => {
    expect(plural(count, LECTURES)).toBe(expected);
  });
});
