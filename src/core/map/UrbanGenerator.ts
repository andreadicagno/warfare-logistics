import { HexGrid } from './HexGrid';
import { mulberry32 } from './rng';
import type { HexCell, HexCoord, UrbanCluster, UrbanParams, UrbanTier } from './types';
import { TerrainType } from './types';

interface TierConfig {
  tier: UrbanTier;
  minCells: number;
  maxCells: number;
  densityKey: 'metropolisDensity' | 'cityDensity' | 'townDensity';
  spacingKey: 'minMetropolisSpacing' | 'minCitySpacing' | 'minTownSpacing';
}

const TIERS: TierConfig[] = [
  {
    tier: 'metropolis',
    minCells: 8,
    maxCells: 15,
    densityKey: 'metropolisDensity',
    spacingKey: 'minMetropolisSpacing',
  },
  {
    tier: 'city',
    minCells: 4,
    maxCells: 7,
    densityKey: 'cityDensity',
    spacingKey: 'minCitySpacing',
  },
  {
    tier: 'town',
    minCells: 2,
    maxCells: 3,
    densityKey: 'townDensity',
    spacingKey: 'minTownSpacing',
  },
];

const ELIGIBLE_TERRAIN = new Set([TerrainType.Plains, TerrainType.Forest, TerrainType.Hills]);

export class UrbanGenerator {
  static generate(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    params: UrbanParams,
    seed: number,
  ): UrbanCluster[] {
    const rng = mulberry32(seed + 7919);
    const totalHexes = width * height;
    const allSeeds: HexCoord[] = [];
    const clusters: UrbanCluster[] = [];

    const scored = UrbanGenerator.scoreCells(cells, width, height, params);

    for (const tierConfig of TIERS) {
      const baseCount = params[tierConfig.densityKey];
      const count = Math.max(1, Math.round(baseCount * (totalHexes / 1200)));
      const minSpacing = params[tierConfig.spacingKey];

      const seeds = UrbanGenerator.selectSeeds(scored, allSeeds, count, minSpacing);
      allSeeds.push(...seeds);

      for (const seedCoord of seeds) {
        const targetSize =
          tierConfig.minCells + Math.floor(rng() * (tierConfig.maxCells - tierConfig.minCells + 1));
        const cluster = UrbanGenerator.growCluster(
          seedCoord,
          targetSize,
          tierConfig.tier,
          cells,
          width,
          height,
          rng,
        );
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private static scoreCells(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    params: UrbanParams,
  ): Array<{ coord: HexCoord; score: number }> {
    const candidates: Array<{ coord: HexCoord; score: number }> = [];

    for (const cell of cells.values()) {
      if (!ELIGIBLE_TERRAIN.has(cell.terrain)) continue;

      let score = 0;
      const neighbors = HexGrid.neighbors(cell.coord)
        .filter((n) => HexGrid.inBounds(n, width, height))
        .map((n) => cells.get(HexGrid.key(n))!)
        .filter(Boolean);

      if (neighbors.some((n) => n.terrain === TerrainType.River)) score += params.riverBonus;
      if (neighbors.some((n) => n.terrain === TerrainType.Water)) score += params.waterBonus;
      score +=
        neighbors.filter((n) => n.terrain === TerrainType.Plains).length * params.plainsBonus;

      candidates.push({ coord: cell.coord, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  private static selectSeeds(
    scored: Array<{ coord: HexCoord; score: number }>,
    existingSeeds: HexCoord[],
    count: number,
    minSpacing: number,
  ): HexCoord[] {
    const selected: HexCoord[] = [];

    for (const candidate of scored) {
      if (selected.length >= count) break;

      const tooCloseToExisting = existingSeeds.some(
        (s) => HexGrid.distance(s, candidate.coord) < minSpacing,
      );
      if (tooCloseToExisting) continue;

      const tooCloseToNew = selected.some((s) => HexGrid.distance(s, candidate.coord) < minSpacing);
      if (tooCloseToNew) continue;

      selected.push(candidate.coord);
    }

    return selected;
  }

  private static growCluster(
    seed: HexCoord,
    targetSize: number,
    tier: UrbanTier,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    rng: () => number,
  ): UrbanCluster {
    const id = `${tier}-${seed.q}-${seed.r}`;
    const seedCell = cells.get(HexGrid.key(seed))!;
    const seedElevation = seedCell.elevation;
    const clusterCells: HexCoord[] = [seed];
    const clusterKeys = new Set<string>([HexGrid.key(seed)]);

    seedCell.terrain = TerrainType.Urban;
    seedCell.urbanClusterId = id;

    const boundary = new Map<string, HexCoord>();
    for (const n of HexGrid.neighbors(seed)) {
      if (HexGrid.inBounds(n, width, height)) {
        const key = HexGrid.key(n);
        if (!clusterKeys.has(key)) boundary.set(key, n);
      }
    }

    while (clusterCells.length < targetSize && boundary.size > 0) {
      const eligible: Array<{ coord: HexCoord; weight: number }> = [];
      for (const [key, coord] of boundary) {
        const cell = cells.get(key);
        if (!cell) continue;
        if (!ELIGIBLE_TERRAIN.has(cell.terrain)) continue;

        const elevDiff = Math.abs(cell.elevation - seedElevation);
        const weight = elevDiff <= 0.1 ? 2 : 1;
        eligible.push({ coord, weight });
      }

      if (eligible.length === 0) break;

      const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
      let roll = rng() * totalWeight;
      let chosen = eligible[0];
      for (const e of eligible) {
        roll -= e.weight;
        if (roll <= 0) {
          chosen = e;
          break;
        }
      }

      const chosenKey = HexGrid.key(chosen.coord);
      const chosenCell = cells.get(chosenKey)!;
      chosenCell.terrain = TerrainType.Urban;
      chosenCell.urbanClusterId = id;
      clusterCells.push(chosen.coord);
      clusterKeys.add(chosenKey);
      boundary.delete(chosenKey);

      for (const n of HexGrid.neighbors(chosen.coord)) {
        if (HexGrid.inBounds(n, width, height)) {
          const nKey = HexGrid.key(n);
          if (!clusterKeys.has(nKey) && !boundary.has(nKey)) {
            boundary.set(nKey, n);
          }
        }
      }
    }

    return { id, tier, center: seed, cells: clusterCells };
  }
}
