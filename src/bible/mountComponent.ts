import type { ComponentMarker } from './markdownLoader';

export type ComponentFactory = (
  container: HTMLDivElement,
  props: Record<string, string>,
) => Promise<() => void>;

const registry = new Map<string, ComponentFactory>();

export function registerComponent(type: string, factory: ComponentFactory): void {
  registry.set(type, factory);
}

export async function mountComponents(markers: ComponentMarker[]): Promise<Array<() => void>> {
  const cleanups: Array<() => void> = [];

  for (const marker of markers) {
    const factory = registry.get(marker.type);
    if (!factory) {
      marker.element.textContent = `[Unknown component: ${marker.type}]`;
      continue;
    }
    const cleanup = await factory(marker.element, marker.props);
    cleanups.push(cleanup);
  }

  return cleanups;
}
