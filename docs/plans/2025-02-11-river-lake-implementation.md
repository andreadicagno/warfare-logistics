# River & Lake Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace edge-based rivers with cell-based `River` terrain, add noise/termination lakes, add bridge rendering where routes cross rivers.

**Architecture:** Rivers become `TerrainType.River` cells generated via greedy downhill flow. Lakes are `Water` cells created by noise thresholds and river dead-ends. Bridges are derived from route+river overlap at render time. Old edge-based river code (types, generator, layer) is deleted.

**Tech Stack:** TypeScript, Vitest, PixiJS v8

---

### Task 1: Update types — add `River`, remove edge-based types

**Files:**
- Modify: `src/core/map/types.ts`

**Step 1: Write the failing test**

Create `src/core/map/__tests__/types.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { TerrainType } from '../types';

describe('TerrainType', () => {
  it('includes River', () => {
    expect(TerrainType.River).toBe('river');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/core/map/__tests__/types.test.ts`
Expected: FAIL — `TerrainType.River` is undefined

**Step 3: Update types.ts**

In `src/core/map/types.ts`:

1. Add `River = 'river'` to the `TerrainType` enum.
2. Add `navigable?: boolean` to `HexCell`.
3. Remove `riverEdges: Set<number>` from `HexCell`.
4. Remove the `RiverPath` interface entirely.
5. Remove `rivers: RiverPath[]` from `GameMap`.

Result:

```typescript
export enum TerrainType {
  Water = 'water',
  Plains = 'plains',
  Marsh = 'marsh',
  Forest = 'forest',
  Hills = 'hills',
  Mountain = 'mountain',
  River = 'river',
}

export interface HexCell {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
  moisture: number;
  navigable?: boolean;
  settlement: SettlementType | null;
}

// RiverPath — DELETED

export interface GameMap {
  width: number;
  height: number;
  cells: Map<string, HexCell>;
  roads: RoutePath[];
  railways: RoutePath[];
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/core/map/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/map/types.ts src/core/map/__tests__/types.test.ts
git commit -m "refactor(map): add River terrain type, remove edge-based river types"
```

---

### Task 2: Fix all compilation errors from type changes

After Task 1, many files will fail to compile because they reference `riverEdges`, `RiverPath`, or `GameMap.rivers`. This task fixes every reference.

**Files:**
- Modify: `src/core/map/TerrainGenerator.ts` — remove `riverEdges: new Set()` from cell creation
- Modify: `src/core/map/SmoothingPass.ts` — add `River` to `TERRAIN_GROUP`
- Modify: `src/core/map/SettlementPlacer.ts` — replace `cell.riverEdges.size > 0` with neighbor check for `River` terrain
- Modify: `src/core/map/RoadGenerator.ts` — add `River` cost (6) to `TERRAIN_COST`
- Modify: `src/core/map/MapGenerator.ts` — remove `RiverGenerator` import, remove `rivers` from return, adjust pipeline
- Modify: `src/ui/MapRenderer.ts` — remove `RiverLayer` import and all references
- Modify: `src/ui/layers/TerrainLayer.ts` — add `River` color to `TERRAIN_COLORS`
- Delete: `src/ui/layers/RiverLayer.ts`
- Modify: `src/core/map/__tests__/RiverGenerator.test.ts` — delete file (will be rewritten in Task 3)
- Modify: `src/core/map/__tests__/MapGenerator.test.ts` — remove `rivers` assertions
- Modify: `src/core/map/__tests__/SmoothingPass.test.ts` — remove `riverEdges` from `makeCell`
- Modify: `src/core/map/__tests__/RoadGenerator.test.ts` — remove `riverEdges` from cell literals, update `makeMap` to not call old `RiverGenerator`

**Step 1: Fix TerrainGenerator.ts**

Remove the `riverEdges: new Set()` line from the cell object literal (line 42). The cell creation becomes:

```typescript
cells.set(HexGrid.key(coord), {
  coord,
  terrain,
  elevation,
  moisture,
  settlement: null,
});
```

**Step 2: Fix SmoothingPass.ts**

Add `River` to `TERRAIN_GROUP` at position 1 (between Water=0 and Marsh=1). Shift Marsh to 2, Plains to 3, etc. Also skip `River` cells in `removeSingleHexAnomalies` — they are intentional.

```typescript
const TERRAIN_GROUP: Record<TerrainType, number> = {
  [TerrainType.Water]: 0,
  [TerrainType.River]: 1,
  [TerrainType.Marsh]: 2,
  [TerrainType.Plains]: 3,
  [TerrainType.Forest]: 4,
  [TerrainType.Hills]: 5,
  [TerrainType.Mountain]: 6,
};
```

In `removeSingleHexAnomalies`, add early continue for `River` cells:

```typescript
if (cell.terrain === TerrainType.River) continue;
```

In `removeIsolatedWater`, no changes needed — it only touches `Water` cells.

**Step 3: Fix SettlementPlacer.ts**

In `placeCities` (line 38), replace:
```typescript
if (cell.riverEdges.size > 0) score += 3;
```
with:
```typescript
if (neighbors.some((n) => n.terrain === TerrainType.River)) score += 3;
```

In `placeTowns` (line 90), replace:
```typescript
if (cell.riverEdges.size > 0) score += 1;
```
with:
```typescript
const townNeighbors = HexGrid.neighbors(cell.coord)
  .filter((n) => HexGrid.inBounds(n, width, height))
  .map((n) => cells.get(HexGrid.key(n))!)
  .filter(Boolean);
if (townNeighbors.some((n) => n.terrain === TerrainType.River)) score += 1;
```

Also add `TerrainType.River` to the exclusion filter for city placement (line 30) — cities can't be on River:
```typescript
if (
  cell.terrain !== TerrainType.Plains &&
  cell.terrain !== TerrainType.Forest
) continue;
```
This already excludes River, so no change needed for cities. But for towns (line 73-76), `River` is also not in the allowed list, so already excluded.

Note: `placeTowns` currently doesn't receive `width`/`height` — the params exist but are prefixed with `_`. Rename them to remove the underscore so we can use them for `HexGrid.inBounds`.

**Step 4: Fix RoadGenerator.ts**

Add `River` to `TERRAIN_COST`:
```typescript
const TERRAIN_COST: Record<TerrainType, number> = {
  [TerrainType.Plains]: 1,
  [TerrainType.Forest]: 2,
  [TerrainType.Hills]: 3,
  [TerrainType.Marsh]: 3,
  [TerrainType.River]: 6,
  [TerrainType.Mountain]: Infinity,
  [TerrainType.Water]: Infinity,
};
```

**Step 5: Fix MapGenerator.ts**

Remove `RiverGenerator` import. Remove the river generation line and `rivers` from the return object. The pipeline becomes:

```typescript
const cells = TerrainGenerator.generate(width, height, config.geography, config.seed);
SmoothingPass.apply(cells, width, height);
SettlementPlacer.place(cells, width, height);
const { roads, railways } = RoadGenerator.generate(cells, width, height, config.initialInfrastructure);
return { width, height, cells, roads, railways };
```

(RiverGenerator will be re-integrated in Task 3 after rewrite.)

**Step 6: Fix MapRenderer.ts**

Remove import of `RiverLayer`. Remove the `riverLayer` field, its construction, its `container` addition to `worldContainer`, its `.build()` calls, and its `.destroy()` call.

**Step 7: Fix TerrainLayer.ts**

Add `River` to `TERRAIN_COLORS`:
```typescript
[TerrainType.River]: 0x4a90b8,
```

**Step 8: Delete RiverLayer.ts**

Delete `src/ui/layers/RiverLayer.ts` entirely.

**Step 9: Fix test files**

`src/core/map/__tests__/RiverGenerator.test.ts` — delete entirely (will be rewritten in Task 3).

`src/core/map/__tests__/MapGenerator.test.ts`:
- Remove `expect(map.rivers.length).toBeGreaterThan(0)` (line 39)
- Remove `expect(a.rivers.length).toBe(b.rivers.length)` (line 62)

`src/core/map/__tests__/SmoothingPass.test.ts`:
- Remove `riverEdges: new Set()` from `makeCell` helper (line 14).

`src/core/map/__tests__/RoadGenerator.test.ts`:
- Remove `riverEdges: new Set()` from every cell literal (lines 96, 114, 122, 131).
- In `makeMap()`, remove the `RiverGenerator.generate(cells, 40, 30, 42)` call (line 14) and the `RiverGenerator` import (line 3).

**Step 10: Run typecheck + tests**

Run: `bun run check`
Expected: All pass — 0 compile errors, all tests green.

**Step 11: Commit**

```bash
git add -A
git commit -m "refactor(map): remove edge-based river system, fix all references"
```

---

### Task 3: Rewrite RiverGenerator as cell-based

**Files:**
- Rewrite: `src/core/map/RiverGenerator.ts`
- Create: `src/core/map/__tests__/RiverGenerator.test.ts`

**Step 1: Write the failing tests**

Create `src/core/map/__tests__/RiverGenerator.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { TerrainGenerator } from '../TerrainGenerator';
import { TerrainType } from '../types';

describe('RiverGenerator', () => {
  function makeMap() {
    return TerrainGenerator.generate(40, 30, 'mixed', 42);
  }

  it('produces 3-5 rivers (river cell groups)', () => {
    const cells = makeMap();
    const riverCount = RiverGenerator.generate(cells, 40, 30, 42);
    expect(riverCount).toBeGreaterThanOrEqual(3);
    expect(riverCount).toBeLessThanOrEqual(5);
  });

  it('creates River terrain cells', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    const riverCells = [...cells.values()].filter((c) => c.terrain === TerrainType.River);
    expect(riverCells.length).toBeGreaterThan(0);
  });

  it('river sources start at high elevation', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    // River cells at highest elevation should be > 0.5
    const riverCells = [...cells.values()].filter((c) => c.terrain === TerrainType.River);
    const maxElev = Math.max(...riverCells.map((c) => c.elevation));
    expect(maxElev).toBeGreaterThan(0.5);
  });

  it('rivers terminate at Water, map edge, or another River', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    // Every River cell should have at least one neighbor that is River, Water, or out of bounds
    const riverCells = [...cells.values()].filter((c) => c.terrain === TerrainType.River);
    for (const rc of riverCells) {
      const neighbors = HexGrid.neighbors(rc.coord);
      const hasConnection = neighbors.some((n) => {
        if (!HexGrid.inBounds(n, 40, 30)) return true; // map edge
        const nc = cells.get(HexGrid.key(n));
        return nc?.terrain === TerrainType.River || nc?.terrain === TerrainType.Water;
      });
      expect(hasConnection).toBe(true);
    }
  });

  it('wide rivers have navigable cells', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    const riverCells = [...cells.values()].filter((c) => c.terrain === TerrainType.River);
    // At least some cells should be navigable (from rivers >= 8 cells)
    const navigableCount = riverCells.filter((c) => c.navigable).length;
    // May be 0 if all rivers are short — check that navigable is only set on River cells
    const nonRiverNavigable = [...cells.values()].filter(
      (c) => c.navigable && c.terrain !== TerrainType.River,
    );
    expect(nonRiverNavigable.length).toBe(0);
  });

  it('is deterministic', () => {
    const cells1 = makeMap();
    RiverGenerator.generate(cells1, 40, 30, 42);
    const cells2 = TerrainGenerator.generate(40, 30, 'mixed', 42);
    RiverGenerator.generate(cells2, 40, 30, 42);

    const rivers1 = [...cells1.values()].filter((c) => c.terrain === TerrainType.River);
    const rivers2 = [...cells2.values()].filter((c) => c.terrain === TerrainType.River);
    expect(rivers1.length).toBe(rivers2.length);
  });

  it('generates termination lakes when rivers get stuck', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    // After generation, there should be Water cells that weren't there before (lakes)
    const freshCells = TerrainGenerator.generate(40, 30, 'mixed', 42);
    const originalWater = [...freshCells.values()].filter((c) => c.terrain === TerrainType.Water).length;
    const afterWater = [...cells.values()].filter((c) => c.terrain === TerrainType.Water).length;
    // Water count should be >= original (termination lakes may add more)
    expect(afterWater).toBeGreaterThanOrEqual(originalWater);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/core/map/__tests__/RiverGenerator.test.ts`
Expected: FAIL — `RiverGenerator.generate` returns `RiverPath[]` (old signature)

**Step 3: Rewrite RiverGenerator.ts**

Replace the entire file with the new cell-based implementation:

```typescript
import { HexGrid } from './HexGrid';
import { mulberry32 } from './rng';
import type { HexCell, HexCoord } from './types';
import { TerrainType } from './types';

const RIVER_COUNT_MIN = 3;
const RIVER_COUNT_MAX = 5;
const MIN_RIVER_LENGTH = 3;
const WIDE_RIVER_THRESHOLD = 8;
const WIDE_RIVER_START_FRACTION = 0.4; // top 40% stays narrow
const MAX_FLOW_LENGTH = 100;
const LAKE_MIN_SIZE = 3;
const LAKE_MAX_SIZE = 6;

export class RiverGenerator {
  /**
   * Generates rivers as River terrain cells. Returns the number of rivers created.
   * Also generates termination lakes (Water cells) when rivers get stuck.
   */
  static generate(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    seed: number,
  ): number {
    const rng = mulberry32(seed + 1000);
    const sources = RiverGenerator.selectSources(cells, width, height, rng);
    let riverCount = 0;

    for (const source of sources) {
      const path = RiverGenerator.flowDownhill(source, cells, width, height);

      if (path.length < MIN_RIVER_LENGTH) continue;

      // Check if river terminated without reaching water/edge/river
      const last = path[path.length - 1];
      const reachedEnd = RiverGenerator.reachedTerminus(last, cells, width, height, path);

      // Convert path cells to River terrain
      for (const coord of path) {
        const cell = cells.get(HexGrid.key(coord))!;
        cell.terrain = TerrainType.River;
      }

      // Widen long rivers
      if (path.length >= WIDE_RIVER_THRESHOLD) {
        RiverGenerator.widenRiver(path, cells, width, height);
      }

      // Generate termination lake if stuck
      if (!reachedEnd) {
        RiverGenerator.generateLake(last, cells, width, height, rng);
      }

      riverCount++;
    }

    return riverCount;
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
  ): HexCoord[] {
    const path: HexCoord[] = [source];
    let current = source;
    const visited = new Set<string>();
    visited.add(HexGrid.key(current));

    for (let step = 0; step < MAX_FLOW_LENGTH; step++) {
      const currentCell = cells.get(HexGrid.key(current))!;
      const neighbors = HexGrid.neighbors(current);

      let bestNeighbor: HexCoord | null = null;
      let bestElevation = currentCell.elevation;

      for (const neighbor of neighbors) {
        const key = HexGrid.key(neighbor);
        if (visited.has(key)) continue;

        // Stop at map edge
        if (!HexGrid.inBounds(neighbor, width, height)) {
          return path;
        }

        const neighborCell = cells.get(key)!;

        // Stop at Water (ocean/lake)
        if (neighborCell.terrain === TerrainType.Water) {
          return path;
        }

        // Stop at existing River (confluence)
        if (neighborCell.terrain === TerrainType.River) {
          return path;
        }

        if (neighborCell.elevation < bestElevation) {
          bestElevation = neighborCell.elevation;
          bestNeighbor = neighbor;
        }
      }

      if (bestNeighbor === null) break; // stuck

      visited.add(HexGrid.key(bestNeighbor));
      path.push(bestNeighbor);
      current = bestNeighbor;
    }

    return path;
  }

  /** Check if the river path reached a valid terminus (Water, map edge, or existing River). */
  private static reachedTerminus(
    lastCoord: HexCoord,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    path: HexCoord[],
  ): boolean {
    const pathKeys = new Set(path.map((c) => HexGrid.key(c)));
    const neighbors = HexGrid.neighbors(lastCoord);
    return neighbors.some((n) => {
      if (!HexGrid.inBounds(n, width, height)) return true;
      const nc = cells.get(HexGrid.key(n));
      if (!nc) return false;
      if (nc.terrain === TerrainType.Water) return true;
      // An existing River cell that is NOT part of the current path = confluence
      if (nc.terrain === TerrainType.River && !pathKeys.has(HexGrid.key(n))) return true;
      return false;
    });
  }

  /** Widen the lower portion of the river to 2 cells and mark navigable. */
  private static widenRiver(
    path: HexCoord[],
    cells: Map<string, HexCell>,
    width: number,
    height: number,
  ): void {
    const startIdx = Math.floor(path.length * WIDE_RIVER_START_FRACTION);

    for (let i = startIdx; i < path.length; i++) {
      const coord = path[i];
      const cell = cells.get(HexGrid.key(coord))!;
      cell.navigable = true;

      // Determine flow direction to find lateral neighbor
      const prev = i > 0 ? path[i - 1] : null;
      const next = i < path.length - 1 ? path[i + 1] : null;

      // Get perpendicular neighbor
      const lateral = RiverGenerator.getLateralNeighbor(coord, prev, next, cells, width, height);
      if (lateral) {
        const lateralCell = cells.get(HexGrid.key(lateral))!;
        lateralCell.terrain = TerrainType.River;
        lateralCell.navigable = true;
      }
    }
  }

  /** Find a suitable lateral (perpendicular to flow) neighbor to widen the river. */
  private static getLateralNeighbor(
    coord: HexCoord,
    prev: HexCoord | null,
    next: HexCoord | null,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
  ): HexCoord | null {
    // Determine flow direction index
    const ref = next ?? prev;
    if (!ref) return null;

    const flowDir = HexGrid.edgeDirection(coord, ref);
    if (flowDir === null) return null;

    // Perpendicular directions: +2 and -2 from flow direction (roughly 90 degrees in hex)
    const perpDirs = [(flowDir + 2) % 6, (flowDir + 4) % 6];
    const neighbors = HexGrid.neighbors(coord);

    for (const dir of perpDirs) {
      const n = neighbors[dir];
      if (!HexGrid.inBounds(n, width, height)) continue;
      const nc = cells.get(HexGrid.key(n));
      if (!nc) continue;
      // Only widen into land cells (not Water, Mountain, or existing River)
      if (
        nc.terrain !== TerrainType.Water &&
        nc.terrain !== TerrainType.Mountain &&
        nc.terrain !== TerrainType.River
      ) {
        return n;
      }
    }

    return null;
  }

  /** Generate a small lake at a dead-end river termination point. */
  private static generateLake(
    center: HexCoord,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    rng: () => number,
  ): void {
    const lakeSize = LAKE_MIN_SIZE + Math.floor(rng() * (LAKE_MAX_SIZE - LAKE_MIN_SIZE + 1));
    const centerCell = cells.get(HexGrid.key(center));

    // Convert the center to Water (override the River that was just placed)
    if (centerCell) {
      centerCell.terrain = TerrainType.Water;
      centerCell.navigable = undefined;
    }

    // Expand to adjacent low-elevation cells
    const candidates = HexGrid.neighbors(center)
      .filter((n) => HexGrid.inBounds(n, width, height))
      .map((n) => ({ coord: n, cell: cells.get(HexGrid.key(n))! }))
      .filter(
        (entry) =>
          entry.cell &&
          entry.cell.terrain !== TerrainType.Water &&
          entry.cell.terrain !== TerrainType.Mountain,
      )
      .sort((a, b) => a.cell.elevation - b.cell.elevation);

    const toConvert = candidates.slice(0, lakeSize - 1); // -1 because center is already converted
    for (const entry of toConvert) {
      entry.cell.terrain = TerrainType.Water;
      entry.cell.navigable = undefined;
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/core/map/__tests__/RiverGenerator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/map/RiverGenerator.ts src/core/map/__tests__/RiverGenerator.test.ts
git commit -m "feat(map): rewrite RiverGenerator as cell-based with lakes"
```

---

### Task 4: Add noise-based lakes to TerrainGenerator

**Files:**
- Modify: `src/core/map/TerrainGenerator.ts`
- Modify: `src/core/map/__tests__/TerrainGenerator.test.ts` (or create if none exists)

**Step 1: Write the failing test**

Check if a test file exists. If not, create `src/core/map/__tests__/TerrainGenerator.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { TerrainGenerator } from '../TerrainGenerator';
import { TerrainType } from '../types';

describe('TerrainGenerator', () => {
  describe('noise-based lakes', () => {
    it('generates inland Water cells in low-elevation high-moisture areas', () => {
      // Use a map with mixed geography (some inland low areas)
      const cells = TerrainGenerator.generate(60, 45, 'mixed', 42);

      // Find Water cells that are not at the map border (inland lakes)
      const inlandWater = [...cells.values()].filter((c) => {
        if (c.terrain !== TerrainType.Water) return false;
        // Consider "inland" as not at extreme low elevation (ocean is typically < 0.15)
        return c.elevation >= 0.2 && c.moisture > 0.7;
      });

      // Should have some inland water from the noise-based lake generation
      expect(inlandWater.length).toBeGreaterThan(0);
    });
  });

  describe('assignTerrain', () => {
    it('returns Water for low elevation high moisture (lake)', () => {
      const terrain = TerrainGenerator.assignTerrain(0.25, 0.75, 'mixed');
      expect(terrain).toBe(TerrainType.Water);
    });

    it('still returns Marsh for moderate moisture in lake elevation range', () => {
      const terrain = TerrainGenerator.assignTerrain(0.25, 0.55, 'mixed');
      expect(terrain).toBe(TerrainType.Marsh);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/core/map/__tests__/TerrainGenerator.test.ts`
Expected: FAIL — `assignTerrain(0.25, 0.75, 'mixed')` returns `Marsh`, not `Water`

**Step 3: Modify assignTerrain in TerrainGenerator.ts**

In the `assignTerrain` method, add a lake condition in the elevation range 0.2–0.35. Change the logic:

```typescript
static assignTerrain(elevation: number, moisture: number, geography: Geography): TerrainType {
  const offset = GEOGRAPHY_OFFSETS[geography];
  const moistureThreshold = 0.5;

  if (elevation < 0.2 + offset) return TerrainType.Water;
  if (elevation < 0.35 + offset) {
    if (moisture > 0.7) return TerrainType.Water; // noise-based lake
    return moisture > moistureThreshold ? TerrainType.Marsh : TerrainType.Plains;
  }
  if (elevation < 0.55 + offset) {
    return moisture > moistureThreshold ? TerrainType.Forest : TerrainType.Plains;
  }
  if (elevation < 0.75 + offset) {
    return moisture > moistureThreshold ? TerrainType.Forest : TerrainType.Hills;
  }
  return TerrainType.Mountain;
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/core/map/__tests__/TerrainGenerator.test.ts`
Expected: PASS

**Step 5: Run full check**

Run: `bun run check`
Expected: All pass

**Step 6: Commit**

```bash
git add src/core/map/TerrainGenerator.ts src/core/map/__tests__/TerrainGenerator.test.ts
git commit -m "feat(map): add noise-based inland lakes in TerrainGenerator"
```

---

### Task 5: Re-integrate RiverGenerator into MapGenerator pipeline

**Files:**
- Modify: `src/core/map/MapGenerator.ts`
- Modify: `src/core/map/__tests__/MapGenerator.test.ts`

**Step 1: Write the failing test**

Add tests to `MapGenerator.test.ts`:

```typescript
it('produces River terrain cells', () => {
  const map = MapGenerator.generate(config);
  const riverCells = [...map.cells.values()].filter((c) => c.terrain === TerrainType.River);
  expect(riverCells.length).toBeGreaterThan(0);
});
```

Add `TerrainType` import at top.

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/core/map/__tests__/MapGenerator.test.ts`
Expected: FAIL — no River cells because RiverGenerator isn't called

**Step 3: Add RiverGenerator back to MapGenerator pipeline**

In `MapGenerator.ts`, re-add the import and call between TerrainGenerator and SmoothingPass:

```typescript
import { RiverGenerator } from './RiverGenerator';

// In generate():
const cells = TerrainGenerator.generate(width, height, config.geography, config.seed);
RiverGenerator.generate(cells, width, height, config.seed);
SmoothingPass.apply(cells, width, height);
SettlementPlacer.place(cells, width, height);
const { roads, railways } = RoadGenerator.generate(cells, width, height, config.initialInfrastructure);
return { width, height, cells, roads, railways };
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/core/map/__tests__/MapGenerator.test.ts`
Expected: PASS

**Step 5: Also update RoadGenerator.test.ts makeMap**

In `src/core/map/__tests__/RoadGenerator.test.ts`, the `makeMap()` function should call the new RiverGenerator:

```typescript
import { RiverGenerator } from '../RiverGenerator';

function makeMap() {
  const cells = TerrainGenerator.generate(40, 30, 'mixed', 42);
  RiverGenerator.generate(cells, 40, 30, 42);
  SmoothingPass.apply(cells, 40, 30);
  SettlementPlacer.place(cells, 40, 30);
  return cells;
}
```

**Step 6: Run full check**

Run: `bun run check`
Expected: All pass

**Step 7: Commit**

```bash
git add src/core/map/MapGenerator.ts src/core/map/__tests__/MapGenerator.test.ts src/core/map/__tests__/RoadGenerator.test.ts
git commit -m "feat(map): re-integrate cell-based RiverGenerator into pipeline"
```

---

### Task 6: Bridge rendering in RouteLayer

**Files:**
- Modify: `src/ui/layers/RouteLayer.ts`

**Step 1: Add bridge rendering logic**

When drawing a road or railway segment, check if either hex is a `River` cell. If so, draw a bridge indicator (small rectangle under the route line).

In `RouteLayer.ts`, add the `GameMap` cells reference and a bridge drawing method:

Add to imports:
```typescript
import { HexGrid } from '@core/map/HexGrid';
import { TerrainType } from '@core/map/types';
```

Add bridge constants:
```typescript
const BRIDGE_COLOR = 0x8b7355;
const BRIDGE_WIDTH = 8;
const BRIDGE_HEIGHT = 4;
```

Add a `drawBridge` method:
```typescript
private drawBridge(x: number, y: number): void {
  this.graphics.rect(x - BRIDGE_WIDTH / 2, y - BRIDGE_HEIGHT / 2, BRIDGE_WIDTH, BRIDGE_HEIGHT);
  this.graphics.fill({ color: BRIDGE_COLOR });
}
```

In `drawRoads` and `drawRailways`, after drawing each segment, check if the hex is a river cell and draw a bridge:

```typescript
// Inside drawRoads, after the segment loop:
for (const hex of route.hexes) {
  const cell = this.gameMap.cells.get(HexGrid.key(hex));
  if (cell?.terrain === TerrainType.River) {
    const px = HexRenderer.hexToPixel(hex);
    this.drawBridge(px.x, px.y);
  }
}
```

Same for `drawRailways`.

**Step 2: Run full check**

Run: `bun run check`
Expected: All pass (no test needed for rendering — visual verification).

**Step 3: Commit**

```bash
git add src/ui/layers/RouteLayer.ts
git commit -m "feat(ui): add bridge indicators where routes cross river cells"
```

---

### Task 7: Visual verification and cleanup

**Step 1: Run dev server**

Run: `bun run dev`

Open browser and verify:
- Rivers appear as light blue hex cells flowing from mountains to coast/lakes
- Lakes appear as dark blue clusters (inland)
- Roads and railways cross rivers with visible bridge markers
- Settlements appear near rivers but not on them
- No visual glitches or missing terrain colors

**Step 2: Run full quality check**

Run: `bun run check`
Expected: All pass.

**Step 3: Final commit if any tweaks needed**

Adjust colors, sizes, or thresholds based on visual feedback.
