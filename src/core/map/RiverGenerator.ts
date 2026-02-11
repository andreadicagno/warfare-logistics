import type { HexCell, HexCoord, RiverPath } from './types';
import { TerrainType } from './types';
import { HexGrid } from './HexGrid';

const RIVER_COUNT_MIN = 3;
const RIVER_COUNT_MAX = 5;

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RiverGenerator {
  static generate(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    seed: number,
  ): RiverPath[] {
    const rng = mulberry32(seed + 1000);
    const sources = RiverGenerator.selectSources(cells, width, height, rng);
    const rivers: RiverPath[] = [];
    const usedHexes = new Set<string>();

    for (const source of sources) {
      const river = RiverGenerator.flowDownhill(source, cells, width, height, usedHexes);
      if (river.edges.length >= 2) {
        rivers.push(river);
        for (const edge of river.edges) {
          usedHexes.add(HexGrid.key(edge.hex));
        }
      }
    }

    return rivers;
  }

  private static selectSources(
    cells: Map<string, HexCell>,
    _width: number,
    _height: number,
    rng: () => number,
  ): HexCoord[] {
    const count = RIVER_COUNT_MIN + Math.floor(rng() * (RIVER_COUNT_MAX - RIVER_COUNT_MIN + 1));

    const candidates = [...cells.values()]
      .filter(
        (c) =>
          c.elevation > 0.55 &&
          c.terrain !== TerrainType.Water &&
          c.terrain !== TerrainType.Marsh,
      )
      .sort((a, b) => b.elevation - a.elevation);

    const sources: HexCoord[] = [];
    for (const candidate of candidates) {
      if (sources.length >= count) break;
      const tooClose = sources.some((s) => HexGrid.distance(s, candidate.coord) < 5);
      if (!tooClose) {
        sources.push(candidate.coord);
      }
    }

    return sources;
  }

  private static flowDownhill(
    source: HexCoord,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    usedHexes: Set<string>,
  ): RiverPath {
    const edges: RiverPath['edges'] = [];
    let current = source;
    const visited = new Set<string>();
    visited.add(HexGrid.key(current));

    const MAX_LENGTH = 100;

    for (let step = 0; step < MAX_LENGTH; step++) {
      const currentCell = cells.get(HexGrid.key(current))!;
      const neighbors = HexGrid.neighbors(current);

      let bestNeighbor: HexCoord | null = null;
      let bestElevation = currentCell.elevation;
      let bestDirection = -1;

      for (let dir = 0; dir < 6; dir++) {
        const neighbor = neighbors[dir];
        const key = HexGrid.key(neighbor);
        if (visited.has(key)) continue;

        if (!HexGrid.inBounds(neighbor, width, height)) {
          edges.push({ hex: current, edge: dir });
          currentCell.riverEdges.add(dir);
          return { edges };
        }

        const neighborCell = cells.get(key)!;

        if (neighborCell.terrain === TerrainType.Water) {
          edges.push({ hex: current, edge: dir });
          currentCell.riverEdges.add(dir);
          neighborCell.riverEdges.add(HexGrid.oppositeEdge(dir));
          return { edges };
        }

        if (neighborCell.elevation < bestElevation && !usedHexes.has(key)) {
          bestElevation = neighborCell.elevation;
          bestNeighbor = neighbor;
          bestDirection = dir;
        }
      }

      if (bestNeighbor === null || bestDirection === -1) break;

      edges.push({ hex: current, edge: bestDirection });
      currentCell.riverEdges.add(bestDirection);
      const nextCell = cells.get(HexGrid.key(bestNeighbor))!;
      nextCell.riverEdges.add(HexGrid.oppositeEdge(bestDirection));

      visited.add(HexGrid.key(bestNeighbor));
      current = bestNeighbor;
    }

    return { edges };
  }
}
