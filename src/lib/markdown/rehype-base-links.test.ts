import { describe, expect, it } from 'vitest';
import rehypeBaseLinks from './rehype-base-links';

const element = (tagName: string, properties: Record<string, unknown>, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});

describe('rehypeBaseLinks', () => {
  it('доповнює href і src від кореня сайту, решту не чіпає', () => {
    const tree = {
      type: 'root',
      children: [
        element('p', {}, [
          element('a', { href: '/labs/1/' }),
          element('a', { href: 'https://example.com/' }),
          element('a', { href: '#goal' }),
          element('img', { src: '/files/scheme.png', alt: '' }),
          { type: 'text', value: '/not-a-link' },
        ] as never),
      ],
    };

    rehypeBaseLinks({ base: '/aimo' })(tree);

    const [paragraph] = tree.children;
    const [internal, external, anchor, image, text] = paragraph!.children as Array<
      ReturnType<typeof element> & { value?: string }
    >;
    expect(internal!.properties.href).toBe('/aimo/labs/1/');
    expect(external!.properties.href).toBe('https://example.com/');
    expect(anchor!.properties.href).toBe('#goal');
    expect(image!.properties.src).toBe('/aimo/files/scheme.png');
    expect(text!.value).toBe('/not-a-link');
  });
});
