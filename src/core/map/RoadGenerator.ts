import type { HexCell, HexCoord, RoutePath } from './types';
import { TerrainType, SettlementType } from './types';
import { HexGrid } from './HexGrid';

type Infrastructure = 'none' | 'basic' | 'developed';

const TERRAIN_COST: Record<TerrainType, number> = {
  [TerrainType.Plains]: 1,
  [TerrainType.Forest]: 2,
  [TerrainType.Hills]: 3,
  [TerrainType.Marsh]: 3,
  [TerrainType.Mountain]: Infinity,
  [TerrainType.Water]: Infinity,
};

export class RoadGenerator {
  static generate(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    infrastructure: Infrastructure
  ): { roads: RoutePath[]; railways: RoutePath[] } {
    const cities = [...cells.values()]
      .filter((c) => c.settlement === SettlementType.City)
      .map((c) => c.coord);
    const towns = [...cells.values()]
      .filter((c) => c.settlement === SettlementType.Town)
      .map((c) => c.coord);

    const roads: RoutePath[] = [];
    const usedPairs = new Set<string>();

    // Connect each town to its nearest city
    for (const town of towns) {
      let nearestCity: HexCoord | null = null;
      let nearestDist = Infinity;
      for (const city of cities) {
        const dist = HexGrid.distance(town, city);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestCity = city;
        }
      }
      if (nearestCity) {
        const pairKey = RoadGenerator.pairKey(town, nearestCity);
        if (!usedPairs.has(pairKey)) {
          const path = RoadGenerator.astar(town, nearestCity, cells, width, height);
          if (path) {
            roads.push({ hexes: path, type: 'road' });
            usedPairs.add(pairKey);
          }
        }
      }
    }

    // Connect cities to each other if within 20 hexes
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        if (HexGrid.distance(cities[i], cities[j]) <= 20) {
          const pairKey = RoadGenerator.pairKey(cities[i], cities[j]);
          if (!usedPairs.has(pairKey)) {
            const path = RoadGenerator.astar(cities[i], cities[j], cells, width, height);
            if (path) {
              roads.push({ hexes: path, type: 'road' });
              usedPairs.add(pairKey);
            }
          }
        }
      }
    }

    // Railways
    const railways: RoutePath[] = [];
    if (infrastructure !== 'none') {
      const cityPairs: Array<{ from: HexCoord; to: HexCoord; dist: number }> = [];
      for (let i = 0; i < cities.length; i++) {
        for (let j = i + 1; j < cities.length; j++) {
          cityPairs.push({
            from: cities[i],
            to: cities[j],
            dist: HexGrid.distance(cities[i], cities[j]),
          });
        }
      }
      cityPairs.sort((a, b) => a.dist - b.dist);

      const railCount = infrastructure === 'basic'
        ? Math.min(2, cityPairs.length)
        : cityPairs.length;

      for (let i = 0; i < railCount; i++) {
        const path = RoadGenerator.astar(
          cityPairs[i].from, cityPairs[i].to, cells, width, height
        );
        if (path) {
          railways.push({ hexes: path, type: 'railway' });
        }
      }
    }

    return { roads, railways };
  }

  /** A* pathfinding with terrain costs */
  static astar(
    start: HexCoord,
    goal: HexCoord,
    cells: Map<string, HexCell>,
    width: number,
    height: number
  ): HexCoord[] | null {
    const startKey = HexGrid.key(start);
    const goalKey = HexGrid.key(goal);

    const openSet = new Map<string, { coord: HexCoord; f: number }>();
    openSet.set(startKey, { coord: start, f: HexGrid.distance(start, goal) });

    const gScore = new Map<string, number>();
    gScore.set(startKey, 0);

    const cameFrom = new Map<string, string>();

    while (openSet.size > 0) {
      let currentKey = '';
      let currentF = Infinity;
      for (const [key, node] of openSet) {
        if (node.f < currentF) {
          currentF = node.f;
          currentKey = key;
        }
      }

      if (currentKey === goalKey) {
        return RoadGenerator.reconstructPath(cameFrom, currentKey, cells);
      }

      const current = openSet.get(currentKey)!.coord;
      openSet.delete(currentKey);

      for (const neighbor of HexGrid.neighbors(current)) {
        if (!HexGrid.inBounds(neighbor, width, height)) continue;

        const neighborKey = HexGrid.key(neighbor);
        const neighborCell = cells.get(neighborKey);
        if (!neighborCell) continue;

        const cost = TERRAIN_COST[neighborCell.terrain];
        if (!isFinite(cost)) continue;

        const tentativeG = (gScore.get(currentKey) ?? Infinity) + cost;

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + HexGrid.distance(neighbor, goal);
          openSet.set(neighborKey, { coord: neighbor, f });
        }
      }
    }

    return null;
  }

  private static reconstructPath(
    cameFrom: Map<string, string>,
    endKey: string,
    cells: Map<string, HexCell>
  ): HexCoord[] {
    const path: HexCoord[] = [];
    let current: string | undefined = endKey;
    while (current) {
      const cell = cells.get(current)!;
      path.unshift(cell.coord);
      current = cameFrom.get(current);
    }
    return path;
  }

  private static pairKey(a: HexCoord, b: HexCoord): string {
    const keyA = HexGrid.key(a);
    const keyB = HexGrid.key(b);
    return keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
  }
}
