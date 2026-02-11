import { HexGrid } from '@core/map/HexGrid';
import type { GameMap } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const ROAD_COLOR = 0x6b5a40;
const ROAD_WIDTH = 2;
const RAILWAY_COLOR = 0x3a3a45;
const RAILWAY_WIDTH = 3;
const TIE_LENGTH = 6;
const TIE_SPACING = 10;
const BRIDGE_COLOR = 0x8b7355;
const BRIDGE_WIDTH = 8;
const BRIDGE_HEIGHT = 4;

export class RouteLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(_bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    this.graphics.clear();
    this.drawRoads();
    this.drawRailways();
  }

  private drawRoads(): void {
    for (const route of this.gameMap.roads) {
      if (route.hexes.length < 2) continue;
      const points = route.hexes.map((h) => HexRenderer.hexToPixel(h));

      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i];
        const to = points[i + 1];
        this.drawDashedLine(from.x, from.y, to.x, to.y, 6, 4);
      }

      this.drawBridges(route.hexes);
    }
  }

  private drawRailways(): void {
    for (const route of this.gameMap.railways) {
      if (route.hexes.length < 2) continue;
      const points = route.hexes.map((h) => HexRenderer.hexToPixel(h));

      this.graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.graphics.lineTo(points[i].x, points[i].y);
      }
      this.graphics.stroke({ width: RAILWAY_WIDTH, color: RAILWAY_COLOR });

      this.drawBridges(route.hexes);

      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i];
        const to = points[i + 1];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        const nx = -dy / len;
        const ny = dx / len;

        const ties = Math.floor(len / TIE_SPACING);
        for (let t = 1; t <= ties; t++) {
          const frac = t / (ties + 1);
          const cx = from.x + dx * frac;
          const cy = from.y + dy * frac;
          this.graphics.moveTo(cx - (nx * TIE_LENGTH) / 2, cy - (ny * TIE_LENGTH) / 2);
          this.graphics.lineTo(cx + (nx * TIE_LENGTH) / 2, cy + (ny * TIE_LENGTH) / 2);
          this.graphics.stroke({ width: 1, color: RAILWAY_COLOR });
        }
      }
    }
  }

  private drawBridges(hexes: { q: number; r: number }[]): void {
    for (const hex of hexes) {
      const cell = this.gameMap.cells.get(HexGrid.key(hex));
      if (cell?.terrain === TerrainType.River) {
        const px = HexRenderer.hexToPixel(hex);
        this.graphics.rect(
          px.x - BRIDGE_WIDTH / 2,
          px.y - BRIDGE_HEIGHT / 2,
          BRIDGE_WIDTH,
          BRIDGE_HEIGHT,
        );
        this.graphics.fill({ color: BRIDGE_COLOR });
      }
    }
  }

  private drawDashedLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLength: number,
    gapLength: number,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const totalLen = Math.sqrt(dx * dx + dy * dy);
    if (totalLen === 0) return;
    const ux = dx / totalLen;
    const uy = dy / totalLen;

    let pos = 0;
    while (pos < totalLen) {
      const dashEnd = Math.min(pos + dashLength, totalLen);
      this.graphics.moveTo(x1 + ux * pos, y1 + uy * pos);
      this.graphics.lineTo(x1 + ux * dashEnd, y1 + uy * dashEnd);
      this.graphics.stroke({ width: ROAD_WIDTH, color: ROAD_COLOR });
      pos = dashEnd + gapLength;
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
