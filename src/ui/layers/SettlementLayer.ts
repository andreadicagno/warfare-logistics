import type { GameMap } from '@core/map/types';
import { SettlementType } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const CITY_FILL = 0xd4c8a0;
const CITY_BORDER = 0x2a2a35;
const CITY_RADIUS = 8;
const TOWN_FILL = 0xa09880;
const TOWN_RADIUS = 4;

export class SettlementLayer {
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
      if (cell.settlement === null) continue;

      const px = HexRenderer.hexToPixel(cell.coord);
      if (
        px.x < bounds.minX - margin ||
        px.x > bounds.maxX + margin ||
        px.y < bounds.minY - margin ||
        px.y > bounds.maxY + margin
      )
        continue;

      if (cell.settlement === SettlementType.City) {
        this.graphics.circle(px.x, px.y, CITY_RADIUS);
        this.graphics.fill({ color: CITY_FILL });
        this.graphics.circle(px.x, px.y, CITY_RADIUS);
        this.graphics.stroke({ width: 2, color: CITY_BORDER });
      } else {
        this.graphics.circle(px.x, px.y, TOWN_RADIUS);
        this.graphics.fill({ color: TOWN_FILL });
      }
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
