import type { GameMap } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Water]: 0x2b4a6b,
  [TerrainType.Plains]: 0x6b7a4a,
  [TerrainType.Forest]: 0x3a5a35,
  [TerrainType.Hills]: 0x7a6b50,
  [TerrainType.Mountain]: 0x5a5a65,
  [TerrainType.Marsh]: 0x4a6a55,
};

const BORDER_COLOR = 0x2a2a35;

export class TerrainLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    this.graphics.clear();

    const margin = HexRenderer.HEX_SIZE * 2;

    for (const cell of this.gameMap.cells.values()) {
      const px = HexRenderer.hexToPixel(cell.coord);
      if (
        px.x < bounds.minX - margin ||
        px.x > bounds.maxX + margin ||
        px.y < bounds.minY - margin ||
        px.y > bounds.maxY + margin
      )
        continue;

      const verts = HexRenderer.vertices(px.x, px.y);
      const flat = verts.flatMap((v) => [v.x, v.y]);

      this.graphics.poly(flat);
      this.graphics.fill({ color: TERRAIN_COLORS[cell.terrain] });
      this.graphics.poly(flat);
      this.graphics.stroke({ width: 1, color: BORDER_COLOR });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
