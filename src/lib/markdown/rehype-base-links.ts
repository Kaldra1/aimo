import { withBase } from '../url';

/** Мінімальна частина дерева HAST, яку обробляє плагін. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

export interface RehypeBaseLinksOptions {
  /** Базовий шлях сайту, наприклад `/aimo`. */
  base: string;
}

const URL_ATTRIBUTES = ['href', 'src'] as const;

/**
 * Rehype-плагін: доповнює базовим шляхом посилання від кореня сайту в Markdown.
 * Автор контенту пише `[ЛР1](/labs/1/)`, а на GitHub Pages виходить `/aimo/labs/1/`.
 */
export default function rehypeBaseLinks(options: RehypeBaseLinksOptions) {
  return (tree: HastNode): void => {
    visit(tree, (node) => {
      if (node.type !== 'element' || !node.properties) return;
      for (const attribute of URL_ATTRIBUTES) {
        const value = node.properties[attribute];
        if (typeof value === 'string') {
          node.properties[attribute] = withBase(value, options.base);
        }
      }
    });
  };
}

function visit(node: HastNode, callback: (node: HastNode) => void): void {
  callback(node);
  for (const child of node.children ?? []) visit(child, callback);
}
