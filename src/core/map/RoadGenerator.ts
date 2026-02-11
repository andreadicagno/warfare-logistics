import { HexGrid } from './HexGrid';
import type { HexCell, HexCoord, RoadParams, RoutePath, UrbanCluster } from './types';
import { TerrainType } from './types';

export class RoadGenerator {
  static generate(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    params: RoadParams,
    urbanClusters: UrbanCluster[],
  ): { roads: RoutePath[]; railways: RoutePath[] } {
    const terrainCost: Record<TerrainType, number> = {
      [TerrainType.Plains]: params.plainsCost,
      [TerrainType.Forest]: params.forestCost,
      [TerrainType.Hills]: params.hillsCost,
      [TerrainType.Marsh]: params.marshCost,
      [TerrainType.River]: params.riverCost,
      [TerrainType.Urban]: params.urbanCost,
      [TerrainType.Mountain]: Infinity,
      [TerrainType.Water]: Infinity,
    };

    const majorCenters = urbanClusters
      .filter((c) => c.tier === 'metropolis' || c.tier === 'city')
      .map((c) => c.center);
    const minorCenters = urbanClusters.filter((c) => c.tier === 'town').map((c) => c.center);

    const roads: RoutePath[] = [];
    const usedPairs = new Set<string>();
    const roadEdges = new Set<string>();

    // Connect each minor center to nearest major center
    for (const town of minorCenters) {
      let nearestCity: HexCoord | null = null;
      let nearestDist = Infinity;
      for (const city of majorCenters) {
        const dist = HexGrid.distance(town, city);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestCity = city;
        }
      }
      if (nearestCity) {
        const pairKey = RoadGenerator.pairKey(town, nearestCity);
        if (!usedPairs.has(pairKey)) {
          const path = RoadGenerator.astar(
            town,
            nearestCity,
            cells,
            width,
            height,
            terrainCost,
            roadEdges,
          );
          if (path) {
            roads.push({ hexes: path, type: 'road' });
            usedPairs.add(pairKey);
            RoadGenerator.addPathEdges(path, roadEdges);
          }
        }
      }
    }

    // Connect major centers to each other if within range
    for (let i = 0; i < majorCenters.length; i++) {
      for (let j = i + 1; j < majorCenters.length; j++) {
        if (HexGrid.distance(majorCenters[i], majorCenters[j]) <= params.cityConnectionDistance) {
          const pairKey = RoadGenerator.pairKey(majorCenters[i], majorCenters[j]);
          if (!usedPairs.has(pairKey)) {
            const path = RoadGenerator.astar(
              majorCenters[i],
              majorCenters[j],
              cells,
              width,
              height,
              terrainCost,
              roadEdges,
            );
            if (path) {
              roads.push({ hexes: path, type: 'road' });
              usedPairs.add(pairKey);
              RoadGenerator.addPathEdges(path, roadEdges);
            }
          }
        }
      }
    }

    // Railways between major centers
    const railways: RoutePath[] = [];
    if (params.infrastructure !== 'none') {
      const cityPairs: Array<{ from: HexCoord; to: HexCoord; dist: number }> = [];
      for (let i = 0; i < majorCenters.length; i++) {
        for (let j = i + 1; j < majorCenters.length; j++) {
          cityPairs.push({
            from: majorCenters[i],
            to: majorCenters[j],
            dist: HexGrid.distance(majorCenters[i], majorCenters[j]),
          });
        }
      }
      cityPairs.sort((a, b) => a.dist - b.dist);

      const railCount =
        params.infrastructure === 'basic' ? Math.min(2, cityPairs.length) : cityPairs.length;

      const railEdges = new Set<string>();
      for (let i = 0; i < railCount; i++) {
        const path = RoadGenerator.astar(
          cityPairs[i].from,
          cityPairs[i].to,
          cells,
          width,
          height,
          terrainCost,
          railEdges,
        );
        if (path) {
          railways.push({ hexes: path, type: 'railway' });
          RoadGenerator.addPathEdges(path, railEdges);
        }
      }
    }

    return {
      roads: RoadGenerator.mergePathsIntoNetwork(roads.map((r) => r.hexes)).map((hexes) => ({
        hexes,
        type: 'road' as const,
      })),
      railways: RoadGenerator.mergePathsIntoNetwork(railways.map((r) => r.hexes)).map((hexes) => ({
        hexes,
        type: 'railway' as const,
      })),
    };
  }

  /**
   * Merge overlapping paths into a deduplicated road network.
   * Collects all unique hex-to-hex edges, then traces polylines
   * splitting at junctions (degree != 2) and dead ends.
   */
  private static mergePathsIntoNetwork(paths: HexCoord[][]): HexCoord[][] {
    if (paths.length === 0) return [];

    const adj = new Map<string, Set<string>>();
    const coordOf = new Map<string, HexCoord>();

    const ensureNode = (key: string) => {
      if (!adj.has(key)) adj.set(key, new Set());
    };

    for (const path of paths) {
      for (let i = 0; i < path.length; i++) {
        const key = HexGrid.key(path[i]);
        coordOf.set(key, path[i]);
        ensureNode(key);
        if (i > 0) {
          const prevKey = HexGrid.key(path[i - 1]);
          adj.get(prevKey)!.add(key);
          adj.get(key)!.add(prevKey);
        }
      }
    }

    const visitedEdges = new Set<string>();
    const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const result: HexCoord[][] = [];

    // Start tracing from junctions (degree != 2) and dead ends
    const startNodes: string[] = [];
    for (const [node, neighbors] of adj) {
      if (neighbors.size !== 2) startNodes.push(node);
    }

    // Handle pure loops (all degree 2) — pick any node
    if (startNodes.length === 0 && adj.size > 0) {
      startNodes.push(adj.keys().next().value!);
    }

    for (const start of startNodes) {
      for (const next of adj.get(start)!) {
        const ek = edgeKey(start, next);
        if (visitedEdges.has(ek)) continue;

        const polyline: HexCoord[] = [coordOf.get(start)!];
        let prev = start;
        let curr = next;

        while (true) {
          visitedEdges.add(edgeKey(prev, curr));
          polyline.push(coordOf.get(curr)!);

          const neighbors = adj.get(curr)!;
          if (neighbors.size !== 2) break; // junction or dead end

          let nextNode: string | null = null;
          for (const n of neighbors) {
            if (n !== prev) {
              nextNode = n;
              break;
            }
          }
          if (!nextNode || visitedEdges.has(edgeKey(curr, nextNode))) break;

          prev = curr;
          curr = nextNode;
        }

        if (polyline.length >= 2) result.push(polyline);
      }
    }

    return result;
  }

  /** Cost of traversing an edge that already has a road/railway built. */
  private static readonly EXISTING_ROUTE_COST = 0.1;

  static astar(
    start: HexCoord,
    goal: HexCoord,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    terrainCost: Record<TerrainType, number>,
    existingEdges: Set<string> = new Set(),
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

        const baseCost = terrainCost[neighborCell.terrain];
        if (!Number.isFinite(baseCost)) continue;

        // Prefer reusing existing roads/railways — much cheaper than building new
        const ek = RoadGenerator.edgeKey(currentKey, neighborKey);
        const cost = existingEdges.has(ek) ? RoadGenerator.EXISTING_ROUTE_COST : baseCost;

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
    cells: Map<string, HexCell>,
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

  private static edgeKey(ka: string, kb: string): string {
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  }

  private static pairKey(a: HexCoord, b: HexCoord): string {
    return RoadGenerator.edgeKey(HexGrid.key(a), HexGrid.key(b));
  }

  private static addPathEdges(path: HexCoord[], edges: Set<string>): void {
    for (let i = 0; i < path.length - 1; i++) {
      edges.add(RoadGenerator.edgeKey(HexGrid.key(path[i]), HexGrid.key(path[i + 1])));
    }
  }
}

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
