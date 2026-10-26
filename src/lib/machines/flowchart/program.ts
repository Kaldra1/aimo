/**
 * Схема алгоритму як дерево блоків (структурна: послідовність, розгалуження, цикли) і її
 * компіляція в послідовність інструкцій для покрокового виконання.
 */
import { parseExpr, SyntaxProblem, type Expr } from './expr';

export type BlockType = 'process' | 'input' | 'output' | 'if' | 'while' | 'for';

export interface FlowNode {
  id: number;
  type: BlockType;
  text: string;
  /** Розгалуження: гілки «так» і «ні». */
  yes?: FlowNode[];
  no?: FlowNode[];
  /** Цикли: тіло. */
  body?: FlowNode[];
}

export type Branch = 'yes' | 'no' | 'body';

export const BLOCK_META: Record<BlockType, { title: string; text: string; hint: string }> = {
  process: {
    title: 'Процес',
    text: 'x = 0',
    hint: 'Присвоєння: s = s + n % 10; кілька — через «;».',
  },
  input: {
    title: 'Введення',
    text: 'ввести n',
    hint: 'ввести n, m; елемент масиву — ввести a[i].',
  },
  output: {
    title: 'Виведення',
    text: 'вивести s',
    hint: 'вивести s; текст у лапках: вивести "так".',
  },
  if: { title: 'Розгалуження', text: 'x > 0', hint: 'Умова: x > 0, a == b, x >= 0 і y < 5.' },
  while: {
    title: 'Цикл з передумовою',
    text: 'n > 0',
    hint: 'Тіло виконується, поки умова істинна.',
  },
  for: {
    title: 'Цикл з параметром',
    text: 'i = 1 .. n',
    hint: 'i = 1 .. n або i = 10 .. 1 крок -1.',
  },
};

export const BLOCK_TYPES = Object.keys(BLOCK_META) as BlockType[];

// ---------- Робота з деревом (без мутацій) ----------

export const childLists = (n: FlowNode): [Branch, FlowNode[]][] =>
  n.type === 'if'
    ? [
        ['yes', n.yes ?? []],
        ['no', n.no ?? []],
      ]
    : n.type === 'while' || n.type === 'for'
      ? [['body', n.body ?? []]]
      : [];

export function* walk(list: readonly FlowNode[]): Generator<FlowNode> {
  for (const n of list) {
    yield n;
    for (const [, child] of childLists(n)) yield* walk(child);
  }
}

export const nextId = (list: readonly FlowNode[]) =>
  Math.max(0, ...Array.from(walk(list), (n) => n.id)) + 1;

export function makeNode(type: BlockType, id: number, text = BLOCK_META[type].text): FlowNode {
  const node: FlowNode = { id, type, text };
  if (type === 'if') {
    node.yes = [];
    node.no = [];
  }
  if (type === 'while' || type === 'for') node.body = [];
  return node;
}

/** Місце вставки: список (кореневий або гілка блока parent) і позиція в ньому. */
export interface Slot {
  parent: number | null;
  branch: Branch | null;
  index: number;
}

function mapList(
  list: readonly FlowNode[],
  fn: (list: readonly FlowNode[], parent: number | null, branch: Branch | null) => FlowNode[],
  parent: number | null = null,
  branch: Branch | null = null,
): FlowNode[] {
  return fn(list, parent, branch).map((n) => {
    const kids = childLists(n);
    if (kids.length === 0) return n;
    const copy = { ...n };
    for (const [b, child] of kids) copy[b] = mapList(child, fn, n.id, b);
    return copy;
  });
}

export function insertAt(list: readonly FlowNode[], slot: Slot, node: FlowNode): FlowNode[] {
  return mapList(list, (l, parent, branch) =>
    parent === slot.parent && branch === slot.branch
      ? [...l.slice(0, slot.index), node, ...l.slice(slot.index)]
      : [...l],
  );
}

export function removeNode(list: readonly FlowNode[], id: number): FlowNode[] {
  return mapList(list, (l) => l.filter((n) => n.id !== id));
}

export function updateText(list: readonly FlowNode[], id: number, text: string): FlowNode[] {
  return mapList(list, (l) => l.map((n) => (n.id === id ? { ...n, text } : n)));
}

export function findNode(list: readonly FlowNode[], id: number): FlowNode | undefined {
  for (const n of walk(list)) if (n.id === id) return n;
  return undefined;
}

/** Перевіряє й нормалізує дерево з файлу чи посилання. */
export function normalizeTree(data: unknown, path = 'схема'): FlowNode[] {
  if (!Array.isArray(data)) throw new Error(`${path}: очікується список блоків.`);
  const ids = new Set<number>();
  const visit = (list: unknown[], where: string): FlowNode[] =>
    list.map((raw, i) => {
      const at = `${where}, блок ${i + 1}`;
      if (typeof raw !== 'object' || raw === null) throw new Error(`${at}: не блок.`);
      const r = raw as Record<string, unknown>;
      const type = r.type;
      if (typeof type !== 'string' || !(type in BLOCK_META))
        throw new Error(`${at}: невідомий тип блока.`);
      if (typeof r.text !== 'string') throw new Error(`${at}: немає тексту.`);
      let id = typeof r.id === 'number' && Number.isInteger(r.id) && r.id > 0 ? r.id : 0;
      if (id === 0 || ids.has(id)) id = Math.max(0, ...ids) + 1;
      ids.add(id);
      const node = makeNode(type as BlockType, id, r.text.slice(0, 500));
      for (const [b] of childLists(node)) {
        const child = r[b] ?? [];
        if (!Array.isArray(child)) throw new Error(`${at}: гілка «${b}» має бути списком.`);
        node[b] = visit(child, `${at} → ${b === 'yes' ? 'так' : b === 'no' ? 'ні' : 'тіло'}`);
      }
      return node;
    });
  const tree = visit(data, path);
  if (Array.from(walk(tree)).length > 500) throw new Error('Забагато блоків (понад 500).');
  return tree;
}

// ---------- Розбір тексту блоків ----------

export interface Target {
  name: string;
  index: Expr | null;
}
export type Compiled =
  | { type: 'process'; assigns: { target: Target; value: Expr }[] }
  | { type: 'input'; targets: Target[] }
  | { type: 'output'; items: Expr[] }
  | { type: 'if' | 'while'; cond: Expr }
  | { type: 'for'; variable: string; from: Expr; to: Expr; step: Expr };

export interface BlockError {
  id: number;
  message: string;
}

const NAME = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const RESERVED = new Set(['і', 'та', 'або', 'не', 'div', 'mod', 'and', 'or', 'not']);

/** Ділить текст за роздільниками верхнього рівня (не всередині дужок і лапок). */
export function splitTop(src: string, separators: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"') quote = '"';
    else if (c === '«') quote = '»';
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && separators.includes(c)) {
      parts.push(src.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(src.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

function target(text: string): Target {
  const m = /^([\p{L}_][\p{L}\p{N}_]*)\s*(?:\[(.*)\])?$/su.exec(text.trim());
  if (!m || RESERVED.has(m[1]!.toLowerCase())) throw new Error(`«${text}» — не змінна.`);
  return { name: m[1]!, index: m[2] === undefined ? null : expr(m[2]) };
}

function expr(text: string): Expr {
  try {
    return parseExpr(text);
  } catch (e) {
    if (e instanceof SyntaxProblem) {
      const near = text.slice(Math.max(0, e.pos - 6), e.pos + 6).trim();
      throw new Error(near ? `${e.message} (біля «${near}»)` : e.message, { cause: e });
    }
    throw e;
  }
}

const stripWord = (text: string, words: string) =>
  text.replace(new RegExp(`^(?:${words})\\s*:?\\s*`, 'iu'), '');

export function compileBlock(node: Pick<FlowNode, 'type' | 'text'>): Compiled {
  const text = node.text.trim();
  if (text === '') throw new Error('Порожній блок: впишіть текст.');
  switch (node.type) {
    case 'process': {
      const assigns = splitTop(text, ';\n').map((s) => {
        // одинарне «=» або «:=», але не «==», «<=», «>=», «!=»
        const m = /^(.+?)\s*(?::=|(?<![=<>!])=(?!=))\s*(.+)$/su.exec(s);
        if (!m) {
          throw new Error(`Очікується присвоєння «змінна = вираз», а не «${s}».`);
        }
        return { target: target(m[1]!), value: expr(m[2]!) };
      });
      return { type: 'process', assigns };
    }
    case 'input': {
      const body = stripWord(text, 'ввести|ввід|введення|введіть|input');
      if (body.trim() === '') throw new Error('Вкажіть змінні: ввести n, m.');
      return { type: 'input', targets: splitTop(body, ',').map(target) };
    }
    case 'output': {
      const body = stripWord(text, 'вивести|вивід|виведення|друк|print');
      if (body.trim() === '') throw new Error('Вкажіть, що вивести: вивести s.');
      return { type: 'output', items: splitTop(body, ',').map(expr) };
    }
    case 'if':
    case 'while':
      return { type: node.type, cond: expr(text) };
    case 'for': {
      // \b не працює з кирилицею, тому «крок» відокремлюємо пробілами.
      const m =
        /^([\p{L}_][\p{L}\p{N}_]*)\s*(?::=|=)\s*(.+?)\s*(?:\.\.|…|,)\s*(.+?)(?:(?:\s+(?:крок|step)\s+|\s*,\s*)(.+))?$/isu.exec(
          text,
        );
      if (!m || !NAME.test(m[1]!)) {
        throw new Error('Очікується «i = 1 .. n» або «i = 10 .. 1 крок -1».');
      }
      return {
        type: 'for',
        variable: m[1]!,
        from: expr(m[2]!),
        to: expr(m[3]!),
        step: m[4] === undefined ? { k: 'num', v: 1 } : expr(m[4]),
      };
    }
  }
}

// ---------- Інструкції ----------

export type Instruction =
  | { kind: 'process' | 'input' | 'output'; node: number; code: Compiled }
  | { kind: 'branch'; node: number; cond: Expr; loop: boolean; elseTo: number }
  | { kind: 'jump'; to: number }
  | {
      kind: 'forInit';
      node: number;
      code: Extract<Compiled, { type: 'for' }>;
      slot: number;
      exitTo: number;
    }
  | {
      kind: 'forNext';
      node: number;
      variable: string;
      slot: number;
      bodyTo: number;
      exitTo: number;
    }
  | { kind: 'halt' };

export interface FlowProgram {
  readonly tree: readonly FlowNode[];
  readonly code: readonly Instruction[];
  readonly loops: number;
}

export type CompileResult = { ok: true; value: FlowProgram } | { ok: false; errors: BlockError[] };

export function compile(tree: readonly FlowNode[]): CompileResult {
  const errors: BlockError[] = [];
  const compiled = new Map<number, Compiled>();
  for (const n of walk(tree)) {
    try {
      compiled.set(n.id, compileBlock(n));
    } catch (e) {
      errors.push({ id: n.id, message: e instanceof Error ? e.message : String(e) });
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const code: Instruction[] = [];
  let loops = 0;
  const emit = (list: readonly FlowNode[]) => {
    for (const n of list) {
      const c = compiled.get(n.id)!;
      if (n.type === 'process' || n.type === 'input' || n.type === 'output') {
        code.push({ kind: n.type, node: n.id, code: c });
      } else if (n.type === 'if') {
        const branch = {
          kind: 'branch',
          node: n.id,
          cond: (c as { cond: Expr }).cond,
          loop: false,
          elseTo: -1,
        } as const;
        const at = code.push({ ...branch }) - 1;
        emit(n.yes ?? []);
        const jumpAt = code.push({ kind: 'jump', to: -1 }) - 1;
        (code[at] as { elseTo: number }).elseTo = code.length;
        emit(n.no ?? []);
        (code[jumpAt] as { to: number }).to = code.length;
      } else if (n.type === 'while') {
        const top = code.length;
        code.push({
          kind: 'branch',
          node: n.id,
          cond: (c as { cond: Expr }).cond,
          loop: true,
          elseTo: -1,
        });
        emit(n.body ?? []);
        code.push({ kind: 'jump', to: top });
        (code[top] as { elseTo: number }).elseTo = code.length;
      } else {
        const slot = loops++;
        const init = code.length;
        code.push({
          kind: 'forInit',
          node: n.id,
          code: c as Extract<Compiled, { type: 'for' }>,
          slot,
          exitTo: -1,
        });
        const bodyTo = code.length;
        emit(n.body ?? []);
        code.push({
          kind: 'forNext',
          node: n.id,
          variable: (c as { variable: string }).variable,
          slot,
          bodyTo,
          exitTo: -1,
        });
        (code[init] as { exitTo: number }).exitTo = code.length;
        (code[code.length - 1] as { exitTo: number }).exitTo = code.length;
      }
    }
  };
  emit(tree);
  code.push({ kind: 'halt' });
  return { ok: true, value: { tree, code, loops } };
}
