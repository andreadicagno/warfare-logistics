# Supply Line System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the separate road/railway systems into a single SupplyLine concept with 5 upgradeable levels, updating types, generation, rendering, simulation, and UI.

**Architecture:** Replace `RoutePath` with `SupplyLine` (adding level, state, capacity, flow fields). Collapse `GameMap.roads[]` + `GameMap.railways[]` into `GameMap.supplyLines[]`. Rename `RoadGenerator` → `SupplyLineGenerator`, `RouteLayer` → `SupplyLineLayer`. All generated lines start at level 1. The mock simulation assigns random levels for visual demo purposes.

**Tech Stack:** TypeScript, PixiJS v8, Vitest, Biome v2

**Design doc:** `docs/plans/2025-02-11-supply-line-system-design.md`

---

### Task 1: Update Core Types

**Files:**
- Modify: `src/core/map/types.ts`

**Step 1: Write the failing test**

Add test to `src/core/map/__tests__/types.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DEFAULT_GENERATION_PARAMS, SUPPLY_LINE_CAPACITY } from '../types';
import type { SupplyLine } from '../types';

describe('SupplyLine types', () => {
  it('SUPPLY_LINE_CAPACITY has 5 levels with progressive scaling', () => {
    expect(SUPPLY_LINE_CAPACITY).toHaveLength(5);
    for (let i = 1; i < SUPPLY_LINE_CAPACITY.length; i++) {
      expect(SUPPLY_LINE_CAPACITY[i]).toBeGreaterThan(SUPPLY_LINE_CAPACITY[i - 1]);
    }
  });

  it('SUPPLY_LINE_CAPACITY matches design values', () => {
    expect(SUPPLY_LINE_CAPACITY).toEqual([10, 25, 60, 150, 400]);
  });

  it('SupplyLine interface supports required fields', () => {
    const line: SupplyLine = {
      hexes: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      level: 1,
      state: 'active',
      buildProgress: 1,
      flow: 0,
      capacity: 10,
    };
    expect(line.level).toBe(1);
    expect(line.state).toBe('active');
  });

  it('DEFAULT_GENERATION_PARAMS uses supplyLines key', () => {
    expect(DEFAULT_GENERATION_PARAMS.supplyLines).toBeDefined();
    expect((DEFAULT_GENERATION_PARAMS as any).roads).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- --run src/core/map/__tests__/types.test.ts`
Expected: FAIL — `SUPPLY_LINE_CAPACITY` and `SupplyLine` don't exist yet.

**Step 3: Update types**

In `src/core/map/types.ts`:

1. Replace `RoutePath` interface (lines 40-43) with:
```typescript
export type SupplyLineLevel = 1 | 2 | 3 | 4 | 5;
export type SupplyLineState = 'active' | 'upgrading' | 'building';

export interface SupplyLine {
  hexes: HexCoord[];
  level: SupplyLineLevel;
  state: SupplyLineState;
  buildProgress: number; // 0-1
  flow: number;
  capacity: number;
}

export const SUPPLY_LINE_CAPACITY: readonly [number, number, number, number, number] = [10, 25, 60, 150, 400];
```

2. Replace `GameMap` (lines 45-54) — change `roads` + `railways` to single `supplyLines`:
```typescript
export interface GameMap {
  width: number;
  height: number;
  seed: number;
  cells: Map<string, HexCell>;
  urbanClusters: UrbanCluster[];
  supplyHubs: SupplyHub[];
  supplyLines: SupplyLine[];
}
```

3. Rename `RoadParams` → `SupplyLineParams` (lines 109-121), remove railway-specific fields:
```typescript
export interface SupplyLineParams {
  infrastructure: 'none' | 'basic' | 'developed';
  plainsCost: number;
  forestCost: number;
  hillsCost: number;
  marshCost: number;
  riverCost: number;
  urbanCost: number;
  cityConnectionDistance: number;
  redundancy: number; // extra edges beyond MST
  reuseCost: number; // cost multiplier for reusing existing edges
}
```

4. In `GenerationParams` (line 132): rename `roads: RoadParams` → `supplyLines: SupplyLineParams`.

5. In `DEFAULT_GENERATION_PARAMS` (lines 182-194): rename `roads:` → `supplyLines:`, update field names:
```typescript
supplyLines: {
  infrastructure: 'developed',
  plainsCost: 1,
  forestCost: 2,
  hillsCost: 3,
  marshCost: 3,
  riverCost: 6,
  urbanCost: 1,
  cityConnectionDistance: 20,
  redundancy: 2,
  reuseCost: 0.1,
},
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- --run src/core/map/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/map/types.ts src/core/map/__tests__/types.test.ts
git commit -m "feat: replace RoutePath with SupplyLine types"
```

---

### Task 2: Rename RoadGenerator → SupplyLineGenerator

**Files:**
- Rename: `src/core/map/RoadGenerator.ts` → `src/core/map/SupplyLineGenerator.ts`
- Modify: `src/core/map/SupplyLineGenerator.ts`
- Modify: `src/core/map/__tests__/RoadGenerator.test.ts` → `src/core/map/__tests__/SupplyLineGenerator.test.ts`

**Step 1: Rename the file**

```bash
git mv src/core/map/RoadGenerator.ts src/core/map/SupplyLineGenerator.ts
git mv src/core/map/__tests__/RoadGenerator.test.ts src/core/map/__tests__/SupplyLineGenerator.test.ts
```

**Step 2: Update the generator**

In `src/core/map/SupplyLineGenerator.ts`:

1. Update import: `RoadParams` → `SupplyLineParams`, `RoutePath` → `SupplyLine`, add `SUPPLY_LINE_CAPACITY`.
2. Rename class `RoadGenerator` → `SupplyLineGenerator`.
3. Change `generate()` return type from `{ roads: RoutePath[]; railways: RoutePath[] }` to `SupplyLine[]`.
4. Update `generate()` body:
   - The internal `buildRailways()` and `buildRoads()` methods remain as-is (they produce `HexCoord[][]` paths internally).
   - At the output (lines 108-117), merge all paths into a single `SupplyLine[]`, all at level 1:
   ```typescript
   const allPaths = [
     ...RoadGenerator.mergePathsIntoNetwork(roads.map((r) => r.hexes)),
     ...RoadGenerator.mergePathsIntoNetwork(railways.map((r) => r.hexes)),
   ];
   const result = allPaths.map((hexes) => ({
     hexes,
     level: 1 as const,
     state: 'active' as const,
     buildProgress: 1,
     flow: 0,
     capacity: SUPPLY_LINE_CAPACITY[0],
   }));
   ```
5. Update `params: RoadParams` → `params: SupplyLineParams` in method signatures.
6. Replace `params.railwayRedundancy` → `params.redundancy`, `params.roadReuseCost` and `params.railwayReuseCost` → `params.reuseCost`.
7. Make `astar()` public (it's already used in tests).

**Step 3: Update the test file**

In `src/core/map/__tests__/SupplyLineGenerator.test.ts`:

1. Update imports: `RoadGenerator` → `SupplyLineGenerator`, `RoadParams` → `SupplyLineParams`.
2. Replace all test bodies to work with `SupplyLine[]` instead of `{ roads, railways }`:
   - `'produces supply lines'` — expects array length > 0
   - `'all lines are level 1'` — check `.level === 1` on all
   - `'all lines are active'` — check `.state === 'active'` on all
   - `'paths contain only adjacent hexes'` — same adjacency check
   - `'lines avoid mountains and water'` — same terrain check
   - `'produces more lines with developed infrastructure'` — compare line counts
   - Keep A* tests as-is (they test the static method directly)

**Step 4: Run tests**

Run: `bun run test -- --run src/core/map/__tests__/SupplyLineGenerator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename RoadGenerator to SupplyLineGenerator"
```

---

### Task 3: Update MapGenerator

**Files:**
- Modify: `src/core/map/MapGenerator.ts`
- Modify: `src/core/map/__tests__/MapGenerator.test.ts`

**Step 1: Update MapGenerator**

In `src/core/map/MapGenerator.ts`:

1. Change import: `RoadGenerator` → `SupplyLineGenerator` (line 3).
2. Change generation call (lines 47-49):
   ```typescript
   const supplyLines = prof.measure('Supply line generation', () =>
     SupplyLineGenerator.generate(cells, width, height, params.supplyLines, urbanClusters),
   );
   ```
3. Update return (line 53):
   ```typescript
   return { width, height, seed: params.seed, cells, urbanClusters, supplyHubs, supplyLines };
   ```

**Step 2: Update MapGenerator tests**

In `src/core/map/__tests__/MapGenerator.test.ts`:

1. Replace `map.roads` references with `map.supplyLines`.
2. Remove railway-specific test — replace with:
   ```typescript
   it('produces supply lines', () => {
     const map = MapGenerator.generate(params);
     expect(map.supplyLines.length).toBeGreaterThan(0);
   });
   ```
3. In determinism test: `a.roads.length` → `a.supplyLines.length`.
4. In params: `roads: { ...DEFAULT_GENERATION_PARAMS.roads, infrastructure: 'basic' }` → `supplyLines: { ...DEFAULT_GENERATION_PARAMS.supplyLines, infrastructure: 'basic' }`.

**Step 3: Run tests**

Run: `bun run test -- --run src/core/map/__tests__/MapGenerator.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/map/MapGenerator.ts src/core/map/__tests__/MapGenerator.test.ts
git commit -m "refactor: wire SupplyLineGenerator into MapGenerator"
```

---

### Task 4: Update Mock Types

**Files:**
- Modify: `src/core/mock/types.ts`

**Step 1: Update MockRouteState**

Rename and update types:

1. `MockRouteState` → `MockSupplyLineState`:
   ```typescript
   export interface MockSupplyLineState {
     supplyLine: SupplyLine;
     health: RouteHealth;
   }
   ```
   Import `SupplyLine` instead of `RoutePath`.

2. `MockVehicle` — change `routeIndex` comment, keep the type/index pattern but base vehicle type on line level:
   ```typescript
   export interface MockVehicle {
     id: string;
     type: 'truck' | 'train';
     lineIndex: number; // index into GameMap.supplyLines[]
     t: number;
     speed: number;
     direction: 1 | -1;
   }
   ```

3. `AccessRamp` — remove `routeType` field (no longer needed):
   ```typescript
   export interface AccessRamp {
     facilityCoord: HexCoord;
     routeHexCoord: HexCoord;
   }
   ```

4. `MockState` — rename `routeStates: MockRouteState[]` → `supplyLineStates: MockSupplyLineState[]`:
   ```typescript
   export interface MockState {
     territory: Map<string, Faction>;
     frontLineEdges: Array<{ a: HexCoord; b: HexCoord }>;
     units: MockUnit[];
     formations: MockFormation[];
     facilities: MockFacility[];
     supplyLineStates: MockSupplyLineState[];
     vehicles: MockVehicle[];
     accessRamps: AccessRamp[];
     version: number;
   }
   ```

**Step 2: Commit**

```bash
git add src/core/mock/types.ts
git commit -m "refactor: update mock types for supply line system"
```

---

### Task 5: Update MockSimulation

**Files:**
- Modify: `src/core/mock/MockSimulation.ts`

This is the largest single change. The key modifications:

**Step 1: Update imports**

Change `RoutePath` → `SupplyLine`, `SUPPLY_LINE_CAPACITY` imports.

**Step 2: Update `assignRouteHealth()` → `assignSupplyLineHealth()`**

The method currently combines `this.map.roads` + `this.map.railways` into `allRoutes`. Change to iterate `this.map.supplyLines` directly. Assign random levels (1-5) for visual demo purposes. Push to `this.state.supplyLineStates` instead of `this.state.routeStates`.

Key changes:
- `const allRoutes: RoutePath[] = [...this.map.roads, ...this.map.railways]` → `const lines = this.map.supplyLines`
- Also assign random levels to each supply line for mock demo: `line.level = randomLevel; line.capacity = SUPPLY_LINE_CAPACITY[line.level - 1]`
- Push `{ supplyLine: line, health }` into `this.state.supplyLineStates`

**Step 3: Update `spawnVehicles()`**

- Iterate `this.state.supplyLineStates` instead of `this.state.routeStates`.
- Vehicle type based on supply line level: `level >= 4 ? 'train' : 'truck'`.
- `routeIndex` → `lineIndex`, referencing index in `supplyLines[]`.
- Use `this.map.supplyLines.indexOf(ss.supplyLine)` for index lookup.

**Step 4: Update `advanceVehicles()`**

- `this.map.roads[vehicle.routeIndex]` / `this.map.railways[vehicle.routeIndex]` → `this.map.supplyLines[vehicle.lineIndex]`.
- Remove truck/train branching for route lookup.

**Step 5: Update `computeAccessRamps()`**

- Combine road/railway hex lookup into single loop over `this.map.supplyLines`.
- Remove `routeType` from access ramp creation.
- Remove railway preference logic for railHub — all supply lines are equal.

**Step 6: Update `generateFacilities()`**

- `this.map.roads` + `this.map.railways` loops → single `this.map.supplyLines` loop.
- Remove `railwayCoords` set — use single `routeHexKeys` for all supply lines.
- For facility kind: use supply line level instead of road/railway distinction. If a hex is on a level 4+ supply line → `railHub`, else `depot`/`factory` as before.

**Step 7: Update state initialization**

- In constructor or `init()` method, initialize `state.supplyLineStates` instead of `state.routeStates`.

**Step 8: Run full test suite**

Run: `bun run test -- --run`
Expected: PASS (mock simulation has no dedicated tests, but MapGenerator tests exercise it indirectly)

**Step 9: Commit**

```bash
git add src/core/mock/MockSimulation.ts
git commit -m "refactor: update MockSimulation for supply line system"
```

---

### Task 6: Update SupplyLineLayer (rename RouteLayer)

**Files:**
- Rename: `src/ui/layers/RouteLayer.ts` → `src/ui/layers/SupplyLineLayer.ts`
- Modify: `src/ui/layers/SupplyLineLayer.ts`

**Step 1: Rename file**

```bash
git mv src/ui/layers/RouteLayer.ts src/ui/layers/SupplyLineLayer.ts
```

**Step 2: Rewrite the layer**

The key structural changes:

1. **Remove dual road/railway architecture**: No more `roadSplines` + `railwaySplines`. Single `splines: BezierSegment[][]` array indexed by supply line index.

2. **Remove shared edge logic**: `computeSharedEdges()` and `offsetPathPoints()` are deleted. All lines render at hex centers (no offset).

3. **Constructor**: takes `gameMap: GameMap`, `healths: Map<number, RouteHealth>`, `accessRamps: AccessRamp[]`.

4. **Single `computedSplines` getter** instead of `computedRoadSplines` + `computedRailwaySplines`.

5. **`build()` method**: Single loop over `gameMap.supplyLines`. For each line, convert to spline, then draw based on `level`:
   - Level 1 (Trail): dashed thin line, brown `0xc2a66c`, width 2
   - Level 2 (Road): solid line, tan `0xc2ae6c`, border `0x4a3f2f`, width 3/5
   - Level 3 (Dual carriageway): two parallel lines, grey `0x999999`, width 3 each offset ±2px
   - Level 4 (Railway): rail line with crossties, steel `0x8888a0`, border `0x2a2a35`, width 3/5
   - Level 5 (Logistics corridor): railway + road side by side, offset ±3px

6. **Health coloring**: Same `HEALTH_COLORS` map, applied to fill color per supply line index.

7. **Access ramps**: simplified — no `routeType` distinction. Use level 2 (road) styling for all ramps.

8. **`updateData()`**: takes single `healths: Map<number, RouteHealth>` instead of separate road/railway maps.

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: Errors in consumers (MapRenderer, etc.) — these are fixed in later tasks.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename RouteLayer to SupplyLineLayer with level-based rendering"
```

---

### Task 7: Update FlowLayer

**Files:**
- Modify: `src/ui/layers/FlowLayer.ts`

**Step 1: Simplify to single spline array**

1. Remove `routeType` from `FlowParticle` interface (line 39).
2. Remove `routeType` parameter from `createFlowParticles()` (line 73).
3. Replace `roadSplines` + `railwaySplines` with single `splines: BezierSegment[][]`.
4. Update `init()` to take single arrays:
   ```typescript
   init(
     splines: BezierSegment[][],
     healths: Map<number, RouteHealth>,
   ): void {
     this.splines = splines;
     this.particles = createFlowParticles(splines, healths);
   }
   ```
5. Update `update()` render loop (line 170): `p.routeType === 'road' ? this.roadSplines : this.railwaySplines` → `this.splines`.

**Step 2: Commit**

```bash
git add src/ui/layers/FlowLayer.ts
git commit -m "refactor: simplify FlowLayer to single spline array"
```

---

### Task 8: Update VehicleLayer

**Files:**
- Modify: `src/ui/layers/VehicleLayer.ts`

**Step 1: Simplify to single spline array**

1. Replace `roadSplines` + `railwaySplines` (lines 65-66) with `splines: BezierSegment[][]`.
2. Update `init()` (line 73) to take single array:
   ```typescript
   init(splines: BezierSegment[][]): void {
     this.splines = splines;
   }
   ```
3. Update `update()` (lines 86-89) — vehicle type now determines drawing style only, not which spline array:
   ```typescript
   const spline = this.splines[vehicle.lineIndex];
   ```
4. Import `MockVehicle` still uses `lineIndex` (updated in Task 4).

**Step 2: Commit**

```bash
git add src/ui/layers/VehicleLayer.ts
git commit -m "refactor: simplify VehicleLayer to single spline array"
```

---

### Task 9: Update MapRenderer

**Files:**
- Modify: `src/ui/MapRenderer.ts`

**Step 1: Update imports and wiring**

1. Import `SupplyLineLayer` instead of `RouteLayer` (line 11).
2. Rename `routeLayer` → `supplyLineLayer` field.
3. Update LayerName: `'routes'` → `'supplyLines'` (line 23).

**Step 2: Simplify health map construction**

Replace dual road/railway health maps (lines 68-79) with single:
```typescript
const healths = new Map<number, RouteHealth>();
for (let i = 0; i < this.mockSim.state.supplyLineStates.length; i++) {
  const ss = this.mockSim.state.supplyLineStates[i];
  const idx = gameMap.supplyLines.indexOf(ss.supplyLine);
  if (idx >= 0) healths.set(idx, ss.health);
}
```

**Step 3: Update layer construction**

```typescript
this.supplyLineLayer = new SupplyLineLayer(gameMap, healths, this.mockSim.state.accessRamps);
```

**Step 4: Update FlowLayer and VehicleLayer init**

```typescript
this.flowLayer.init(this.supplyLineLayer.computedSplines, healths);
this.vehicleLayer.init(this.supplyLineLayer.computedSplines);
```

**Step 5: Update layerContainer switch**

`case 'routes'` → `case 'supplyLines'`: return `this.supplyLineLayer.container`.

**Step 6: Update destroy**

`this.routeLayer.destroy()` → `this.supplyLineLayer.destroy()`.

**Step 7: Commit**

```bash
git add src/ui/MapRenderer.ts
git commit -m "refactor: wire SupplyLineLayer into MapRenderer"
```

---

### Task 10: Update Sidebar

**Files:**
- Modify: `src/ui/Sidebar.ts`

**Step 1: Rename roads section**

1. Rename `buildRoadsSection` → `buildSupplyLinesSection`.
2. Change section title from `'Roads'` to `'Supply Lines'`.
3. Remove `railwayRedundancy`, `roadReuseCost`, `railwayReuseCost` sliders.
4. Add `redundancy` and `reuseCost` sliders instead.
5. In `getParams()`: `roads: { ... }` → `supplyLines: { ... }`, use new field names.
6. In `setParams()`: `params.roads.xxx` → `params.supplyLines.xxx`, use new field names.
7. In layers list: `{ key: 'routes', label: 'Routes' }` → `{ key: 'supplyLines', label: 'Supply Lines' }`.

**Step 2: Commit**

```bash
git add src/ui/Sidebar.ts
git commit -m "refactor: update Sidebar for supply line params"
```

---

### Task 11: Update DebugOverlay and Game.ts

**Files:**
- Modify: `src/ui/DebugOverlay.ts`
- Modify: `src/game/Game.ts`

**Step 1: Simplify DebugInfo**

In `DebugOverlay.ts`:
1. Replace `hasRoad: boolean` + `hasRailway: boolean` with `supplyLineLevel: number | null`.
2. Update display: show `Supply Line: Lv3` or `Supply Line: —` instead of separate Road/Railway lines.

**Step 2: Update Game.ts**

In `Game.ts` (lines 120-131):
1. Replace road/railway check with:
   ```typescript
   let supplyLineLevel: number | null = null;
   if (cell) {
     const line = this.map.supplyLines.find((l) =>
       l.hexes.some((h) => h.q === hex.q && h.r === hex.r),
     );
     supplyLineLevel = line?.level ?? null;
   }
   ```
2. Update `DebugInfo` construction: `hasRoad, hasRailway` → `supplyLineLevel`.

**Step 3: Commit**

```bash
git add src/ui/DebugOverlay.ts src/game/Game.ts
git commit -m "refactor: update debug overlay for supply line info"
```

---

### Task 12: Update Game-Level Stub Types

**Files:**
- Modify: `src/data/types.ts`

**Step 1: Update stub types**

1. Replace `RouteType` enum with `SupplyLineLevel` (1-5) — or remove it entirely since the real type lives in `core/map/types.ts`.
2. Replace `Route` interface with simplified version referencing supply line concept.
3. Remove `RouteStatus` (replaced by `RouteHealth` in mock types).
4. Keep `VehicleType` as-is (truck/train still exist).

Since these are unused stubs, keep changes minimal — just align naming with the new system.

**Step 2: Commit**

```bash
git add src/data/types.ts
git commit -m "refactor: align stub types with supply line system"
```

---

### Task 13: Update Barrel Exports

**Files:**
- Modify: `src/core/index.ts`

**Step 1: Add SupplyLine export if needed**

If any consumer outside `core/` needs `SupplyLine` type, add to barrel:
```typescript
export type { SupplyLine, SupplyLineLevel } from './map/types';
```

**Step 2: Commit**

```bash
git add src/core/index.ts
git commit -m "refactor: update barrel exports for supply line types"
```

---

### Task 14: Run All Quality Gates

**Step 1: Run full check**

```bash
bun run check
```

This runs lint + typecheck + all tests.

**Step 2: Fix any issues**

Fix remaining type errors, unused imports, or test failures.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: fix lint and type errors after supply line refactor"
```

---

## Dependency Order

```
Task 1 (types) ← foundation for everything
  └─ Task 2 (generator) ← needs new types
     └─ Task 3 (MapGenerator) ← needs generator
  └─ Task 4 (mock types) ← needs SupplyLine type
     └─ Task 5 (MockSimulation) ← needs mock types + generator types
  └─ Task 6 (SupplyLineLayer) ← needs GameMap.supplyLines
  └─ Task 7 (FlowLayer) ← needs simplified spline API
  └─ Task 8 (VehicleLayer) ← needs simplified spline API
  └─ Task 9 (MapRenderer) ← needs all layers + mock types
  └─ Task 10 (Sidebar) ← needs SupplyLineParams
  └─ Task 11 (DebugOverlay + Game) ← needs GameMap.supplyLines
  └─ Task 12 (stub types) ← independent
  └─ Task 13 (barrel exports) ← needs final type names
  └─ Task 14 (quality gates) ← runs last
```

Tasks 6, 7, 8 can be done in parallel after Task 1.
Tasks 10, 11, 12, 13 can be done in parallel after Task 1.
Task 9 requires Tasks 5, 6, 7, 8 all complete.
Task 14 is always last.
