/**
 * ReportModel → .docx за правилами оформлення коледжу (ЄСПД):
 * поля 2 см зверху й знизу, 2,25 см ліворуч, 1,5 см праворуч; Times New Roman 14, інтервал 1,0,
 * абзацний відступ 1,25 см; назви розділів — «Заголовок 1» з автономером без крапки;
 * лістинги програм — Courier New 10; таблиці — одинарні межі, TNR 14, жирний лише заголовок.
 */
import type { Block, ReportModel } from './model';

const CM = 567; // twips у сантиметрі
const BODY = 28; // 14 пт у половинах пункту
const CODE = 20; // 10 пт
const TAB = Math.round(1.75 * CM); // текст після номера

export async function renderDocx(model: ReportModel): Promise<Blob> {
  const docx = await import('docx');
  return docx.Packer.toBlob(buildDocument(docx, model));
}

/** Для тестів у Node: той самий документ як Buffer. */
export async function renderDocxBuffer(model: ReportModel): Promise<Uint8Array> {
  const docx = await import('docx');
  return docx.Packer.toBuffer(buildDocument(docx, model));
}

type Docx = typeof import('docx');

function buildDocument(d: Docx, model: ReportModel) {
  const font = 'Times New Roman';
  const run = (text: string, extra: Record<string, unknown> = {}) =>
    new d.TextRun({ text, font, size: BODY, ...extra });

  const centered = (text: string, bold = false) =>
    new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      indent: { firstLine: 0 },
      children: [run(text, bold ? { bold: true } : {})],
    });

  const paragraph = (text: string) =>
    new d.Paragraph({ alignment: d.AlignmentType.JUSTIFIED, children: [run(text)] });

  const codeLine = (text: string) =>
    new d.Paragraph({
      indent: { firstLine: 0 },
      alignment: d.AlignmentType.LEFT,
      children: [
        new d.TextRun({ text: text === '' ? ' ' : text, font: 'Courier New', size: CODE }),
      ],
    });

  const cell = (text: string, bold: boolean) =>
    new d.TableCell({
      children: [
        new d.Paragraph({
          indent: { firstLine: 0 },
          alignment: d.AlignmentType.LEFT,
          children: [run(text, bold ? { bold: true } : {})],
        }),
      ],
    });

  const table = (header: string[], rows: string[][]) =>
    new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      rows: [
        new d.TableRow({ tableHeader: true, children: header.map((h) => cell(h, true)) }),
        ...rows.map((r) => new d.TableRow({ children: r.map((c) => cell(c, false)) })),
      ],
    });

  const blocks = (list: Block[]) =>
    list.flatMap((b) => {
      switch (b.kind) {
        case 'p':
          return [paragraph(b.text)];
        case 'h2':
          return [
            new d.Paragraph({
              heading: d.HeadingLevel.HEADING_2,
              numbering: { reference: 'sections', level: 1 },
              children: [run(b.text)],
            }),
          ];
        case 'code':
          return b.lines.map(codeLine);
        case 'table':
          return [
            table(b.header, b.rows),
            new d.Paragraph({ indent: { firstLine: 0 }, children: [] }),
          ];
        case 'image':
          return [
            new d.Paragraph({
              alignment: d.AlignmentType.CENTER,
              indent: { firstLine: 0 },
              children: [
                new d.ImageRun({
                  type: 'png',
                  data: b.data,
                  transformation: { width: b.width, height: b.height },
                }),
              ],
            }),
          ];
        case 'list':
          return b.items.map(
            (text) =>
              new d.Paragraph({
                numbering: { reference: 'items', level: 0 },
                alignment: d.AlignmentType.JUSTIFIED,
                children: [run(text)],
              }),
          );
      }
    });

  const children = [
    centered(model.heading, true),
    centered(model.student || '[Прізвище Ім’я, група]'),
    ...model.sections.flatMap((s) => [
      new d.Paragraph({
        heading: d.HeadingLevel.HEADING_1,
        numbering: { reference: 'sections', level: 0 },
        children: [run(s.title)],
      }),
      ...blocks(s.blocks),
    ]),
  ];

  // Номер на 1,25 см, після нього табуляція до 1,75 см (як у списках стандарту коледжу).
  const numbered = (format: string, level: number) => ({
    level,
    format: d.LevelFormat.DECIMAL,
    text: format,
    alignment: d.AlignmentType.LEFT,
    suffix: d.LevelSuffix.TAB,
    style: {
      paragraph: {
        indent: { left: 0, firstLine: Math.round(1.25 * CM) },
        tabStops: [{ type: d.TabStopType.LEFT, position: TAB }],
      },
    },
  });

  return new d.Document({
    creator: 'АІМО',
    title: `${model.heading} — ${model.student}`,
    styles: {
      default: {
        document: {
          run: { font, size: BODY },
          paragraph: {
            spacing: { line: 240, before: 0, after: 0 },
            indent: { firstLine: Math.round(1.25 * CM) },
          },
        },
        heading1: {
          run: { font, size: BODY, bold: true, color: '000000' },
          paragraph: {
            spacing: { before: 240, after: 240, line: 240 },
            keepNext: true,
            keepLines: true,
          },
        },
        heading2: {
          run: { font, size: BODY, bold: true, color: '000000' },
          paragraph: {
            spacing: { before: 120, after: 120, line: 240 },
            keepNext: true,
            keepLines: true,
          },
        },
      },
    },
    numbering: {
      config: [
        { reference: 'sections', levels: [numbered('%1', 0), numbered('%1.%2', 1)] },
        { reference: 'items', levels: [numbered('%1.', 0)] },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: 2 * CM,
              bottom: 2 * CM,
              left: Math.round(2.25 * CM),
              right: Math.round(1.5 * CM),
            },
          },
        },
        children,
      },
    ],
  });
}
