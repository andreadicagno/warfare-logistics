import type { HexCell, HexCoord } from '@core/map/types';

export interface DebugInfo {
  fps: number;
  zoom: number;
  cursorHex: HexCoord | null;
  visibleCells: number;
  cell: HexCell | null;
  hasRoad: boolean;
  hasRailway: boolean;
}

export class DebugOverlay {
  private element: HTMLPreElement;
  private visible = true;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('pre');
    Object.assign(this.element.style, {
      position: 'absolute',
      top: '8px',
      right: '8px',
      margin: '0',
      padding: '8px 10px',
      background: 'rgba(0, 0, 0, 0.7)',
      color: '#ccc',
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.4',
      pointerEvents: 'none',
      zIndex: '10',
      borderRadius: '2px',
      userSelect: 'none',
    });
    parent.appendChild(this.element);
  }

  update(info: DebugInfo): void {
    if (!this.visible) return;

    const lines: string[] = [
      `FPS: ${Math.round(info.fps)}`,
      `Zoom: ${info.zoom.toFixed(2)}x`,
      `Cursor: ${info.cursorHex ? `(${info.cursorHex.q}, ${info.cursorHex.r})` : '—'}`,
      `Visible: ${info.visibleCells} cells`,
    ];

    if (info.cell) {
      const c = info.cell;
      const rivers = c.riverEdges.size > 0 ? `edges ${[...c.riverEdges].join(', ')}` : 'none';
      lines.push(
        '',
        '--- Cell Info ---',
        `Terrain: ${c.terrain}`,
        `Elevation: ${c.elevation.toFixed(2)}`,
        `Moisture: ${c.moisture.toFixed(2)}`,
        `River: ${rivers}`,
        `Road: ${info.hasRoad ? 'yes' : 'no'}`,
        `Railway: ${info.hasRailway ? 'yes' : 'no'}`,
        `Settlement: ${c.settlement ?? 'none'}`,
      );
    } else if (info.cursorHex) {
      lines.push('', 'Cell Info: —');
    }

    this.element.textContent = lines.join('\n');
  }

  toggle(): void {
    this.visible = !this.visible;
    this.element.style.display = this.visible ? 'block' : 'none';
  }

  destroy(): void {
    this.element.remove();
  }
}
