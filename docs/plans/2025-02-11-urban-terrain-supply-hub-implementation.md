# Urban Terrain & Supply Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the point-based settlement system with multi-hex urban terrain clusters and a separate supply hub layer.

**Architecture:** Urban areas become a terrain type (`Urban`) rendered as clusters of hexes with a street-grid pattern, generated via seed selection + flood-fill growth. Supply hubs are logistical markers (circles) placed at urban centers and strategic rural positions. Roads/railways target urban cluster centers instead of individual settlement cells.

**Tech Stack:** TypeScript, PixiJS v8, Vitest, Biome v2, seeded RNG (mulberry32)

---

## Task 1: Add Urban terrain type and new data types to `types.ts`

**Files:**
- Modify: `src/core/map/types.ts`

**Step 1: Add `Urban` to `TerrainType` enum**

In `src/core/map/types.ts`, add `Urban` after `Mountain`:

```typescript
export enum TerrainType {
  Water = 'water',
  River = 'river',
  Plains = 'plains',
  Marsh = 'marsh',
  Forest = 'forest',
  Hills = 'hills',
  Mountain = 'mountain',
  Urban = 'urban',
}
```

**Step 2: Replace `SettlementType` with `UrbanCluster` and `SupplyHub` types**

Remove:
```typescript
export enum SettlementType {
  Town = 'town',
  City = 'city',
}
```

Add after `HexCoord`:
```typescript
export type UrbanTier = 'metropolis' | 'city' | 'town';

export interface UrbanCluster {
  id: string;
  tier: UrbanTier;
  center: HexCoord;
  cells: HexCoord[];
}

export interface SupplyHub {
  coord: HexCoord;
  size: 'large' | 'small';
}
```

**Step 3: Update `HexCell` — replace `settlement` with `urbanClusterId`**

Change `HexCell` from:
```typescript
export interface HexCell {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
  moisture: number;
  navigable?: boolean;
  settlement: SettlementType | null;
}
```
To:
```typescript
export interface HexCell {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
  moisture: number;
  navigable?: boolean;
  urbanClusterId: string | null;
}
```

**Step 4: Update `GameMap` — add `urbanClusters` and `supplyHubs`**

Change `GameMap` from:
```typescript
export interface GameMap {
  width: number;
  height: number;
  cells: Map<string, HexCell>;
  roads: RoutePath[];
  railways: RoutePath[];
}
```
To:
```typescript
export interface GameMap {
  width: number;
  height: number;
  cells: Map<string, HexCell>;
  urbanClusters: UrbanCluster[];
  supplyHubs: SupplyHub[];
  roads: RoutePath[];
  railways: RoutePath[];
}
```

**Step 5: Replace `SettlementParams` with `UrbanParams`**

Remove:
```typescript
export interface SettlementParams {
  cityDensity: number;
  townDensity: number;
  minCityDistance: number;
  minTownDistance: number;
  riverBonusCity: number;
  waterBonusCity: number;
  plainsBonusCity: number;
}
```

Add:
```typescript
export interface UrbanParams {
  metropolisDensity: number;
  cityDensity: number;
  townDensity: number;
  minMetropolisSpacing: number;
  minCitySpacing: number;
  minTownSpacing: number;
  riverBonus: number;
  waterBonus: number;
  plainsBonus: number;
}
```

**Step 6: Update `GenerationParams` — replace `settlements` with `urban`**

Change:
```typescript
export interface GenerationParams {
  // ...existing fields...
  settlements: SettlementParams;
  roads: RoadParams;
}
```
To:
```typescript
export interface GenerationParams {
  // ...existing fields...
  urban: UrbanParams;
  roads: RoadParams;
}
```

**Step 7: Add `urbanCost` to `RoadParams`**

Add one field to `RoadParams`:
```typescript
export interface RoadParams {
  infrastructure: 'none' | 'basic' | 'developed';
  plainsCost: number;
  forestCost: number;
  hillsCost: number;
  marshCost: number;
  riverCost: number;
  urbanCost: number;
  cityConnectionDistance: number;
}
```

**Step 8: Update `DEFAULT_GENERATION_PARAMS`**

Replace the `settlements` block with `urban`:
```typescript
  urban: {
    metropolisDensity: 2,
    cityDensity: 5,
    townDensity: 8,
    minMetropolisSpacing: 10,
    minCitySpacing: 6,
    minTownSpacing: 4,
    riverBonus: 3,
    waterBonus: 2,
    plainsBonus: 1,
  },
```

Add `urbanCost: 1` to the `roads` block:
```typescript
  roads: {
    infrastructure: 'none',
    plainsCost: 1,
    forestCost: 2,
    hillsCost: 3,
    marshCost: 3,
    riverCost: 6,
    urbanCost: 1,
    cityConnectionDistance: 20,
  },
```

**Step 9: Run typecheck to confirm types compile (expect errors from consumers — that's fine for now)**

Run: `bunx tsc --noEmit 2>&1 | head -40`
Expected: Errors in SettlementPlacer, RoadGenerator, Sidebar, etc. (they still reference old types). No errors in types.ts itself.

**Step 10: Commit**

```bash
git add src/core/map/types.ts
git commit -m "feat: replace SettlementType with Urban terrain, UrbanCluster, and SupplyHub types"
```

---

## Task 2: Create `UrbanGenerator` with tests

**Files:**
- Create: `src/core/map/UrbanGenerator.ts`
- Create: `src/core/map/__tests__/UrbanGenerator.test.ts`

**Step 1: Write the failing tests**

Create `src/core/map/__tests__/UrbanGenerator.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { SmoothingPass } from '../SmoothingPass';
import { TerrainGenerator } from '../TerrainGenerator';
import { UrbanGenerator } from '../UrbanGenerator';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';
import type { UrbanCluster } from '../types';

function makeMap() {
  const cells = TerrainGenerator.generate(
    40,
    30,
    DEFAULT_GENERATION_PARAMS.terrain,
    DEFAULT_GENERATION_PARAMS.seaSides,
    42,
  );
  RiverGenerator.generate(cells, 40, 30, 42, DEFAULT_GENERATION_PARAMS.rivers);
  SmoothingPass.apply(cells, 40, 30, DEFAULT_GENERATION_PARAMS.smoothing);
  return cells;
}

describe('UrbanGenerator', () => {
  it('returns urban clusters', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    expect(clusters.length).toBeGreaterThan(0);
  });

  it('places at least one metropolis', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const metros = clusters.filter((c) => c.tier === 'metropolis');
    expect(metros.length).toBeGreaterThanOrEqual(1);
  });

  it('places cities and towns', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const cities = clusters.filter((c) => c.tier === 'city');
    const towns = clusters.filter((c) => c.tier === 'town');
    expect(cities.length).toBeGreaterThan(0);
    expect(towns.length).toBeGreaterThan(0);
  });

  it('sets Urban terrain on cluster cells', () => {
    const cells = makeMap();
    UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const urbanCells = [...cells.values()].filter((c) => c.terrain === TerrainType.Urban);
    expect(urbanCells.length).toBeGreaterThan(0);
  });

  it('sets urbanClusterId on cluster cells', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    for (const cluster of clusters) {
      for (const coord of cluster.cells) {
        const cell = cells.get(HexGrid.key(coord))!;
        expect(cell.urbanClusterId).toBe(cluster.id);
      }
    }
  });

  it('metropolis clusters have 8-15 cells', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    for (const cluster of clusters.filter((c) => c.tier === 'metropolis')) {
      expect(cluster.cells.length).toBeGreaterThanOrEqual(2);
      expect(cluster.cells.length).toBeLessThanOrEqual(15);
    }
  });

  it('city clusters have 4-7 cells', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    for (const cluster of clusters.filter((c) => c.tier === 'city')) {
      expect(cluster.cells.length).toBeGreaterThanOrEqual(2);
      expect(cluster.cells.length).toBeLessThanOrEqual(7);
    }
  });

  it('town clusters have 2-3 cells', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    for (const cluster of clusters.filter((c) => c.tier === 'town')) {
      expect(cluster.cells.length).toBeGreaterThanOrEqual(2);
      expect(cluster.cells.length).toBeLessThanOrEqual(3);
    }
  });

  it('metropolis seeds respect minimum spacing', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const metros = clusters.filter((c) => c.tier === 'metropolis');
    for (let i = 0; i < metros.length; i++) {
      for (let j = i + 1; j < metros.length; j++) {
        expect(HexGrid.distance(metros[i].center, metros[j].center)).toBeGreaterThanOrEqual(
          DEFAULT_GENERATION_PARAMS.urban.minMetropolisSpacing,
        );
      }
    }
  });

  it('urban cells are never on Water, River, or Mountain', () => {
    const cells = makeMap();
    UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const urbanCells = [...cells.values()].filter((c) => c.terrain === TerrainType.Urban);
    // They should all be Urban terrain now, but let's also check no cell that was originally
    // Water/River/Mountain got converted (implicitly tested by checking terrain === Urban)
    expect(urbanCells.length).toBeGreaterThan(0);
    for (const cell of urbanCells) {
      expect(cell.terrain).toBe(TerrainType.Urban);
    }
  });

  it('is deterministic with same seed', () => {
    const cells1 = makeMap();
    const clusters1 = UrbanGenerator.generate(cells1, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const cells2 = makeMap();
    const clusters2 = UrbanGenerator.generate(cells2, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    expect(clusters1.length).toBe(clusters2.length);
    for (let i = 0; i < clusters1.length; i++) {
      expect(clusters1[i].center).toEqual(clusters2[i].center);
      expect(clusters1[i].cells.length).toBe(clusters2[i].cells.length);
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/core/map/__tests__/UrbanGenerator.test.ts`
Expected: FAIL — cannot resolve `../UrbanGenerator`

**Step 3: Implement `UrbanGenerator`**

Create `src/core/map/UrbanGenerator.ts`:

```typescript
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

    // Score all eligible cells once
    const scored = UrbanGenerator.scoreCells(cells, width, height, params);

    // Phase 1: Seed selection — tier by tier (metropolis first, then city, then town)
    for (const tierConfig of TIERS) {
      const baseCount = params[tierConfig.densityKey];
      const count = Math.max(1, Math.round(baseCount * (totalHexes / 1200)));
      const minSpacing = params[tierConfig.spacingKey];

      const seeds = UrbanGenerator.selectSeeds(scored, allSeeds, count, minSpacing);
      allSeeds.push(...seeds);

      // Phase 2: Cluster growth from each seed
      for (const seedCoord of seeds) {
        const targetSize =
          tierConfig.minCells +
          Math.floor(rng() * (tierConfig.maxCells - tierConfig.minCells + 1));
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
      score += neighbors.filter((n) => n.terrain === TerrainType.Plains).length * params.plainsBonus;

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

      const tooCloseToNew = selected.some(
        (s) => HexGrid.distance(s, candidate.coord) < minSpacing,
      );
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

    // Mark seed cell as urban
    seedCell.terrain = TerrainType.Urban;
    seedCell.urbanClusterId = id;

    // Build boundary set — neighbors of current cluster that could be added
    const boundary = new Map<string, HexCoord>();
    for (const n of HexGrid.neighbors(seed)) {
      if (HexGrid.inBounds(n, width, height)) {
        const key = HexGrid.key(n);
        if (!clusterKeys.has(key)) boundary.set(key, n);
      }
    }

    while (clusterCells.length < targetSize && boundary.size > 0) {
      // Collect eligible boundary cells
      const eligible: Array<{ coord: HexCoord; weight: number }> = [];
      for (const [key, coord] of boundary) {
        const cell = cells.get(key);
        if (!cell) continue;
        if (!ELIGIBLE_TERRAIN.has(cell.terrain)) continue;

        // Prefer similar elevation to seed
        const elevDiff = Math.abs(cell.elevation - seedElevation);
        const weight = elevDiff <= 0.1 ? 2 : 1;
        eligible.push({ coord, weight });
      }

      if (eligible.length === 0) break;

      // Weighted random selection
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

      // Add new neighbors to boundary
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
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/core/map/__tests__/UrbanGenerator.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/map/UrbanGenerator.ts src/core/map/__tests__/UrbanGenerator.test.ts
git commit -m "feat: add UrbanGenerator with seed selection and flood-fill cluster growth"
```

---

## Task 3: Create `SupplyHubPlacer` with tests

**Files:**
- Create: `src/core/map/SupplyHubPlacer.ts`
- Create: `src/core/map/__tests__/SupplyHubPlacer.test.ts`

**Step 1: Write the failing tests**

Create `src/core/map/__tests__/SupplyHubPlacer.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { SmoothingPass } from '../SmoothingPass';
import { SupplyHubPlacer } from '../SupplyHubPlacer';
import { TerrainGenerator } from '../TerrainGenerator';
import { UrbanGenerator } from '../UrbanGenerator';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';

function makeMapWithClusters() {
  const cells = TerrainGenerator.generate(
    40,
    30,
    DEFAULT_GENERATION_PARAMS.terrain,
    DEFAULT_GENERATION_PARAMS.seaSides,
    42,
  );
  RiverGenerator.generate(cells, 40, 30, 42, DEFAULT_GENERATION_PARAMS.rivers);
  SmoothingPass.apply(cells, 40, 30, DEFAULT_GENERATION_PARAMS.smoothing);
  const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
  return { cells, clusters };
}

describe('SupplyHubPlacer', () => {
  it('returns supply hubs', () => {
    const { cells, clusters } = makeMapWithClusters();
    const hubs = SupplyHubPlacer.place(cells, 40, 30, clusters, 42);
    expect(hubs.length).toBeGreaterThan(0);
  });

  it('places large hubs at metropolis centers', () => {
    const { cells, clusters } = makeMapWithClusters();
    const hubs = SupplyHubPlacer.place(cells, 40, 30, clusters, 42);
    const metros = clusters.filter((c) => c.tier === 'metropolis');
    for (const metro of metros) {
      const hub = hubs.find(
        (h) => h.coord.q === metro.center.q && h.coord.r === metro.center.r,
      );
      expect(hub).toBeDefined();
      expect(hub!.size).toBe('large');
    }
  });

  it('hubs are not on Water or Mountain', () => {
    const { cells, clusters } = makeMapWithClusters();
    const hubs = SupplyHubPlacer.place(cells, 40, 30, clusters, 42);
    for (const hub of hubs) {
      const cell = cells.get(HexGrid.key(hub.coord))!;
      expect(cell.terrain).not.toBe(TerrainType.Water);
      expect(cell.terrain).not.toBe(TerrainType.Mountain);
    }
  });

  it('has both large and small hubs', () => {
    const { cells, clusters } = makeMapWithClusters();
    const hubs = SupplyHubPlacer.place(cells, 40, 30, clusters, 42);
    expect(hubs.some((h) => h.size === 'large')).toBe(true);
    expect(hubs.some((h) => h.size === 'small')).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/core/map/__tests__/SupplyHubPlacer.test.ts`
Expected: FAIL — cannot resolve `../SupplyHubPlacer`

**Step 3: Implement `SupplyHubPlacer`**

Create `src/core/map/SupplyHubPlacer.ts`:

```typescript
import { HexGrid } from './HexGrid';
import { mulberry32 } from './rng';
import type { HexCell, HexCoord, SupplyHub, UrbanCluster } from './types';
import { TerrainType } from './types';

export class SupplyHubPlacer {
  static place(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    clusters: UrbanCluster[],
    seed: number,
  ): SupplyHub[] {
    const rng = mulberry32(seed + 6271);
    const hubs: SupplyHub[] = [];
    const usedKeys = new Set<string>();

    // 1 large hub per metropolis (at center)
    for (const cluster of clusters.filter((c) => c.tier === 'metropolis')) {
      const key = HexGrid.key(cluster.center);
      if (!usedKeys.has(key)) {
        hubs.push({ coord: cluster.center, size: 'large' });
        usedKeys.add(key);
      }
    }

    // 1 large hub per 2 cities (at center of selected cities)
    const cities = clusters.filter((c) => c.tier === 'city');
    const cityHubCount = Math.max(1, Math.floor(cities.length / 2));
    for (let i = 0; i < cityHubCount && i < cities.length; i++) {
      const key = HexGrid.key(cities[i].center);
      if (!usedKeys.has(key)) {
        hubs.push({ coord: cities[i].center, size: 'large' });
        usedKeys.add(key);
      }
    }

    // 2-4 small hubs in strategic rural positions
    const smallCount = 2 + Math.floor(rng() * 3);
    const ruralCandidates = SupplyHubPlacer.findRuralPositions(
      cells,
      width,
      height,
      usedKeys,
      clusters,
    );

    for (let i = 0; i < smallCount && i < ruralCandidates.length; i++) {
      const coord = ruralCandidates[i];
      const key = HexGrid.key(coord);
      if (!usedKeys.has(key)) {
        hubs.push({ coord, size: 'small' });
        usedKeys.add(key);
      }
    }

    return hubs;
  }

  private static findRuralPositions(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    usedKeys: Set<string>,
    clusters: UrbanCluster[],
  ): HexCoord[] {
    const forbidden = new Set([TerrainType.Water, TerrainType.Mountain, TerrainType.River]);
    const clusterCenters = clusters.map((c) => c.center);
    const candidates: Array<{ coord: HexCoord; score: number }> = [];

    for (const cell of cells.values()) {
      if (forbidden.has(cell.terrain)) continue;
      if (cell.terrain === TerrainType.Urban) continue;
      const key = HexGrid.key(cell.coord);
      if (usedKeys.has(key)) continue;

      // Score: prefer cells roughly midway between clusters and near map edges
      let score = 0;

      // Edge proximity bonus
      const col = cell.coord.q;
      const row = cell.coord.r + Math.floor(cell.coord.q / 2);
      const edgeDist = Math.min(col, width - 1 - col, row, height - 1 - row);
      if (edgeDist < 5) score += 3;

      // Midway between clusters bonus
      if (clusterCenters.length >= 2) {
        let minDist = Infinity;
        for (const center of clusterCenters) {
          const d = HexGrid.distance(cell.coord, center);
          if (d < minDist) minDist = d;
        }
        if (minDist >= 5 && minDist <= 15) score += 2;
      }

      // Road intersection hint: prefer plains with many passable neighbors
      const neighbors = HexGrid.neighbors(cell.coord)
        .filter((n) => HexGrid.inBounds(n, width, height))
        .map((n) => cells.get(HexGrid.key(n))!)
        .filter(Boolean);
      const passable = neighbors.filter((n) => !forbidden.has(n.terrain));
      if (passable.length >= 5) score += 1;

      candidates.push({ coord: cell.coord, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    // Space them out: at least 8 hexes apart
    const selected: HexCoord[] = [];
    for (const c of candidates) {
      if (selected.some((s) => HexGrid.distance(s, c.coord) < 8)) continue;
      selected.push(c.coord);
      if (selected.length >= 10) break;
    }

    return selected;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/core/map/__tests__/SupplyHubPlacer.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/map/SupplyHubPlacer.ts src/core/map/__tests__/SupplyHubPlacer.test.ts
git commit -m "feat: add SupplyHubPlacer for automatic hub placement at urban centers and rural positions"
```

---

## Task 4: Update `MapGenerator` pipeline

**Files:**
- Modify: `src/core/map/MapGenerator.ts`

**Step 1: Replace SettlementPlacer with UrbanGenerator + SupplyHubPlacer**

Replace the full file content with:

```typescript
import { RiverGenerator } from './RiverGenerator';
import { RoadGenerator } from './RoadGenerator';
import { SmoothingPass } from './SmoothingPass';
import { SupplyHubPlacer } from './SupplyHubPlacer';
import { TerrainGenerator } from './TerrainGenerator';
import { UrbanGenerator } from './UrbanGenerator';
import type { GameMap, GenerationParams } from './types';

export const MAP_SIZE_PRESETS = {
  small: { width: 200, height: 150 },
  medium: { width: 300, height: 225 },
  large: { width: 400, height: 300 },
} as const;

export class MapGenerator {
  static generate(params: GenerationParams): GameMap {
    const { width, height } = params;

    // Phase 1 & 2: Elevation + terrain assignment
    const cells = TerrainGenerator.generate(
      width,
      height,
      params.terrain,
      params.seaSides,
      params.seed,
    );

    // Phase 3: Rivers
    RiverGenerator.generate(cells, width, height, params.seed, params.rivers);

    // Phase 4: Smoothing
    SmoothingPass.apply(cells, width, height, params.smoothing);

    // Phase 5: Urban clusters
    const urbanClusters = UrbanGenerator.generate(cells, width, height, params.urban, params.seed);

    // Phase 6: Supply hubs
    const supplyHubs = SupplyHubPlacer.place(cells, width, height, urbanClusters, params.seed);

    // Phase 7: Roads & railways
    const { roads, railways } = RoadGenerator.generate(
      cells,
      width,
      height,
      params.roads,
      urbanClusters,
    );

    return { width, height, cells, urbanClusters, supplyHubs, roads, railways };
  }
}
```

**Step 2: Run typecheck (RoadGenerator will error — that's expected)**

Run: `bunx tsc --noEmit 2>&1 | grep -c "error"`
Expected: Some errors remain from RoadGenerator, Sidebar, UI layers. MapGenerator itself should be clean once RoadGenerator is updated.

**Step 3: Commit**

```bash
git add src/core/map/MapGenerator.ts
git commit -m "feat: update MapGenerator pipeline — UrbanGenerator + SupplyHubPlacer replace SettlementPlacer"
```

---

## Task 5: Update `RoadGenerator` to target urban cluster centers

**Files:**
- Modify: `src/core/map/RoadGenerator.ts`

**Step 1: Update `generate` signature and body**

The method now receives `UrbanCluster[]` instead of reading settlements from cells. Add `Urban` to the terrain cost map.

Replace the `generate` method signature and the city/town extraction logic:

```typescript
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

    // Derive cities and towns from urban clusters
    const majorCenters = urbanClusters
      .filter((c) => c.tier === 'metropolis' || c.tier === 'city')
      .map((c) => c.center);
    const minorCenters = urbanClusters
      .filter((c) => c.tier === 'town')
      .map((c) => c.center);

    const roads: RoutePath[] = [];
    const usedPairs = new Set<string>();

    // Connect each minor center (town) to its nearest major center (city/metropolis)
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
          const path = RoadGenerator.astar(town, nearestCity, cells, width, height, terrainCost);
          if (path) {
            roads.push({ hexes: path, type: 'road' });
            usedPairs.add(pairKey);
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
            );
            if (path) {
              roads.push({ hexes: path, type: 'road' });
              usedPairs.add(pairKey);
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

      for (let i = 0; i < railCount; i++) {
        const path = RoadGenerator.astar(
          cityPairs[i].from,
          cityPairs[i].to,
          cells,
          width,
          height,
          terrainCost,
        );
        if (path) {
          railways.push({ hexes: path, type: 'railway' });
        }
      }
    }

    return { roads, railways };
  }

  // ... astar, reconstructPath, pairKey methods stay unchanged ...
```

**Step 2: Run the existing RoadGenerator tests (they will need updating)**

Run: `bunx vitest run src/core/map/__tests__/RoadGenerator.test.ts`
Expected: FAIL — test `makeMap()` still calls `SettlementPlacer.place()` and RoadGenerator.generate now requires `urbanClusters` param.

**Step 3: Update `RoadGenerator.test.ts`**

Replace the import and `makeMap` function and update `generate` calls to pass clusters:

```typescript
import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { RoadGenerator } from '../RoadGenerator';
import { SmoothingPass } from '../SmoothingPass';
import { TerrainGenerator } from '../TerrainGenerator';
import { UrbanGenerator } from '../UrbanGenerator';
import type { HexCell, RoadParams, UrbanCluster } from '../types';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';

const defaultRoadParams = DEFAULT_GENERATION_PARAMS.roads;

function roadParamsWithInfra(infrastructure: RoadParams['infrastructure']): RoadParams {
  return { ...defaultRoadParams, infrastructure };
}

const defaultTerrainCost: Record<TerrainType, number> = {
  [TerrainType.Plains]: defaultRoadParams.plainsCost,
  [TerrainType.Forest]: defaultRoadParams.forestCost,
  [TerrainType.Hills]: defaultRoadParams.hillsCost,
  [TerrainType.Marsh]: defaultRoadParams.marshCost,
  [TerrainType.River]: defaultRoadParams.riverCost,
  [TerrainType.Urban]: defaultRoadParams.urbanCost,
  [TerrainType.Mountain]: Infinity,
  [TerrainType.Water]: Infinity,
};

function makeMap(): { cells: Map<string, HexCell>; clusters: UrbanCluster[] } {
  const cells = TerrainGenerator.generate(
    40,
    30,
    DEFAULT_GENERATION_PARAMS.terrain,
    DEFAULT_GENERATION_PARAMS.seaSides,
    42,
  );
  RiverGenerator.generate(cells, 40, 30, 42, DEFAULT_GENERATION_PARAMS.rivers);
  SmoothingPass.apply(cells, 40, 30, DEFAULT_GENERATION_PARAMS.smoothing);
  const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
  return { cells, clusters };
}

describe('RoadGenerator', () => {
  describe('generate', () => {
    it('produces road routes', () => {
      const { cells, clusters } = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'), clusters);
      expect(roads.length).toBeGreaterThan(0);
    });

    it('all roads have type road', () => {
      const { cells, clusters } = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'), clusters);
      for (const road of roads) {
        expect(road.type).toBe('road');
      }
    });

    it('road paths contain only adjacent hexes', () => {
      const { cells, clusters } = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'), clusters);
      for (const road of roads) {
        for (let i = 1; i < road.hexes.length; i++) {
          expect(HexGrid.distance(road.hexes[i - 1], road.hexes[i])).toBe(1);
        }
      }
    });

    it('roads avoid mountains and water', () => {
      const { cells, clusters } = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'), clusters);
      for (const road of roads) {
        for (const hex of road.hexes) {
          const cell = cells.get(HexGrid.key(hex))!;
          expect(cell.terrain).not.toBe(TerrainType.Mountain);
          expect(cell.terrain).not.toBe(TerrainType.Water);
        }
      }
    });

    it('produces no railways with infrastructure=none', () => {
      const { cells, clusters } = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('none'), clusters);
      expect(railways.length).toBe(0);
    });

    it('produces some railways with infrastructure=basic', () => {
      const { cells, clusters } = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'), clusters);
      expect(railways.length).toBeGreaterThanOrEqual(1);
      expect(railways.length).toBeLessThanOrEqual(2);
    });

    it('produces railways between major centers with infrastructure=developed', () => {
      const { cells, clusters } = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('developed'), clusters);
      expect(railways.length).toBeGreaterThanOrEqual(2);
    });

    it('all railways have type railway', () => {
      const { cells, clusters } = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('developed'), clusters);
      for (const rail of railways) {
        expect(rail.type).toBe('railway');
      }
    });
  });

  describe('astar', () => {
    it('finds path between two hexes on plains', () => {
      const cells = new Map<string, HexCell>();
      for (let q = 0; q < 3; q++) {
        for (let r = 0; r < 3; r++) {
          const coord = { q, r };
          cells.set(HexGrid.key(coord), {
            coord,
            terrain: TerrainType.Plains,
            elevation: 0.4,
            moisture: 0.3,
            urbanClusterId: null,
          });
        }
      }
      const path = RoadGenerator.astar(
        { q: 0, r: 0 },
        { q: 2, r: 0 },
        cells,
        3,
        3,
        defaultTerrainCost,
      );
      expect(path).not.toBeNull();
      expect(path![0]).toEqual({ q: 0, r: 0 });
      expect(path![path!.length - 1]).toEqual({ q: 2, r: 0 });
    });

    it('returns null if no path exists (surrounded by mountains)', () => {
      const cells = new Map<string, HexCell>();
      cells.set('2,2', {
        coord: { q: 2, r: 2 },
        terrain: TerrainType.Plains,
        elevation: 0.4,
        moisture: 0.3,
        urbanClusterId: null,
      });
      cells.set('0,0', {
        coord: { q: 0, r: 0 },
        terrain: TerrainType.Plains,
        elevation: 0.4,
        moisture: 0.3,
        urbanClusterId: null,
      });
      for (const n of HexGrid.neighbors({ q: 2, r: 2 })) {
        cells.set(HexGrid.key(n), {
          coord: n,
          terrain: TerrainType.Mountain,
          elevation: 0.9,
          moisture: 0.3,
          urbanClusterId: null,
        });
      }
      const path = RoadGenerator.astar(
        { q: 0, r: 0 },
        { q: 2, r: 2 },
        cells,
        5,
        5,
        defaultTerrainCost,
      );
      expect(path).toBeNull();
    });
  });
});
```

**Step 4: Run updated tests**

Run: `bunx vitest run src/core/map/__tests__/RoadGenerator.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/map/RoadGenerator.ts src/core/map/__tests__/RoadGenerator.test.ts
git commit -m "feat: RoadGenerator targets urban cluster centers instead of settlements"
```

---

## Task 6: Update `MapGenerator.test.ts`

**Files:**
- Modify: `src/core/map/__tests__/MapGenerator.test.ts`

**Step 1: Update tests to use new types**

Replace the full test file:

```typescript
import { describe, expect, it } from 'vitest';
import { MAP_SIZE_PRESETS, MapGenerator } from '../MapGenerator';
import type { GenerationParams } from '../types';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';

describe('MapGenerator', () => {
  const params: GenerationParams = {
    ...DEFAULT_GENERATION_PARAMS,
    width: 40,
    height: 30,
    seed: 42,
    roads: { ...DEFAULT_GENERATION_PARAMS.roads, infrastructure: 'basic' },
  };

  describe('MAP_SIZE_PRESETS', () => {
    it('defines small as 200x150', () => {
      expect(MAP_SIZE_PRESETS.small).toEqual({ width: 200, height: 150 });
    });

    it('defines medium as 300x225', () => {
      expect(MAP_SIZE_PRESETS.medium).toEqual({ width: 300, height: 225 });
    });

    it('defines large as 400x300', () => {
      expect(MAP_SIZE_PRESETS.large).toEqual({ width: 400, height: 300 });
    });
  });

  describe('generate', () => {
    it('returns a GameMap with specified dimensions', () => {
      const map = MapGenerator.generate(params);
      expect(map.width).toBe(40);
      expect(map.height).toBe(30);
    });

    it('populates cells map with correct count', () => {
      const map = MapGenerator.generate(params);
      expect(map.cells.size).toBe(40 * 30);
    });

    it('produces River terrain cells', () => {
      const map = MapGenerator.generate(params);
      const riverCells = [...map.cells.values()].filter((c) => c.terrain === TerrainType.River);
      expect(riverCells.length).toBeGreaterThan(0);
    });

    it('produces roads', () => {
      const map = MapGenerator.generate(params);
      expect(map.roads.length).toBeGreaterThan(0);
    });

    it('produces railways with basic infrastructure', () => {
      const map = MapGenerator.generate(params);
      expect(map.railways.length).toBeGreaterThanOrEqual(1);
    });

    it('has urban clusters placed', () => {
      const map = MapGenerator.generate(params);
      expect(map.urbanClusters.length).toBeGreaterThan(0);
    });

    it('has supply hubs placed', () => {
      const map = MapGenerator.generate(params);
      expect(map.supplyHubs.length).toBeGreaterThan(0);
    });

    it('has Urban terrain cells', () => {
      const map = MapGenerator.generate(params);
      const urbanCells = [...map.cells.values()].filter((c) => c.terrain === TerrainType.Urban);
      expect(urbanCells.length).toBeGreaterThan(0);
    });

    it('is deterministic', () => {
      const a = MapGenerator.generate(params);
      const b = MapGenerator.generate(params);
      expect(a.cells.size).toBe(b.cells.size);
      expect(a.roads.length).toBe(b.roads.length);
      expect(a.urbanClusters.length).toBe(b.urbanClusters.length);
      expect(a.supplyHubs.length).toBe(b.supplyHubs.length);
      for (const [key, cellA] of a.cells) {
        const cellB = b.cells.get(key)!;
        expect(cellA.terrain).toBe(cellB.terrain);
        expect(cellA.urbanClusterId).toBe(cellB.urbanClusterId);
      }
    });

    it('produces different maps with different seeds', () => {
      const a = MapGenerator.generate({ ...params, seed: 1 });
      const b = MapGenerator.generate({ ...params, seed: 2 });
      let differences = 0;
      for (const [key, cellA] of a.cells) {
        const cellB = b.cells.get(key)!;
        if (cellA.terrain !== cellB.terrain) differences++;
      }
      expect(differences).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run all map tests**

Run: `bunx vitest run src/core/map/__tests__/`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/core/map/__tests__/MapGenerator.test.ts
git commit -m "test: update MapGenerator tests for urban clusters and supply hubs"
```

---

## Task 7: Delete `SettlementPlacer` and its tests

**Files:**
- Delete: `src/core/map/SettlementPlacer.ts`
- Delete: `src/core/map/__tests__/SettlementPlacer.test.ts`

**Step 1: Delete the files**

```bash
rm src/core/map/SettlementPlacer.ts src/core/map/__tests__/SettlementPlacer.test.ts
```

**Step 2: Run all map tests to confirm nothing breaks**

Run: `bunx vitest run src/core/map/__tests__/`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add -u src/core/map/SettlementPlacer.ts src/core/map/__tests__/SettlementPlacer.test.ts
git commit -m "refactor: remove SettlementPlacer — replaced by UrbanGenerator"
```

---

## Task 8: Update `TerrainLayer` to render Urban terrain

**Files:**
- Modify: `src/ui/layers/TerrainLayer.ts`

**Step 1: Add Urban color and street-grid pattern rendering**

Replace the full file with:

```typescript
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCell } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Water]: 0x2b4a6b,
  [TerrainType.River]: 0x4a90b8,
  [TerrainType.Plains]: 0x6b7a4a,
  [TerrainType.Forest]: 0x3a5a35,
  [TerrainType.Hills]: 0x7a6b50,
  [TerrainType.Mountain]: 0x5a5a65,
  [TerrainType.Marsh]: 0x4a6a55,
  [TerrainType.Urban]: 0x4a4a4a,
};

const BORDER_COLOR = 0x2a2a35;
const URBAN_GRID_COLOR = 0x5a5a5a;
const URBAN_DENSE_BASE = 0x404040;
const URBAN_SPARSE_BASE = 0x555555;

export class TerrainLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    this.graphics.clear();

    const margin = HexRenderer.HEX_SIZE * 2;

    for (const cell of this.gameMap.cells.values()) {
      const px = HexRenderer.hexToPixel(cell.coord);
      if (
        px.x < bounds.minX - margin ||
        px.x > bounds.maxX + margin ||
        px.y < bounds.minY - margin ||
        px.y > bounds.maxY + margin
      )
        continue;

      const verts = HexRenderer.vertices(px.x, px.y);
      const flat = verts.flatMap((v) => [v.x, v.y]);

      if (cell.terrain === TerrainType.Urban) {
        this.drawUrbanHex(cell, px, flat);
      } else {
        this.graphics.poly(flat);
        this.graphics.fill({ color: TERRAIN_COLORS[cell.terrain] });
        this.graphics.poly(flat);
        this.graphics.stroke({ width: 1, color: BORDER_COLOR });
      }
    }
  }

  private drawUrbanHex(
    cell: HexCell,
    px: { x: number; y: number },
    flat: number[],
  ): void {
    // Count urban neighbors for density variation
    const urbanNeighborCount = HexGrid.neighbors(cell.coord)
      .map((n) => this.gameMap.cells.get(HexGrid.key(n)))
      .filter((n) => n?.terrain === TerrainType.Urban).length;

    const isDense = urbanNeighborCount >= 3;
    const baseColor = isDense ? URBAN_DENSE_BASE : URBAN_SPARSE_BASE;

    // Base fill
    this.graphics.poly(flat);
    this.graphics.fill({ color: baseColor });

    // Street grid pattern — offset per cell for organic variation
    const hash = (cell.coord.q * 73856093) ^ (cell.coord.r * 19349663);
    const offsetX = ((hash & 0xff) / 255) * 2 - 1;
    const offsetY = (((hash >> 8) & 0xff) / 255) * 2 - 1;

    const hexSize = HexRenderer.HEX_SIZE;
    const gridSpacing = isDense ? hexSize * 0.3 : hexSize * 0.45;

    // Horizontal lines
    const hLines = isDense ? 4 : 3;
    for (let i = 0; i < hLines; i++) {
      const t = ((i + 0.5) / hLines) * 2 - 1;
      const y = px.y + t * hexSize * 0.7 + offsetY;
      const halfWidth = hexSize * 0.5;
      this.graphics.moveTo(px.x - halfWidth, y);
      this.graphics.lineTo(px.x + halfWidth, y);
    }

    // Vertical lines
    const vLines = isDense ? 3 : 2;
    for (let i = 0; i < vLines; i++) {
      const t = ((i + 0.5) / vLines) * 2 - 1;
      const x = px.x + t * hexSize * 0.5 + offsetX;
      const halfHeight = hexSize * 0.6;
      this.graphics.moveTo(x, px.y - halfHeight);
      this.graphics.lineTo(x, px.y + halfHeight);
    }

    this.graphics.stroke({ width: 0.5, color: URBAN_GRID_COLOR });

    // Dense areas: small rectangles suggesting rooftops
    if (isDense) {
      const roofCount = 2 + (Math.abs(hash) % 3);
      for (let i = 0; i < roofCount; i++) {
        const rHash = (hash * (i + 1)) & 0xffff;
        const rx = px.x + ((rHash & 0xff) / 255 - 0.5) * hexSize * 0.6;
        const ry = px.y + (((rHash >> 8) & 0xff) / 255 - 0.5) * hexSize * 0.6;
        const rw = hexSize * 0.08;
        const rh = hexSize * 0.06;
        this.graphics.rect(rx - rw / 2, ry - rh / 2, rw, rh);
        this.graphics.fill({ color: URBAN_GRID_COLOR });
      }
    }

    // Border: skip if adjacent urban cell (seamless urban area)
    const hasNonUrbanNeighbor = urbanNeighborCount < 6;
    if (hasNonUrbanNeighbor) {
      // Draw border only on non-urban edges
      this.graphics.poly(flat);
      this.graphics.stroke({ width: 1, color: BORDER_COLOR });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Run typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep TerrainLayer`
Expected: No errors in TerrainLayer.ts

**Step 3: Commit**

```bash
git add src/ui/layers/TerrainLayer.ts
git commit -m "feat: render Urban terrain with street-grid pattern and density variation"
```

---

## Task 9: Rename `SettlementLayer` to `SupplyHubLayer`

**Files:**
- Delete: `src/ui/layers/SettlementLayer.ts`
- Create: `src/ui/layers/SupplyHubLayer.ts`
- Modify: `src/ui/MapRenderer.ts`

**Step 1: Create `SupplyHubLayer`**

Create `src/ui/layers/SupplyHubLayer.ts`:

```typescript
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const LARGE_FILL = 0xd4c8a0;
const LARGE_BORDER = 0x2a2a35;
const LARGE_RADIUS = 8;
const SMALL_FILL = 0xa09880;
const SMALL_RADIUS = 4;

export class SupplyHubLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    this.graphics.clear();

    const margin = HexRenderer.HEX_SIZE * 2;

    for (const hub of this.gameMap.supplyHubs) {
      const px = HexRenderer.hexToPixel(hub.coord);
      if (
        px.x < bounds.minX - margin ||
        px.x > bounds.maxX + margin ||
        px.y < bounds.minY - margin ||
        px.y > bounds.maxY + margin
      )
        continue;

      if (hub.size === 'large') {
        this.graphics.circle(px.x, px.y, LARGE_RADIUS);
        this.graphics.fill({ color: LARGE_FILL });
        this.graphics.circle(px.x, px.y, LARGE_RADIUS);
        this.graphics.stroke({ width: 2, color: LARGE_BORDER });
      } else {
        this.graphics.circle(px.x, px.y, SMALL_RADIUS);
        this.graphics.fill({ color: SMALL_FILL });
      }
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Delete `SettlementLayer.ts`**

```bash
rm src/ui/layers/SettlementLayer.ts
```

**Step 3: Update `MapRenderer.ts` — replace SettlementLayer with SupplyHubLayer**

In `src/ui/MapRenderer.ts`, replace all references:

Import change:
```typescript
// Remove: import { SettlementLayer } from './layers/SettlementLayer';
// Add:
import { SupplyHubLayer } from './layers/SupplyHubLayer';
```

Field change:
```typescript
// Replace: private settlementLayer: SettlementLayer;
// With:
private supplyHubLayer: SupplyHubLayer;
```

Constructor body — replace all `settlementLayer` with `supplyHubLayer` and `SettlementLayer` with `SupplyHubLayer`:
```typescript
this.supplyHubLayer = new SupplyHubLayer(gameMap);
// ...
this.worldContainer.addChild(this.supplyHubLayer.container);
// ...
this.supplyHubLayer.build(bounds);
// ... (both initial builds)
```

Destroy: `this.supplyHubLayer.destroy();`

onFrame: `this.supplyHubLayer.build(bounds);`

**Step 4: Run typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep -E "SettlementLayer|SupplyHubLayer|MapRenderer"`
Expected: No errors

**Step 5: Commit**

```bash
git add -u src/ui/layers/SettlementLayer.ts
git add src/ui/layers/SupplyHubLayer.ts src/ui/MapRenderer.ts
git commit -m "refactor: rename SettlementLayer to SupplyHubLayer, render supply hubs instead of settlements"
```

---

## Task 10: Update `DebugOverlay`

**Files:**
- Modify: `src/ui/DebugOverlay.ts`

**Step 1: Replace settlement display with urban cluster info**

In `src/ui/DebugOverlay.ts`, change line 59 from:
```typescript
`Settlement: ${c.settlement ?? 'none'}`,
```
To:
```typescript
`Urban: ${c.urbanClusterId ?? 'none'}`,
```

**Step 2: Run typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep DebugOverlay`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/DebugOverlay.ts
git commit -m "feat: show urban cluster ID instead of settlement type in debug overlay"
```

---

## Task 11: Update `TerrainGenerator` — generate `urbanClusterId` field on cells

**Files:**
- Modify: `src/core/map/TerrainGenerator.ts`

**Step 1: Update cell creation to include `urbanClusterId: null`**

In `TerrainGenerator.ts`, find where `HexCell` objects are created. They currently set `settlement: null`. Change to `urbanClusterId: null`.

Search for `settlement: null` and replace with `urbanClusterId: null`.

**Step 2: Run typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep TerrainGenerator`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/map/TerrainGenerator.ts
git commit -m "refactor: TerrainGenerator creates cells with urbanClusterId instead of settlement"
```

---

## Task 12: Update `Sidebar` — replace settlement controls with urban params

**Files:**
- Modify: `src/ui/Sidebar.ts`

**Step 1: Replace settlement field declarations with urban fields**

Replace lines 86-93 (settlement controls) with:
```typescript
  // Urban controls
  private metropolisDensity!: SliderRow;
  private cityDensity!: SliderRow;
  private townDensity!: SliderRow;
  private minMetropolisSpacing!: SliderRow;
  private minCitySpacing!: SliderRow;
  private minTownSpacing!: SliderRow;
  private riverBonus!: SliderRow;
  private waterBonus!: SliderRow;
  private plainsBonus!: SliderRow;
```

Also add `urbanCost` to the road controls section.

**Step 2: Replace `buildSettlementsSection` with `buildUrbanSection`**

Replace the method call in the constructor from `this.buildSettlementsSection(scrollArea)` to `this.buildUrbanSection(scrollArea)`.

Replace the method body:

```typescript
  private buildUrbanSection(parent: HTMLElement): void {
    const { content } = this.createSection('Urban', parent, false);

    this.metropolisDensity = this.createSliderRow('Metropolis Density', 1, 5, 1, 2);
    content.appendChild(this.metropolisDensity.container);
    this.cityDensity = this.createSliderRow('City Density', 1, 10, 1, 5);
    content.appendChild(this.cityDensity.container);
    this.townDensity = this.createSliderRow('Town Density', 2, 15, 1, 8);
    content.appendChild(this.townDensity.container);
    this.minMetropolisSpacing = this.createSliderRow('Min Metropolis Spacing', 5, 20, 1, 10);
    content.appendChild(this.minMetropolisSpacing.container);
    this.minCitySpacing = this.createSliderRow('Min City Spacing', 3, 15, 1, 6);
    content.appendChild(this.minCitySpacing.container);
    this.minTownSpacing = this.createSliderRow('Min Town Spacing', 2, 10, 1, 4);
    content.appendChild(this.minTownSpacing.container);
    this.riverBonus = this.createSliderRow('River Bonus', 0, 10, 1, 3);
    content.appendChild(this.riverBonus.container);
    this.waterBonus = this.createSliderRow('Water Bonus', 0, 10, 1, 2);
    content.appendChild(this.waterBonus.container);
    this.plainsBonus = this.createSliderRow('Plains Bonus', 0, 10, 1, 1);
    content.appendChild(this.plainsBonus.container);
  }
```

**Step 3: Update `getParams()` — replace `settlements` with `urban`**

Replace:
```typescript
      settlements: {
        cityDensity: this.cityDensity.getValue(),
        townDensity: this.townDensity.getValue(),
        minCityDistance: this.minCityDistance.getValue(),
        minTownDistance: this.minTownDistance.getValue(),
        riverBonusCity: this.riverBonusCity.getValue(),
        waterBonusCity: this.waterBonusCity.getValue(),
        plainsBonusCity: this.plainsBonusCity.getValue(),
      },
```
With:
```typescript
      urban: {
        metropolisDensity: this.metropolisDensity.getValue(),
        cityDensity: this.cityDensity.getValue(),
        townDensity: this.townDensity.getValue(),
        minMetropolisSpacing: this.minMetropolisSpacing.getValue(),
        minCitySpacing: this.minCitySpacing.getValue(),
        minTownSpacing: this.minTownSpacing.getValue(),
        riverBonus: this.riverBonus.getValue(),
        waterBonus: this.waterBonus.getValue(),
        plainsBonus: this.plainsBonus.getValue(),
      },
```

Also add `urbanCost: this.urbanCost.getValue()` to the `roads` block in `getParams()`.

**Step 4: Update `setParams()` — replace settlement setValue calls with urban**

Replace:
```typescript
    this.cityDensity.setValue(params.settlements.cityDensity);
    this.townDensity.setValue(params.settlements.townDensity);
    this.minCityDistance.setValue(params.settlements.minCityDistance);
    this.minTownDistance.setValue(params.settlements.minTownDistance);
    this.riverBonusCity.setValue(params.settlements.riverBonusCity);
    this.waterBonusCity.setValue(params.settlements.waterBonusCity);
    this.plainsBonusCity.setValue(params.settlements.plainsBonusCity);
```
With:
```typescript
    this.metropolisDensity.setValue(params.urban.metropolisDensity);
    this.cityDensity.setValue(params.urban.cityDensity);
    this.townDensity.setValue(params.urban.townDensity);
    this.minMetropolisSpacing.setValue(params.urban.minMetropolisSpacing);
    this.minCitySpacing.setValue(params.urban.minCitySpacing);
    this.minTownSpacing.setValue(params.urban.minTownSpacing);
    this.riverBonus.setValue(params.urban.riverBonus);
    this.waterBonus.setValue(params.urban.waterBonus);
    this.plainsBonus.setValue(params.urban.plainsBonus);
```

Also add `this.urbanCost.setValue(params.roads.urbanCost)` to the roads section of `setParams`.

**Step 5: Add urbanCost slider to buildRoadsSection**

Add after the existing road sliders (before `cityConnectionDistance`):
```typescript
    this.urbanCost = this.createSliderRow('Urban Cost', 1, 10, 1, 1);
    content.appendChild(this.urbanCost.container);
```

Add `private urbanCost!: SliderRow;` to the road controls field declarations.

**Step 6: Run typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep Sidebar`
Expected: No errors

**Step 7: Commit**

```bash
git add src/ui/Sidebar.ts
git commit -m "feat: sidebar exposes urban cluster params instead of settlement params"
```

---

## Task 12b: Update barrel exports and presets

**Files:**
- Modify: `src/core/index.ts`
- Modify: `src/ui/presets.ts` (if it references SettlementType)

**Step 1: Update barrel export**

In `src/core/index.ts`, remove `SettlementType` export and add new type exports:

```typescript
export { HexGrid } from './map/HexGrid';
export { MapGenerator } from './map/MapGenerator';
export type { GameMap, GenerationParams, HexCell, HexCoord, SupplyHub, UrbanCluster } from './map/types';
export { TerrainType } from './map/types';
```

**Step 2: Check if presets.ts references old types — update if needed**

Read `src/ui/presets.ts` and update any `settlements:` blocks to `urban:` with the new field names and default values. Every built-in preset must have an `urban` block instead of `settlements`, and an `urbanCost` in the `roads` block.

**Step 3: Run full quality check**

Run: `bun run check`
Expected: All lint, typecheck, and tests pass

**Step 4: Commit**

```bash
git add src/core/index.ts src/ui/presets.ts
git commit -m "refactor: update barrel exports and presets for urban/supply hub types"
```

---

## Task 13: Final integration test — generate and visually verify

**Step 1: Run full quality gate**

Run: `bun run check`
Expected: All lint, typecheck, and tests pass with zero errors

**Step 2: Start dev server and visually verify**

Run: `bun run dev`

Verify:
- Map generates without errors
- Urban clusters appear as dark gray hex areas with street-grid patterns
- Dense urban areas (3+ urban neighbors) have tighter grid and darker color
- Sparse urban edges have lighter color and wider grid
- Supply hubs appear as circles (large: bordered, small: no border)
- Roads connect urban cluster centers
- Railways connect major centers (metropolis/city)
- Debug overlay shows `Urban: <cluster-id>` when hovering urban cells
- Sidebar "Urban" section controls work (adjust density, spacing, etc.)
- Generate button produces new maps correctly

**Step 3: Final commit if any tweaks needed**

```bash
git add -A
git commit -m "feat: urban terrain and supply hub system complete"
```
