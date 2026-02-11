import type { GameMap } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const RIVER_COLOR = 0x4a7a9a;
const RIVER_WIDTH = 3;

export class RiverLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(_bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    this.graphics.clear();

    for (const river of this.gameMap.rivers) {
      if (river.edges.length < 2) continue;

      const midpoints: Array<{ x: number; y: number }> = [];
      for (const entry of river.edges) {
        const px = HexRenderer.hexToPixel(entry.hex);
        const mid = HexRenderer.edgeMidpoint(px.x, px.y, entry.edge);
        midpoints.push(mid);
      }

      this.graphics.moveTo(midpoints[0].x, midpoints[0].y);
      for (let i = 1; i < midpoints.length; i++) {
        this.graphics.lineTo(midpoints[i].x, midpoints[i].y);
      }
      this.graphics.stroke({ width: RIVER_WIDTH, color: RIVER_COLOR });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
