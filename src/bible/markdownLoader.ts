import { marked } from 'marked';

export interface ComponentMarker {
  element: HTMLDivElement;
  type: string;
  props: Record<string, string>;
}

const MARKER_REGEX = /<!--\s*component:\s*(\S+)((?:\s+\w+=\S+)*)\s*-->/g;

function parseProps(raw: string): Record<string, string> {
  const props: Record<string, string> = {};
  const matches = raw.matchAll(/(\w+)=(\S+)/g);
  for (const m of matches) {
    props[m[1]] = m[2];
  }
  return props;
}

export function renderMarkdown(source: string): {
  html: string;
  markers: Array<{ type: string; props: Record<string, string>; id: string }>;
} {
  const markers: Array<{ type: string; props: Record<string, string>; id: string }> = [];
  let counter = 0;

  const processed = source.replace(MARKER_REGEX, (_match, type: string, propsStr: string) => {
    const id = `bible-comp-${counter++}`;
    const props = parseProps(propsStr);
    markers.push({ type, props, id });
    return `<div class="bible-component" id="${id}" data-component="${type}"></div>`;
  });

  const html = marked.parse(processed) as string;
  return { html, markers };
}

export function findMarkerElements(
  container: HTMLElement,
  markers: Array<{ type: string; props: Record<string, string>; id: string }>,
): ComponentMarker[] {
  return markers
    .map((m) => {
      const el = container.querySelector<HTMLDivElement>(`#${m.id}`);
      return el ? { element: el, type: m.type, props: m.props } : null;
    })
    .filter((m): m is ComponentMarker => m !== null);
}
