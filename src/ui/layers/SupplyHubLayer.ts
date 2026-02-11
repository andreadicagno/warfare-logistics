import type { GameMap } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const LARGE_FILL = 0xd4c8a0;
const LARGE_BORDER = 0x2a2a35;
const LARGE_RADIUS = 8;
const SMALL_FILL = 0xa09880;
const SMALL_RADIUS = 4;

export class SupplyHubLayer {
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

    for (const hub of this.gameMap.supplyHubs) {
      const px = HexRenderer.hexToPixel(hub.coord);

      if (hub.size === 'large') {
        this.graphics.circle(px.x, px.y, LARGE_RADIUS);
        this.graphics.fill({ color: LARGE_FILL });
        this.graphics.circle(px.x, px.y, LARGE_RADIUS);
        this.graphics.stroke({ width: 2, color: LARGE_BORDER });
      } else {
        this.graphics.circle(px.x, px.y, SMALL_RADIUS);
        this.graphics.fill({ color: SMALL_FILL });
      }
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
