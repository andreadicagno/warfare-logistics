import { HexGrid } from '@core/map/HexGrid';
import type { HexCoord } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const LINE_COLOR = 0xffffff;
const LINE_BORDER_COLOR = 0x222222;
const LINE_WIDTH = 3;
const BORDER_WIDTH = 5;

export class FrontLineLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private builtVersion = -1;
  private edges: Array<{ a: HexCoord; b: HexCoord }> = [];

  constructor() {
    this.container.addChild(this.graphics);
  }

  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();

    if (this.edges.length === 0) return;

    // Pass 1: dark border (wider)
    for (const { a, b } of this.edges) {
      const edgeIdx = HexGrid.edgeDirection(a, b);
      if (edgeIdx === null) continue;
      const center = HexRenderer.hexToPixel(a);
      const verts = HexRenderer.vertices(center.x, center.y);
      const v0 = verts[edgeIdx];
      const v1 = verts[(edgeIdx + 1) % 6];
      this.graphics.moveTo(v0.x, v0.y);
      this.graphics.lineTo(v1.x, v1.y);
    }
    this.graphics.stroke({ width: BORDER_WIDTH, color: LINE_BORDER_COLOR });

    // Pass 2: white line (thinner)
    for (const { a, b } of this.edges) {
      const edgeIdx = HexGrid.edgeDirection(a, b);
      if (edgeIdx === null) continue;
      const center = HexRenderer.hexToPixel(a);
      const verts = HexRenderer.vertices(center.x, center.y);
      const v0 = verts[edgeIdx];
      const v1 = verts[(edgeIdx + 1) % 6];
      this.graphics.moveTo(v0.x, v0.y);
      this.graphics.lineTo(v1.x, v1.y);
    }
    this.graphics.stroke({ width: LINE_WIDTH, color: LINE_COLOR });
  }

  updateData(edges: Array<{ a: HexCoord; b: HexCoord }>): void {
    this.edges = edges;
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
