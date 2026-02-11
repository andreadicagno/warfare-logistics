import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCell } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { createNoise2D } from 'simplex-noise';
import { adjustLuminosity, darken } from '../colorUtils';
import { HexRenderer } from '../HexRenderer';

const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Water]: 0x1a3a5c,
  [TerrainType.River]: 0x4a90b8,
  [TerrainType.Plains]: 0x8a9e5e,
  [TerrainType.Forest]: 0x2d5a2d,
  [TerrainType.Hills]: 0x9e8a5a,
  [TerrainType.Mountain]: 0xb0aab0,
  [TerrainType.Marsh]: 0x5a7a6a,
  [TerrainType.Urban]: 0x7a7a7a,
};

const BORDER_WIDTH = 0.5;
const BORDER_DARKEN = 0.3;
const URBAN_DENSE_BASE = 0x606060;
const URBAN_SPARSE_BASE = 0x8a8a8a;
const URBAN_BOUNDARY_COLOR = 0x2a2a2a;
const URBAN_BOUNDARY_WIDTH = 1;

// Maps HexGrid direction index to the vertex pair forming that edge.
// Direction 0 (E) → edge v0-v1, Direction 1 (NE) → edge v5-v0, etc.
const DIRECTION_TO_EDGE: [number, number][] = [
  [0, 1], // E
  [5, 0], // NE
  [4, 5], // NW
  [3, 4], // W
  [2, 3], // SW
  [1, 2], // SE
];
const NOISE_FREQUENCY = 0.15;
const NOISE_AMPLITUDE = 0.08;
const PATTERN_DARKEN = 0.15;
const PATTERN_STROKE = 0.5;

export class TerrainLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;
  private noise: ReturnType<typeof createNoise2D>;
  private built = false;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
    // Seed the noise generator from the map seed using mulberry32 first step
    let s = gameMap.seed | 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const seedValue = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    this.noise = createNoise2D(() => seedValue);
  }

  build(_bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    if (this.built) return;
    this.built = true;
    this.graphics.clear();

    for (const cell of this.gameMap.cells.values()) {
      const px = HexRenderer.hexToPixel(cell.coord);
      const verts = HexRenderer.vertices(px.x, px.y);
      const flat = verts.flatMap((v) => [v.x, v.y]);

      const noiseVal = this.noise(cell.coord.q * NOISE_FREQUENCY, cell.coord.r * NOISE_FREQUENCY);
      const variation = noiseVal * NOISE_AMPLITUDE;

      if (cell.terrain === TerrainType.Urban) {
        this.drawUrbanHex(cell, px, flat, variation);
      } else {
        const baseColor = TERRAIN_COLORS[cell.terrain];
        const fillColor = adjustLuminosity(baseColor, variation);
        this.graphics.poly(flat);
        this.graphics.fill({ color: fillColor });
        this.graphics.poly(flat);
        this.graphics.stroke({ width: BORDER_WIDTH, color: darken(baseColor, BORDER_DARKEN) });
        const hash = (cell.coord.q * 73856093) ^ (cell.coord.r * 19349663);
        this.drawTerrainPattern(cell.terrain, px, hash);
      }
    }
  }

  private drawUrbanHex(
    cell: HexCell,
    px: { x: number; y: number },
    flat: number[],
    variation: number,
  ): void {
    const urbanNeighborCount = HexGrid.neighbors(cell.coord)
      .map((n) => this.gameMap.cells.get(HexGrid.key(n)))
      .filter((n) => n?.terrain === TerrainType.Urban).length;

    const isDense = urbanNeighborCount >= 3;
    const baseColor = adjustLuminosity(isDense ? URBAN_DENSE_BASE : URBAN_SPARSE_BASE, variation);

    this.graphics.poly(flat);
    this.graphics.fill({ color: baseColor });

    const hash = (cell.coord.q * 73856093) ^ (cell.coord.r * 19349663);
    const hexSize = HexRenderer.HEX_SIZE;
    const dotColor = darken(baseColor, 0.25);
    const dotCount = isDense ? 10 + (Math.abs(hash) % 5) : 4 + (Math.abs(hash) % 3);
    const dotSize = isDense ? 1.2 : 1.0;
    const spread = hexSize * 0.65;

    for (let i = 0; i < dotCount; i++) {
      const h = (hash * (i + 1) + i * 7919) & 0xffff;
      const angle = ((h & 0xff) / 255) * Math.PI * 2;
      const dist = (((h >> 8) & 0xff) / 255) * spread;
      // Bias toward center: square root distribution
      const r = Math.sqrt(dist / spread) * spread;
      const dx = Math.cos(angle) * r;
      const dy = Math.sin(angle) * r;
      this.graphics.rect(px.x + dx - dotSize / 2, px.y + dy - dotSize / 2, dotSize, dotSize);
      this.graphics.fill({ color: dotColor });
    }

    const neighbors = HexGrid.neighbors(cell.coord);
    const verts = HexRenderer.vertices(px.x, px.y);
    for (let d = 0; d < 6; d++) {
      const neighbor = this.gameMap.cells.get(HexGrid.key(neighbors[d]));
      if (!neighbor || neighbor.terrain !== TerrainType.Urban) {
        const [vi, vj] = DIRECTION_TO_EDGE[d];
        this.graphics.moveTo(verts[vi].x, verts[vi].y);
        this.graphics.lineTo(verts[vj].x, verts[vj].y);
        this.graphics.stroke({ width: URBAN_BOUNDARY_WIDTH, color: URBAN_BOUNDARY_COLOR });
      }
    }
  }

  private drawTerrainPattern(
    terrain: TerrainType,
    px: { x: number; y: number },
    hash: number,
  ): void {
    const color = darken(TERRAIN_COLORS[terrain], PATTERN_DARKEN);
    const size = HexRenderer.HEX_SIZE;

    switch (terrain) {
      case TerrainType.Forest:
        this.drawTreeCanopies(px, hash, color, size);
        break;
      case TerrainType.Hills:
        this.drawContourArcs(px, hash, color, size);
        break;
      case TerrainType.Mountain:
        this.drawPeakTriangles(px, hash, color, size);
        break;
      case TerrainType.Marsh:
        this.drawMarshDashes(px, hash, color, size);
        break;
    }
  }

  private drawTreeCanopies(
    px: { x: number; y: number },
    hash: number,
    color: number,
    size: number,
  ): void {
    const count = 2 + (Math.abs(hash) % 2);
    const radius = size * 0.12;
    for (let i = 0; i < count; i++) {
      const h = (hash * (i + 7)) & 0xffff;
      const ox = ((h & 0xff) / 255 - 0.5) * size * 0.6;
      const oy = (((h >> 8) & 0xff) / 255 - 0.5) * size * 0.5;
      this.graphics.circle(px.x + ox, px.y + oy, radius);
      this.graphics.stroke({ width: PATTERN_STROKE, color });
    }
  }

  private drawContourArcs(
    px: { x: number; y: number },
    hash: number,
    color: number,
    size: number,
  ): void {
    const count = 2 + (Math.abs(hash) % 2);
    for (let i = 0; i < count; i++) {
      const t = ((i + 0.5) / count) * 2 - 1;
      const cy = px.y + t * size * 0.35;
      const h = (hash * (i + 3)) & 0xffff;
      const ox = ((h & 0xff) / 255 - 0.5) * size * 0.15;
      const arcWidth = size * 0.35;
      this.graphics.moveTo(px.x - arcWidth + ox, cy);
      this.graphics.quadraticCurveTo(px.x + ox, cy - size * 0.12, px.x + arcWidth + ox, cy);
      this.graphics.stroke({ width: PATTERN_STROKE, color });
    }
  }

  private drawPeakTriangles(
    px: { x: number; y: number },
    hash: number,
    color: number,
    size: number,
  ): void {
    const count = 1 + (Math.abs(hash) % 2);
    const triH = size * 0.3;
    const triW = size * 0.2;
    for (let i = 0; i < count; i++) {
      const h = (hash * (i + 5)) & 0xffff;
      const ox = ((h & 0xff) / 255 - 0.5) * size * 0.4;
      const oy = (((h >> 8) & 0xff) / 255 - 0.5) * size * 0.3;
      const cx = px.x + ox;
      const cy = px.y + oy;
      this.graphics.moveTo(cx, cy - triH / 2);
      this.graphics.lineTo(cx - triW / 2, cy + triH / 2);
      this.graphics.lineTo(cx + triW / 2, cy + triH / 2);
      this.graphics.closePath();
      this.graphics.stroke({ width: PATTERN_STROKE, color });
    }
  }

  private drawMarshDashes(
    px: { x: number; y: number },
    hash: number,
    color: number,
    size: number,
  ): void {
    const count = 3 + (Math.abs(hash) % 2);
    const dashW = size * 0.25;
    for (let i = 0; i < count; i++) {
      const t = ((i + 0.5) / count) * 2 - 1;
      const cy = px.y + t * size * 0.4;
      const h = (hash * (i + 11)) & 0xffff;
      const ox = ((h & 0xff) / 255 - 0.5) * size * 0.3;
      this.graphics.moveTo(px.x - dashW / 2 + ox, cy);
      this.graphics.lineTo(px.x + dashW / 2 + ox, cy);
      this.graphics.stroke({ width: PATTERN_STROKE, color });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
