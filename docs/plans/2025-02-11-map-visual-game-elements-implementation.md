# Map Visual Game Elements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all 6 visual game elements (territory, front line, NATO units, depot resource bars, route health + flow particles, vehicles) with mock data so the map looks like a living battlefield.

**Architecture:** A `MockSimulation` module generates coherent mock state (territory ownership per hex, military units, depot resource levels, route health, vehicle positions). New render layers consume this state. Static layers rebuild on state change; animated layers update every frame. All wired through MapRenderer with Sidebar toggles.

**Tech Stack:** TypeScript, PixiJS v8 (Graphics API), existing spline/hex utilities, seeded RNG.

**Design doc:** `docs/plans/2025-02-11-map-visual-game-elements-design.md`

---

## Task 1: Mock Types & Territory Generation

**Files:**
- Create: `src/core/mock/types.ts`
- Create: `src/core/mock/MockSimulation.ts`
- Create: `src/core/mock/__tests__/MockSimulation.test.ts`

**Step 1: Write mock types**

Create `src/core/mock/types.ts` with all types the mock simulation produces:

```typescript
import type { HexCoord, RoutePath } from '@core/map/types';
import type { ResourceStorage } from '@data/types';

export type Faction = 'allied' | 'enemy';

export type UnitType = 'infantry' | 'armor' | 'artillery';

export interface MockUnit {
  id: string;
  name: string;
  faction: Faction;
  type: UnitType;
  coord: HexCoord;
  supplies: ResourceStorage; // 0-1 each (percentage)
}

export type FacilityKind = 'depot' | 'factory' | 'railHub';

export interface MockFacility {
  id: string;
  kind: FacilityKind;
  coord: HexCoord;
  size: 'large' | 'small';
  storage: ResourceStorage;     // 0-1 each
  damaged: boolean;
}

export type RouteHealth = 'good' | 'congested' | 'stressed' | 'destroyed';

export interface MockRouteState {
  route: RoutePath;
  health: RouteHealth;
}

export interface MockVehicle {
  id: string;
  type: 'truck' | 'train';
  routeIndex: number;       // index into roads[] or railways[]
  t: number;                // 0-1 position along spline
  speed: number;            // px/s
  direction: 1 | -1;       // forward or return trip
}

export interface MockState {
  territory: Map<string, Faction>;  // hex key → faction
  frontLineEdges: Array<{ a: HexCoord; b: HexCoord }>; // edges between factions
  units: MockUnit[];
  facilities: MockFacility[];
  routeStates: MockRouteState[];
  vehicles: MockVehicle[];
  version: number;          // increments on state change (for rebuild detection)
}
```

**Step 2: Write failing tests for territory generation**

Create `src/core/mock/__tests__/MockSimulation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { MockSimulation } from '../MockSimulation';
import type { GameMap } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { HexGrid } from '@core/map/HexGrid';

function createMiniMap(): GameMap {
  const cells = new Map<string, any>();
  // 10x10 grid of plains
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 10; row++) {
      const q = col;
      const r = row - Math.floor(col / 2);
      const key = HexGrid.key({ q, r });
      cells.set(key, {
        coord: { q, r },
        terrain: TerrainType.Plains,
        elevation: 0.5,
        moisture: 0.5,
        urbanClusterId: null,
      });
    }
  }
  return {
    width: 10,
    height: 10,
    seed: 42,
    cells,
    urbanClusters: [],
    supplyHubs: [
      { coord: { q: 2, r: 2 }, size: 'large' },
      { coord: { q: 7, r: 2 }, size: 'large' },
      { coord: { q: 1, r: 5 }, size: 'small' },
    ],
    roads: [{ hexes: [{ q: 2, r: 2 }, { q: 3, r: 2 }, { q: 4, r: 2 }], type: 'road' }],
    railways: [{ hexes: [{ q: 2, r: 2 }, { q: 3, r: 1 }, { q: 4, r: 1 }], type: 'railway' }],
  };
}

describe('MockSimulation', () => {
  describe('init', () => {
    it('assigns territory to all land hexes', () => {
      const sim = new MockSimulation(createMiniMap());
      const state = sim.state;
      // Every non-water, non-mountain hex should have a faction
      for (const [key, cell] of sim['gameMap'].cells) {
        if (cell.terrain !== TerrainType.Water && cell.terrain !== TerrainType.Mountain) {
          expect(state.territory.has(key)).toBe(true);
        }
      }
    });

    it('creates both allied and enemy territory', () => {
      const sim = new MockSimulation(createMiniMap());
      const factions = new Set(sim.state.territory.values());
      expect(factions.has('allied')).toBe(true);
      expect(factions.has('enemy')).toBe(true);
    });

    it('generates front line edges between factions', () => {
      const sim = new MockSimulation(createMiniMap());
      expect(sim.state.frontLineEdges.length).toBeGreaterThan(0);
    });

    it('creates military units for both factions', () => {
      const sim = new MockSimulation(createMiniMap());
      const allied = sim.state.units.filter((u) => u.faction === 'allied');
      const enemy = sim.state.units.filter((u) => u.faction === 'enemy');
      expect(allied.length).toBeGreaterThan(0);
      expect(enemy.length).toBeGreaterThan(0);
    });

    it('creates facilities from supply hubs', () => {
      const sim = new MockSimulation(createMiniMap());
      expect(sim.state.facilities.length).toBe(3); // matches supplyHubs count
    });

    it('assigns route health to all routes', () => {
      const sim = new MockSimulation(createMiniMap());
      // roads + railways
      expect(sim.state.routeStates.length).toBe(2);
    });

    it('creates vehicles on active routes', () => {
      const sim = new MockSimulation(createMiniMap());
      expect(sim.state.vehicles.length).toBeGreaterThan(0);
    });
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `bun run test -- src/core/mock/__tests__/MockSimulation.test.ts`
Expected: FAIL — `MockSimulation` does not exist yet.

**Step 4: Implement MockSimulation — init only**

Create `src/core/mock/MockSimulation.ts`. This is the largest single file. Key logic:

- **Territory assignment**: compute the median q-column of all land hexes. Use a seeded noise function (reuse map seed) to create a wavy boundary ±2 columns around the median. Hexes left of boundary = allied, right = enemy. Water and mountain hexes are excluded from the territory map.
- **Front line detection**: iterate all territory hexes. For each hex, check 6 neighbors. If a neighbor has the opposite faction, that shared edge is a front line edge. Collect unique edges using canonical key `min(a,b)|max(a,b)`.
- **Unit placement**: find all land hexes within distance 1-3 of the front line. Randomly pick 8-12 positions on the allied side, 6-8 on the enemy side. Assign random unit types (infantry/armor/artillery). Allied units get random supply levels (some at 1.0, some 0.4-0.6, 1-2 below 0.2). Enemy units get flat 0.7.
- **Facilities**: map each `SupplyHub` to a `MockFacility`. Assign `kind` based on whether there's a railway connection (railHub), urban cluster (factory), or default (depot). Storage levels: compute distance from front line center — further back = higher (0.7-1.0), closer = lower (0.3-0.6). Mark 1-2 closest to front as damaged.
- **Route health**: for each road/railway, compute average q-position. Routes far from front = 'good', near = 'congested', crossing front = 'stressed'. Pick 1-2 and set 'destroyed'.
- **Vehicles**: for each non-destroyed route, create 2-4 vehicles (trucks for roads, trains for railways). Each vehicle gets a random starting `t` in [0,1), speed (trucks: 40px/s, trains: 25px/s), random initial direction.

Use the seeded RNG pattern from `src/core/map/rng.ts` for deterministic generation.

**Step 5: Run tests to verify they pass**

Run: `bun run test -- src/core/mock/__tests__/MockSimulation.test.ts`
Expected: All 7 tests PASS.

**Step 6: Commit**

```bash
git add src/core/mock/
git commit -m "feat: add MockSimulation with territory, units, facilities, routes, vehicles"
```

---

## Task 2: MockSimulation Update Loop

**Files:**
- Modify: `src/core/mock/MockSimulation.ts`
- Modify: `src/core/mock/__tests__/MockSimulation.test.ts`

**Step 1: Write failing tests for update**

Add to the test file:

```typescript
describe('update', () => {
  it('advances vehicle positions', () => {
    const sim = new MockSimulation(createMiniMap());
    const v = sim.state.vehicles[0];
    if (!v) return; // skip if no vehicles on mini map
    const oldT = v.t;
    sim.update(1 / 60); // one frame at 60fps
    expect(v.t).not.toBe(oldT);
  });

  it('increments version when front moves', () => {
    const sim = new MockSimulation(createMiniMap());
    const oldVersion = sim.state.version;
    // Force front movement by advancing 31 seconds
    for (let i = 0; i < 31 * 60; i++) {
      sim.update(1 / 60);
    }
    expect(sim.state.version).toBeGreaterThan(oldVersion);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/core/mock/__tests__/MockSimulation.test.ts`
Expected: FAIL — `update` method doesn't exist.

**Step 3: Implement update method**

Add `update(deltaSec: number)` to `MockSimulation`:

- **Every frame**: advance each vehicle's `t` by `(speed * deltaSec) / routeLength`. When `t` exceeds 1 or goes below 0, flip `direction` and clamp.
- **Accumulator timers**: track elapsed time for periodic updates.
  - `depotTimer` (resets at 2s): decrease storage of facilities near front by 0.01-0.03 per resource. Clamp to 0.
  - `unitTimer` (resets at 10s): randomly adjust each allied unit's supplies by ±0.05. Clamp [0, 1].
  - `frontTimer` (resets at 30s): pick 2-3 random front-line hexes, flip them to the other faction. Recompute front line edges. Increment `version`.

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/core/mock/__tests__/MockSimulation.test.ts`
Expected: All tests PASS.

**Step 5: Run full check**

Run: `bun run check`
Expected: PASS (lint + typecheck + tests).

**Step 6: Commit**

```bash
git add src/core/mock/
git commit -m "feat: add MockSimulation update loop with timers"
```

---

## Task 3: TerritoryLayer

**Files:**
- Create: `src/ui/layers/TerritoryLayer.ts`

**Step 1: Implement TerritoryLayer**

Follows the build-once-cache pattern from TerrainLayer. Constructor takes `GameMap` and territory `Map<string, Faction>`.

```typescript
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import type { Faction } from '@core/mock/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const ALLIED_COLOR = 0x4488cc;
const ENEMY_COLOR = 0xcc4444;
const TERRITORY_ALPHA = 0.15;

export class TerritoryLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;
  private territory: Map<string, Faction>;
  private builtVersion = -1;

  constructor(gameMap: GameMap, territory: Map<string, Faction>) {
    this.gameMap = gameMap;
    this.territory = territory;
    this.container.addChild(this.graphics);
  }

  /** Rebuild only if version changed */
  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();

    for (const [key, cell] of this.gameMap.cells) {
      if (cell.terrain === TerrainType.Water || cell.terrain === TerrainType.Mountain) continue;
      const faction = this.territory.get(key);
      if (!faction) continue;

      const px = HexRenderer.hexToPixel(cell.coord);
      const verts = HexRenderer.vertices(px.x, px.y);
      const flat = verts.flatMap((v) => [v.x, v.y]);

      const color = faction === 'allied' ? ALLIED_COLOR : ENEMY_COLOR;
      this.graphics.poly(flat);
      this.graphics.fill({ color, alpha: TERRITORY_ALPHA });
    }
  }

  updateData(territory: Map<string, Faction>): void {
    this.territory = territory;
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

Key differences from TerrainLayer:
- Uses `builtVersion` instead of boolean `built` flag — rebuilds when mock state version changes.
- `updateData()` allows swapping territory map without recreating the layer.
- Skips Water and Mountain hexes.
- Single pass: fill only, no stroke (the terrain borders beneath are sufficient).

**Step 2: Verify build compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/ui/layers/TerritoryLayer.ts
git commit -m "feat: add TerritoryLayer for faction territory overlay"
```

---

## Task 4: FrontLineLayer

**Files:**
- Create: `src/ui/layers/FrontLineLayer.ts`

**Step 1: Implement FrontLineLayer**

Draws a thick line along hex edges where factions meet. Uses `HexRenderer.edgeMidpoint()` to get the two vertices of each shared edge, then connects them.

```typescript
import type { HexCoord } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';
import { HexGrid } from '@core/map/HexGrid';

const LINE_COLOR = 0xffffff;
const LINE_BORDER_COLOR = 0x222222;
const LINE_WIDTH = 3;
const BORDER_WIDTH = 5;

export class FrontLineLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private builtVersion = -1;
  private edges: Array<{ a: HexCoord; b: HexCoord }> = [];

  constructor() {
    this.container.addChild(this.graphics);
  }

  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();

    // For each front line edge, draw a segment between the two shared vertices.
    // Two adjacent hexes share an edge. We need the two vertex positions of that edge.
    // HexGrid.edgeDirection(a, b) gives the edge index from a's perspective.
    // The edge vertices are vertex[edgeIdx] and vertex[(edgeIdx+1)%6].

    // Pass 1: dark border (wider)
    for (const { a, b } of this.edges) {
      const edgeIdx = HexGrid.edgeDirection(a, b);
      if (edgeIdx === null) continue;
      const center = HexRenderer.hexToPixel(a);
      const verts = HexRenderer.vertices(center.x, center.y);
      const v0 = verts[edgeIdx];
      const v1 = verts[(edgeIdx + 1) % 6];
      this.graphics.moveTo(v0.x, v0.y);
      this.graphics.lineTo(v1.x, v1.y);
    }
    this.graphics.stroke({ width: BORDER_WIDTH, color: LINE_BORDER_COLOR });

    // Pass 2: white line (thinner)
    for (const { a, b } of this.edges) {
      const edgeIdx = HexGrid.edgeDirection(a, b);
      if (edgeIdx === null) continue;
      const center = HexRenderer.hexToPixel(a);
      const verts = HexRenderer.vertices(center.x, center.y);
      const v0 = verts[edgeIdx];
      const v1 = verts[(edgeIdx + 1) % 6];
      this.graphics.moveTo(v0.x, v0.y);
      this.graphics.lineTo(v1.x, v1.y);
    }
    this.graphics.stroke({ width: LINE_WIDTH, color: LINE_COLOR });
  }

  updateData(edges: Array<{ a: HexCoord; b: HexCoord }>): void {
    this.edges = edges;
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

Key design:
- 2-pass drawing (dark border behind white line) for contrast on any terrain.
- Uses `HexGrid.edgeDirection` to find which edge index connects two adjacent hexes, then draws between that edge's two vertices.
- `builtVersion` pattern for rebuild-on-change.

**Step 2: Verify build compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/ui/layers/FrontLineLayer.ts
git commit -m "feat: add FrontLineLayer rendering front boundary"
```

---

## Task 5: UnitLayer — NATO Symbols

**Files:**
- Create: `src/ui/layers/UnitLayer.ts`

**Step 1: Implement UnitLayer**

Draws NATO-style unit symbols at each unit's hex position. Uses PixiJS Graphics for rectangles, lines, and circles. Text via PixiJS `Text` objects for unit names.

```typescript
import type { HexCoord } from '@core/map/types';
import type { MockUnit } from '@core/mock/types';
import { ResourceType } from '@data/types';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

// NATO box dimensions (in world pixels)
const BOX_W = 20;
const BOX_H = 14;
const BORDER_W = 1.5;

const ALLIED_BG = 0x3366aa;
const ENEMY_BG = 0xaa3333;
const BORDER_COLOR = 0x111111;

// Supply bar colors
const SUPPLY_COLORS: Record<string, number> = {
  [ResourceType.Fuel]: 0xccaa22,   // yellow
  [ResourceType.Ammo]: 0x666666,   // dark gray
  [ResourceType.Food]: 0x44aa44,   // green
  [ResourceType.Parts]: 0xcc8833,  // orange
};
const BAR_HEIGHT = 2;
const BAR_SEGMENT_W = 4;
const BAR_GAP = 1;

const LABEL_STYLE = new TextStyle({
  fontSize: 6,
  fill: 0xdddddd,
  fontFamily: 'monospace',
});
```

Structure:
- Main container holds a Graphics for boxes/symbols and a child Container for text labels.
- `build(version)` pattern — rebuilds when mock state version changes.
- For each unit:
  1. Draw filled rectangle (faction color) with dark border at hex center.
  2. Draw unit type symbol inside: X lines for infantry, circle for armor, filled dot for artillery.
  3. For allied units only: draw 4 small colored bars below the rectangle showing supply levels. Pulsation handled by separate `update(dt)` method that modulates alpha on a sine wave when supplies < 0.4.
  4. Small text label below with unit name.
- Enemy units rendered at 60% alpha, no supply bars.

**Step 2: Verify build compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/ui/layers/UnitLayer.ts
git commit -m "feat: add UnitLayer with NATO symbols and supply bars"
```

---

## Task 6: Refactor SupplyHubLayer — Facility Icons + Resource Bars

**Files:**
- Modify: `src/ui/layers/SupplyHubLayer.ts`

**Step 1: Refactor SupplyHubLayer**

Replace simple circles with facility icons and 4 resource bars. The layer now takes `MockFacility[]` in addition to `GameMap`.

Constructor signature changes to:
```typescript
constructor(gameMap: GameMap, facilities: MockFacility[])
```

New constants:
```typescript
const LARGE_SIZE = 10;  // half-width of large icon
const SMALL_SIZE = 6;
const ICON_BG = 0xd4c8a0;
const ICON_BORDER = 0x2a2a35;
const DAMAGE_COLOR = 0xcc3333;

const BAR_W = 2;
const BAR_H = 10;
const BAR_GAP = 1;
const BAR_COLORS = {
  fuel: 0xccaa22,
  ammo: 0x666666,
  food: 0x44aa44,
  parts: 0xcc8833,
};
```

Build logic per facility:
1. Draw square background (size depends on large/small).
2. Draw icon symbol inside based on `kind`:
   - **depot**: cross (two perpendicular lines)
   - **factory**: small gear (circle with 4 short radial lines)
   - **railHub**: two parallel horizontal lines with short perpendicular ticks
3. Draw 4 vertical resource bars above the icon. Each bar: dark background rect (full height) + colored foreground rect (height = level * BAR_H, drawn from bottom up).
4. If `damaged`: semi-transparent red overlay on the icon + small "X" mark.

Uses `builtVersion` pattern — rebuilds when mock version changes (resource levels change).

Add `updateData(facilities: MockFacility[])` method.

**Step 2: Verify build compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/ui/layers/SupplyHubLayer.ts
git commit -m "feat: refactor SupplyHubLayer with facility icons and resource bars"
```

---

## Task 7: RouteLayer — Health Colors

**Files:**
- Modify: `src/ui/layers/RouteLayer.ts`

**Step 1: Modify RouteLayer to accept route health data**

Add constructor parameter and `updateData` method:
```typescript
constructor(gameMap: GameMap, routeHealthMap?: Map<number, RouteHealth>)
```

The `routeHealthMap` maps route index (position in `gameMap.roads` or `gameMap.railways`) to a health state. The layer uses this to pick fill colors.

New constants:
```typescript
const HEALTH_COLORS: Record<RouteHealth, number> = {
  good: 0x4a8c3f,
  congested: 0xc8a832,
  stressed: 0xb83a3a,
  destroyed: 0x666666,
};
```

Changes to `drawRoads` and `drawRailways`:
- Pass 1 (border): keep dark border color unchanged.
- Pass 2 (fill): if `routeHealthMap` has an entry for this route's index, use `HEALTH_COLORS[health]` instead of the static `ROAD_FILL_COLOR` / `RAILWAY_FILL_COLOR`.
- Destroyed routes: draw with dashed appearance (skip every other Bezier segment) or just use gray.
- Railway crossties: use health color instead of static color.

The layer changes from `built` boolean to `builtVersion` number to support rebuilds when health changes.

**Step 2: Verify build compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/ui/layers/RouteLayer.ts
git commit -m "feat: add route health colors to RouteLayer"
```

---

## Task 8: FlowLayer — Animated Supply Particles

**Files:**
- Create: `src/ui/layers/FlowLayer.ts`

**Step 1: Implement FlowLayer**

This replaces/extends the existing RouteAnimator concept but specifically for supply flow visualization. It reuses spline evaluation from `spline.ts`.

Key differences from RouteAnimator:
- **White semi-transparent particles** (not route-colored) — `0xffffff` at alpha 0.6.
- **Density varies by route health**: good = 6-8 particles, congested = 3-4, stressed = 1-2, destroyed = 0.
- **Speed**: ~60px/s on good routes, ~40px/s on congested, ~20px/s on stressed.
- **Stressed routes**: particles move in bursts — groups of 2-3 with gaps, achieved by spawning particles in clusters with `t` offsets of 0.02-0.03 and leaving 0.3-0.4 gaps between clusters.
- **Particle size**: 2px circles.
- Zoom threshold: hidden below 0.4x.

Constructor:
```typescript
constructor(getZoom: () => number)
```

Methods:
- `init(roadSplines, railwaySplines, routeHealths)` — create particles based on health.
- `update(ticker: Ticker)` — advance particles, clear & redraw. Same pattern as RouteAnimator.

**Step 2: Verify build compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/ui/layers/FlowLayer.ts
git commit -m "feat: add FlowLayer with health-aware supply particles"
```

---

## Task 9: VehicleLayer — Moving Trucks & Trains

**Files:**
- Create: `src/ui/layers/VehicleLayer.ts`

**Step 1: Implement VehicleLayer**

Per-frame animated layer drawing vehicle shapes along route splines.

Constants:
```typescript
const TRUCK_W = 6;
const TRUCK_H = 4;
const TRUCK_CAB_W = 2;
const TRUCK_COLOR = 0x8b7355;
const TRUCK_CAB_COLOR = 0x6b5335;

const TRAIN_W = 10;
const TRAIN_H = 4;
const WAGON_W = 7;
const WAGON_GAP = 1;
const TRAIN_COLOR = 0x555566;
const WAGON_COLOR = 0x666677;

const MIN_ZOOM_FOR_VEHICLES = 0.5;
```

Constructor:
```typescript
constructor(getZoom: () => number)
```

Methods:
- `init(roadSplines, railwaySplines, vehicles: MockVehicle[])` — store references.
- `update(ticker: Ticker, vehicles: MockVehicle[])` — each frame:
  1. If zoom < 0.5, clear and return.
  2. Clear graphics.
  3. For each vehicle:
     - Evaluate position on spline at `vehicle.t`.
     - Evaluate position at `vehicle.t + 0.01` to compute tangent angle.
     - Draw rotated shape at position:
       - **Truck**: small rectangle (body) + smaller rectangle (cab) in front based on direction.
       - **Train**: longer rectangle (engine) + 1-2 smaller rectangles (wagons) trailing behind (at `t - 0.03` and `t - 0.06`).
     - Use `this.graphics.setTransform()` or manual rotation math to orient along tangent.

Vehicle rotation: compute `angle = Math.atan2(dy, dx)` from position to next position. Draw shapes relative to center, rotated by angle. Since PixiJS v8 Graphics doesn't have per-shape transforms, use trig to compute rotated corner positions manually:
```typescript
function rotatedRect(cx, cy, w, h, angle): number[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = w / 2, hh = h / 2;
  // Return 4 corners as flat array
  return [
    cx + cos * (-hw) - sin * (-hh), cy + sin * (-hw) + cos * (-hh),
    cx + cos * (hw) - sin * (-hh),  cy + sin * (hw) + cos * (-hh),
    cx + cos * (hw) - sin * (hh),   cy + sin * (hw) + cos * (hh),
    cx + cos * (-hw) - sin * (hh),  cy + sin * (-hw) + cos * (hh),
  ];
}
```

**Step 2: Verify build compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/ui/layers/VehicleLayer.ts
git commit -m "feat: add VehicleLayer with animated trucks and trains"
```

---

## Task 10: Wire Everything — MapRenderer + Sidebar + Game

**Files:**
- Modify: `src/ui/MapRenderer.ts`
- Modify: `src/ui/Sidebar.ts`
- Modify: `src/game/Game.ts`

This is the integration task. Three files change.

**Step 1: Update LayerName type and MapRenderer**

In `MapRenderer.ts`:

1. Expand `LayerName`:
```typescript
export type LayerName =
  | 'terrain' | 'territory' | 'routes' | 'flows' | 'vehicles'
  | 'supplyHubs' | 'frontLine' | 'units' | 'selection';
```

2. Add imports for new layers and MockSimulation.

3. Add new fields:
```typescript
private territoryLayer: TerritoryLayer;
private flowLayer: FlowLayer;
private vehicleLayer: VehicleLayer;
private frontLineLayer: FrontLineLayer;
private unitLayer: UnitLayer;
private mockSim: MockSimulation;
private lastMockVersion = -1;
```

4. In constructor, after creating existing layers and before `this.camera.attach()`:
   - Create `MockSimulation` from gameMap.
   - Create `TerritoryLayer` with gameMap and mock territory.
   - Create `FrontLineLayer`, call `updateData` with front edges.
   - Modify `SupplyHubLayer` construction to pass mock facilities.
   - Create `FlowLayer` and `VehicleLayer`.
   - Create `UnitLayer` with mock units.
   - Add all containers to worldContainer in correct order:
     ```
     terrainLayer → territoryLayer → routeLayer → flowLayer → vehicleLayer
     → supplyHubLayer → frontLineLayer → unitLayer → selectionLayer
     ```
   - Remove the old `routeAnimator` — FlowLayer replaces it.

5. Update `onFrame()`:
```typescript
private onFrame(): void {
  const dt = this.app.ticker.deltaMS / 1000;

  // Update mock simulation
  if (!this.isPaused) {
    this.mockSim.update(dt);
  }

  // Rebuild static layers if mock state version changed
  if (this.mockSim.state.version !== this.lastMockVersion) {
    this.lastMockVersion = this.mockSim.state.version;
    this.territoryLayer.updateData(this.mockSim.state.territory);
    this.territoryLayer.build(this.lastMockVersion);
    this.frontLineLayer.updateData(this.mockSim.state.frontLineEdges);
    this.frontLineLayer.build(this.lastMockVersion);
    this.unitLayer.updateData(this.mockSim.state.units);
    this.unitLayer.build(this.lastMockVersion);
    this.supplyHubLayer.updateData(this.mockSim.state.facilities);
    this.supplyHubLayer.build(this.lastMockVersion);
  }

  // Per-frame animated layers
  this.flowLayer.update(this.app.ticker);
  this.vehicleLayer.update(this.app.ticker, this.mockSim.state.vehicles);
  this.unitLayer.update(dt); // for supply bar pulsation
}
```

6. Update `setLayerVisible` and `layerContainer` to handle new layer names.

7. Update `destroy()` to clean up all new layers.

**Step 2: Update Sidebar**

In `Sidebar.ts`, add 5 new entries to the layers array in `buildLayersSection`:

```typescript
const layers: { key: LayerName; label: string }[] = [
  { key: 'terrain', label: 'Terrain' },
  { key: 'territory', label: 'Territory' },
  { key: 'routes', label: 'Routes' },
  { key: 'flows', label: 'Flows' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'supplyHubs', label: 'Supply Hubs' },
  { key: 'frontLine', label: 'Front Line' },
  { key: 'units', label: 'Units' },
  { key: 'selection', label: 'Selection' },
];
```

**Step 3: Update Game.ts**

Minimal changes — MapRenderer now handles MockSimulation internally. The `isPaused` state needs to be communicated to MapRenderer. Add:

```typescript
// In Game constructor or init, pass isPaused state:
this.mapRenderer.setPaused(this.isPaused);

// In pause toggle handler:
this.mapRenderer?.setPaused(this.isPaused);
```

Add `setPaused(paused: boolean)` method to MapRenderer.

**Step 4: Verify everything compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 5: Run all tests**

Run: `bun run check`
Expected: PASS (lint + typecheck + all tests).

**Step 6: Commit**

```bash
git add src/ui/MapRenderer.ts src/ui/Sidebar.ts src/game/Game.ts
git commit -m "feat: wire all visual game elements into MapRenderer"
```

---

## Task 11: Visual Verification & Polish

**Files:**
- Various — based on what needs adjusting

**Step 1: Run dev server and visually verify**

Run: `bun run dev`

Check in browser:
1. Territory tints visible (blue left, red right)?
2. Front line visible as white line along hex edges?
3. NATO unit symbols near front line?
4. Supply bars under allied units with some pulsing?
5. Facility icons with resource bars at supply hubs?
6. Routes colored green/yellow/red/gray?
7. White particles flowing along routes?
8. Trucks on roads, trains on railways, moving?
9. All sidebar toggles work (9 checkboxes)?
10. Pause (Space) stops simulation updates?
11. Map regeneration rebuilds everything correctly?

**Step 2: Fix any visual issues**

Common issues to watch for:
- Layer ordering wrong → adjust `addChild` order in MapRenderer constructor.
- Colors too bright/dark → tweak alpha values and color constants.
- Particles too fast/slow → adjust speed constants.
- Vehicles jittering → ensure tangent calculation uses small enough epsilon.
- Front line has gaps → check edge detection logic handles all 6 directions.
- Supply bars too small at low zoom → consider scaling or hiding below threshold.

**Step 3: Run final quality check**

Run: `bun run check`
Expected: PASS.

**Step 4: Commit any polish changes**

```bash
git add -A
git commit -m "fix: visual polish for game element layers"
```

---

## Task Summary

| # | Task | Creates/Modifies | Estimated Complexity |
|---|------|-----------------|---------------------|
| 1 | MockSimulation init | 3 new files | Large |
| 2 | MockSimulation update | 2 files | Medium |
| 3 | TerritoryLayer | 1 new file | Small |
| 4 | FrontLineLayer | 1 new file | Small |
| 5 | UnitLayer (NATO) | 1 new file | Medium |
| 6 | SupplyHubLayer refactor | 1 file | Medium |
| 7 | RouteLayer health colors | 1 file | Small |
| 8 | FlowLayer | 1 new file | Medium |
| 9 | VehicleLayer | 1 new file | Medium |
| 10 | Wire everything | 3 files | Large |
| 11 | Visual verification | Various | Small |

**Dependencies:** Tasks 1-2 (MockSimulation) must come first. Tasks 3-9 (layers) can be built in any order but depend on mock types from Task 1. Task 10 (wiring) depends on all prior tasks. Task 11 depends on Task 10.
