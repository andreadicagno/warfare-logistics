import { HexGrid } from '@core/map/HexGrid';
import type { HexCoord } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const LINE_COLOR = 0xffffff;
const LINE_BORDER_COLOR = 0x222222;
const LINE_WIDTH = 3;
const BORDER_WIDTH = 5;

/** Round to fixed precision to use as map key for vertex matching. */
function vtxKey(x: number, y: number): string {
  return `${Math.round(x * 100)},${Math.round(y * 100)}`;
}

/**
 * Chain a set of edge segments (pairs of vertices) into connected polylines.
 * Each segment is [v0, v1]. Connected segments share a vertex.
 * Returns an array of polylines, where each polyline is an array of {x, y}.
 */
function chainEdges(
  segments: Array<{ x0: number; y0: number; x1: number; y1: number }>,
): Array<Array<{ x: number; y: number }>> {
  // Build adjacency: vertex key → list of { other vertex key, other point, segment index }
  const adj = new Map<
    string,
    Array<{ key: string; pt: { x: number; y: number }; segIdx: number }>
  >();
  const used = new Set<number>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const k0 = vtxKey(seg.x0, seg.y0);
    const k1 = vtxKey(seg.x1, seg.y1);

    if (!adj.has(k0)) adj.set(k0, []);
    if (!adj.has(k1)) adj.set(k1, []);

    adj.get(k0)!.push({ key: k1, pt: { x: seg.x1, y: seg.y1 }, segIdx: i });
    adj.get(k1)!.push({ key: k0, pt: { x: seg.x0, y: seg.y0 }, segIdx: i });
  }

  const chains: Array<Array<{ x: number; y: number }>> = [];

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;

    // Start a new chain from this segment
    used.add(i);
    const seg = segments[i];
    const chain: Array<{ x: number; y: number }> = [
      { x: seg.x0, y: seg.y0 },
      { x: seg.x1, y: seg.y1 },
    ];

    // Extend forward from the last point
    let currentKey = vtxKey(seg.x1, seg.y1);
    let extended = true;
    while (extended) {
      extended = false;
      const neighbors = adj.get(currentKey);
      if (!neighbors) break;
      for (const nb of neighbors) {
        if (!used.has(nb.segIdx)) {
          used.add(nb.segIdx);
          chain.push(nb.pt);
          currentKey = nb.key;
          extended = true;
          break;
        }
      }
    }

    // Extend backward from the first point
    currentKey = vtxKey(seg.x0, seg.y0);
    extended = true;
    while (extended) {
      extended = false;
      const neighbors = adj.get(currentKey);
      if (!neighbors) break;
      for (const nb of neighbors) {
        if (!used.has(nb.segIdx)) {
          used.add(nb.segIdx);
          chain.unshift(nb.pt);
          currentKey = nb.key;
          extended = true;
          break;
        }
      }
    }

    chains.push(chain);
  }

  return chains;
}

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

    // Convert hex edges to pixel segments
    const segments: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    for (const { a, b } of this.edges) {
      const dirIdx = HexGrid.edgeDirection(a, b);
      if (dirIdx === null) continue;
      // Direction indices and vertex-edge indices use different winding:
      // vertex edges go CCW (0°,60°,120°…) while directions go CW from E.
      // Correct mapping: edge = (6 - direction) % 6
      const edgeIdx = (6 - dirIdx) % 6;
      const center = HexRenderer.hexToPixel(a);
      const verts = HexRenderer.vertices(center.x, center.y);
      const v0 = verts[edgeIdx];
      const v1 = verts[(edgeIdx + 1) % 6];
      segments.push({ x0: v0.x, y0: v0.y, x1: v1.x, y1: v1.y });
    }

    // Chain into connected polylines
    const chains = chainEdges(segments);

    // Pass 1: dark border (wider)
    for (const chain of chains) {
      this.graphics.moveTo(chain[0].x, chain[0].y);
      for (let i = 1; i < chain.length; i++) {
        this.graphics.lineTo(chain[i].x, chain[i].y);
      }
    }
    this.graphics.stroke({ width: BORDER_WIDTH, color: LINE_BORDER_COLOR });

    // Pass 2: white line (thinner)
    for (const chain of chains) {
      this.graphics.moveTo(chain[0].x, chain[0].y);
      for (let i = 1; i < chain.length; i++) {
        this.graphics.lineTo(chain[i].x, chain[i].y);
      }
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
