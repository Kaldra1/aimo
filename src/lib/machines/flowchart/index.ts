/**
 * Ядро конструктора блок-схем: чистий TypeScript без залежностей від UI.
 *
 *   compile(tree)                → програма або помилки в блоках
 *   createState(program, input)  → початковий стан
 *   step(state) / run(state)     → покрокове виконання
 *   layout(tree) / toSvg(layout) → схема за ГОСТ 19.701-90
 *   serialize / deserialize      → збереження схеми, вхідних даних і коментаря
 */
import { optionalStringField, readEnvelope, writeEnvelope } from '../share';
import { normalizeTree, type FlowNode } from './program';

export { evaluate, formatValue, parseExpr, FUNCTIONS } from './expr';
export type { Value } from './expr';
export {
  BLOCK_META,
  BLOCK_TYPES,
  compile,
  compileBlock,
  findNode,
  insertAt,
  makeNode,
  nextId,
  normalizeTree,
  removeNode,
  updateText,
  walk,
} from './program';
export type {
  BlockError,
  BlockType,
  Branch,
  CompileResult,
  FlowNode,
  FlowProgram,
  Slot,
} from './program';
export { createState, describeEnv, END, positionOf, run, splitInput, step } from './machine';
export type { FlowEvent, FlowPosition, FlowState, FlowStepResult } from './machine';
export { BLOCK_H, BLOCK_W, layout, shapeOutline, toSvg, wrapText } from './layout';
export type { Label, Layout, Line, PlusPoint, Shape } from './layout';
export { FLOWCHART_EXAMPLES } from './examples';
export type { FlowExample } from './examples';

export interface FlowSaved {
  tree: FlowNode[];
  /** Вхідні дані через пробіл. */
  input: string;
  comment: string;
}

/** Дерево без службових полів — для збереження й порівняння. */
export function cleanTree(tree: readonly FlowNode[]): FlowNode[] {
  return tree.map((n) => {
    const out: FlowNode = { id: n.id, type: n.type, text: n.text };
    if (n.yes) out.yes = cleanTree(n.yes);
    if (n.no) out.no = cleanTree(n.no);
    if (n.body) out.body = cleanTree(n.body);
    return out;
  });
}

export function serialize(saved: FlowSaved): string {
  return writeEnvelope('flowchart', {
    tree: cleanTree(saved.tree),
    input: saved.input,
    comment: saved.comment,
  });
}

export function deserialize(text: string): FlowSaved {
  const record = readEnvelope('flowchart', text);
  return {
    tree: normalizeTree(record.tree),
    input: optionalStringField(record, 'input'),
    comment: optionalStringField(record, 'comment'),
  };
}

/** Компактний текст схеми для бази: лише типи й тексти блоків. */
export const treeText = (tree: readonly FlowNode[]) => JSON.stringify(cleanTree(tree));

/** Структура схеми без id і пробілів — для пошуку однакових схем. */
export function treeShape(tree: readonly FlowNode[]): string {
  const strip = (list: readonly FlowNode[]): unknown[] =>
    list.map((n) => [
      n.type,
      n.text.replace(/\s+/g, ''),
      ...[n.yes, n.no, n.body].filter(Boolean).map((l) => strip(l!)),
    ]);
  return JSON.stringify(strip(tree));
}
