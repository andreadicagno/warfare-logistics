import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../markdownLoader';

describe('renderMarkdown', () => {
  it('converts markdown to HTML', () => {
    const { html } = renderMarkdown('# Hello\n\nWorld');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<p>World</p>');
  });

  it('extracts component markers', () => {
    const source = '## Terrain\n\n<!-- component: terrain-preview type=plains -->\n\nSome text.';
    const { html, markers } = renderMarkdown(source);

    expect(markers).toHaveLength(1);
    expect(markers[0].type).toBe('terrain-preview');
    expect(markers[0].props).toEqual({ type: 'plains' });
    expect(html).toContain('data-component="terrain-preview"');
  });

  it('handles multiple markers', () => {
    const source = [
      '<!-- component: supply-line level=1 -->',
      '<!-- component: supply-line level=3 -->',
    ].join('\n\n');

    const { markers } = renderMarkdown(source);
    expect(markers).toHaveLength(2);
    expect(markers[0].props.level).toBe('1');
    expect(markers[1].props.level).toBe('3');
  });

  it('handles no markers', () => {
    const { markers } = renderMarkdown('# Just text');
    expect(markers).toHaveLength(0);
  });
});
