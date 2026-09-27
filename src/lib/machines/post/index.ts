/**
 * Ядро емулятора машини Поста: чистий TypeScript без залежностей від UI.
 *
 *   parse(source)             → програма або помилки з номерами рядків
 *   createState(program, tape) → початковий стан
 *   step(state)               → один крок, новий стан
 *   run(state, { maxSteps })  → до зупинки, аварії або ліміту кроків
 *   serialize / deserialize   → збереження програми й вхідних даних
 */
import { readEnvelope, writeEnvelope } from '../share';

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
}

export function serialize(program: string, input: string): string {
  return writeEnvelope('post', { program, input });
}

export function deserialize(text: string): PostSaved {
  return readEnvelope('post', text, ['program', 'input']);
}
