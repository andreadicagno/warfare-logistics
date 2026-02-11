import { HexGrid } from './HexGrid';
import { mulberry32 } from './rng';
import type { HexCell, HexCoord } from './types';
import { TerrainType } from './types';

const MIN_RIVER_LENGTH = 3;
const MIN_SOURCES = 3;
const MAX_SOURCES = 5;
const SOURCE_MIN_ELEVATION = 0.55;
const SOURCE_MIN_SPACING = 5;
const WIDE_RIVER_MIN_LENGTH = 8;
const WIDE_RIVER_LOWER_FRACTION = 0.6;
const LAKE_MIN_SIZE = 3;
const LAKE_MAX_SIZE = 6;

export class RiverGenerator {
  /**
   * Generate cell-based rivers on the map.
   * Mutates the cells map in place, converting terrain to River/Water.
   * Returns the number of rivers created.
   */
  static generate(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    seed: number,
  ): number {
    const rng = mulberry32(seed + 1000);

    // 1. Select river sources
    const sources = RiverGenerator.selectSources(cells, width, height, rng);

    // 2. Trace rivers via greedy downhill flow
    const rivers: HexCoord[][] = [];
    const allRiverKeys = new Set<string>();

    for (const source of sources) {
      const path = RiverGenerator.traceRiver(cells, source, width, height, allRiverKeys);
      if (path.length >= MIN_RIVER_LENGTH) {
        rivers.push(path);
        for (const coord of path) {
          allRiverKeys.add(HexGrid.key(coord));
        }
      }
    }

    // 3. Apply rivers to the map
    for (const path of rivers) {
      const reachedValidTerminus = RiverGenerator.checkTerminus(
        cells,
        path,
        width,
        height,
        allRiverKeys,
      );

      // Convert path cells to River terrain
      for (const coord of path) {
        const cell = cells.get(HexGrid.key(coord));
        if (cell) {
          cell.terrain = TerrainType.River;
        }
      }

      // Widen long rivers
      if (path.length >= WIDE_RIVER_MIN_LENGTH) {
        RiverGenerator.widenRiver(cells, path, allRiverKeys);
      }

      // Generate termination lake if river didn't reach a valid terminus
      if (!reachedValidTerminus) {
        RiverGenerator.generateLake(cells, path[path.length - 1], width, height, rng);
      }
    }

    return rivers.length;
  }

  /** Select 3-5 source cells at high elevation, spaced apart */
  private static selectSources(
    cells: Map<string, HexCell>,
    _width: number,
    _height: number,
    rng: () => number,
  ): HexCoord[] {
    // Gather all candidate cells: high elevation, not Water or Marsh
    const candidates: HexCell[] = [];
    for (const cell of cells.values()) {
      if (
        cell.elevation > SOURCE_MIN_ELEVATION &&
        cell.terrain !== TerrainType.Water &&
        cell.terrain !== TerrainType.Marsh
      ) {
        candidates.push(cell);
      }
    }

    // Sort by elevation descending
    candidates.sort((a, b) => b.elevation - a.elevation);

    // Pick sources with minimum spacing
    const numSources = MIN_SOURCES + Math.floor(rng() * (MAX_SOURCES - MIN_SOURCES + 1));
    const sources: HexCoord[] = [];

    for (const candidate of candidates) {
      if (sources.length >= numSources) break;

      const tooClose = sources.some(
        (s) => HexGrid.distance(s, candidate.coord) < SOURCE_MIN_SPACING,
      );
      if (!tooClose) {
        sources.push(candidate.coord);
      }
    }

    return sources;
  }

  /** Trace a river path via greedy downhill flow */
  private static traceRiver(
    cells: Map<string, HexCell>,
    source: HexCoord,
    width: number,
    height: number,
    existingRiverKeys: Set<string>,
  ): HexCoord[] {
    const path: HexCoord[] = [source];
    const visited = new Set<string>([HexGrid.key(source)]);
    let current = source;

    for (;;) {
      const neighbors = HexGrid.neighbors(current);
      let bestNeighbor: HexCoord | null = null;
      let bestElevation = Number.POSITIVE_INFINITY;

      for (const neighbor of neighbors) {
        const key = HexGrid.key(neighbor);

        // Stop conditions: map edge
        if (!HexGrid.inBounds(neighbor, width, height)) {
          return path;
        }

        // Stop condition: existing river (confluence)
        if (existingRiverKeys.has(key)) {
          return path;
        }

        const neighborCell = cells.get(key);
        if (!neighborCell) continue;

        // Stop condition: Water cell
        if (neighborCell.terrain === TerrainType.Water) {
          return path;
        }

        // Skip visited cells
        if (visited.has(key)) continue;

        // Find lowest neighbor
        if (neighborCell.elevation < bestElevation) {
          bestElevation = neighborCell.elevation;
          bestNeighbor = neighbor;
        }
      }

      // Stuck — no unvisited non-water neighbor found
      if (!bestNeighbor) {
        return path;
      }

      visited.add(HexGrid.key(bestNeighbor));
      path.push(bestNeighbor);
      current = bestNeighbor;
    }
  }

  /** Check if the river reached a valid terminus (Water, map edge, or existing River) */
  private static checkTerminus(
    cells: Map<string, HexCell>,
    path: HexCoord[],
    width: number,
    height: number,
    allRiverKeys: Set<string>,
  ): boolean {
    const endpoint = path[path.length - 1];
    const pathKeys = new Set(path.map((p) => HexGrid.key(p)));

    for (const neighbor of HexGrid.neighbors(endpoint)) {
      // Map edge counts as valid terminus
      if (!HexGrid.inBounds(neighbor, width, height)) {
        return true;
      }

      const key = HexGrid.key(neighbor);
      const neighborCell = cells.get(key);

      // Water cell counts as valid terminus
      if (neighborCell?.terrain === TerrainType.Water) {
        return true;
      }

      // Existing river from a different river path (confluence) counts
      if (allRiverKeys.has(key) && !pathKeys.has(key)) {
        return true;
      }
    }

    return false;
  }

  /** Widen the lower 60% of a long river to 2 cells, marking them navigable */
  private static widenRiver(
    cells: Map<string, HexCell>,
    path: HexCoord[],
    allRiverKeys: Set<string>,
  ): void {
    const wideStart = Math.floor(path.length * (1 - WIDE_RIVER_LOWER_FRACTION));

    for (let i = wideStart; i < path.length; i++) {
      const coord = path[i];
      const cell = cells.get(HexGrid.key(coord));
      if (cell) {
        cell.navigable = true;
      }

      // Determine flow direction for perpendicular widening
      const prev = i > 0 ? path[i - 1] : null;
      const next = i < path.length - 1 ? path[i + 1] : null;
      const flowRef = next ?? prev;
      if (!flowRef) continue;

      const flowDir = HexGrid.edgeDirection(coord, flowRef);
      if (flowDir === null) continue;

      // Perpendicular directions: +2 and +4 from flow direction (mod 6)
      const perpDirs = [(flowDir + 2) % 6, (flowDir + 4) % 6];
      const directions = HexGrid.DIRECTIONS;

      for (const perpDir of perpDirs) {
        const lateral: HexCoord = {
          q: coord.q + directions[perpDir].q,
          r: coord.r + directions[perpDir].r,
        };
        const lateralKey = HexGrid.key(lateral);
        const lateralCell = cells.get(lateralKey);

        if (
          lateralCell &&
          lateralCell.terrain !== TerrainType.Water &&
          lateralCell.terrain !== TerrainType.Mountain &&
          lateralCell.terrain !== TerrainType.River
        ) {
          lateralCell.terrain = TerrainType.River;
          lateralCell.navigable = true;
          allRiverKeys.add(lateralKey);
          break; // Only widen by 1 cell per river cell
        }
      }
    }
  }

  /** Generate a termination lake at the endpoint of a stuck river */
  private static generateLake(
    cells: Map<string, HexCell>,
    center: HexCoord,
    width: number,
    height: number,
    rng: () => number,
  ): void {
    const lakeSize = LAKE_MIN_SIZE + Math.floor(rng() * (LAKE_MAX_SIZE - LAKE_MIN_SIZE + 1));

    // Convert center to Water
    const centerCell = cells.get(HexGrid.key(center));
    if (centerCell) {
      centerCell.terrain = TerrainType.Water;
      centerCell.navigable = undefined;
    }

    // Gather neighbors sorted by elevation (lowest first)
    const neighbors = HexGrid.neighbors(center)
      .filter((n) => HexGrid.inBounds(n, width, height))
      .map((n) => ({ coord: n, cell: cells.get(HexGrid.key(n))! }))
      .filter((n) => n.cell && n.cell.terrain !== TerrainType.Water)
      .sort((a, b) => a.cell.elevation - b.cell.elevation);

    // Convert up to (lakeSize - 1) additional cells to Water
    let converted = 1; // center already converted
    for (const neighbor of neighbors) {
      if (converted >= lakeSize) break;
      neighbor.cell.terrain = TerrainType.Water;
      neighbor.cell.navigable = undefined;
      converted++;
    }
  }
}
