import type { HexCell, HexCoord, MapConfig, RoutePath } from './types';
import { TerrainType, SettlementType } from './types';
import { HexGrid } from './HexGrid';

type Infrastructure = MapConfig['initialInfrastructure'];

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

  /** A* pathfinding with terrain costs (binary heap open set) */
  static astar(
    start: HexCoord,
    goal: HexCoord,
    cells: Map<string, HexCell>,
    width: number,
    height: number
  ): HexCoord[] | null {
    const startKey = HexGrid.key(start);
    const goalKey = HexGrid.key(goal);

    const heap = new MinHeap();
    heap.push(startKey, HexGrid.distance(start, goal));

    const gScore = new Map<string, number>();
    gScore.set(startKey, 0);

    const cameFrom = new Map<string, string>();
    const closed = new Set<string>();

    while (heap.size > 0) {
      const currentKey = heap.pop()!;
      if (currentKey === goalKey) {
        return RoadGenerator.reconstructPath(cameFrom, currentKey, cells);
      }

      if (closed.has(currentKey)) continue;
      closed.add(currentKey);

      const currentCell = cells.get(currentKey)!;

      for (const neighbor of HexGrid.neighbors(currentCell.coord)) {
        if (!HexGrid.inBounds(neighbor, width, height)) continue;

        const neighborKey = HexGrid.key(neighbor);
        if (closed.has(neighborKey)) continue;

        const neighborCell = cells.get(neighborKey);
        if (!neighborCell) continue;

        const cost = TERRAIN_COST[neighborCell.terrain];
        if (!isFinite(cost)) continue;

        const tentativeG = (gScore.get(currentKey) ?? Infinity) + cost;

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + HexGrid.distance(neighbor, goal);
          heap.push(neighborKey, f);
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

/** Binary min-heap keyed by f-score for A* open set */
class MinHeap {
  private data: Array<{ key: string; f: number }> = [];

  get size(): number {
    return this.data.length;
  }

  push(key: string, f: number): void {
    this.data.push({ key, f });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): string | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top.key;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f >= this.data[parent].f) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < n && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}
