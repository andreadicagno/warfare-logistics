import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCell } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Water]: 0x2b4a6b,
  [TerrainType.River]: 0x4a90b8,
  [TerrainType.Plains]: 0x6b7a4a,
  [TerrainType.Forest]: 0x3a5a35,
  [TerrainType.Hills]: 0x7a6b50,
  [TerrainType.Mountain]: 0x5a5a65,
  [TerrainType.Marsh]: 0x4a6a55,
  [TerrainType.Urban]: 0x4a4a4a,
};

const BORDER_COLOR = 0x2a2a35;
const URBAN_GRID_COLOR = 0x5a5a5a;
const URBAN_DENSE_BASE = 0x404040;
const URBAN_SPARSE_BASE = 0x555555;

export class TerrainLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;
  private built = false;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(_bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    if (this.built) return;
    this.built = true;
    this.graphics.clear();

    for (const cell of this.gameMap.cells.values()) {
      const px = HexRenderer.hexToPixel(cell.coord);
      const verts = HexRenderer.vertices(px.x, px.y);
      const flat = verts.flatMap((v) => [v.x, v.y]);

      if (cell.terrain === TerrainType.Urban) {
        this.drawUrbanHex(cell, px, flat);
      } else {
        this.graphics.poly(flat);
        this.graphics.fill({ color: TERRAIN_COLORS[cell.terrain] });
        this.graphics.poly(flat);
        this.graphics.stroke({ width: 1, color: BORDER_COLOR });
      }
    }
  }

  private drawUrbanHex(cell: HexCell, px: { x: number; y: number }, flat: number[]): void {
    const urbanNeighborCount = HexGrid.neighbors(cell.coord)
      .map((n) => this.gameMap.cells.get(HexGrid.key(n)))
      .filter((n) => n?.terrain === TerrainType.Urban).length;

    const isDense = urbanNeighborCount >= 3;
    const baseColor = isDense ? URBAN_DENSE_BASE : URBAN_SPARSE_BASE;

    this.graphics.poly(flat);
    this.graphics.fill({ color: baseColor });

    const hash = (cell.coord.q * 73856093) ^ (cell.coord.r * 19349663);
    const offsetX = ((hash & 0xff) / 255) * 2 - 1;
    const offsetY = (((hash >> 8) & 0xff) / 255) * 2 - 1;

    const hexSize = HexRenderer.HEX_SIZE;

    const hLines = isDense ? 4 : 3;
    for (let i = 0; i < hLines; i++) {
      const t = ((i + 0.5) / hLines) * 2 - 1;
      const y = px.y + t * hexSize * 0.7 + offsetY;
      const halfWidth = hexSize * 0.5;
      this.graphics.moveTo(px.x - halfWidth, y);
      this.graphics.lineTo(px.x + halfWidth, y);
    }

    const vLines = isDense ? 3 : 2;
    for (let i = 0; i < vLines; i++) {
      const t = ((i + 0.5) / vLines) * 2 - 1;
      const x = px.x + t * hexSize * 0.5 + offsetX;
      const halfHeight = hexSize * 0.6;
      this.graphics.moveTo(x, px.y - halfHeight);
      this.graphics.lineTo(x, px.y + halfHeight);
    }

    this.graphics.stroke({ width: 0.5, color: URBAN_GRID_COLOR });

    if (isDense) {
      const roofCount = 2 + (Math.abs(hash) % 3);
      for (let i = 0; i < roofCount; i++) {
        const rHash = (hash * (i + 1)) & 0xffff;
        const rx = px.x + ((rHash & 0xff) / 255 - 0.5) * hexSize * 0.6;
        const ry = px.y + (((rHash >> 8) & 0xff) / 255 - 0.5) * hexSize * 0.6;
        const rw = hexSize * 0.08;
        const rh = hexSize * 0.06;
        this.graphics.rect(rx - rw / 2, ry - rh / 2, rw, rh);
        this.graphics.fill({ color: URBAN_GRID_COLOR });
      }
    }

    const hasNonUrbanNeighbor = urbanNeighborCount < 6;
    if (hasNonUrbanNeighbor) {
      this.graphics.poly(flat);
      this.graphics.stroke({ width: 1, color: BORDER_COLOR });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
