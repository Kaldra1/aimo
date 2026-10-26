/**
 * Розкладка схеми за ГОСТ 19.701-90: потік згори вниз, повернення циклів — ліворуч зі стрілкою,
 * вихід з циклу — праворуч, гілки розгалуження «так» ліворуч і «ні» праворуч.
 * Результат — фігури, лінії, підписи й місця вставки «+» у координатах; малює їх UI або toSvg().
 */
import type { Branch, FlowNode, Slot } from './program';

/** Розміри символу: висота a, ширина b. */
export const BLOCK_W = 132;
export const BLOCK_H = 56;
const GAP = 30; // вертикальний проміжок між блоками (у ньому «+»)
const SIDE = 18; // відступ гілок і ліній циклів
const PAD = 24;
const TERM_H = 40;

export type ShapeKind = 'terminator' | 'process' | 'data' | 'decision' | 'preparation';

export interface Shape {
  /** id блока; null — термінатори «Початок» / «Кінець». */
  id: number | null;
  /** -1 — «Кінець» (для підсвітки останнього кроку). */
  key: number;
  kind: ShapeKind;
  x: number; // центр
  y: number; // верх
  w: number;
  h: number;
  lines: string[];
}
export interface Line {
  points: [number, number][];
  arrow: boolean;
}
export interface Label {
  x: number;
  y: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
}
export interface PlusPoint {
  x: number;
  y: number;
  slot: Slot;
}
export interface Layout {
  width: number;
  height: number;
  shapes: Shape[];
  lines: Line[];
  labels: Label[];
  plus: PlusPoint[];
}

interface Size {
  h: number;
  l: number;
  r: number;
}

const KIND: Record<FlowNode['type'], ShapeKind> = {
  process: 'process',
  input: 'data',
  output: 'data',
  if: 'decision',
  while: 'decision',
  for: 'preparation',
};

/** Переносить текст у межах символу (до 3 рядків, довші обрізаються з «…»). */
export function wrapText(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    let word = w;
    while (word.length > maxChars) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (cur && (cur + ' ' + word).length > maxChars) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1]!.slice(0, maxChars - 1) + '…';
    return kept;
  }
  return lines.length ? lines : [''];
}

const charsFor = (kind: ShapeKind) => (kind === 'decision' ? 13 : kind === 'preparation' ? 14 : 16);

export function layout(tree: readonly FlowNode[]): Layout {
  const sizes = new Map<
    number,
    Size & { xl?: number; xr?: number; y?: Size; n?: Size; b?: Size }
  >();

  const measureList = (list: readonly FlowNode[]): Size => {
    let h = GAP;
    let l = 14;
    let r = 14;
    for (const n of list) {
      const s = measureNode(n);
      h += s.h + GAP;
      l = Math.max(l, s.l);
      r = Math.max(r, s.r);
    }
    return { h, l, r };
  };
  const measureNode = (n: FlowNode): Size => {
    let size: Size & { xl?: number; xr?: number; y?: Size; n?: Size; b?: Size };
    if (n.type === 'if') {
      const Y = measureList(n.yes ?? []);
      const N = measureList(n.no ?? []);
      const xl = Math.max(BLOCK_W / 2 + SIDE, Y.r + SIDE);
      const xr = Math.max(BLOCK_W / 2 + SIDE, N.l + SIDE);
      size = {
        h: BLOCK_H + 16 + Math.max(Y.h, N.h) + 16,
        l: xl + Y.l,
        r: xr + N.r,
        xl,
        xr,
        y: Y,
        n: N,
      };
    } else if (n.type === 'while' || n.type === 'for') {
      const B = measureList(n.body ?? []);
      const xl = Math.max(BLOCK_W / 2, B.l) + SIDE + 4;
      const xr = Math.max(BLOCK_W / 2, B.r) + SIDE + 4;
      size = { h: 12 + BLOCK_H + B.h + 12 + 18, l: xl + 4, r: xr + 4, xl, xr, b: B };
    } else size = { h: BLOCK_H, l: BLOCK_W / 2, r: BLOCK_W / 2 };
    sizes.set(n.id, size);
    return size;
  };

  const root = measureList(tree);
  const half = Math.max(root.l, root.r, BLOCK_W / 2);
  const x0 = PAD + Math.max(root.l, BLOCK_W / 2);
  const out: Layout = {
    width: Math.ceil(PAD * 2 + Math.max(root.l, BLOCK_W / 2) + Math.max(root.r, BLOCK_W / 2)),
    height: Math.ceil(PAD + TERM_H + root.h + TERM_H + PAD),
    shapes: [],
    lines: [],
    labels: [],
    plus: [],
  };
  void half;

  const line = (points: [number, number][], arrow = false) => out.lines.push({ points, arrow });
  const shape = (n: FlowNode, x: number, y: number) => {
    const kind = KIND[n.type];
    out.shapes.push({
      id: n.id,
      key: n.id,
      kind,
      x,
      y,
      w: BLOCK_W,
      h: BLOCK_H,
      lines: wrapText(n.text, charsFor(kind)),
    });
  };

  const drawList = (
    list: readonly FlowNode[],
    x: number,
    y: number,
    parent: number | null,
    branch: Branch | null,
  ): number => {
    let cy = y;
    list.forEach((n, index) => {
      line([
        [x, cy],
        [x, cy + GAP],
      ]);
      out.plus.push({ x, y: cy + GAP / 2, slot: { parent, branch, index } });
      cy += GAP;
      drawNode(n, x, cy);
      cy += sizes.get(n.id)!.h;
    });
    line([
      [x, cy],
      [x, cy + GAP],
    ]);
    out.plus.push({ x, y: cy + GAP / 2, slot: { parent, branch, index: list.length } });
    return cy + GAP;
  };

  const drawNode = (n: FlowNode, x: number, y: number) => {
    const s = sizes.get(n.id)!;
    if (n.type === 'if') {
      const xl = s.xl!;
      const xr = s.xr!;
      shape(n, x, y);
      const mid = y + BLOCK_H / 2;
      const top = y + BLOCK_H + 16;
      const merge = top + Math.max(s.y!.h, s.n!.h) + 16;
      line([
        [x - BLOCK_W / 2, mid],
        [x - xl, mid],
        [x - xl, top],
      ]);
      line([
        [x + BLOCK_W / 2, mid],
        [x + xr, mid],
        [x + xr, top],
      ]);
      out.labels.push({ x: x - BLOCK_W / 2 - 6, y: mid - 6, text: 'так', anchor: 'end' });
      out.labels.push({ x: x + BLOCK_W / 2 + 6, y: mid - 6, text: 'ні', anchor: 'start' });
      const yEnd = drawList(n.yes ?? [], x - xl, top, n.id, 'yes');
      const nEnd = drawList(n.no ?? [], x + xr, top, n.id, 'no');
      line([
        [x - xl, yEnd],
        [x - xl, merge],
        [x, merge],
      ]);
      line([
        [x + xr, nEnd],
        [x + xr, merge],
        [x, merge],
      ]);
      return;
    }
    if (n.type === 'while' || n.type === 'for') {
      const xl = s.xl!;
      const xr = s.xr!;
      const yd = y + 12;
      line([
        [x, y],
        [x, yd],
      ]);
      shape(n, x, yd);
      const bodyTop = yd + BLOCK_H;
      const bodyEnd = drawList(n.body ?? [], x, bodyTop, n.id, 'body');
      const back = bodyEnd + 12;
      const exit = back + 18;
      // повернення: ліворуч і вгору, у лінію над символом
      line(
        [
          [x, bodyEnd],
          [x, back],
          [x - xl, back],
          [x - xl, y + 4],
          [x - 3, y + 4],
        ],
        true,
      );
      // вихід: праворуч і вниз, у лінію під циклом
      line(
        [
          [x + BLOCK_W / 2, yd + BLOCK_H / 2],
          [x + xr, yd + BLOCK_H / 2],
          [x + xr, exit],
          [x + 3, exit],
        ],
        true,
      );
      line([
        [x, back],
        [x, exit],
      ]);
      if (n.type === 'while') {
        out.labels.push({ x: x + 12, y: bodyTop + 11, text: 'так', anchor: 'start' });
        out.labels.push({
          x: x + BLOCK_W / 2 + 6,
          y: yd + BLOCK_H / 2 - 6,
          text: 'ні',
          anchor: 'start',
        });
      }
      return;
    }
    shape(n, x, y);
  };

  out.shapes.push({
    id: null,
    key: 0,
    kind: 'terminator',
    x: x0,
    y: PAD,
    w: BLOCK_W,
    h: TERM_H,
    lines: ['Початок'],
  });
  const end = drawList(tree, x0, PAD + TERM_H, null, null);
  out.shapes.push({
    id: null,
    key: -1,
    kind: 'terminator',
    x: x0,
    y: end,
    w: BLOCK_W,
    h: TERM_H,
    lines: ['Кінець'],
  });
  return out;
}

/** Контур фігури як SVG-атрибути. */
export function shapeOutline(s: Shape): {
  tag: 'rect' | 'polygon';
  attrs: Record<string, string | number>;
} {
  const { x, y, w, h } = s;
  const l = x - w / 2;
  const r = x + w / 2;
  const pts = (p: [number, number][]) => ({ points: p.map(([a, b]) => `${a},${b}`).join(' ') });
  switch (s.kind) {
    case 'terminator':
      return { tag: 'rect', attrs: { x: l, y, width: w, height: h, rx: h / 2 } };
    case 'process':
      return { tag: 'rect', attrs: { x: l, y, width: w, height: h } };
    case 'data': {
      const k = 14;
      return {
        tag: 'polygon',
        attrs: pts([
          [l + k, y],
          [r, y],
          [r - k, y + h],
          [l, y + h],
        ]),
      };
    }
    case 'decision':
      return {
        tag: 'polygon',
        attrs: pts([
          [x, y],
          [r, y + h / 2],
          [x, y + h],
          [l, y + h / 2],
        ]),
      };
    case 'preparation': {
      const k = 16;
      return {
        tag: 'polygon',
        attrs: pts([
          [l + k, y],
          [r - k, y],
          [r, y + h / 2],
          [r - k, y + h],
          [l + k, y + h],
          [l, y + h / 2],
        ]),
      };
    }
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Окремий SVG-файл схеми для звіту (чорно-білий, без кнопок «+»). */
export function toSvg(l: Layout): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${l.width}" height="${l.height}" viewBox="0 0 ${l.width} ${l.height}">`,
    '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L9,5 L0,9" fill="none" stroke="#000" stroke-width="1.6"/></marker></defs>',
    `<rect width="100%" height="100%" fill="#fff"/>`,
    '<g fill="none" stroke="#000" stroke-width="1.4">',
  );
  for (const ln of l.lines) {
    parts.push(
      `<polyline points="${ln.points.map((p) => p.join(',')).join(' ')}"${ln.arrow ? ' marker-end="url(#a)"' : ''}/>`,
    );
  }
  parts.push('</g><g fill="#fff" stroke="#000" stroke-width="1.4">');
  for (const s of l.shapes) {
    const o = shapeOutline(s);
    parts.push(
      `<${o.tag} ${Object.entries(o.attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')}/>`,
    );
  }
  parts.push(
    '</g><g font-family="Consolas, monospace" font-size="12" fill="#000" text-anchor="middle">',
  );
  for (const s of l.shapes) {
    s.lines.forEach((t, i) => {
      const y = s.y + s.h / 2 + (i - (s.lines.length - 1) / 2) * 14 + 4;
      parts.push(`<text x="${s.x}" y="${y}">${esc(t)}</text>`);
    });
  }
  for (const lb of l.labels) {
    parts.push(
      `<text x="${lb.x}" y="${lb.y}" text-anchor="${lb.anchor}" font-size="11">${esc(lb.text)}</text>`,
    );
  }
  parts.push('</g></svg>');
  return parts.join('\n');
}
