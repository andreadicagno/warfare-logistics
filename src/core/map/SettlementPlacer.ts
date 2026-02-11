import { HexGrid } from './HexGrid';
import type { HexCell, HexCoord, SettlementParams } from './types';
import { SettlementType, TerrainType } from './types';

export class SettlementPlacer {
  static place(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    params: SettlementParams,
  ): void {
    const totalHexes = width * height;
    const cityCount = Math.min(6, Math.max(3, Math.round(totalHexes * params.cityDensity)));
    const townCount = Math.min(15, Math.max(8, Math.round(totalHexes * params.townDensity)));

    SettlementPlacer.placeCities(cells, width, height, cityCount, params);
    SettlementPlacer.placeTowns(cells, width, height, townCount, params);
  }

  private static placeCities(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    count: number,
    params: SettlementParams,
  ): void {
    const candidates: Array<{ coord: HexCoord; score: number }> = [];

    for (const cell of cells.values()) {
      if (cell.terrain !== TerrainType.Plains && cell.terrain !== TerrainType.Forest) continue;

      let score = 0;
      const neighbors = HexGrid.neighbors(cell.coord)
        .filter((n) => HexGrid.inBounds(n, width, height))
        .map((n) => cells.get(HexGrid.key(n))!)
        .filter(Boolean);

      if (neighbors.some((n) => n.terrain === TerrainType.River)) score += params.riverBonusCity;
      if (neighbors.some((n) => n.terrain === TerrainType.Water)) score += params.waterBonusCity;
      score +=
        neighbors.filter((n) => n.terrain === TerrainType.Plains).length * params.plainsBonusCity;

      candidates.push({ coord: cell.coord, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    const placed: HexCoord[] = [];
    for (const candidate of candidates) {
      if (placed.length >= count) break;
      const tooClose = placed.some(
        (c) => HexGrid.distance(c, candidate.coord) < params.minCityDistance,
      );
      if (!tooClose) {
        const cell = cells.get(HexGrid.key(candidate.coord))!;
        cell.settlement = SettlementType.City;
        placed.push(candidate.coord);
      }
    }
  }

  private static placeTowns(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    count: number,
    params: SettlementParams,
  ): void {
    const cities = [...cells.values()]
      .filter((c) => c.settlement === SettlementType.City)
      .map((c) => c.coord);

    const candidates: Array<{ coord: HexCoord; score: number }> = [];

    for (const cell of cells.values()) {
      if (cell.settlement !== null) continue;
      if (
        cell.terrain !== TerrainType.Plains &&
        cell.terrain !== TerrainType.Forest &&
        cell.terrain !== TerrainType.Hills
      )
        continue;

      let score = 0;

      for (const city of cities) {
        const dist = HexGrid.distance(cell.coord, city);
        if (dist >= 5 && dist <= 10) {
          score += 2;
          break;
        }
      }

      const townNeighbors = HexGrid.neighbors(cell.coord)
        .filter((n) => HexGrid.inBounds(n, width, height))
        .map((n) => cells.get(HexGrid.key(n))!)
        .filter(Boolean);
      if (townNeighbors.some((n) => n.terrain === TerrainType.River)) score += 1;

      candidates.push({ coord: cell.coord, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    const placed: HexCoord[] = [];
    for (const candidate of candidates) {
      if (placed.length >= count) break;

      const tooCloseToTown = placed.some(
        (t) => HexGrid.distance(t, candidate.coord) < params.minTownDistance,
      );
      if (tooCloseToTown) continue;

      const cell = cells.get(HexGrid.key(candidate.coord))!;
      cell.settlement = SettlementType.Town;
      placed.push(candidate.coord);
    }
  }
}
