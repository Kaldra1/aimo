/**
 * Вирази в блоках схеми: числа, рядки в лапках, змінні, елементи масивів a[i], функції,
 * арифметика (+ − * /, div, mod або %), порівняння й логіка (і/або/не, &&/||/!).
 *
 * `/` — звичайне ділення; ціла частка — `div` (з відкиданням дробової частини, як у C++).
 */

export type Value = number | string;
/** Масив: індекс → значення (індекси довільні цілі, як a[1]..a[n]). */
export type ArrayValue = ReadonlyMap<number, Value>;
export type Env = ReadonlyMap<string, Value | ArrayValue>;

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'var'; name: string }
  | { k: 'idx'; name: string; index: Expr }
  | { k: 'call'; name: string; args: Expr[] }
  | { k: 'un'; op: '-' | '+' | '!'; a: Expr }
  | { k: 'bin'; op: BinOp; a: Expr; b: Expr };

export type BinOp =
  '+' | '-' | '*' | '/' | 'div' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||';

/** Помилка в тексті блока з позицією символу (від 0). */
export class SyntaxProblem extends Error {
  constructor(
    message: string,
    readonly pos: number,
  ) {
    super(message);
  }
}

/** Помилка під час виконання (ділення на нуль, змінна без значення…). */
export class RuntimeProblem extends Error {}

type Token =
  | { t: 'num'; v: number; pos: number }
  | { t: 'str'; v: string; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'op'; v: string; pos: number }
  | { t: 'end'; pos: number };

/** Слова-оператори (без урахування регістру). */
const WORDS: Record<string, string> = {
  і: '&&',
  та: '&&',
  and: '&&',
  або: '||',
  or: '||',
  не: '!',
  not: '!',
  div: 'div',
  mod: '%',
};
const SYMBOLS: Record<string, string> = {
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '×': '*',
  '·': '*',
  '−': '-',
};
const TWO = ['==', '!=', '<=', '>=', '&&', '||', '<>'];
const ONE = '+-*/%()[]<>=!,';

const isIdStart = (c: string) => /[\p{L}_]/u.test(c);
const isIdPart = (c: string) => /[\p{L}\p{N}_]/u.test(c);

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j]!)) j++;
      // дробова частина: одна крапка (або кома між цифрами в числі не підтримується — кома розділяє)
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] ?? '')) {
        j++;
        while (j < src.length && /[0-9]/.test(src[j]!)) j++;
      }
      if (/[eE]/.test(src[j] ?? '') && /[0-9+-]/.test(src[j + 1] ?? '')) {
        let k = j + 1;
        if (/[+-]/.test(src[k]!)) k++;
        if (/[0-9]/.test(src[k] ?? '')) {
          while (k < src.length && /[0-9]/.test(src[k]!)) k++;
          j = k;
        }
      }
      tokens.push({ t: 'num', v: Number(src.slice(i, j)), pos: i });
      i = j;
      continue;
    }
    if (isIdStart(c)) {
      let j = i;
      while (j < src.length && isIdPart(src[j]!)) j++;
      const word = src.slice(i, j);
      const op = WORDS[word.toLowerCase()];
      tokens.push(op ? { t: 'op', v: op, pos: i } : { t: 'id', v: word, pos: i });
      i = j;
      continue;
    }
    if (c === '"' || c === '«') {
      const close = c === '"' ? '"' : '»';
      const j = src.indexOf(close, i + 1);
      if (j < 0) throw new SyntaxProblem('Немає закривної лапки.', i);
      tokens.push({ t: 'str', v: src.slice(i + 1, j), pos: i });
      i = j + 1;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (TWO.includes(two)) {
      tokens.push({ t: 'op', v: two === '<>' ? '!=' : two, pos: i });
      i += 2;
      continue;
    }
    if (SYMBOLS[c]) {
      tokens.push({ t: 'op', v: SYMBOLS[c]!, pos: i });
      i++;
      continue;
    }
    if (ONE.includes(c)) {
      tokens.push({ t: 'op', v: c, pos: i });
      i++;
      continue;
    }
    throw new SyntaxProblem(`Незрозумілий символ «${c}».`, i);
  }
  tokens.push({ t: 'end', pos: src.length });
  return tokens;
}

const PREC: Partial<Record<string, number>> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  div: 6,
  '%': 6,
};

class Parser {
  i = 0;
  constructor(private readonly tokens: Token[]) {}

  peek(): Token {
    return this.tokens[this.i]!;
  }
  isOp(v: string): boolean {
    const t = this.peek();
    return t.t === 'op' && t.v === v;
  }
  expect(v: string): void {
    const t = this.peek();
    if (!(t.t === 'op' && t.v === v)) {
      throw new SyntaxProblem(t.t === 'end' ? `Бракує «${v}».` : `Очікується «${v}».`, t.pos);
    }
    this.i++;
  }

  expr(minPrec = 1): Expr {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      const p = t.t === 'op' ? PREC[t.v] : undefined;
      if (p === undefined || p < minPrec) break;
      this.i++;
      const right = this.expr(p + 1);
      left = { k: 'bin', op: (t as { v: string }).v as BinOp, a: left, b: right };
    }
    return left;
  }

  unary(): Expr {
    const t = this.peek();
    if (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '!')) {
      this.i++;
      // «не» слабше за порівняння: не a > b — це не (a > b)
      const a = t.v === '!' ? this.expr(3) : this.unary();
      return { k: 'un', op: t.v, a };
    }
    return this.primary();
  }

  primary(): Expr {
    const t = this.peek();
    this.i++;
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'op' && t.v === '(') {
      const e = this.expr();
      this.expect(')');
      return e;
    }
    if (t.t === 'id') {
      if (this.isOp('(')) {
        this.i++;
        const args: Expr[] = [];
        if (!this.isOp(')')) {
          for (;;) {
            args.push(this.expr());
            if (this.isOp(',')) {
              this.i++;
              continue;
            }
            break;
          }
        }
        this.expect(')');
        return { k: 'call', name: t.v, args };
      }
      if (this.isOp('[')) {
        this.i++;
        const index = this.expr();
        this.expect(']');
        return { k: 'idx', name: t.v, index };
      }
      return { k: 'var', name: t.v };
    }
    if (t.t === 'end') throw new SyntaxProblem('Вираз обірвано.', t.pos);
    if (t.t === 'op' && t.v === '=') {
      throw new SyntaxProblem('Для порівняння пишіть «==» (одинарне «=» — присвоєння).', t.pos);
    }
    throw new SyntaxProblem(`Неочікуване «${t.v}».`, t.pos);
  }
}

/** Розбирає вираз повністю (весь текст). */
export function parseExpr(src: string): Expr {
  const tokens = tokenize(src);
  if (tokens.length === 1) throw new SyntaxProblem('Порожній вираз.', 0);
  const parser = new Parser(tokens);
  const e = parser.expr();
  const rest = parser.peek();
  if (rest.t !== 'end') {
    if (rest.t === 'op' && rest.v === '=') {
      throw new SyntaxProblem('Для порівняння пишіть «==» (одинарне «=» — присвоєння).', rest.pos);
    }
    throw new SyntaxProblem(`Зайве «${'v' in rest ? rest.v : ''}».`, rest.pos);
  }
  return e;
}

// ---------- Обчислення ----------

const num = (v: Value, what: string): number => {
  if (typeof v !== 'number')
    throw new RuntimeProblem(`${what}: очікується число, а не текст «${v}».`);
  return v;
};
const finite = (v: number, what: string): number => {
  if (!Number.isFinite(v)) throw new RuntimeProblem(`${what}: результат не є скінченним числом.`);
  return v;
};

type Fn = (...args: number[]) => number;
export const FUNCTIONS: Record<string, { arity: number; fn: Fn }> = {
  sqrt: {
    arity: 1,
    fn: (x) => {
      if (x < 0) throw new RuntimeProblem(`Корінь з від’ємного числа ${formatValue(x)}.`);
      return Math.sqrt(x);
    },
  },
  abs: { arity: 1, fn: Math.abs },
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tan: { arity: 1, fn: Math.tan },
  exp: { arity: 1, fn: Math.exp },
  ln: {
    arity: 1,
    fn: (x) => {
      if (x <= 0) throw new RuntimeProblem(`Логарифм недодатного числа ${formatValue(x)}.`);
      return Math.log(x);
    },
  },
  pow: { arity: 2, fn: Math.pow },
  floor: { arity: 1, fn: Math.floor },
  ceil: { arity: 1, fn: Math.ceil },
  round: { arity: 1, fn: (x) => Math.sign(x) * Math.round(Math.abs(x)) },
  trunc: { arity: 1, fn: Math.trunc },
  min: { arity: 2, fn: Math.min },
  max: { arity: 2, fn: Math.max },
};

const truth = (v: Value) => (typeof v === 'number' ? v !== 0 : v !== '');

export function evaluate(e: Expr, env: Env): Value {
  switch (e.k) {
    case 'num':
    case 'str':
      return e.v;
    case 'var': {
      const v = env.get(e.name);
      if (v === undefined) throw new RuntimeProblem(`Змінна «${e.name}» ще не має значення.`);
      if (typeof v === 'object') {
        throw new RuntimeProblem(`«${e.name}» — масив; потрібен елемент, наприклад ${e.name}[1].`);
      }
      return v;
    }
    case 'idx': {
      const arr = env.get(e.name);
      const i = indexOf(evaluate(e.index, env), e.name);
      if (arr === undefined) throw new RuntimeProblem(`Масив «${e.name}» ще не має елементів.`);
      if (typeof arr !== 'object') throw new RuntimeProblem(`«${e.name}» — не масив.`);
      const v = arr.get(i);
      if (v === undefined) throw new RuntimeProblem(`Елемент ${e.name}[${i}] ще не має значення.`);
      return v;
    }
    case 'call': {
      const f = FUNCTIONS[e.name.toLowerCase()];
      if (!f) throw new RuntimeProblem(`Невідома функція «${e.name}».`);
      if (e.args.length !== f.arity) {
        throw new RuntimeProblem(`Функція ${e.name} приймає аргументів: ${f.arity}.`);
      }
      return finite(f.fn(...e.args.map((a) => num(evaluate(a, env), e.name))), e.name);
    }
    case 'un': {
      if (e.op === '!') return truth(evaluate(e.a, env)) ? 0 : 1;
      const a = num(evaluate(e.a, env), 'Унарний мінус');
      return e.op === '-' ? -a : a;
    }
    case 'bin': {
      if (e.op === '&&') return truth(evaluate(e.a, env)) && truth(evaluate(e.b, env)) ? 1 : 0;
      if (e.op === '||') return truth(evaluate(e.a, env)) || truth(evaluate(e.b, env)) ? 1 : 0;
      const a = evaluate(e.a, env);
      const b = evaluate(e.b, env);
      switch (e.op) {
        case '==':
          return a === b ? 1 : 0;
        case '!=':
          return a !== b ? 1 : 0;
        case '<':
        case '<=':
        case '>':
        case '>=': {
          if (typeof a !== typeof b)
            throw new RuntimeProblem('Не можна порівнювати число з текстом.');
          const c = a < b ? -1 : a > b ? 1 : 0;
          return (e.op === '<' ? c < 0 : e.op === '<=' ? c <= 0 : e.op === '>' ? c > 0 : c >= 0)
            ? 1
            : 0;
        }
        case '+':
          if (typeof a === 'string' || typeof b === 'string')
            return formatValue(a) + formatValue(b);
          return finite(a + b, 'Додавання');
      }
      const x = num(a, e.op);
      const y = num(b, e.op);
      switch (e.op) {
        case '-':
          return finite(x - y, 'Віднімання');
        case '*':
          return finite(x * y, 'Множення');
        case '/':
          if (y === 0) throw new RuntimeProblem('Ділення на нуль.');
          return x / y;
        case 'div':
          if (y === 0) throw new RuntimeProblem('Ділення на нуль (div).');
          return Math.trunc(x / y);
        case '%':
          if (y === 0) throw new RuntimeProblem('Остача від ділення на нуль.');
          return x % y;
      }
    }
  }
  throw new RuntimeProblem('Невідомий вираз.');
}

export function indexOf(v: Value, name: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new RuntimeProblem(
      `Індекс масиву ${name} має бути цілим числом, а не ${formatValue(v)}.`,
    );
  }
  return v;
}

export const isTrue = truth;

/** Виведення: ціле — як є, дробове — з трьома знаками після крапки, текст — як є. */
export function formatValue(v: Value): string {
  if (typeof v === 'string') return v;
  if (Number.isInteger(v)) return String(v === 0 ? 0 : v);
  const text = v.toFixed(3);
  return text === '-0.000' ? '0.000' : text;
}

/** Імена змінних, які вираз читає (для підказок). */
export function readsOf(e: Expr, out = new Set<string>()): Set<string> {
  switch (e.k) {
    case 'var':
      out.add(e.name);
      break;
    case 'idx':
      out.add(e.name);
      readsOf(e.index, out);
      break;
    case 'call':
      e.args.forEach((a) => readsOf(a, out));
      break;
    case 'un':
      readsOf(e.a, out);
      break;
    case 'bin':
      readsOf(e.a, out);
      readsOf(e.b, out);
      break;
  }
  return out;
}
