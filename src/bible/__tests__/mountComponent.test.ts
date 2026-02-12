// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mountComponents, registerComponent } from '../mountComponent';

describe('mountComponents', () => {
  it('calls the registered factory for known types', async () => {
    const cleanup = vi.fn();
    const factory = vi.fn().mockResolvedValue(cleanup);
    registerComponent('test-comp', factory);

    const div = document.createElement('div');
    const markers = [{ element: div, type: 'test-comp', props: { foo: 'bar' } }];

    const cleanups = await mountComponents(markers);

    expect(factory).toHaveBeenCalledWith(div, { foo: 'bar' });
    expect(cleanups).toHaveLength(1);
  });

  it('shows placeholder for unknown types', async () => {
    const div = document.createElement('div');
    const markers = [{ element: div, type: 'unknown-type', props: {} }];

    await mountComponents(markers);

    expect(div.textContent).toContain('Unknown component');
  });
});
