import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import type { Faction } from '@core/mock/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const ALLIED_COLOR = 0x4488cc;
const ENEMY_COLOR = 0xcc4444;
const ALPHA_MAX = 0.45;
const ALPHA_MIN = 0.08;

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

      const normalizedDist = distanceMap.get(key) ?? 1;
      const alpha = ALPHA_MAX - normalizedDist * (ALPHA_MAX - ALPHA_MIN);
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
   * Returns a map of hex key → normalized distance (0 = front, 1 = farthest).
   */
  private computeFrontDistances(): Map<string, number> {
    const distances = new Map<string, number>();

    // Collect all hexes that touch the front line
    const frontHexKeys = new Set<string>();
    for (const edge of this.frontLineEdges) {
      frontHexKeys.add(HexGrid.key(edge.a));
      frontHexKeys.add(HexGrid.key(edge.b));
    }

    if (frontHexKeys.size === 0) {
      // No front line — everything at max distance
      for (const key of this.territory.keys()) {
        distances.set(key, 1);
      }
      return distances;
    }

    // BFS
    const queue: string[] = [];
    for (const key of frontHexKeys) {
      if (this.territory.has(key)) {
        distances.set(key, 0);
        queue.push(key);
      }
    }

    let maxDist = 0;
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

        const nbDist = dist + 1;
        distances.set(nbKey, nbDist);
        if (nbDist > maxDist) maxDist = nbDist;
        queue.push(nbKey);
      }
    }

    // Normalize to 0-1
    if (maxDist > 0) {
      for (const [key, dist] of distances) {
        distances.set(key, dist / maxDist);
      }
    }

    return distances;
  }
}
