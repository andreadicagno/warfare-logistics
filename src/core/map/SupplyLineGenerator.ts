import { Profiler } from '../Profiler';
import { HexGrid } from './HexGrid';
import type {
  HexCell,
  HexCoord,
  SupplyLine,
  SupplyLineLevel,
  SupplyLineParams,
  UrbanCluster,
} from './types';
import { SUPPLY_LINE_CAPACITY, TerrainType } from './types';

// ---------------------------------------------------------------------------
// Union-Find with path compression + union by rank
// ---------------------------------------------------------------------------

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Cached pairwise A* result
// ---------------------------------------------------------------------------

interface PairwiseRoute {
  from: number;
  to: number;
  cost: number;
  path: HexCoord[];
}

// ---------------------------------------------------------------------------
// SupplyLineGenerator — MST-based network construction
// ---------------------------------------------------------------------------

export class SupplyLineGenerator {
  static generate(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    params: SupplyLineParams,
    urbanClusters: UrbanCluster[],
  ): SupplyLine[] {
    const terrainCost = SupplyLineGenerator.buildTerrainCost(params);
    const prof = new Profiler('SupplyLineGenerator detail');

    const majorCenters = urbanClusters
      .filter((c) => c.tier === 'metropolis' || c.tier === 'city')
      .map((c) => c.center);
    const towns = urbanClusters.filter((c) => c.tier === 'town').map((c) => c.center);

    console.log(
      `  Road input: ${majorCenters.length} major centers, ${towns.length} towns → ${(majorCenters.length * (majorCenters.length - 1)) / 2} A* pairs`,
    );

    // --- Pairwise A* between all major center pairs ---
    const pairwiseRoutes = prof.measure('Pairwise A* (all major pairs)', () =>
      SupplyLineGenerator.computePairwiseRoutes(majorCenters, cells, width, height, terrainCost),
    );

    // --- Railways ---
    const railways = prof.measure('Railway construction', () =>
      SupplyLineGenerator.buildRailways(
        majorCenters,
        towns,
        pairwiseRoutes,
        params,
        cells,
        width,
        height,
        terrainCost,
      ),
    );

    // --- Roads ---
    const roads = prof.measure('Road construction', () =>
      SupplyLineGenerator.buildRoads(
        majorCenters,
        towns,
        pairwiseRoutes,
        params,
        cells,
        width,
        height,
        terrainCost,
      ),
    );

    const result = prof.measure('Merge paths into network', () => {
      const allPaths = [
        ...SupplyLineGenerator.mergePathsIntoNetwork(roads.map((r) => r.hexes)),
        ...SupplyLineGenerator.mergePathsIntoNetwork(railways.map((r) => r.hexes)),
      ];
      return allPaths.map((hexes) => ({
        hexes,
        level: 1 as SupplyLineLevel,
        state: 'active' as const,
        buildProgress: 1,
        flow: 0,
        capacity: SUPPLY_LINE_CAPACITY[0],
      }));
    });

    prof.log();

    return result;
  }

  // ---------------------------------------------------------------------------
  // Railway construction: MST trunk + redundancy + town branches
  // ---------------------------------------------------------------------------

  private static buildRailways(
    majorCenters: HexCoord[],
    towns: HexCoord[],
    pairwiseRoutes: PairwiseRoute[],
    params: SupplyLineParams,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    terrainCost: Record<TerrainType, number>,
  ): { hexes: HexCoord[] }[] {
    if (params.infrastructure === 'none' || majorCenters.length < 2) return [];

    // Step 1: MST trunk lines (Kruskal's)
    const mstEdges = SupplyLineGenerator.buildMST(pairwiseRoutes, majorCenters.length);
    const railways: { hexes: HexCoord[] }[] = [];

    for (const edge of mstEdges) {
      railways.push({ hexes: edge.path });
    }

    if (params.infrastructure === 'basic') return railways;

    // Step 2: Redundancy edges (cheapest non-MST edges)
    const mstSet = new Set(mstEdges.map((e) => `${e.from}-${e.to}`));
    const nonMstEdges = pairwiseRoutes
      .filter((r) => !mstSet.has(`${r.from}-${r.to}`))
      .sort((a, b) => a.cost - b.cost);

    const redundancyCount = Math.min(params.redundancy, nonMstEdges.length);
    for (let i = 0; i < redundancyCount; i++) {
      railways.push({ hexes: nonMstEdges[i].path });
    }

    // Step 3: Branch lines — connect each town to nearest hex on railway network
    const networkHexes = SupplyLineGenerator.collectNetworkHexes(railways);
    for (const town of towns) {
      const nearest = SupplyLineGenerator.findNearestNetworkHex(town, networkHexes);
      if (!nearest) continue;
      if (HexGrid.key(town) === HexGrid.key(nearest)) continue;

      const path = SupplyLineGenerator.astar(town, nearest, cells, width, height, terrainCost);
      if (path) {
        railways.push({ hexes: path });
        // Expand network with new branch for subsequent towns
        for (const hex of path) networkHexes.set(HexGrid.key(hex), hex);
      }
    }

    return railways;
  }

  // ---------------------------------------------------------------------------
  // Road construction: MST primary + secondary highways + town connections
  // ---------------------------------------------------------------------------

  private static buildRoads(
    majorCenters: HexCoord[],
    towns: HexCoord[],
    pairwiseRoutes: PairwiseRoute[],
    params: SupplyLineParams,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    terrainCost: Record<TerrainType, number>,
  ): { hexes: HexCoord[] }[] {
    if (majorCenters.length < 2) {
      // If fewer than 2 major centers, just connect towns to whatever exists
      return SupplyLineGenerator.connectTownsToNetwork(
        towns,
        majorCenters,
        new Map(),
        cells,
        width,
        height,
        terrainCost,
      );
    }

    const roads: { hexes: HexCoord[] }[] = [];

    // Step 1: Primary highways (MST)
    const mstEdges = SupplyLineGenerator.buildMST(pairwiseRoutes, majorCenters.length);
    const existingEdges = new Set<string>();

    for (const edge of mstEdges) {
      roads.push({ hexes: edge.path });
      SupplyLineGenerator.addPathToEdgeSet(edge.path, existingEdges);
    }

    // Step 2: Secondary highways — add direct roads where MST detour > 1.5x direct cost
    const mstSet = new Set(mstEdges.map((e) => `${e.from}-${e.to}`));

    // Build MST adjacency for shortest-path-in-MST computation
    const mstAdj = new Map<number, Map<number, number>>();
    for (const edge of mstEdges) {
      if (!mstAdj.has(edge.from)) mstAdj.set(edge.from, new Map());
      if (!mstAdj.has(edge.to)) mstAdj.set(edge.to, new Map());
      mstAdj.get(edge.from)!.set(edge.to, edge.cost);
      mstAdj.get(edge.to)!.set(edge.from, edge.cost);
    }

    for (const route of pairwiseRoutes) {
      if (mstSet.has(`${route.from}-${route.to}`)) continue;
      // Only consider pairs within connection distance
      if (
        HexGrid.distance(majorCenters[route.from], majorCenters[route.to]) >
        params.cityConnectionDistance
      )
        continue;

      const mstDist = SupplyLineGenerator.dijkstraMSTDist(
        route.from,
        route.to,
        mstAdj,
        majorCenters.length,
      );
      if (mstDist > route.cost * 1.5) {
        // Route via A* with existing edges as cheap, encouraging corridor sharing
        const path = SupplyLineGenerator.astar(
          majorCenters[route.from],
          majorCenters[route.to],
          cells,
          width,
          height,
          terrainCost,
          existingEdges,
          0.1,
        );
        if (path) {
          roads.push({ hexes: path });
          SupplyLineGenerator.addPathToEdgeSet(path, existingEdges);
        }
      }
    }

    // Step 3: Town connections
    const networkHexes = SupplyLineGenerator.collectNetworkHexes(roads);
    const townRoads = SupplyLineGenerator.connectTownsToNetwork(
      towns,
      majorCenters,
      networkHexes,
      cells,
      width,
      height,
      terrainCost,
    );
    roads.push(...townRoads);

    return roads;
  }

  // ---------------------------------------------------------------------------
  // Connect towns to existing network
  // ---------------------------------------------------------------------------

  private static connectTownsToNetwork(
    towns: HexCoord[],
    majorCenters: HexCoord[],
    networkHexes: Map<string, HexCoord>,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    terrainCost: Record<TerrainType, number>,
  ): { hexes: HexCoord[] }[] {
    const roads: { hexes: HexCoord[] }[] = [];

    // If no network yet, connect to nearest major center directly
    if (networkHexes.size === 0) {
      for (const town of towns) {
        let nearest: HexCoord | null = null;
        let bestDist = Infinity;
        for (const center of majorCenters) {
          const d = HexGrid.distance(town, center);
          if (d < bestDist) {
            bestDist = d;
            nearest = center;
          }
        }
        if (nearest) {
          const path = SupplyLineGenerator.astar(town, nearest, cells, width, height, terrainCost);
          if (path) {
            roads.push({ hexes: path });
            for (const hex of path) networkHexes.set(HexGrid.key(hex), hex);
          }
        }
      }
      return roads;
    }

    for (const town of towns) {
      const nearest = SupplyLineGenerator.findNearestNetworkHex(town, networkHexes);
      if (!nearest) continue;
      if (HexGrid.key(town) === HexGrid.key(nearest)) continue;

      const path = SupplyLineGenerator.astar(town, nearest, cells, width, height, terrainCost);
      if (path) {
        roads.push({ hexes: path });
        for (const hex of path) networkHexes.set(HexGrid.key(hex), hex);
      }
    }

    return roads;
  }

  // ---------------------------------------------------------------------------
  // MST construction (Kruskal's)
  // ---------------------------------------------------------------------------

  private static buildMST(routes: PairwiseRoute[], nodeCount: number): PairwiseRoute[] {
    const sorted = [...routes].sort((a, b) => a.cost - b.cost);
    const uf = new UnionFind(nodeCount);
    const mst: PairwiseRoute[] = [];

    for (const route of sorted) {
      if (uf.union(route.from, route.to)) {
        mst.push(route);
        if (mst.length === nodeCount - 1) break;
      }
    }

    return mst;
  }

  // ---------------------------------------------------------------------------
  // Pairwise A* between all major center pairs
  // ---------------------------------------------------------------------------

  private static readonly MAX_PAIRWISE_NEIGHBORS = 8;

  private static computePairwiseRoutes(
    centers: HexCoord[],
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    terrainCost: Record<TerrainType, number>,
  ): PairwiseRoute[] {
    const routes: PairwiseRoute[] = [];
    const k = Math.min(SupplyLineGenerator.MAX_PAIRWISE_NEIGHBORS, centers.length - 1);
    const computed = new Set<string>();

    for (let i = 0; i < centers.length; i++) {
      // Find K nearest centers by hex distance
      const nearest: Array<{ j: number; dist: number }> = [];
      for (let j = 0; j < centers.length; j++) {
        if (i === j) continue;
        nearest.push({ j, dist: HexGrid.distance(centers[i], centers[j]) });
      }
      nearest.sort((a, b) => a.dist - b.dist);

      for (let n = 0; n < k; n++) {
        const j = nearest[n].j;
        const pairKey = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (computed.has(pairKey)) continue;
        computed.add(pairKey);

        const [from, to] = i < j ? [i, j] : [j, i];
        const path = SupplyLineGenerator.astar(
          centers[from],
          centers[to],
          cells,
          width,
          height,
          terrainCost,
        );
        if (path) {
          routes.push({
            from,
            to,
            cost: SupplyLineGenerator.pathCost(path, cells, terrainCost),
            path,
          });
        }
      }
    }

    return routes;
  }

  // ---------------------------------------------------------------------------
  // Path cost calculation
  // ---------------------------------------------------------------------------

  private static pathCost(
    path: HexCoord[],
    cells: Map<string, HexCell>,
    terrainCost: Record<TerrainType, number>,
  ): number {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const cell = cells.get(HexGrid.key(path[i]));
      if (cell) total += terrainCost[cell.terrain];
    }
    return total;
  }

  // ---------------------------------------------------------------------------
  // Shortest path through MST graph (Dijkstra on abstract MST adjacency)
  // ---------------------------------------------------------------------------

  private static dijkstraMSTDist(
    from: number,
    to: number,
    adj: Map<number, Map<number, number>>,
    nodeCount: number,
  ): number {
    const dist = new Array(nodeCount).fill(Infinity);
    dist[from] = 0;
    const visited = new Set<number>();
    const heap = new MinHeap();
    heap.push(String(from), 0);

    while (heap.size > 0) {
      const key = heap.pop()!;
      const node = Number(key);
      if (node === to) return dist[to];
      if (visited.has(node)) continue;
      visited.add(node);

      const neighbors = adj.get(node);
      if (!neighbors) continue;
      for (const [neighbor, cost] of neighbors) {
        const newDist = dist[node] + cost;
        if (newDist < dist[neighbor]) {
          dist[neighbor] = newDist;
          heap.push(String(neighbor), newDist);
        }
      }
    }

    return dist[to];
  }

  // ---------------------------------------------------------------------------
  // Network hex collection and nearest-hex lookup
  // ---------------------------------------------------------------------------

  private static collectNetworkHexes(routes: { hexes: HexCoord[] }[]): Map<string, HexCoord> {
    const hexes = new Map<string, HexCoord>();
    for (const route of routes) {
      for (const hex of route.hexes) {
        hexes.set(HexGrid.key(hex), hex);
      }
    }
    return hexes;
  }

  private static findNearestNetworkHex(
    target: HexCoord,
    network: Map<string, HexCoord>,
  ): HexCoord | null {
    let best: HexCoord | null = null;
    let bestDist = Infinity;
    for (const hex of network.values()) {
      const d = HexGrid.distance(target, hex);
      if (d < bestDist) {
        bestDist = d;
        best = hex;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // A* pathfinding (simplified signature)
  // ---------------------------------------------------------------------------

  static astar(
    start: HexCoord,
    goal: HexCoord,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    terrainCost: Record<TerrainType, number>,
    existingEdges?: Set<string>,
    reuseCostMultiplier?: number,
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
        return SupplyLineGenerator.reconstructPath(cameFrom, currentKey, cells);
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

        // Prefer reusing existing edges if provided
        let cost = baseCost;
        if (existingEdges && reuseCostMultiplier !== undefined) {
          const ek = SupplyLineGenerator.edgeKey(currentKey, neighborKey);
          if (existingEdges.has(ek)) {
            cost = baseCost * reuseCostMultiplier;
          }
        }

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

  // ---------------------------------------------------------------------------
  // Merge overlapping paths into a deduplicated network
  // ---------------------------------------------------------------------------

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
    const ek = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
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
        const edgeId = ek(start, next);
        if (visitedEdges.has(edgeId)) continue;

        const polyline: HexCoord[] = [coordOf.get(start)!];
        let prev = start;
        let curr = next;

        while (true) {
          visitedEdges.add(ek(prev, curr));
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
          if (!nextNode || visitedEdges.has(ek(curr, nextNode))) break;

          prev = curr;
          curr = nextNode;
        }

        if (polyline.length >= 2) result.push(polyline);
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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

  private static addPathToEdgeSet(path: HexCoord[], edges: Set<string>): void {
    for (let i = 0; i < path.length - 1; i++) {
      edges.add(SupplyLineGenerator.edgeKey(HexGrid.key(path[i]), HexGrid.key(path[i + 1])));
    }
  }

  private static buildTerrainCost(params: SupplyLineParams): Record<TerrainType, number> {
    return {
      [TerrainType.Plains]: params.plainsCost,
      [TerrainType.Forest]: params.forestCost,
      [TerrainType.Hills]: params.hillsCost,
      [TerrainType.Marsh]: params.marshCost,
      [TerrainType.River]: params.riverCost,
      [TerrainType.Urban]: params.urbanCost,
      [TerrainType.Mountain]: Infinity,
      [TerrainType.Water]: Infinity,
    };
  }
}

// ---------------------------------------------------------------------------
// MinHeap (unchanged)
// ---------------------------------------------------------------------------

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
