/**
 * Ядро емулятора нормальних алгоритмів Маркова: чистий TypeScript без залежностей від UI.
 *
 *   parse(source, { alphabet })  → схема або помилки з номерами рядків
 *   createState(program, word)   → початковий стан
 *   step(state)                  → одна підстановка, новий стан
 *   run(state, { maxSteps })     → до зупинки, аварії або ліміту кроків
 *   serialize / deserialize      → збереження схеми й вхідного слова
 */
import { optionalStringField, readEnvelope, stringField, writeEnvelope } from '../share';

export { EMPTY_WORD, formatRule, formatWord, parse, parseAlphabet, parseWord } from './program';
export type { MarkovProgram, MarkovRule, ParseOptions, WordResult } from './program';
export { createState, findRule, MAX_WORD_LENGTH, positionOf, run, step } from './machine';
export type {
  MarkovApplied,
  MarkovEvent,
  MarkovPosition,
  MarkovRunResult,
  MarkovState,
  MarkovStepResult,
} from './machine';
export { MARKOV_EXAMPLES } from './examples';
export type { MarkovExample } from './examples';

export interface MarkovSaved {
  /** Схема: одна підстановка в рядку. */
  program: string;
  /** Вхідне слово. */
  input: string;
  /** Алфавіт для перевірки символів. */
  alphabet: string;
  /** Чи перевіряти символи за алфавітом. */
  checkAlphabet: boolean;
  /** Коментар до схеми: опис ідеї розв'язання. */
  comment: string;
}

export function serialize(saved: MarkovSaved): string {
  return writeEnvelope('markov', {
    alphabet: saved.alphabet,
    checkAlphabet: saved.checkAlphabet,
    program: saved.program,
    input: saved.input,
    comment: saved.comment,
  });
}

export function deserialize(text: string): MarkovSaved {
  const record = readEnvelope('markov', text);
  const check = record.checkAlphabet;
  if (check !== undefined && typeof check !== 'boolean') {
    throw new Error('Поле checkAlphabet має бути true або false.');
  }
  return {
    program: stringField(record, 'program'),
    input: stringField(record, 'input'),
    alphabet: optionalStringField(record, 'alphabet'),
    checkAlphabet: check ?? true,
    comment: optionalStringField(record, 'comment'),
  };
}
