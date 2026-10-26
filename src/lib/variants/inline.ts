/** Умова завдання варіанта → HTML: `код` моноширинним, $формула$ — KaTeX (під час збирання). */
import katex from 'katex';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function inlineTask(text: string): string {
  return text
    .split(/(`[^`]+`|\$[^$]+\$)/)
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
        return `<code>${escape(part.slice(1, -1))}</code>`;
      }
      if (part.startsWith('$') && part.endsWith('$') && part.length > 1) {
        return katex.renderToString(part.slice(1, -1), { throwOnError: false });
      }
      return escape(part);
    })
    .join('');
}
