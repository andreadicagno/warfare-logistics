import { HexGrid } from './HexGrid';
import type { HexCell, SmoothingParams } from './types';
import { TerrainType } from './types';

const TERRAIN_GROUP: Record<TerrainType, number> = {
  [TerrainType.Water]: 0,
  [TerrainType.River]: 1,
  [TerrainType.Marsh]: 2,
  [TerrainType.Plains]: 3,
  [TerrainType.Forest]: 4,
  [TerrainType.Hills]: 5,
  [TerrainType.Mountain]: 6,
  [TerrainType.Urban]: 3,
};

export class SmoothingPass {
  static apply(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    params: SmoothingParams,
  ): void {
    SmoothingPass.removeSingleHexAnomalies(cells, width, height, params);
    SmoothingPass.removeIsolatedWater(cells, width, height);
  }

  static removeSingleHexAnomalies(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    params: SmoothingParams,
  ): void {
    const changes: Array<{ key: string; terrain: TerrainType }> = [];

    for (const [key, cell] of cells) {
      const neighbors = HexGrid.neighbors(cell.coord)
        .filter((n) => HexGrid.inBounds(n, width, height))
        .map((n) => cells.get(HexGrid.key(n))!)
        .filter(Boolean);

      if (cell.terrain === TerrainType.River) continue;
      if (neighbors.length === 0) continue;

      const cellGroup = TERRAIN_GROUP[cell.terrain];
      const neighborGroups = neighbors.map((n) => TERRAIN_GROUP[n.terrain]);
      const avgGroup = neighborGroups.reduce((a, b) => a + b, 0) / neighborGroups.length;

      const hasSameGroupNeighbor = neighborGroups.some(
        (g) => Math.abs(g - cellGroup) <= params.groupTolerance,
      );

      if (!hasSameGroupNeighbor && Math.abs(cellGroup - avgGroup) > params.minGroupDifference) {
        const terrainCounts = new Map<TerrainType, number>();
        for (const n of neighbors) {
          terrainCounts.set(n.terrain, (terrainCounts.get(n.terrain) ?? 0) + 1);
        }
        let bestTerrain = neighbors[0].terrain;
        let bestCount = 0;
        for (const [terrain, count] of terrainCounts) {
          if (count > bestCount) {
            bestCount = count;
            bestTerrain = terrain;
          }
        }
        changes.push({ key, terrain: bestTerrain });
      }
    }

    for (const change of changes) {
      cells.get(change.key)!.terrain = change.terrain;
    }
  }

  static removeIsolatedWater(cells: Map<string, HexCell>, width: number, height: number): void {
    const changes: string[] = [];

    for (const [key, cell] of cells) {
      if (cell.terrain !== TerrainType.Water) continue;

      const neighbors = HexGrid.neighbors(cell.coord)
        .filter((n) => HexGrid.inBounds(n, width, height))
        .map((n) => cells.get(HexGrid.key(n))!)
        .filter(Boolean);

      const hasWaterNeighbor = neighbors.some((n) => n.terrain === TerrainType.Water);

      if (!hasWaterNeighbor) {
        changes.push(key);
      }
    }

    for (const key of changes) {
      cells.get(key)!.terrain = TerrainType.Marsh;
    }
  }
}
