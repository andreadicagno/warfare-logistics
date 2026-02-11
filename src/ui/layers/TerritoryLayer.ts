import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import type { Faction } from '@core/mock/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const ALLIED_COLOR = 0x4488cc;
const ENEMY_COLOR = 0xcc4444;
const ALPHA_MAX = 0.6;
const ALPHA_MIN = 0.1;
const GRADIENT_DISTANCE = 8; // gradient from ALPHA_MAX to ALPHA_MIN over 8 hexes, then ALPHA_MIN

export class TerritoryLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;
  private territory: Map<string, Faction>;
  private frontLineEdges: Array<{ a: HexCoord; b: HexCoord }>;
  private builtVersion = -1;

  constructor(
    gameMap: GameMap,
    territory: Map<string, Faction>,
    frontLineEdges: Array<{ a: HexCoord; b: HexCoord }> = [],
  ) {
    this.gameMap = gameMap;
    this.territory = territory;
    this.frontLineEdges = frontLineEdges;
    this.container.addChild(this.graphics);
  }

  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();

    const distanceMap = this.computeFrontDistances();

    for (const [key, cell] of this.gameMap.cells) {
      if (cell.terrain === TerrainType.Water || cell.terrain === TerrainType.Mountain) continue;
      const faction = this.territory.get(key);
      if (!faction) continue;

      const px = HexRenderer.hexToPixel(cell.coord);
      const verts = HexRenderer.vertices(px.x, px.y);
      const flat = verts.flatMap((v) => [v.x, v.y]);

      const rawDist = distanceMap.get(key) ?? GRADIENT_DISTANCE;
      const t = Math.min(rawDist / GRADIENT_DISTANCE, 1); // 0 at front, 1 at 6+ hexes
      const alpha = ALPHA_MAX - t * (ALPHA_MAX - ALPHA_MIN);
      const color = faction === 'allied' ? ALLIED_COLOR : ENEMY_COLOR;
      this.graphics.poly(flat);
      this.graphics.fill({ color, alpha });
    }
  }

  updateData(
    territory: Map<string, Faction>,
    frontLineEdges?: Array<{ a: HexCoord; b: HexCoord }>,
  ): void {
    this.territory = territory;
    if (frontLineEdges) {
      this.frontLineEdges = frontLineEdges;
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }

  /**
   * BFS from all front-line-adjacent hexes outward.
   * Returns a map of hex key → raw hex distance from front (0, 1, 2, ...).
   */
  private computeFrontDistances(): Map<string, number> {
    const distances = new Map<string, number>();

    const frontHexKeys = new Set<string>();
    for (const edge of this.frontLineEdges) {
      frontHexKeys.add(HexGrid.key(edge.a));
      frontHexKeys.add(HexGrid.key(edge.b));
    }

    if (frontHexKeys.size === 0) return distances;

    const queue: string[] = [];
    for (const key of frontHexKeys) {
      if (this.territory.has(key)) {
        distances.set(key, 0);
        queue.push(key);
      }
    }

    let head = 0;
    while (head < queue.length) {
      const key = queue[head++];
      const dist = distances.get(key)!;
      const parts = key.split(',');
      const coord: HexCoord = { q: Number(parts[0]), r: Number(parts[1]) };

      for (const nb of HexGrid.neighbors(coord)) {
        const nbKey = HexGrid.key(nb);
        if (!this.territory.has(nbKey)) continue;
        if (distances.has(nbKey)) continue;

        distances.set(nbKey, dist + 1);
        queue.push(nbKey);
      }
    }

    return distances;
  }
}
