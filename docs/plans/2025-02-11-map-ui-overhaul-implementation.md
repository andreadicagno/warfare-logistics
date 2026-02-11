# Map UI Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the bottom toolbar with a collapsible sidebar exposing all ~45 map generation parameters, add Bezier curve road rendering, x5 map sizes, sea-side selection, and a preset system.

**Architecture:** Extract all hardcoded generator constants into a single `GenerationParams` interface. Each generator accepts its relevant slice. The sidebar builds a `GenerationParams` object and passes it through `MapGenerator.generate()`. Route rendering uses Catmull-Rom→Bezier conversion for smooth curves. Presets are stored in localStorage.

**Tech Stack:** TypeScript, PixiJS v8, Vitest, Biome v2

---

## Task 1: Define GenerationParams type and defaults

**Files:**
- Modify: `src/core/map/types.ts`

**Step 1: Write the failing test**

Create `src/core/map/__tests__/types.test.ts` — add tests for the new type and defaults:

```typescript
import { describe, expect, it } from 'vitest';
import { DEFAULT_GENERATION_PARAMS } from '../types';

describe('DEFAULT_GENERATION_PARAMS', () => {
  it('has valid map dimensions', () => {
    expect(DEFAULT_GENERATION_PARAMS.width).toBe(200);
    expect(DEFAULT_GENERATION_PARAMS.height).toBe(150);
  });

  it('has all sea sides enabled by default', () => {
    expect(DEFAULT_GENERATION_PARAMS.seaSides).toEqual({
      north: true,
      south: true,
      east: true,
      west: true,
    });
  });

  it('has terrain thresholds in ascending order', () => {
    const t = DEFAULT_GENERATION_PARAMS.terrain;
    expect(t.waterThreshold).toBeLessThan(t.coastalThreshold);
    expect(t.coastalThreshold).toBeLessThan(t.lowlandThreshold);
    expect(t.lowlandThreshold).toBeLessThan(t.highlandThreshold);
  });

  it('has noise weights that sum to approximately 1', () => {
    const t = DEFAULT_GENERATION_PARAMS.terrain;
    const sum = t.noiseWeightLarge + t.noiseWeightMedium + t.noiseWeightDetail;
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('has river min sources <= max sources', () => {
    const r = DEFAULT_GENERATION_PARAMS.rivers;
    expect(r.minSources).toBeLessThanOrEqual(r.maxSources);
  });

  it('has lake min size <= max size', () => {
    const r = DEFAULT_GENERATION_PARAMS.rivers;
    expect(r.lakeMinSize).toBeLessThanOrEqual(r.lakeMaxSize);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/core/map/__tests__/types.test.ts`
Expected: FAIL — `DEFAULT_GENERATION_PARAMS` not found

**Step 3: Add types and defaults to `src/core/map/types.ts`**

Add after existing types:

```typescript
export interface SeaSides {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

export interface TerrainParams {
  geography: 'plains' | 'mixed' | 'mountainous';
  elevationScaleLarge: number;
  elevationScaleMedium: number;
  elevationScaleDetail: number;
  noiseWeightLarge: number;
  noiseWeightMedium: number;
  noiseWeightDetail: number;
  falloffStrength: number;
  moistureScale: number;
  waterThreshold: number;
  coastalThreshold: number;
  lowlandThreshold: number;
  highlandThreshold: number;
  lakeMoistureThreshold: number;
}

export interface SmoothingParams {
  groupTolerance: number;
  minGroupDifference: number;
}

export interface RiverParams {
  minSources: number;
  maxSources: number;
  sourceMinElevation: number;
  sourceMinSpacing: number;
  minRiverLength: number;
  wideRiverMinLength: number;
  wideRiverFraction: number;
  lakeMinSize: number;
  lakeMaxSize: number;
}

export interface SettlementParams {
  cityDensity: number;
  townDensity: number;
  minCityDistance: number;
  minTownDistance: number;
  riverBonusCity: number;
  waterBonusCity: number;
  plainsBonusCity: number;
}

export interface RoadParams {
  infrastructure: 'none' | 'basic' | 'developed';
  plainsCost: number;
  forestCost: number;
  hillsCost: number;
  marshCost: number;
  riverCost: number;
  cityConnectionDistance: number;
}

export interface GenerationParams {
  width: number;
  height: number;
  seed: number;
  seaSides: SeaSides;
  terrain: TerrainParams;
  smoothing: SmoothingParams;
  rivers: RiverParams;
  settlements: SettlementParams;
  roads: RoadParams;
}

export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  width: 200,
  height: 150,
  seed: Date.now(),
  seaSides: { north: true, south: true, east: true, west: true },
  terrain: {
    geography: 'mixed',
    elevationScaleLarge: 0.05,
    elevationScaleMedium: 0.1,
    elevationScaleDetail: 0.2,
    noiseWeightLarge: 0.6,
    noiseWeightMedium: 0.3,
    noiseWeightDetail: 0.1,
    falloffStrength: 2.0,
    moistureScale: 0.08,
    waterThreshold: 0.2,
    coastalThreshold: 0.35,
    lowlandThreshold: 0.55,
    highlandThreshold: 0.75,
    lakeMoistureThreshold: 0.7,
  },
  smoothing: {
    groupTolerance: 1,
    minGroupDifference: 2,
  },
  rivers: {
    minSources: 3,
    maxSources: 5,
    sourceMinElevation: 0.55,
    sourceMinSpacing: 5,
    minRiverLength: 3,
    wideRiverMinLength: 8,
    wideRiverFraction: 0.6,
    lakeMinSize: 3,
    lakeMaxSize: 6,
  },
  settlements: {
    cityDensity: 3 / 1200,
    townDensity: 8 / 1200,
    minCityDistance: 8,
    minTownDistance: 3,
    riverBonusCity: 3,
    waterBonusCity: 2,
    plainsBonusCity: 1,
  },
  roads: {
    infrastructure: 'none',
    plainsCost: 1,
    forestCost: 2,
    hillsCost: 3,
    marshCost: 3,
    riverCost: 6,
    cityConnectionDistance: 20,
  },
};
```

Keep the old `MapConfig` interface for now — it will be removed in a later task.

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/core/map/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/map/types.ts src/core/map/__tests__/types.test.ts
git commit -m "feat: add GenerationParams type with all configurable map parameters"
```

---

## Task 2: Update TerrainGenerator to accept TerrainParams + SeaSides

**Files:**
- Modify: `src/core/map/TerrainGenerator.ts`
- Modify: `src/core/map/__tests__/TerrainGenerator.test.ts`

**Step 1: Update the tests**

Replace the test file to test the new signature. Key changes:
- `generate()` now takes `(width, height, terrainParams, seaSides, seed)` instead of `(width, height, geography, seed)`
- `assignTerrain()` now takes `(elevation, moisture, terrainParams)` instead of `(elevation, moisture, geography)`
- Add test for sea-side falloff: a map with `west: false` should have land terrain on the west edge

```typescript
import { describe, expect, it } from 'vitest';
import { TerrainGenerator } from '../TerrainGenerator';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';

const defaultTerrain = DEFAULT_GENERATION_PARAMS.terrain;
const allSea = DEFAULT_GENERATION_PARAMS.seaSides;
const smallWidth = 40;
const smallHeight = 30;

describe('TerrainGenerator', () => {
  describe('generate', () => {
    it('returns a cell for every hex in bounds', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, defaultTerrain, allSea, 12345);
      expect(cells.size).toBe(smallWidth * smallHeight);
    });

    it('assigns valid terrain types to all cells', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, defaultTerrain, allSea, 12345);
      const validTerrains = new Set(Object.values(TerrainType));
      for (const cell of cells.values()) {
        expect(validTerrains.has(cell.terrain)).toBe(true);
      }
    });

    it('elevation values are in 0-1 range', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, defaultTerrain, allSea, 12345);
      for (const cell of cells.values()) {
        expect(cell.elevation).toBeGreaterThanOrEqual(0);
        expect(cell.elevation).toBeLessThanOrEqual(1);
      }
    });

    it('is deterministic with same seed', () => {
      const a = TerrainGenerator.generate(smallWidth, smallHeight, defaultTerrain, allSea, 99);
      const b = TerrainGenerator.generate(smallWidth, smallHeight, defaultTerrain, allSea, 99);
      for (const [key, cellA] of a) {
        const cellB = b.get(key)!;
        expect(cellA.terrain).toBe(cellB.terrain);
        expect(cellA.elevation).toBe(cellB.elevation);
      }
    });

    it('respects sea side = false (land continues to edge)', () => {
      const noWestSea = { ...allSea, west: false };
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, defaultTerrain, noWestSea, 42);
      // Check west-edge cells (q=0) — should have more land than with all-sea
      const allSeaCells = TerrainGenerator.generate(smallWidth, smallHeight, defaultTerrain, allSea, 42);
      let landCountNoWest = 0;
      let landCountAllSea = 0;
      for (const cell of cells.values()) {
        if (cell.coord.q === 0 && cell.terrain !== TerrainType.Water) landCountNoWest++;
      }
      for (const cell of allSeaCells.values()) {
        if (cell.coord.q === 0 && cell.terrain !== TerrainType.Water) landCountAllSea++;
      }
      expect(landCountNoWest).toBeGreaterThan(landCountAllSea);
    });
  });

  describe('assignTerrain', () => {
    it('returns Water for low elevation', () => {
      expect(TerrainGenerator.assignTerrain(0.1, 0.5, defaultTerrain)).toBe(TerrainType.Water);
    });

    it('returns Mountain for high elevation', () => {
      expect(TerrainGenerator.assignTerrain(0.9, 0.5, defaultTerrain)).toBe(TerrainType.Mountain);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/core/map/__tests__/TerrainGenerator.test.ts`
Expected: FAIL — wrong number of arguments

**Step 3: Update TerrainGenerator implementation**

Replace `TerrainGenerator.ts` with:
- `generate(width, height, params: TerrainParams, seaSides: SeaSides, seed: number)`
- `sampleElevation` uses `params.elevationScaleLarge/Medium/Detail`, `params.noiseWeightLarge/Medium/Detail`, `params.falloffStrength`
- Edge falloff per side: for each sea side, apply falloff proportional to proximity to that edge. For non-sea sides, no falloff on that edge. Multiply all active falloffs together.
- `sampleMoisture` uses `params.moistureScale`
- `assignTerrain(elevation, moisture, params: TerrainParams)` uses `params.waterThreshold`, `params.coastalThreshold`, etc.

Key change for sea-side falloff in `sampleElevation`:
```typescript
// Per-edge falloff: only apply falloff on sea sides
const nx = coord.q / width;        // 0..1 from west to east
const ny = row / height;           // 0..1 from north to south
let falloff = 1.0;
const strength = params.falloffStrength;

if (seaSides.west) {
  falloff *= Math.min(1, (nx / 0.3) ** strength);
}
if (seaSides.east) {
  falloff *= Math.min(1, ((1 - nx) / 0.3) ** strength);
}
if (seaSides.north) {
  falloff *= Math.min(1, (ny / 0.3) ** strength);
}
if (seaSides.south) {
  falloff *= Math.min(1, ((1 - ny) / 0.3) ** strength);
}
value *= falloff;
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/core/map/__tests__/TerrainGenerator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/map/TerrainGenerator.ts src/core/map/__tests__/TerrainGenerator.test.ts
git commit -m "feat: TerrainGenerator accepts TerrainParams + SeaSides with per-edge falloff"
```

---

## Task 3: Update RiverGenerator to accept RiverParams

**Files:**
- Modify: `src/core/map/RiverGenerator.ts`
- Modify: `src/core/map/__tests__/RiverGenerator.test.ts`

**Step 1: Update signature**

Change `generate(cells, width, height, seed)` → `generate(cells, width, height, seed, params: RiverParams)`.

Replace all top-level constants (`MIN_RIVER_LENGTH`, `MIN_SOURCES`, etc.) with reads from `params`. Pass `params` through to private methods that need the values.

**Step 2: Update tests to use new signature**

All calls to `RiverGenerator.generate(...)` need the 5th argument: `DEFAULT_GENERATION_PARAMS.rivers`.

**Step 3: Run tests, verify pass**

Run: `bun run test -- src/core/map/__tests__/RiverGenerator.test.ts`

**Step 4: Commit**

```bash
git add src/core/map/RiverGenerator.ts src/core/map/__tests__/RiverGenerator.test.ts
git commit -m "feat: RiverGenerator accepts RiverParams for configurable river generation"
```

---

## Task 4: Update SmoothingPass to accept SmoothingParams

**Files:**
- Modify: `src/core/map/SmoothingPass.ts`
- Modify: `src/core/map/__tests__/SmoothingPass.test.ts`

**Step 1: Update signature**

Change `apply(cells, width, height)` → `apply(cells, width, height, params: SmoothingParams)`.

Use `params.groupTolerance` instead of hardcoded `1`, `params.minGroupDifference` instead of hardcoded `2`.

**Step 2: Update tests**

All calls need the 4th argument: `DEFAULT_GENERATION_PARAMS.smoothing`.

**Step 3: Run tests, verify pass, commit**

```bash
git add src/core/map/SmoothingPass.ts src/core/map/__tests__/SmoothingPass.test.ts
git commit -m "feat: SmoothingPass accepts SmoothingParams"
```

---

## Task 5: Update SettlementPlacer to accept SettlementParams

**Files:**
- Modify: `src/core/map/SettlementPlacer.ts`
- Modify: `src/core/map/__tests__/SettlementPlacer.test.ts`

**Step 1: Update signature**

Change `place(cells, width, height)` → `place(cells, width, height, params: SettlementParams)`.

Use `params.cityDensity`, `params.townDensity`, `params.minCityDistance`, `params.minTownDistance`, `params.riverBonusCity`, `params.waterBonusCity`, `params.plainsBonusCity` instead of hardcoded constants.

Remove top-level constants.

**Step 2: Update tests, run, commit**

```bash
git add src/core/map/SettlementPlacer.ts src/core/map/__tests__/SettlementPlacer.test.ts
git commit -m "feat: SettlementPlacer accepts SettlementParams"
```

---

## Task 6: Update RoadGenerator to accept RoadParams

**Files:**
- Modify: `src/core/map/RoadGenerator.ts`
- Modify: `src/core/map/__tests__/RoadGenerator.test.ts`

**Step 1: Update signature**

Change `generate(cells, width, height, infrastructure)` → `generate(cells, width, height, params: RoadParams)`.

Build `TERRAIN_COST` dynamically from `params.plainsCost`, `params.forestCost`, etc. Keep `Mountain: Infinity` and `Water: Infinity` as non-configurable.

Use `params.cityConnectionDistance` instead of hardcoded `20`.

Use `params.infrastructure` instead of the old `infrastructure` parameter.

Pass the dynamic cost record into `astar` as a parameter.

**Step 2: Update tests, run, commit**

```bash
git add src/core/map/RoadGenerator.ts src/core/map/__tests__/RoadGenerator.test.ts
git commit -m "feat: RoadGenerator accepts RoadParams"
```

---

## Task 7: Update MapGenerator to use GenerationParams

**Files:**
- Modify: `src/core/map/MapGenerator.ts`
- Modify: `src/core/map/__tests__/MapGenerator.test.ts`

**Step 1: Update MapGenerator**

Replace the entire class:
- Remove `MAP_SIZES` constant
- Change `generate(config: MapConfig)` → `generate(params: GenerationParams)`
- Use `params.width` and `params.height` directly
- Pass `params.terrain`, `params.seaSides`, `params.seed` to TerrainGenerator
- Pass `params.rivers` to RiverGenerator
- Pass `params.smoothing` to SmoothingPass
- Pass `params.settlements` to SettlementPlacer
- Pass `params.roads` to RoadGenerator

```typescript
import { RiverGenerator } from './RiverGenerator';
import { RoadGenerator } from './RoadGenerator';
import { SettlementPlacer } from './SettlementPlacer';
import { SmoothingPass } from './SmoothingPass';
import { TerrainGenerator } from './TerrainGenerator';
import type { GameMap, GenerationParams } from './types';

export const MAP_SIZE_PRESETS = {
  small: { width: 200, height: 150 },
  medium: { width: 300, height: 225 },
  large: { width: 400, height: 300 },
} as const;

export class MapGenerator {
  static generate(params: GenerationParams): GameMap {
    const { width, height } = params;

    const cells = TerrainGenerator.generate(
      width, height, params.terrain, params.seaSides, params.seed,
    );

    RiverGenerator.generate(cells, width, height, params.seed, params.rivers);

    SmoothingPass.apply(cells, width, height, params.smoothing);

    SettlementPlacer.place(cells, width, height, params.settlements);

    const { roads, railways } = RoadGenerator.generate(cells, width, height, params.roads);

    return { width, height, cells, roads, railways };
  }
}
```

**Step 2: Update tests**

Replace all `MapGenerator.generate(config)` calls with `MapGenerator.generate(params)` using `DEFAULT_GENERATION_PARAMS`. Update size assertions to new values (200×150 for default).

**Step 3: Run all tests**

Run: `bun run test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/core/map/MapGenerator.ts src/core/map/__tests__/MapGenerator.test.ts
git commit -m "feat: MapGenerator uses GenerationParams, x5 map sizes"
```

---

## Task 8: Catmull-Rom spline utility

**Files:**
- Create: `src/ui/spline.ts`
- Create: `src/ui/__tests__/spline.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { catmullRomToBezier } from '../spline';

describe('catmullRomToBezier', () => {
  it('returns empty array for fewer than 2 points', () => {
    expect(catmullRomToBezier([{ x: 0, y: 0 }])).toEqual([]);
  });

  it('returns one segment for 2 points (straight line)', () => {
    const segments = catmullRomToBezier([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(segments).toHaveLength(1);
    // Start and end should match input points
    expect(segments[0].p0).toEqual({ x: 0, y: 0 });
    expect(segments[0].p3).toEqual({ x: 10, y: 0 });
  });

  it('returns N-1 segments for N points', () => {
    const points = [
      { x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: -5 }, { x: 30, y: 0 },
    ];
    const segments = catmullRomToBezier(points);
    expect(segments).toHaveLength(3);
  });

  it('segments connect end-to-end', () => {
    const points = [
      { x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: -5 },
    ];
    const segments = catmullRomToBezier(points);
    expect(segments[0].p3.x).toBeCloseTo(segments[1].p0.x);
    expect(segments[0].p3.y).toBeCloseTo(segments[1].p0.y);
  });

  it('first segment starts at first point', () => {
    const points = [{ x: 5, y: 10 }, { x: 15, y: 20 }, { x: 25, y: 10 }];
    const segments = catmullRomToBezier(points);
    expect(segments[0].p0).toEqual({ x: 5, y: 10 });
  });

  it('last segment ends at last point', () => {
    const points = [{ x: 5, y: 10 }, { x: 15, y: 20 }, { x: 25, y: 10 }];
    const segments = catmullRomToBezier(points);
    expect(segments[segments.length - 1].p3).toEqual({ x: 25, y: 10 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/ui/__tests__/spline.test.ts`
Expected: FAIL

**Step 3: Implement spline utility**

```typescript
// src/ui/spline.ts

export interface Point {
  x: number;
  y: number;
}

export interface BezierSegment {
  p0: Point; // start
  p1: Point; // control 1
  p2: Point; // control 2
  p3: Point; // end
}

/**
 * Convert a polyline to cubic Bezier segments via Catmull-Rom interpolation.
 * The curve passes through all input points.
 * Tension is fixed at 0.5 (standard Catmull-Rom).
 */
export function catmullRomToBezier(points: Point[]): BezierSegment[] {
  if (points.length < 2) return [];

  const segments: BezierSegment[] = [];

  // Extend with virtual endpoints for open curve
  const extended = [
    // Mirror first point
    { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y },
    ...points,
    // Mirror last point
    {
      x: 2 * points[points.length - 1].x - points[points.length - 2].x,
      y: 2 * points[points.length - 1].y - points[points.length - 2].y,
    },
  ];

  // Convert each 4-point window to a cubic Bezier
  for (let i = 0; i < extended.length - 3; i++) {
    const p0 = extended[i];
    const p1 = extended[i + 1];
    const p2 = extended[i + 2];
    const p3 = extended[i + 3];

    // Catmull-Rom to cubic Bezier control points (alpha = 0.5)
    segments.push({
      p0: { x: p1.x, y: p1.y },
      p1: {
        x: p1.x + (p2.x - p0.x) / 6,
        y: p1.y + (p2.y - p0.y) / 6,
      },
      p2: {
        x: p2.x - (p3.x - p1.x) / 6,
        y: p2.y - (p3.y - p1.y) / 6,
      },
      p3: { x: p2.x, y: p2.y },
    });
  }

  return segments;
}
```

**Step 4: Run tests, verify pass**

Run: `bun run test -- src/ui/__tests__/spline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ui/spline.ts src/ui/__tests__/spline.test.ts
git commit -m "feat: add Catmull-Rom to Bezier spline utility"
```

---

## Task 9: Update RouteLayer to use Bezier curves

**Files:**
- Modify: `src/ui/layers/RouteLayer.ts`

**Step 1: Rewrite RouteLayer**

Replace straight-line drawing with Bezier curves:

- `drawRoads()`: convert hex points → `catmullRomToBezier()` → draw dashed Bezier curves
- `drawRailways()`: convert hex points → `catmullRomToBezier()` → draw smooth Bezier main line + ties perpendicular to tangent
- `drawBridges()`: unchanged (positioned at hex centers, not affected by curves)

For dashed Bezier curves, sample the Bezier at regular intervals to approximate dash pattern:

```typescript
private drawDashedBezier(segments: BezierSegment[], dashLen: number, gapLen: number): void {
  // Sample all segments into a polyline at fine resolution
  const sampledPoints: Point[] = [];
  for (const seg of segments) {
    const steps = 10; // samples per segment
    for (let t = 0; t <= steps; t++) {
      const u = t / steps;
      sampledPoints.push(cubicBezierPoint(seg, u));
    }
  }
  // Draw dashes along the sampled polyline
  // (reuse existing dash logic on the dense polyline)
}
```

For railways, use PixiJS `bezierCurveTo`:
```typescript
this.graphics.moveTo(segments[0].p0.x, segments[0].p0.y);
for (const seg of segments) {
  this.graphics.bezierCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y);
}
this.graphics.stroke({ width: RAILWAY_WIDTH, color: RAILWAY_COLOR });
```

For ties on curved railways, compute tangent at each sample point and draw perpendicular.

**Step 2: Visually verify in browser**

Run: `bun run dev`
Navigate to localhost:3000, generate a map, inspect that roads are smooth curves and railways have curved tracks with perpendicular ties.

**Step 3: Commit**

```bash
git add src/ui/layers/RouteLayer.ts
git commit -m "feat: render roads and railways as smooth Bezier curves"
```

---

## Task 10: Build the collapsible sidebar UI

**Files:**
- Create: `src/ui/Sidebar.ts`
- Remove usage of: `src/ui/GeneratorToolbar.ts` (keep file, remove in Task 12)

This is the largest task. The sidebar is a DOM element (like GeneratorToolbar) positioned on the right side.

**Step 1: Create `src/ui/Sidebar.ts`**

Structure:
```typescript
import type { GenerationParams } from '@core/map/types';
import { DEFAULT_GENERATION_PARAMS } from '@core/map/types';
import { MAP_SIZE_PRESETS } from '@core/map/MapGenerator';

export class Sidebar {
  private element: HTMLDivElement;
  private collapsed: boolean = false;
  private onGenerate: (params: GenerationParams) => void;
  private currentParams: GenerationParams;

  constructor(
    parent: HTMLElement,
    initialParams: GenerationParams,
    onGenerate: (params: GenerationParams) => void,
  ) { /* ... */ }

  /** Read current UI state into a GenerationParams object */
  getParams(): GenerationParams { /* ... */ }

  /** Set all UI controls from a GenerationParams object */
  setParams(params: GenerationParams): void { /* ... */ }

  destroy(): void { /* ... */ }
}
```

**DOM structure:**
```
sidebar-container (position: fixed, right: 0, top: 0, bottom: 0, width: 300px)
├── toggle-tab (position: absolute, left: -24px, clickable arrow tab)
├── header (Generate + Reset buttons, always visible)
└── scroll-container (overflow-y: auto)
    ├── section: Presets
    │   └── dropdown + save/delete buttons
    ├── section: Map Size
    │   └── preset dropdown, width slider+input, height slider+input, seed+dice
    ├── section: Coastline
    │   └── visual rectangle with 4 clickable sides
    ├── section: Terrain
    │   └── geography dropdown + all sliders
    ├── section: Smoothing
    │   └── 2 sliders
    ├── section: Rivers
    │   └── 9 sliders
    ├── section: Settlements
    │   └── 7 sliders
    └── section: Roads
        └── infrastructure dropdown + 6 sliders
```

**Styling:**
- Dark theme: `background: rgba(15, 15, 25, 0.92)`
- Font: 12px system font, `color: #ccc`
- Section headers: clickable, `color: #eee`, `font-weight: 600`, toggle icon `▸`/`▾`
- Sliders: custom CSS (dark track, light thumb)
- Inputs: `width: 60px`, `background: #2a2a3e`, `color: #eee`
- `z-index: 20` (above debug overlay)

**Helper methods to reduce repetition:**
```typescript
private createSection(title: string, collapsed?: boolean): { header: HTMLDivElement; content: HTMLDivElement }
private createSlider(label: string, min: number, max: number, step: number, value: number): { slider: HTMLInputElement; input: HTMLInputElement }
private createSelect(label: string, options: string[], value: string): HTMLSelectElement
```

**Coastline control:**
A small `<div>` with CSS borders representing a rectangle. Each side is a `<div>` absolutely positioned over that edge, styled blue (sea) or dark (land). Click toggles.

**Step 2: Visually verify**

Run dev server, check sidebar appears, collapses/expands, sliders work, coastline control toggles, Generate button calls callback.

**Step 3: Commit**

```bash
git add src/ui/Sidebar.ts
git commit -m "feat: add collapsible sidebar with all generation parameters"
```

---

## Task 11: Implement preset system

**Files:**
- Create: `src/ui/presets.ts`

**Step 1: Write tests**

Create `src/ui/__tests__/presets.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { BUILT_IN_PRESETS, loadCustomPresets, saveCustomPreset, deleteCustomPreset } from '../presets';
import { DEFAULT_GENERATION_PARAMS } from '@core/map/types';

describe('presets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has 6 built-in presets', () => {
    expect(Object.keys(BUILT_IN_PRESETS)).toHaveLength(6);
  });

  it('Default preset matches DEFAULT_GENERATION_PARAMS', () => {
    const { seed, ...defaultWithoutSeed } = DEFAULT_GENERATION_PARAMS;
    const { seed: _, ...presetWithoutSeed } = BUILT_IN_PRESETS['Default'];
    expect(presetWithoutSeed).toEqual(defaultWithoutSeed);
  });

  it('can save and load custom presets', () => {
    const custom = { ...DEFAULT_GENERATION_PARAMS, width: 999 };
    saveCustomPreset('My Preset', custom);
    const loaded = loadCustomPresets();
    expect(loaded['My Preset'].width).toBe(999);
  });

  it('can delete custom presets', () => {
    saveCustomPreset('Temp', DEFAULT_GENERATION_PARAMS);
    deleteCustomPreset('Temp');
    const loaded = loadCustomPresets();
    expect(loaded['Temp']).toBeUndefined();
  });
});
```

**Step 2: Implement presets module**

```typescript
// src/ui/presets.ts
import type { GenerationParams } from '@core/map/types';
import { DEFAULT_GENERATION_PARAMS } from '@core/map/types';

const STORAGE_KEY = 'supplyline-custom-presets';

export const BUILT_IN_PRESETS: Record<string, GenerationParams> = {
  Default: { ...DEFAULT_GENERATION_PARAMS },
  Archipelago: {
    ...DEFAULT_GENERATION_PARAMS,
    terrain: {
      ...DEFAULT_GENERATION_PARAMS.terrain,
      waterThreshold: 0.35,
      coastalThreshold: 0.45,
      moistureScale: 0.12,
    },
    rivers: {
      ...DEFAULT_GENERATION_PARAMS.rivers,
      minSources: 5,
      maxSources: 10,
    },
    seaSides: { north: true, south: true, east: true, west: true },
  },
  Continental: {
    ...DEFAULT_GENERATION_PARAMS,
    terrain: {
      ...DEFAULT_GENERATION_PARAMS.terrain,
      waterThreshold: 0.1,
      coastalThreshold: 0.2,
    },
    rivers: {
      ...DEFAULT_GENERATION_PARAMS.rivers,
      minSources: 2,
      maxSources: 3,
    },
    seaSides: { north: false, south: false, east: false, west: true },
  },
  Peninsula: {
    ...DEFAULT_GENERATION_PARAMS,
    roads: { ...DEFAULT_GENERATION_PARAMS.roads, infrastructure: 'basic' },
    seaSides: { north: true, south: true, east: true, west: false },
  },
  'Mountain Fortress': {
    ...DEFAULT_GENERATION_PARAMS,
    terrain: {
      ...DEFAULT_GENERATION_PARAMS.terrain,
      geography: 'mountainous',
      highlandThreshold: 0.55,
    },
    settlements: {
      ...DEFAULT_GENERATION_PARAMS.settlements,
      cityDensity: 2 / 1200,
      townDensity: 4 / 1200,
      minCityDistance: 12,
    },
  },
  'River Delta': {
    ...DEFAULT_GENERATION_PARAMS,
    terrain: {
      ...DEFAULT_GENERATION_PARAMS.terrain,
      waterThreshold: 0.25,
      lowlandThreshold: 0.6,
      lakeMoistureThreshold: 0.55,
      moistureScale: 0.12,
    },
    rivers: {
      ...DEFAULT_GENERATION_PARAMS.rivers,
      minSources: 6,
      maxSources: 12,
      wideRiverMinLength: 5,
      wideRiverFraction: 0.7,
      lakeMinSize: 4,
      lakeMaxSize: 10,
    },
  },
};

export function loadCustomPresets(): Record<string, GenerationParams> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCustomPreset(name: string, params: GenerationParams): void {
  const existing = loadCustomPresets();
  existing[name] = { ...params };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function deleteCustomPreset(name: string): void {
  const existing = loadCustomPresets();
  delete existing[name];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}
```

**Step 3: Run tests, verify pass**

Run: `bun run test -- src/ui/__tests__/presets.test.ts`

**Step 4: Wire presets into Sidebar**

In `Sidebar.ts`, the Presets section:
- Dropdown lists all built-in + custom preset names
- Selecting a preset calls `setParams(preset)` on all controls
- "Save" button prompts for name via `prompt()`, calls `saveCustomPreset()`
- "Delete" button only enabled for custom presets, calls `deleteCustomPreset()`
- When any parameter changes, dropdown shows "Custom"

**Step 5: Commit**

```bash
git add src/ui/presets.ts src/ui/__tests__/presets.test.ts src/ui/Sidebar.ts
git commit -m "feat: preset system with 6 built-in + custom localStorage presets"
```

---

## Task 12: Wire Sidebar into Game.ts, remove GeneratorToolbar

**Files:**
- Modify: `src/game/Game.ts`
- Delete contents of: `src/ui/GeneratorToolbar.ts` (or remove file and barrel export)
- Modify: `src/ui/index.ts` (update barrel export)

**Step 1: Update Game.ts**

Replace:
```typescript
import { GeneratorToolbar } from '@ui/GeneratorToolbar';
```
with:
```typescript
import { Sidebar } from '@ui/Sidebar';
```

Replace:
```typescript
private toolbar: GeneratorToolbar | null = null;
```
with:
```typescript
private sidebar: Sidebar | null = null;
```

In `init()`:
```typescript
this.sidebar = new Sidebar(container, this.currentParams, (params) => this.onGenerate(params));
```

Change `currentConfig: MapConfig` → `currentParams: GenerationParams`:
```typescript
private currentParams: GenerationParams = { ...DEFAULT_GENERATION_PARAMS };
```

Update `generateMap`:
```typescript
private generateMap(params: GenerationParams): void {
  this.mapRenderer?.destroy();
  this.map = MapGenerator.generate(params);
  this.mapRenderer = new MapRenderer(this.app, this.map);
  this.currentParams = params;
}
```

Update `onGenerate`:
```typescript
private onGenerate(params: GenerationParams): void {
  this.generateMap(params);
}
```

Update `destroy()` to destroy `sidebar` instead of `toolbar`.

**Step 2: Delete GeneratorToolbar**

Remove `src/ui/GeneratorToolbar.ts` or empty it. Update `src/ui/index.ts` to export `Sidebar` instead.

**Step 3: Run full quality check**

Run: `bun run check`
Expected: lint + typecheck + tests all pass

**Step 4: Visually verify**

Run: `bun run dev`
- Sidebar visible on right, collapsible
- All parameter sections expand/collapse
- Coastline control works (toggle sides)
- Presets load correctly
- Generate creates a map with the configured parameters
- Reset Defaults restores all values
- Bottom toolbar is gone

**Step 5: Commit**

```bash
git add src/game/Game.ts src/ui/Sidebar.ts src/ui/index.ts
git rm src/ui/GeneratorToolbar.ts
git commit -m "feat: replace bottom toolbar with sidebar, wire GenerationParams through Game"
```

---

## Task 13: Remove old MapConfig, final cleanup

**Files:**
- Modify: `src/core/map/types.ts` — remove `MapConfig` interface if no longer used
- Check: all imports referencing `MapConfig` are updated
- Modify: `src/ui/index.ts` — ensure barrel exports are correct

**Step 1: Search for remaining MapConfig references**

Run: grep for `MapConfig` across the codebase. Remove the interface and all references.

**Step 2: Run full quality check**

Run: `bun run check`
Expected: ALL PASS

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: remove deprecated MapConfig, clean up exports"
```

---

## Summary of execution order

| Task | Description | Depends on |
|------|-------------|------------|
| 1 | GenerationParams types + defaults | — |
| 2 | TerrainGenerator accepts params + sea sides | 1 |
| 3 | RiverGenerator accepts params | 1 |
| 4 | SmoothingPass accepts params | 1 |
| 5 | SettlementPlacer accepts params | 1 |
| 6 | RoadGenerator accepts params | 1 |
| 7 | MapGenerator wires GenerationParams | 2, 3, 4, 5, 6 |
| 8 | Spline utility | — |
| 9 | RouteLayer Bezier rendering | 8 |
| 10 | Sidebar UI | 1 |
| 11 | Preset system | 1, 10 |
| 12 | Wire into Game.ts | 7, 9, 10, 11 |
| 13 | Remove old MapConfig | 12 |

**Tasks 2-6 can run in parallel** (all depend only on Task 1).
**Tasks 8-9 can run in parallel with Tasks 2-6** (independent rendering concern).
**Task 10 can start after Task 1** (only needs types).
