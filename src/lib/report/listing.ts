/**
 * Як програма виглядає у звіті для кожної машини: текст (Пост, Марков), таблиця переходів
 * (Тюрінг), рисунок схеми (блок-схема — SVG, у PNG його перетворює браузер).
 */
import type { AnyProgram, TaskMachine } from '../cloud/solutions';
import * as flowchart from '../machines/flowchart';
import { cellKey, formatCell, type TuringProgram } from '../machines/turing/program';
import type { Block } from './model';

/** Таблиця переходів: рядки — символи, стовпці — стани, як в емуляторі. */
export function turingTable(program: TuringProgram): Block {
  const states = Array.from({ length: program.states }, (_, i) => i);
  return {
    kind: 'table',
    header: ['', ...states.map((q) => `q${q}`)],
    rows: program.symbols.map((symbol) => [
      symbol,
      ...states.map((q) => {
        const rule = program.rules.get(cellKey(q, symbol));
        return rule ? formatCell(rule) : '';
      }),
    ]),
  };
}

/** Схема як SVG (чорно-біла, за ГОСТ 19.701-90) з її розмірами. */
export function flowchartSvg(program: AnyProgram): { svg: string; width: number; height: number } {
  const l = flowchart.layout((program as flowchart.FlowProgram).tree);
  return { svg: flowchart.toSvg(l), width: l.width, height: l.height };
}

/** Блоки звіту з програмою; для блок-схеми — порожньо (рисунок додає collect.ts). */
export function programBlocks(machine: TaskMachine, program: AnyProgram, text: string): Block[] {
  if (machine === 'turing') return [turingTable(program as TuringProgram)];
  if (machine === 'flowchart') return [];
  return [{ kind: 'code', lines: text.split(/\r?\n/) }];
}
