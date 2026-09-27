/**
 * Ядро емулятора машини Тюрінга: чистий TypeScript без залежностей від UI.
 *
 *   parse(source)              → програма з текстового формату `q0, 1 -> 1, R, q0`
 *   buildProgram(table)        → програма з таблиці переходів (помилки — по клітинках)
 *   createState(program, tape) → початковий стан (q0)
 *   step(state) / run(state, { maxSteps })
 *   serialize / deserialize    → збереження таблиці й вхідних даних
 */
import { readEnvelope, stringField, writeEnvelope } from '../share';
import { cellKey, MAX_STATES, type TuringTable } from './program';

export { BLANK, parseAlphabet } from './alphabet';
export {
  buildProgram,
  cellKey,
  findRuleLine,
  formatCell,
  formatProgram,
  formatRuleLine,
  MAX_STATES,
  parse,
  parseCell,
  stateName,
  tableFromProgram,
} from './program';
export type { Move, TableMessage, TuringProgram, TuringRule, TuringTable } from './program';
export { formatConfiguration, formatTape, parseTape, readCell, subscript } from './tape';
export type { TuringTape } from './tape';
export { configurationState, createState, positionOf, run, step } from './machine';
export type {
  TuringEvent,
  TuringPosition,
  TuringRunResult,
  TuringState,
  TuringStepResult,
} from './machine';
export { TURING_EXAMPLES } from './examples';
export type { TuringExample } from './examples';

type NestedTable = Record<string, Record<string, string>>;

/** Таблиця для файлу: `{ "q0": { "1": "1Rq0" } }`. */
export function nestTable(table: TuringTable): NestedTable {
  const nested: NestedTable = {};
  for (const [key, text] of Object.entries(table.cells)) {
    if (text.trim() === '') continue;
    const space = key.indexOf(' ');
    const state = key.slice(0, space);
    (nested[state] ??= {})[key.slice(space + 1)] = text;
  }
  return nested;
}

/** Клітинки таблиці з вкладеного запису `{ "q0": { "1": "1Rq0" } }`. */
export function flattenTable(nested: unknown): Record<string, string> {
  if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) {
    throw new Error('Поле table має містити таблицю переходів.');
  }
  const cells: Record<string, string> = {};
  for (const [stateKey, row] of Object.entries(nested)) {
    const match = /^q(\d+)$/.exec(stateKey);
    if (!match || typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error(`Незрозумілий стан «${stateKey}» у таблиці.`);
    }
    for (const [symbol, text] of Object.entries(row as Record<string, unknown>)) {
      if (typeof text !== 'string')
        throw new Error(`Клітинка q${match[1]}, ${symbol} має бути текстом.`);
      cells[cellKey(Number(match[1]), symbol)] = text;
    }
  }
  return cells;
}

export interface TuringSaved {
  table: TuringTable;
  /** Вхідна стрічка в нотації. */
  input: string;
}

export function serialize(table: TuringTable, input: string): string {
  return writeEnvelope('turing', {
    alphabet: table.alphabet,
    states: table.states,
    table: nestTable(table),
    input,
  });
}

export function deserialize(text: string): TuringSaved {
  const record = readEnvelope('turing', text);
  const states = record.states;
  if (
    typeof states !== 'number' ||
    !Number.isInteger(states) ||
    states < 1 ||
    states > MAX_STATES
  ) {
    throw new Error(`Поле states має бути цілим числом від 1 до ${MAX_STATES}.`);
  }
  return {
    table: {
      alphabet: stringField(record, 'alphabet'),
      states,
      cells: flattenTable(record.table),
    },
    input: stringField(record, 'input'),
  };
}
