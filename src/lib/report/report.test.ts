import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildLabReport, reportFileName, type LabReportInput } from './model';
import { renderDocxBuffer } from './render';
import { extractSections, plainText } from './sections';
import { REPORT_SESSIONS, reportSource } from './source';
import { flowchartSvg, programBlocks } from './listing';
import * as flowchart from '../machines/flowchart';
import { FLOWCHART_EXAMPLES } from '../machines/flowchart/examples';
import * as turing from '../machines/turing';
import { TURING_EXAMPLES } from '../machines/turing/examples';

const lab1 = readFileSync('src/content/sessions/lab-01.mdx', 'utf8');

const input: LabReportInput = {
  kind: 'lab',
  number: 1,
  title: 'Побудова машин Поста',
  label: 'ЛР1',
  student: { name: 'Бороденко Катерина', group: 'КІ-2406' },
  variant: 4,
  goal: ['Закріпити знання будови машини Поста.'],
  equipment: ['ПК із сучасним браузером.'],
  conventions: ['Число n записане n + 1 мітками.'],
  questions: ['З яких частин складається машина Поста?', 'Які команди має машина Поста?'],
  programTitle: 'Текст програми',
  levels: [
    {
      stars: 1,
      statement: 'Стерти масив повністю.',
      examples: ['[1] 1^3 → λ'],
      program: '1. X 2 // стерти\n2. → 3\n3. ? 4, 1\n4. !',
      idea: 'Стираємо мітку й ідемо праворуч, поки є мітки.',
      tests: [
        { input: '[1] 1^3', expected: 'λ', actual: 'порожня стрічка', steps: 12, passed: true },
      ],
      shareUrl: 'https://kaldra1.github.io/aimo/emulators/post/#s=abc',
    },
    {
      stars: 2,
      statement: 'Подвоїти масив.',
      examples: [],
      program: null,
      idea: '',
      tests: [],
      shareUrl: null,
    },
    {
      stars: 3,
      statement: 'Добуток.',
      examples: [],
      program: null,
      idea: '',
      tests: [],
      shareUrl: null,
    },
  ],
};

describe('розділи сторінки заняття', () => {
  it('мета, обладнання й контрольні запитання ЛР1 — простим текстом', () => {
    const s = extractSections(lab1);
    expect(s.get('Мета')!.paragraphs[0]).toMatch(/^Закріпити знання будови/);
    expect(s.get('Обладнання')!.paragraphs[0]).toMatch(/емулятор машини Поста на сайті курсу/);
    expect(s.get('Обладнання')!.paragraphs[0]).not.toMatch(/\]\(/);
    expect(s.get('Контрольні запитання')!.items).toHaveLength(10);
    expect(s.get('Контрольні запитання')!.items[0]).toBe('З яких частин складається машина Поста?');
  });

  it('розмітка прибирається: посилання, код, формули, жирний', () => {
    expect(plainText('[емулятор](/x/) і `1^3`, **важливо**, число $n + 1$ і $m \\ge n$')).toBe(
      'емулятор і 1^3, важливо, число n + 1 і m ≥ n',
    );
  });
});

describe('дані звіту для кабінету', () => {
  it('ЛР1, варіант 4: три рівні з тестами, розділи сторінки', () => {
    const source = reportSource(
      { id: 'lab-01', kind: 'lab', number: 1, title: 'Побудова машин Поста' },
      4,
    );
    expect(source).toMatchObject({ session: 'lab-01', machine: 'post', variant: 4 });
    expect(source.levels.map((l) => l.stars)).toEqual([1, 2, 3]);
    expect(source.levels.every((l) => l.tests.length > 0)).toBe(true);
    expect(source.lab.label).toBe('ЛР1');
    expect(source.lab.questions).toHaveLength(10);
    expect(source.lab.programTitle).toBe('Текст програми');
  });
});

describe('модель звіту', () => {
  const model = buildLabReport(input);

  it('заголовок, студент, ім’я файлу', () => {
    expect(model.heading).toBe('ЛАБОРАТОРНА РОБОТА №1');
    expect(model.student).toBe('Бороденко Катерина, КІ-2406');
    expect(model.fileName).toBe('ЛР1_Бороденко_КІ-2406.docx');
    expect(reportFileName('ЛР1', '  ', '')).toBe('ЛР1.docx');
  });

  it('розділи в порядку змісту звіту', () => {
    expect(model.sections.map((s) => s.title)).toEqual([
      'Тема',
      'Мета',
      'Обладнання',
      'Завдання',
      'Розв’язання',
      'Висновки',
      'Відповіді на контрольні запитання',
    ]);
  });

  it('у розв’язанні — лише розв’язані завдання ★★/★★★; ★ — завжди', () => {
    const solution = model.sections[4]!.blocks;
    expect(solution.filter((b) => b.kind === 'h2')).toHaveLength(1);
    expect(solution.some((b) => b.kind === 'code')).toBe(true);
    expect(solution.find((b) => b.kind === 'table')).toMatchObject({
      rows: [['1', '[1] 1^3', 'λ', 'порожня стрічка', '12']],
    });
    const unsolved = buildLabReport({ ...input, levels: [{ ...input.levels[0]!, program: null }] });
    expect(unsolved.sections[4]!.blocks.at(-1)).toMatchObject({ placeholder: true });
  });
});

describe('документ Word', () => {
  it('поля, шрифти, нумерація розділів, лістинг Courier New 10', async () => {
    const zip = await JSZip.loadAsync(await renderDocxBuffer(buildLabReport(input)));
    const doc = await zip.file('word/document.xml')!.async('string');
    const styles = await zip.file('word/styles.xml')!.async('string');
    const numbering = await zip.file('word/numbering.xml')!.async('string');
    expect(doc).toContain('ЛАБОРАТОРНА РОБОТА №1');
    expect(doc).toContain('Бороденко Катерина, КІ-2406');
    expect(doc).toContain('w:top="1134"'); // 2 см
    expect(doc).toContain('w:left="1276"'); // 2,25 см
    expect(doc).toContain('w:right="851"'); // 1,5 см
    expect(doc).toContain('Courier New');
    expect(doc).toContain('w:val="20"'); // 10 пт у лістингу
    expect(doc).toContain('1. X 2 // стерти');
    expect(styles).toContain('Times New Roman');
    expect(styles).toContain('w:val="28"'); // 14 пт
    expect(styles).toContain('w:firstLine="709"'); // 1,25 см
    expect(numbering).toContain('w:val="%1"');
    expect(numbering).toContain('w:val="%1.%2"');
  });
});

describe('звіти всіх робіт з автоперевіркою', () => {
  const sessions = [
    { id: 'lab-01', kind: 'lab', number: 1, machine: 'post' },
    { id: 'lab-02', kind: 'lab', number: 2, machine: 'turing' },
    { id: 'lab-03', kind: 'lab', number: 3, machine: 'flowchart' },
    { id: 'practical-01', kind: 'practical', number: 1, machine: 'markov' },
    { id: 'practical-02', kind: 'practical', number: 2, machine: 'markov' },
  ] as const;

  it('список робіт зі звітом — усі заняття з тестами варіантів', () => {
    expect([...REPORT_SESSIONS].sort()).toEqual(sessions.map((s) => s.id).sort());
  });

  it.each(sessions)('$id: мета, обладнання, запитання, три рівні з тестами', (s) => {
    const source = reportSource({ ...s, title: 'Тема' }, 7);
    expect(source.machine).toBe(s.machine);
    expect(source.lab.goal.length).toBeGreaterThan(0);
    expect(source.lab.equipment.length).toBeGreaterThan(0);
    expect(source.lab.questions.length).toBeGreaterThan(0);
    expect(source.levels).toHaveLength(3);
    expect(source.levels.every((l) => l.tests.length > 0 && l.statement)).toBe(true);
  });
});

describe('програма у звіті', () => {
  it('машина Тюрінга — таблиця переходів: символи × стани', () => {
    const example = TURING_EXAMPLES[0]!;
    const built = turing.buildProgram({
      alphabet: example.alphabet,
      states: example.states,
      cells: turing.flattenTable(example.table),
    });
    if (!built.ok) throw new Error('приклад не будується');
    const [table] = programBlocks('turing', built.value, '');
    expect(table).toMatchObject({ kind: 'table', header: ['', 'q0'] });
    if (table?.kind !== 'table') throw new Error('не таблиця');
    expect(table.rows.map((r) => r[0])).toEqual(built.value.symbols);
    expect(table.rows.find((r) => r[0] === '9')![1]).toBe('0Lq0');
  });

  it('блок-схема — SVG рисунок; Пост і Марков — лістинг', () => {
    const compiled = flowchart.compile(FLOWCHART_EXAMPLES[1]!.tree);
    if (!compiled.ok) throw new Error('приклад не компілюється');
    const { svg, width, height } = flowchartSvg(compiled.value);
    expect(svg).toMatch(/^<svg/);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(programBlocks('flowchart', compiled.value, '')).toEqual([]);
    expect(programBlocks('markov', compiled.value, 'a -> b\nb -> .c')).toEqual([
      { kind: 'code', lines: ['a -> b', 'b -> .c'] },
    ]);
  });

  it('рисунок потрапляє в документ як PNG', async () => {
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      ),
      (ch) => ch.charCodeAt(0),
    );
    const model = buildLabReport({
      ...input,
      levels: [
        { ...input.levels[0]!, listing: [{ kind: 'image', data: png, width: 300, height: 400 }] },
      ],
    });
    const zip = await JSZip.loadAsync(await renderDocxBuffer(model));
    expect(Object.keys(zip.files).some((n) => n.startsWith('word/media/'))).toBe(true);
    expect(await zip.file('word/document.xml')!.async('string')).not.toContain('1. X 2');
  });
});
