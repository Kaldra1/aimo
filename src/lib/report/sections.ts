/**
 * Розділи сторінки заняття (MDX) як простий текст для звіту: «Мета», «Обладнання»,
 * «Контрольні запитання»… Розмітку Markdown прибираємо: звіт пишеться звичайним текстом.
 */

export interface SectionText {
  /** Абзаци звичайного тексту. */
  paragraphs: string[];
  /** Пункти нумерованого чи маркованого списку (якщо розділ — список). */
  items: string[];
}

/** Markdown-рядок → простий текст: посилання, код, формули, жирний. */
export function plainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$([^$]+)\$/g, (_, tex: string) =>
      tex
        .replace(/\\(?:le|leq)\b/g, '≤')
        .replace(/\\(?:ge|geq)\b/g, '≥')
        .replace(/\\cdot\b/g, '·')
        .replace(/\\lbrace\b/g, '{')
        .replace(/\\rbrace\b/g, '}')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}]/g, '')
        .trim(),
    )
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Розділи другого рівня (## …) сторінки: назва → текст. Блоки коду й таблиці пропускаються. */
export function extractSections(mdx: string): Map<string, SectionText> {
  const body = mdx.replace(/^---[\s\S]*?---/, '');
  const sections = new Map<string, SectionText>();
  let current: SectionText | null = null;
  let paragraph: string[] = [];
  let item: string[] | null = null;
  let inFence = false;

  const flush = () => {
    if (!current) return;
    if (item) current.items.push(plainText(item.join(' ')));
    else if (paragraph.length) current.paragraphs.push(plainText(paragraph.join(' ')));
    paragraph = [];
    item = null;
  };

  for (const raw of body.split(/\r?\n/)) {
    if (raw.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = /^##\s+(.+)$/.exec(raw);
    if (heading) {
      flush();
      current = { paragraphs: [], items: [] };
      sections.set(heading[1]!.trim(), current);
      continue;
    }
    if (!current) continue;
    const line = raw.trim();
    if (
      line === '' ||
      /^#{3,}\s/.test(line) ||
      line.startsWith('|') ||
      line.startsWith('<') ||
      line.startsWith('import ')
    ) {
      flush();
      continue;
    }
    const listItem = /^(?:\d+\.|[-*])\s+(.*)$/.exec(line);
    if (listItem) {
      flush();
      item = [listItem[1]!];
      continue;
    }
    if (item) item.push(line);
    else paragraph.push(line);
  }
  flush();
  return sections;
}
