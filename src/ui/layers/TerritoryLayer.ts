import type { GameMap } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import type { Faction } from '@core/mock/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const ALLIED_COLOR = 0x4488cc;
const ENEMY_COLOR = 0xcc4444;
const TERRITORY_ALPHA = 0.15;

export class TerritoryLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;
  private territory: Map<string, Faction>;
  private builtVersion = -1;

  constructor(gameMap: GameMap, territory: Map<string, Faction>) {
    this.gameMap = gameMap;
    this.territory = territory;
    this.container.addChild(this.graphics);
  }

  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();

    for (const [key, cell] of this.gameMap.cells) {
      if (cell.terrain === TerrainType.Water || cell.terrain === TerrainType.Mountain) continue;
      const faction = this.territory.get(key);
      if (!faction) continue;

      const px = HexRenderer.hexToPixel(cell.coord);
      const verts = HexRenderer.vertices(px.x, px.y);
      const flat = verts.flatMap((v) => [v.x, v.y]);

      const color = faction === 'allied' ? ALLIED_COLOR : ENEMY_COLOR;
      this.graphics.poly(flat);
      this.graphics.fill({ color, alpha: TERRITORY_ALPHA });
    }
  }

  updateData(territory: Map<string, Faction>): void {
    this.territory = territory;
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
