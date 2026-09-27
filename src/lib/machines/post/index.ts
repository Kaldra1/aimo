/**
 * Ядро емулятора машини Поста: чистий TypeScript без залежностей від UI.
 *
 *   parse(source)             → програма або помилки з номерами рядків
 *   createState(program, tape) → початковий стан
 *   step(state)               → один крок, новий стан
 *   run(state, { maxSteps })  → до зупинки, аварії або ліміту кроків
 *   serialize / deserialize   → збереження програми й вхідних даних
 */
import { optionalStringField, readEnvelope, stringField, writeEnvelope } from '../share';

export { parse, formatCommand, renumber, rowsFromSource, sourceFromRows, ROW_OPS } from './program';
export type { PostCommand, PostOp, PostProgram, PostRow } from './program';
export { parseTape, formatTape, MAX_TAPE_CELLS } from './tape';
export type { PostTape } from './tape';
export { createState, step, run, positionOf } from './machine';
export type { PostEvent, PostPosition, PostState, PostStepResult, PostRunResult } from './machine';
export { POST_EXAMPLES } from './examples';
export type { PostExample } from './examples';

export interface PostSaved {
  /** Текст програми. */
  program: string;
  /** Вхідна стрічка в нотації. */
  input: string;
  /** Коментар до програми: опис ідеї розв'язання. */
  comment: string;
}

export function serialize(program: string, input: string, comment = ''): string {
  return writeEnvelope('post', { program, input, comment });
}

export function deserialize(text: string): PostSaved {
  const record = readEnvelope('post', text);
  return {
    program: stringField(record, 'program'),
    input: stringField(record, 'input'),
    comment: optionalStringField(record, 'comment'),
  };
}
