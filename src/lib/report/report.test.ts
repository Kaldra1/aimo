import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildLabReport, reportFileName, type LabReportInput } from './model';
import { renderDocxBuffer } from './render';
import { extractSections, plainText } from './sections';
import { reportSource } from './source';

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
