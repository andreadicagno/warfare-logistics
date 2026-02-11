# Mock Simulation Visual Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the mock simulation with 4 visual enhancements: territory gradient overlay, hierarchical military organization, supply hub access ramps, and supply flow particles.

**Architecture:** Each feature modifies specific layers of the existing system. Territory gradient changes `TerritoryLayer`. Military hierarchy rewrites `MockSimulation.placeUnits()` + new types + `UnitLayer` overhaul. Access ramps extend `MockSimulation` + `RouteLayer`. Supply flow is a new `SupplyFlowLayer`. All follow the existing versioned-rebuild pattern.

**Tech Stack:** TypeScript, PixiJS v8, Vitest

**Design doc:** `docs/plans/2025-02-11-mock-simulation-improvements-design.md`

---

## Task 1: Territory Gradient Overlay

**Goal:** Replace flat 15% alpha territory overlay with distance-based gradient (45% at front → 8% in rear).

**Files:**
- Modify: `src/ui/layers/TerritoryLayer.ts`

**Step 1: Update TerritoryLayer to accept front line edges**

The layer needs front line edge data to compute BFS distances. Change constructor and add `updateData` to also accept `frontLineEdges`.

In `src/ui/layers/TerritoryLayer.ts`, replace the entire file with:

```typescript
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import type { Faction } from '@core/mock/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const ALLIED_COLOR = 0x4488cc;
const ENEMY_COLOR = 0xcc4444;
const ALPHA_MAX = 0.45;
const ALPHA_MIN = 0.08;

export class TerritoryLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;
  private territory: Map<string, Faction>;
  private frontLineEdges: Array<{ a: HexCoord; b: HexCoord }>;
  private builtVersion = -1;

  constructor(
    gameMap: GameMap,
    territory: Map<string, Faction>,
    frontLineEdges: Array<{ a: HexCoord; b: HexCoord }> = [],
  ) {
    this.gameMap = gameMap;
    this.territory = territory;
    this.frontLineEdges = frontLineEdges;
    this.container.addChild(this.graphics);
  }

  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();

    const distanceMap = this.computeFrontDistances();

    for (const [key, cell] of this.gameMap.cells) {
      if (cell.terrain === TerrainType.Water || cell.terrain === TerrainType.Mountain) continue;
      const faction = this.territory.get(key);
      if (!faction) continue;

      const px = HexRenderer.hexToPixel(cell.coord);
      const verts = HexRenderer.vertices(px.x, px.y);
      const flat = verts.flatMap((v) => [v.x, v.y]);

      const normalizedDist = distanceMap.get(key) ?? 1;
      const alpha = ALPHA_MAX - normalizedDist * (ALPHA_MAX - ALPHA_MIN);
      const color = faction === 'allied' ? ALLIED_COLOR : ENEMY_COLOR;
      this.graphics.poly(flat);
      this.graphics.fill({ color, alpha });
    }
  }

  updateData(
    territory: Map<string, Faction>,
    frontLineEdges?: Array<{ a: HexCoord; b: HexCoord }>,
  ): void {
    this.territory = territory;
    if (frontLineEdges) {
      this.frontLineEdges = frontLineEdges;
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }

  /**
   * BFS from all front-line-adjacent hexes outward.
   * Returns a map of hex key → normalized distance (0 = front, 1 = farthest).
   */
  private computeFrontDistances(): Map<string, number> {
    const distances = new Map<string, number>();

    // Collect all hexes that touch the front line
    const frontHexKeys = new Set<string>();
    for (const edge of this.frontLineEdges) {
      frontHexKeys.add(HexGrid.key(edge.a));
      frontHexKeys.add(HexGrid.key(edge.b));
    }

    if (frontHexKeys.size === 0) {
      // No front line — everything at max distance
      for (const key of this.territory.keys()) {
        distances.set(key, 1);
      }
      return distances;
    }

    // BFS
    const queue: string[] = [];
    for (const key of frontHexKeys) {
      if (this.territory.has(key)) {
        distances.set(key, 0);
        queue.push(key);
      }
    }

    let maxDist = 0;
    let head = 0;
    while (head < queue.length) {
      const key = queue[head++];
      const dist = distances.get(key)!;
      const parts = key.split(',');
      const coord: HexCoord = { q: Number(parts[0]), r: Number(parts[1]) };

      for (const nb of HexGrid.neighbors(coord)) {
        const nbKey = HexGrid.key(nb);
        if (!this.territory.has(nbKey)) continue;
        if (distances.has(nbKey)) continue;

        const nbDist = dist + 1;
        distances.set(nbKey, nbDist);
        if (nbDist > maxDist) maxDist = nbDist;
        queue.push(nbKey);
      }
    }

    // Normalize to 0-1
    if (maxDist > 0) {
      for (const [key, dist] of distances) {
        distances.set(key, dist / maxDist);
      }
    }

    return distances;
  }
}
```

**Step 2: Update MapRenderer to pass frontLineEdges to TerritoryLayer**

In `src/ui/MapRenderer.ts`:

- Change constructor line 80 from:
  ```typescript
  this.territoryLayer = new TerritoryLayer(gameMap, this.mockSim.state.territory);
  ```
  to:
  ```typescript
  this.territoryLayer = new TerritoryLayer(
    gameMap,
    this.mockSim.state.territory,
    this.mockSim.state.frontLineEdges,
  );
  ```

- Change `onFrame()` line 289 from:
  ```typescript
  this.territoryLayer.updateData(this.mockSim.state.territory);
  ```
  to:
  ```typescript
  this.territoryLayer.updateData(
    this.mockSim.state.territory,
    this.mockSim.state.frontLineEdges,
  );
  ```

**Step 3: Run quality checks**

Run: `bun run check`
Expected: All checks pass.

**Step 4: Commit**

```bash
git add src/ui/layers/TerritoryLayer.ts src/ui/MapRenderer.ts
git commit -m "feat: territory overlay gradient based on front line distance"
```

---

## Task 2: Hierarchical Military Organization — Types & Simulation

**Goal:** Replace flat unit list with hierarchical Army→Corps→Division→Regiment→Battalion tree. ~30-80 battalions per faction covering the entire front.

**Files:**
- Modify: `src/core/mock/types.ts` — add hierarchy types
- Modify: `src/core/mock/MockSimulation.ts` — rewrite `placeUnits()`

### Step 1: Add hierarchy types to `src/core/mock/types.ts`

Add below the existing `MockUnit` interface (after line 15):

```typescript
export type Echelon = 'army' | 'corps' | 'division' | 'regiment' | 'battalion';

export interface MockFormation {
  id: string;
  name: string;
  echelon: Echelon;
  faction: Faction;
  hqCoord: HexCoord; // HQ position
  children: MockFormation[]; // sub-formations
  units: MockUnit[]; // only battalions have units (themselves); HQs point here too
}
```

Add `formations` to `MockState` (after `units` field):

```typescript
export interface MockState {
  territory: Map<string, Faction>;
  frontLineEdges: Array<{ a: HexCoord; b: HexCoord }>;
  units: MockUnit[];
  formations: MockFormation[]; // top-level armies (1 per faction)
  facilities: MockFacility[];
  routeStates: MockRouteState[];
  vehicles: MockVehicle[];
  version: number;
}
```

Also extend `MockUnit` with hierarchy info:

```typescript
export interface MockUnit {
  id: string;
  name: string;
  faction: Faction;
  type: UnitType;
  coord: HexCoord;
  supplies: ResourceStorage;
  echelon: Echelon; // 'battalion' for line units, others for HQs
  parentFormationId: string; // id of parent formation
  isHq: boolean; // true for HQ units (regiment+)
}
```

### Step 2: Rewrite `placeUnits()` in MockSimulation

Replace the entire `placeUnits()` method and add helper methods. The new approach:

1. Collect all allied and enemy front-line-adjacent hexes (distance 1 from front), sorted by position along the front (by pixel-Y of the hex).
2. Build the hierarchy tree: 1 army → 2-3 corps → 2-3 divisions each → 2-3 regiments each → 2-4 battalions each.
3. Divide the sorted front hexes into sectors assigned to each level of hierarchy.
4. Place battalions on front hexes (one per hex), reserve ~20% as regimental reserves (2-3 hex behind).
5. Place HQ units at appropriate depths behind their sectors.
6. Set supply levels based on distance from supply hubs.

The new method should:
- Initialize `this.state.formations = []`
- Build the tree
- Flatten all units into `this.state.units` (for backward compatibility with existing layers)
- Store formations in `this.state.formations`

Key algorithm for front hex collection:
```typescript
// Collect hexes at distance exactly 1 from front line on each side
// Sort by pixel-Y to get consistent ordering along the front
```

For sector division:
```typescript
// frontHexes sorted by pixel-Y
// Army gets all hexes
// Corps 1 gets first 1/numCorps, Corps 2 gets next chunk, etc.
// Same subdivision for divisions within each corps sector
```

Supply assignment:
```typescript
// Find nearest non-damaged facility for each unit
// distance < 5: well supplied (0.7-1.0)
// distance 5-10: medium (0.4-0.7)
// distance > 10 or no facility: low (0.1-0.3)
// Reserve units: boost +0.2 (capped at 1.0)
```

Also initialize `formations: []` in the constructor state initialization (line 39-47).

Also update `tickUnits()` to work with the new units (it already iterates `this.state.units` so it should work as-is, but verify).

Also update `tickFrontLine()` unit repositioning to work correctly with the new larger unit count.

### Step 3: Run quality checks

Run: `bun run check`
Expected: All checks pass.

### Step 4: Commit

```bash
git add src/core/mock/types.ts src/core/mock/MockSimulation.ts
git commit -m "feat: hierarchical military organization with battalions covering the front"
```

---

## Task 3: Hierarchical Military Visualization — UnitLayer

**Goal:** Render battalions (small NATO icons), HQ symbols (star/diamond), sector lines, and hierarchy labels.

**Files:**
- Modify: `src/ui/layers/UnitLayer.ts`

### Step 1: Rewrite UnitLayer rendering

The new UnitLayer needs to handle:

1. **Battalions** — small NATO icons (14x10), same type symbols as before (X, circle, dot)
2. **Regiment HQ** — small diamond (8x8), white border, faction-colored fill
3. **Division HQ** — medium diamond (12x12), with label
4. **Corps HQ** — large star (16x16), with label
5. **Sector lines** — thin dashed lines between division sectors (from front toward rear)

Key changes to constants:
```typescript
// Battalion box (smaller than current)
const BTN_W = 14;
const BTN_H = 10;

// HQ sizes by echelon
const HQ_SIZES: Record<string, number> = {
  regiment: 4,   // diamond half-size
  division: 6,
  corps: 8,
};
```

New drawing methods needed:
- `drawDiamond(cx, cy, halfSize, color, alpha)` — for regiment/division HQs
- `drawStar(cx, cy, halfSize, color, alpha)` — for corps HQ
- `drawSectorLines(formations)` — thin dashed lines at division sector boundaries

The `rebuildBoxes()` method should:
- For battalions (`!unit.isHq`): draw small NATO box with type symbol (same as before but smaller)
- For HQ units (`unit.isHq`): draw diamond (regiment/division) or star (corps) with label

The `rebuildLabels()` method should:
- Only label HQ units (not battalions, too cluttered)
- Show formation name: "II Corps", "3rd Div", "5th Rgt"

The `rebuildBars()` method should:
- Only show supply bars for battalions (not HQs)
- Same logic as before but with smaller `BAR_MAX_W = BTN_W`

### Step 2: Add sector line rendering

Add a new method `drawSectorLines()` that:
- Takes the `formations` array from MockState
- For each division boundary, draw a thin dashed semi-transparent line
- Line goes from the front line ~10 hexes into the rear
- Color: `0xffffff` at 15% alpha, dashed (alternating 4px drawn, 4px gap)

This requires access to `MockFormation` data. The layer needs a new `updateFormations()` method, and `MapRenderer` must pass it.

### Step 3: Update MapRenderer to pass formations

In `src/ui/MapRenderer.ts`, after `this.unitLayer.updateData(this.mockSim.state.units)`, add:
```typescript
this.unitLayer.updateFormations(this.mockSim.state.formations);
```

Both in constructor initialization (around line 108) and in `onFrame()` version-change block (around line 293).

### Step 4: Run quality checks

Run: `bun run check`
Expected: All checks pass.

### Step 5: Commit

```bash
git add src/ui/layers/UnitLayer.ts src/ui/MapRenderer.ts
git commit -m "feat: hierarchical unit visualization with HQ symbols and sector lines"
```

---

## Task 4: Supply Hub Access Ramps

**Goal:** Draw short curved road/railway segments connecting each supply hub to its nearest route.

**Files:**
- Modify: `src/core/mock/types.ts` — add ramp type
- Modify: `src/core/mock/MockSimulation.ts` — compute ramp data
- Modify: `src/ui/layers/RouteLayer.ts` — render ramps

### Step 1: Add ramp type

In `src/core/mock/types.ts`, add:

```typescript
export interface AccessRamp {
  facilityCoord: HexCoord;
  routeHexCoord: HexCoord; // nearest hex on the route
  routeType: 'road' | 'railway';
}
```

Add `accessRamps` to `MockState`:
```typescript
accessRamps: AccessRamp[];
```

### Step 2: Compute ramps in MockSimulation

Add a new method `computeAccessRamps()` called after `generateFacilities()` in the constructor.

Algorithm:
```typescript
private computeAccessRamps(): void {
  // For each facility:
  //   If facility coord is on a road/railway hex → skip (already connected)
  //   Find nearest road hex (distance ≤ 2) for depot/factory
  //   Find nearest railway hex (distance ≤ 2) for railHub (fallback to road)
  //   If found, create AccessRamp

  // Build sets of road and railway hex keys for fast lookup
  const roadHexes = new Map<string, HexCoord>();
  for (const road of this.map.roads) {
    for (const hex of road.hexes) {
      roadHexes.set(HexGrid.key(hex), hex);
    }
  }
  const railHexes = new Map<string, HexCoord>();
  for (const rw of this.map.railways) {
    for (const hex of rw.hexes) {
      railHexes.set(HexGrid.key(hex), hex);
    }
  }

  for (const facility of this.state.facilities) {
    const fKey = HexGrid.key(facility.coord);

    // Skip if already on a route
    if (roadHexes.has(fKey) || railHexes.has(fKey)) continue;

    // Determine target route type
    const preferRailway = facility.kind === 'railHub';
    const primarySet = preferRailway ? railHexes : roadHexes;
    const fallbackSet = preferRailway ? roadHexes : railHexes;
    const primaryType = preferRailway ? 'railway' : 'road';
    const fallbackType = preferRailway ? 'road' : 'railway';

    let bestCoord: HexCoord | null = null;
    let bestType: 'road' | 'railway' = primaryType;
    let bestDist = Infinity;

    // Search primary
    for (const [, coord] of primarySet) {
      const d = HexGrid.distance(facility.coord, coord);
      if (d <= 2 && d < bestDist) {
        bestDist = d;
        bestCoord = coord;
        bestType = primaryType;
      }
    }

    // Fallback if nothing found
    if (!bestCoord) {
      for (const [, coord] of fallbackSet) {
        const d = HexGrid.distance(facility.coord, coord);
        if (d <= 2 && d < bestDist) {
          bestDist = d;
          bestCoord = coord;
          bestType = fallbackType;
        }
      }
    }

    if (bestCoord) {
      this.state.accessRamps.push({
        facilityCoord: facility.coord,
        routeHexCoord: bestCoord,
        routeType: bestType,
      });
    }
  }
}
```

Initialize `accessRamps: []` in constructor state and call `this.computeAccessRamps()` after `this.generateFacilities()`.

### Step 3: Render ramps in RouteLayer

In `src/ui/layers/RouteLayer.ts`:

- Add `accessRamps` to constructor and `updateData()`
- Add `private accessRamps: AccessRamp[] = [];`
- In `build()`, after drawing roads and railways, call `this.drawAccessRamps()`
- `drawAccessRamps()`:
  ```typescript
  private drawAccessRamps(): void {
    for (const ramp of this.accessRamps) {
      const from = HexRenderer.hexToPixel(ramp.facilityCoord);
      const to = HexRenderer.hexToPixel(ramp.routeHexCoord);

      // Bézier control point offset perpendicular to the line
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      // Perpendicular offset for natural curve
      const offset = len * 0.2;
      const cx = mx - (dy / len) * offset;
      const cy = my + (dx / len) * offset;

      const isRailway = ramp.routeType === 'railway';
      const borderColor = isRailway ? RAILWAY_BORDER_COLOR : ROAD_BORDER_COLOR;
      const fillColor = isRailway ? RAILWAY_FILL_COLOR : ROAD_FILL_COLOR;
      const borderWidth = (isRailway ? RAILWAY_BORDER_WIDTH : ROAD_BORDER_WIDTH) * 0.7;
      const fillWidth = (isRailway ? RAILWAY_FILL_WIDTH : ROAD_FILL_WIDTH) * 0.7;

      // Border pass
      this.graphics.moveTo(from.x, from.y);
      this.graphics.quadraticCurveTo(cx, cy, to.x, to.y);
      this.graphics.stroke({ width: borderWidth, color: borderColor });

      // Fill pass
      this.graphics.moveTo(from.x, from.y);
      this.graphics.quadraticCurveTo(cx, cy, to.x, to.y);
      this.graphics.stroke({ width: fillWidth, color: fillColor });
    }
  }
  ```

### Step 4: Update MapRenderer to pass ramps to RouteLayer

In `src/ui/MapRenderer.ts`:
- Pass `this.mockSim.state.accessRamps` to RouteLayer constructor
- Pass in `updateData()` calls

### Step 5: Run quality checks

Run: `bun run check`
Expected: All checks pass.

### Step 6: Commit

```bash
git add src/core/mock/types.ts src/core/mock/MockSimulation.ts src/ui/layers/RouteLayer.ts src/ui/MapRenderer.ts
git commit -m "feat: supply hub access ramps connecting facilities to road/railway network"
```

---

## Task 5: Supply Flow Particles (Hub → Troops)

**Goal:** New `SupplyFlowLayer` showing gold arcing particles from supply hubs to troops within range, with flow proportional to supply demand.

**Files:**
- Create: `src/ui/layers/SupplyFlowLayer.ts`
- Modify: `src/ui/MapRenderer.ts` — add layer
- Modify: `src/ui/Sidebar.ts` — add toggle

### Step 1: Create SupplyFlowLayer

Create `src/ui/layers/SupplyFlowLayer.ts`:

```typescript
import { HexGrid } from '@core/map/HexGrid';
import type { MockFacility, MockUnit } from '@core/mock/types';
import { ResourceType } from '@data/types';
import { Container, Graphics, type Ticker } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const PARTICLE_RADIUS = 1.5;
const PARTICLE_COLOR = 0xddaa33;
const PARTICLE_DAMAGED_COLOR = 0xcc4433;
const PARTICLE_ALPHA = 0.5;
const MIN_ZOOM_FOR_SUPPLY_FLOW = 0.4;

/** Supply range by facility kind (in hex distance) */
const SUPPLY_RANGE: Record<string, number> = {
  depot: 8,
  railHub: 8,
  factory: 5,
};

/** Arc height as fraction of distance */
const ARC_HEIGHT_FACTOR = 0.15;

interface SupplyArc {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  arcMidX: number;
  arcMidY: number;
  distance: number; // pixel distance (for speed scaling)
  damaged: boolean;
  particles: number; // count based on demand
  baseSpeed: number; // px/s
}

interface SupplyParticle {
  arcIndex: number;
  t: number; // 0-1 along arc
}

function averageSupply(unit: MockUnit): number {
  const s = unit.supplies;
  return (
    (s[ResourceType.Fuel] + s[ResourceType.Ammo] + s[ResourceType.Food] + s[ResourceType.Parts]) /
    4
  );
}

/** Compute particle count based on supply demand (inverted: low supply = high demand) */
function demandParticles(avgSupply: number, damaged: boolean): number {
  const maxParticles = damaged ? 2 : 5;
  if (avgSupply >= 1.0) return 0;
  if (avgSupply > 0.8) return Math.min(1, maxParticles);
  if (avgSupply > 0.2) return Math.min(Math.round(2 + (0.8 - avgSupply) / 0.6), maxParticles);
  return maxParticles;
}

/** Quadratic Bézier evaluation */
function quadBezier(
  p0x: number,
  p0y: number,
  cpx: number,
  cpy: number,
  p1x: number,
  p1y: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * p0x + 2 * u * t * cpx + t * t * p1x,
    y: u * u * p0y + 2 * u * t * cpy + t * t * p1y,
  };
}

export class SupplyFlowLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private arcs: SupplyArc[] = [];
  private particles: SupplyParticle[] = [];
  private getZoom: () => number;
  private facilities: MockFacility[] = [];
  private units: MockUnit[] = [];
  private lastVersion = -1;

  constructor(getZoom: () => number) {
    this.getZoom = getZoom;
    this.container.addChild(this.graphics);
  }

  updateData(facilities: MockFacility[], units: MockUnit[]): void {
    this.facilities = facilities;
    this.units = units;
  }

  rebuild(version: number): void {
    if (this.lastVersion === version) return;
    this.lastVersion = version;
    this.buildArcs();
  }

  update(ticker: Ticker): void {
    const deltaSec = ticker.deltaMS / 1000;
    const zoom = this.getZoom();

    if (zoom < MIN_ZOOM_FOR_SUPPLY_FLOW) {
      this.graphics.clear();
      return;
    }

    // Advance particles
    for (const p of this.particles) {
      const arc = this.arcs[p.arcIndex];
      const speed = arc.baseSpeed * (arc.damaged ? 0.5 : 1);
      p.t += (speed * deltaSec) / arc.distance;
      if (p.t > 1) p.t -= 1;
    }

    // Redraw
    this.graphics.clear();

    for (const p of this.particles) {
      const arc = this.arcs[p.arcIndex];
      const pos = quadBezier(
        arc.fromX,
        arc.fromY,
        arc.arcMidX,
        arc.arcMidY,
        arc.toX,
        arc.toY,
        p.t,
      );
      const color = arc.damaged ? PARTICLE_DAMAGED_COLOR : PARTICLE_COLOR;
      this.graphics.circle(pos.x, pos.y, PARTICLE_RADIUS);
      this.graphics.fill({ color, alpha: PARTICLE_ALPHA });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }

  private buildArcs(): void {
    this.arcs = [];
    this.particles = [];

    const alliedUnits = this.units.filter(
      (u) => u.faction === 'allied' && !u.isHq,
    );

    for (const facility of this.facilities) {
      const range = SUPPLY_RANGE[facility.kind] ?? 8;
      const fromPx = HexRenderer.hexToPixel(facility.coord);

      for (const unit of alliedUnits) {
        const hexDist = HexGrid.distance(facility.coord, unit.coord);
        if (hexDist > range || hexDist === 0) continue;

        const avg = averageSupply(unit);
        const particleCount = demandParticles(avg, facility.damaged);
        if (particleCount === 0) continue;

        const toPx = HexRenderer.hexToPixel(unit.coord);
        const dx = toPx.x - fromPx.x;
        const dy = toPx.y - fromPx.y;
        const pixelDist = Math.sqrt(dx * dx + dy * dy);
        if (pixelDist < 1) continue;

        // Arc control point: midpoint offset upward (negative y)
        const arcHeight = pixelDist * ARC_HEIGHT_FACTOR;
        const mx = (fromPx.x + toPx.x) / 2;
        const my = (fromPx.y + toPx.y) / 2 - arcHeight;

        const arcIndex = this.arcs.length;
        this.arcs.push({
          fromX: fromPx.x,
          fromY: fromPx.y,
          toX: toPx.x,
          toY: toPx.y,
          arcMidX: mx,
          arcMidY: my,
          distance: pixelDist,
          damaged: facility.damaged,
          particles: particleCount,
          baseSpeed: 30 + (1 - hexDist / range) * 30, // 30-60 px/s, closer = faster
        });

        // Spawn particles evenly distributed
        for (let i = 0; i < particleCount; i++) {
          this.particles.push({
            arcIndex,
            t: i / particleCount,
          });
        }
      }
    }
  }
}
```

### Step 2: Wire SupplyFlowLayer into MapRenderer

In `src/ui/MapRenderer.ts`:

1. Add import:
   ```typescript
   import { SupplyFlowLayer } from './layers/SupplyFlowLayer';
   ```

2. Add `LayerName` option:
   ```typescript
   export type LayerName = ... | 'supplyFlow';
   ```

3. Add field:
   ```typescript
   private supplyFlowLayer: SupplyFlowLayer;
   ```

4. Create in constructor (after `flowLayer`, before `vehicleLayer`):
   ```typescript
   this.supplyFlowLayer = new SupplyFlowLayer(() => this.camera.scale);
   ```

5. Add to scene graph (after supplyHubs, before frontLine):
   ```typescript
   this.worldContainer.addChild(this.supplyFlowLayer.container);
   ```

6. Initialize data and build:
   ```typescript
   this.supplyFlowLayer.updateData(this.mockSim.state.facilities, this.mockSim.state.units);
   this.supplyFlowLayer.rebuild(this.mockSim.state.version);
   ```

7. In `onFrame()` version-change block:
   ```typescript
   this.supplyFlowLayer.updateData(this.mockSim.state.facilities, this.mockSim.state.units);
   this.supplyFlowLayer.rebuild(this.lastMockVersion);
   ```

8. In `onFrame()` per-frame section:
   ```typescript
   this.supplyFlowLayer.update(this.app.ticker);
   ```

9. Add to `layerContainer()` switch:
   ```typescript
   case 'supplyFlow':
     return this.supplyFlowLayer.container;
   ```

10. Add to `buildLayer()` switch:
    ```typescript
    case 'supplyFlow':
      this.supplyFlowLayer.rebuild(this.lastMockVersion);
      break;
    ```

11. Add to `destroy()`:
    ```typescript
    this.supplyFlowLayer.destroy();
    ```

### Step 3: Add toggle in Sidebar

In `src/ui/Sidebar.ts`, in the `layers` array (around line 374-384), add after `supplyHubs`:

```typescript
{ key: 'supplyFlow', label: 'Supply Flow' },
```

### Step 4: Run quality checks

Run: `bun run check`
Expected: All checks pass.

### Step 5: Commit

```bash
git add src/ui/layers/SupplyFlowLayer.ts src/ui/MapRenderer.ts src/ui/Sidebar.ts
git commit -m "feat: supply flow particles from hubs to troops with demand-based density"
```

---

## Task 6: Visual Testing & Polish

**Goal:** Run the dev server, verify all 4 features work correctly, fix any visual issues.

**Files:**
- Any files that need fixes

### Step 1: Start dev server

Run: `bun run dev`

### Step 2: Verify each feature

1. **Territory gradient** — Zoom out to see full map. Front line area should be strongly colored, rear should fade.
2. **Hierarchical units** — Front should be densely covered with small battalion icons. HQ diamonds/stars should be visible behind the front. Sector lines should separate divisions.
3. **Access ramps** — Zoom into supply hubs near roads. Short curved segments should connect them.
4. **Supply flow** — Gold particles should arc from supply hubs to nearby troops. More particles toward low-supply units.

### Step 3: Fix any issues found

Address visual bugs: z-ordering, overlapping, alpha values, sizes, etc.

### Step 4: Final quality check

Run: `bun run check`
Expected: All checks pass.

### Step 5: Commit any fixes

```bash
git add -A
git commit -m "fix: visual polish for mock simulation improvements"
```
