# Map Visual Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve map aesthetics with thinner hex borders, a revised color palette, noise-based color variation, cartographic terrain patterns, and animated route particles.

**Architecture:** All changes are in the `src/ui/` layer. Tasks 1-4 modify `TerrainLayer.ts` (static geometry, built once). Task 5 adds a new `RouteAnimator` class that runs on the PixiJS ticker alongside the existing static `RouteLayer`. A new `colorUtils.ts` utility provides shared `darken`/`adjustLuminosity` helpers used by TerrainLayer.

**Tech Stack:** PixiJS v8, simplex-noise v4, TypeScript strict mode, Vitest

---

### Task 1: Color utilities — `darken` and `adjustLuminosity`

**Files:**
- Create: `src/ui/colorUtils.ts`
- Create: `src/ui/__tests__/colorUtils.test.ts`

**Step 1: Write the failing tests**

```ts
// src/ui/__tests__/colorUtils.test.ts
import { describe, expect, it } from 'vitest';
import { adjustLuminosity, darken } from '../colorUtils';

describe('darken', () => {
  it('darkens white by 30%', () => {
    // 0xffffff darkened by 0.3 → each channel * 0.7 = 0xb2b2b2
    expect(darken(0xffffff, 0.3)).toBe(0xb2b2b2);
  });

  it('darkens a color by 50%', () => {
    // 0x804020 → r=128*0.5=64, g=64*0.5=32, b=32*0.5=16 → 0x402010
    expect(darken(0x804020, 0.5)).toBe(0x402010);
  });

  it('returns black when amount is 1', () => {
    expect(darken(0xff8844, 1.0)).toBe(0x000000);
  });

  it('returns same color when amount is 0', () => {
    expect(darken(0x8a9e5e, 0.0)).toBe(0x8a9e5e);
  });
});

describe('adjustLuminosity', () => {
  it('brightens a color by positive factor', () => {
    // 0x808080 + 8% → each channel = 128 + 128*0.08 = ~138 = 0x8a → 0x8a8a8a
    expect(adjustLuminosity(0x808080, 0.08)).toBe(0x8a8a8a);
  });

  it('darkens a color by negative factor', () => {
    // 0x808080 - 8% → each channel = 128 - 128*0.08 = ~118 = 0x76 → 0x767676
    expect(adjustLuminosity(0x808080, -0.08)).toBe(0x767676);
  });

  it('clamps to 255', () => {
    expect(adjustLuminosity(0xffffff, 0.5)).toBe(0xffffff);
  });

  it('clamps to 0', () => {
    expect(adjustLuminosity(0x000000, -0.5)).toBe(0x000000);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/ui/__tests__/colorUtils.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/ui/colorUtils.ts

/** Darken a 0xRRGGBB color by `amount` (0 = no change, 1 = black). */
export function darken(color: number, amount: number): number {
  const factor = 1 - amount;
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/** Shift each RGB channel by `factor` (e.g. +0.08 = 8% brighter, -0.08 = 8% darker). */
export function adjustLuminosity(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * (1 + factor))));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * (1 + factor))));
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * (1 + factor))));
  return (r << 16) | (g << 8) | b;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/ui/__tests__/colorUtils.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/ui/colorUtils.ts src/ui/__tests__/colorUtils.test.ts
git commit -m "feat: add darken and adjustLuminosity color utilities"
```

---

### Task 2: Thinner hex borders + revised color palette

**Files:**
- Modify: `src/ui/layers/TerrainLayer.ts`

**Step 1: Update color constants and border logic**

Replace the constants block (lines 7-21) with:

```ts
import { darken } from '../colorUtils';

const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Water]: 0x1a3a5c,
  [TerrainType.River]: 0x4a90b8,
  [TerrainType.Plains]: 0x8a9e5e,
  [TerrainType.Forest]: 0x2d5a2d,
  [TerrainType.Hills]: 0x9e8a5a,
  [TerrainType.Mountain]: 0xb0aab0,
  [TerrainType.Marsh]: 0x5a7a6a,
  [TerrainType.Urban]: 0x8b5e4b,
};

const BORDER_WIDTH = 0.5;
const BORDER_DARKEN = 0.3;
const URBAN_GRID_COLOR = 0x9b7b6b;
const URBAN_DENSE_BASE = 0x6b4535;
const URBAN_SPARSE_BASE = 0x9b6e5b;
```

In the `build` method, change the non-urban hex drawing (lines 47-50):

```ts
// Old:
this.graphics.poly(flat);
this.graphics.fill({ color: TERRAIN_COLORS[cell.terrain] });
this.graphics.poly(flat);
this.graphics.stroke({ width: 1, color: BORDER_COLOR });

// New:
const fillColor = TERRAIN_COLORS[cell.terrain];
this.graphics.poly(flat);
this.graphics.fill({ color: fillColor });
this.graphics.poly(flat);
this.graphics.stroke({ width: BORDER_WIDTH, color: darken(fillColor, BORDER_DARKEN) });
```

In `drawUrbanHex`, change the border stroke (line 108):

```ts
// Old:
this.graphics.stroke({ width: 1, color: BORDER_COLOR });

// New:
this.graphics.stroke({ width: BORDER_WIDTH, color: darken(baseColor, BORDER_DARKEN) });
```

**Step 2: Visual verification**

Run: `bun run dev`
Open browser at localhost:3000 — verify:
- Hex borders are thinner and match terrain tints
- Mountains are light gray, urban is brick red-brown
- All terrain types are visually distinct

**Step 3: Commit**

```bash
git add src/ui/layers/TerrainLayer.ts
git commit -m "feat: thinner hex borders and revised color palette"
```

---

### Task 3: Noise-based color variation

**Files:**
- Modify: `src/ui/layers/TerrainLayer.ts`
- Modify: `src/ui/MapRenderer.ts` (pass seed to TerrainLayer)
- Modify: `src/core/map/types.ts` (add seed to GameMap if not present)

**Step 1: Check if GameMap has the seed**

`GameMap` in `src/core/map/types.ts` does NOT have a `seed` field. Add it:

```ts
export interface GameMap {
  width: number;
  height: number;
  seed: number;
  cells: Map<string, HexCell>;
  urbanClusters: UrbanCluster[];
  supplyHubs: SupplyHub[];
  roads: RoutePath[];
  railways: RoutePath[];
}
```

Then in `src/core/map/MapGenerator.ts`, set `seed` when building the GameMap object — find where the GameMap literal is returned and add `seed: params.seed`.

**Step 2: Add noise to TerrainLayer constructor**

```ts
import { createNoise2D } from 'simplex-noise';
import { adjustLuminosity, darken } from '../colorUtils';

// Add to constructor:
constructor(gameMap: GameMap) {
  this.gameMap = gameMap;
  this.container.addChild(this.graphics);
  this.noise = createNoise2D(() => {
    // Simple seeded init: use mulberry32 for first value
    let s = gameMap.seed | 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}
```

Add `private noise: ReturnType<typeof createNoise2D>;` field.

**Step 3: Apply noise variation in build**

In the hex drawing loop, compute per-hex color variation:

```ts
const NOISE_FREQUENCY = 0.15;
const NOISE_AMPLITUDE = 0.08; // ±8%

// Inside the build loop, before drawing:
const noiseVal = this.noise(cell.coord.q * NOISE_FREQUENCY, cell.coord.r * NOISE_FREQUENCY);
const variation = noiseVal * NOISE_AMPLITUDE; // range: [-0.08, +0.08]

// For non-urban:
const baseColor = TERRAIN_COLORS[cell.terrain];
const fillColor = adjustLuminosity(baseColor, variation);
this.graphics.poly(flat);
this.graphics.fill({ color: fillColor });
this.graphics.poly(flat);
this.graphics.stroke({ width: BORDER_WIDTH, color: darken(baseColor, BORDER_DARKEN) });

// For urban (in drawUrbanHex), pass noiseVal through and apply to baseColor:
const adjustedBase = adjustLuminosity(baseColor, variation);
```

**Step 4: Update drawUrbanHex signature**

Add a `variation: number` parameter to `drawUrbanHex` and apply `adjustLuminosity` to the base color.

**Step 5: Visual verification**

Run: `bun run dev`
Verify: hexes of the same terrain type now have subtle luminosity variation creating organic zones.

**Step 6: Run all tests**

Run: `bun run check`
Expected: lint + typecheck + tests all pass (the type change to GameMap may require updating MapGenerator and tests that build GameMap objects — add `seed: 0` to test fixtures).

**Step 7: Commit**

```bash
git add src/core/map/types.ts src/core/map/MapGenerator.ts src/ui/layers/TerrainLayer.ts
git commit -m "feat: add noise-based color variation to terrain hexes"
```

---

### Task 4: Cartographic terrain patterns

**Files:**
- Modify: `src/ui/layers/TerrainLayer.ts`

**Step 1: Add pattern drawing methods**

After the main hex fill/stroke, call a new `drawTerrainPattern` method based on terrain type. The pattern color is the base terrain color darkened by 15%.

```ts
private drawTerrainPattern(
  terrain: TerrainType,
  px: { x: number; y: number },
  hash: number,
): void {
  const baseColor = TERRAIN_COLORS[terrain];
  const patternColor = darken(baseColor, 0.15);
  const size = HexRenderer.HEX_SIZE;

  switch (terrain) {
    case TerrainType.Forest:
      this.drawTreeCanopies(px, hash, patternColor, size);
      break;
    case TerrainType.Hills:
      this.drawContourArcs(px, hash, patternColor, size);
      break;
    case TerrainType.Mountain:
      this.drawPeakTriangles(px, hash, patternColor, size);
      break;
    case TerrainType.Marsh:
      this.drawMarshDashes(px, hash, patternColor, size);
      break;
    // Plains, Water, River, Urban: no pattern
  }
}
```

**Step 2: Implement each pattern**

```ts
/** Forest: 2-3 small circles (tree canopies) */
private drawTreeCanopies(
  px: { x: number; y: number },
  hash: number,
  color: number,
  size: number,
): void {
  const count = 2 + (Math.abs(hash) % 2); // 2 or 3
  const radius = size * 0.12;
  for (let i = 0; i < count; i++) {
    const h = (hash * (i + 7)) & 0xffff;
    const ox = ((h & 0xff) / 255 - 0.5) * size * 0.6;
    const oy = (((h >> 8) & 0xff) / 255 - 0.5) * size * 0.5;
    this.graphics.circle(px.x + ox, px.y + oy, radius);
    this.graphics.stroke({ width: 0.5, color });
  }
}

/** Hills: 2-3 small parallel arcs (contour lines) */
private drawContourArcs(
  px: { x: number; y: number },
  hash: number,
  color: number,
  size: number,
): void {
  const count = 2 + (Math.abs(hash) % 2);
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * 2 - 1;
    const cy = px.y + t * size * 0.35;
    const h = (hash * (i + 3)) & 0xffff;
    const ox = ((h & 0xff) / 255 - 0.5) * size * 0.15;
    const arcWidth = size * 0.35;
    this.graphics.moveTo(px.x - arcWidth + ox, cy);
    this.graphics.quadraticCurveTo(px.x + ox, cy - size * 0.12, px.x + arcWidth + ox, cy);
    this.graphics.stroke({ width: 0.5, color });
  }
}

/** Mountain: 1-2 small pointed triangles (peaks) */
private drawPeakTriangles(
  px: { x: number; y: number },
  hash: number,
  color: number,
  size: number,
): void {
  const count = 1 + (Math.abs(hash) % 2);
  const triH = size * 0.3;
  const triW = size * 0.2;
  for (let i = 0; i < count; i++) {
    const h = (hash * (i + 5)) & 0xffff;
    const ox = ((h & 0xff) / 255 - 0.5) * size * 0.4;
    const oy = (((h >> 8) & 0xff) / 255 - 0.5) * size * 0.3;
    const cx = px.x + ox;
    const cy = px.y + oy;
    this.graphics.moveTo(cx, cy - triH / 2);
    this.graphics.lineTo(cx - triW / 2, cy + triH / 2);
    this.graphics.lineTo(cx + triW / 2, cy + triH / 2);
    this.graphics.closePath();
    this.graphics.stroke({ width: 0.5, color });
  }
}

/** Marsh: 3-4 short horizontal dashes (stagnant water) */
private drawMarshDashes(
  px: { x: number; y: number },
  hash: number,
  color: number,
  size: number,
): void {
  const count = 3 + (Math.abs(hash) % 2);
  const dashW = size * 0.25;
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * 2 - 1;
    const cy = px.y + t * size * 0.4;
    const h = (hash * (i + 11)) & 0xffff;
    const ox = ((h & 0xff) / 255 - 0.5) * size * 0.3;
    this.graphics.moveTo(px.x - dashW / 2 + ox, cy);
    this.graphics.lineTo(px.x + dashW / 2 + ox, cy);
    this.graphics.stroke({ width: 0.5, color });
  }
}
```

**Step 3: Wire patterns into build loop**

In the build loop, after drawing fill+border for non-urban hexes, call:

```ts
const hash = (cell.coord.q * 73856093) ^ (cell.coord.r * 19349663);
this.drawTerrainPattern(cell.terrain, px, hash);
```

**Step 4: Visual verification**

Run: `bun run dev`
Verify: forests show small circles, hills show arcs, mountains show triangles, marshes show dashes. All subtle, not overpowering.

**Step 5: Run quality checks**

Run: `bun run check`
Expected: all pass

**Step 6: Commit**

```bash
git add src/ui/layers/TerrainLayer.ts
git commit -m "feat: add cartographic terrain patterns to hex tiles"
```

---

### Task 5: Animated route particles

**Files:**
- Create: `src/ui/layers/RouteAnimator.ts`
- Create: `src/ui/__tests__/RouteAnimator.test.ts`
- Modify: `src/ui/MapRenderer.ts` (add RouteAnimator to layer stack)
- Modify: `src/ui/layers/RouteLayer.ts` (expose computed spline data)

**Step 5a: Expose spline data from RouteLayer**

RouteLayer currently computes splines internally and discards them. We need to expose the computed Bézier segments so RouteAnimator can use them.

Add a public getter to `RouteLayer`:

```ts
// Add fields:
private roadSplines: BezierSegment[][] = [];
private railwaySplines: BezierSegment[][] = [];

// In drawRoads, after computing allSegments, store them:
this.roadSplines = allSegments.map((s) => s.segments);

// In drawRailways, after computing allSegments, store them:
this.railwaySplines = allSegments.map((s) => s.segments);

// Public getters:
get computedRoadSplines(): BezierSegment[][] {
  return this.roadSplines;
}

get computedRailwaySplines(): BezierSegment[][] {
  return this.railwaySplines;
}
```

**Step 5b: Write RouteAnimator tests**

```ts
// src/ui/__tests__/RouteAnimator.test.ts
import { describe, expect, it } from 'vitest';
import type { BezierSegment } from '../spline';
import { createRouteParticles, updateParticles } from '../layers/RouteAnimator';

// A simple straight-line Bézier segment for testing
const straightSegment: BezierSegment = {
  p0: { x: 0, y: 0 },
  p1: { x: 33, y: 0 },
  p2: { x: 66, y: 0 },
  p3: { x: 100, y: 0 },
};

describe('createRouteParticles', () => {
  it('creates correct number of particles for roads', () => {
    const splines = [[straightSegment]];
    const particles = createRouteParticles(splines, 'road');
    expect(particles.length).toBe(1); // 1 per road segment
  });

  it('creates 1-2 particles for railways', () => {
    const splines = [[straightSegment]];
    const particles = createRouteParticles(splines, 'railway');
    expect(particles.length).toBeGreaterThanOrEqual(1);
    expect(particles.length).toBeLessThanOrEqual(2);
  });

  it('initializes t values spread evenly in [0, 1)', () => {
    const splines = [[straightSegment]];
    const particles = createRouteParticles(splines, 'railway');
    for (const p of particles) {
      expect(p.t).toBeGreaterThanOrEqual(0);
      expect(p.t).toBeLessThan(1);
    }
  });
});

describe('updateParticles', () => {
  it('advances particle t based on delta and speed', () => {
    const particles = [{ t: 0, splineIndex: 0, totalLength: 100, speed: 30 }];
    updateParticles(particles, 1 / 60); // one frame at 60fps
    expect(particles[0].t).toBeCloseTo(30 / 60 / 100, 4);
  });

  it('wraps t back to [0, 1) when it exceeds 1', () => {
    const particles = [{ t: 0.99, splineIndex: 0, totalLength: 100, speed: 30 }];
    updateParticles(particles, 1); // large delta
    expect(particles[0].t).toBeGreaterThanOrEqual(0);
    expect(particles[0].t).toBeLessThan(1);
  });
});
```

**Step 5c: Run tests to verify they fail**

Run: `bun run test -- src/ui/__tests__/RouteAnimator.test.ts`
Expected: FAIL — module not found

**Step 5d: Implement RouteAnimator**

```ts
// src/ui/layers/RouteAnimator.ts
import { Container, Graphics, type Ticker } from 'pixi.js';
import { type BezierSegment, cubicBezierPoint } from '../spline';

const ROAD_PARTICLE_COLOR = 0x4a3f2f;
const ROAD_PARTICLE_SIZE = 2;
const ROAD_SPEED = 20; // px/s
const RAILWAY_PARTICLE_COLOR = 0x3a3a4a;
const RAILWAY_PARTICLE_SIZE_W = 3;
const RAILWAY_PARTICLE_SIZE_H = 2;
const RAILWAY_SPEED = 30; // px/s
const MIN_ZOOM_FOR_PARTICLES = 0.5;

export interface RouteParticle {
  t: number;
  splineIndex: number;
  totalLength: number;
  speed: number;
}

/** Estimate total arc length of a chain of Bézier segments. */
function estimateSplineLength(segments: BezierSegment[]): number {
  let total = 0;
  for (const seg of segments) {
    let prev = cubicBezierPoint(seg, 0);
    for (let i = 1; i <= 10; i++) {
      const pt = cubicBezierPoint(seg, i / 10);
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      total += Math.sqrt(dx * dx + dy * dy);
      prev = pt;
    }
  }
  return total;
}

/** Evaluate position along a chain of Bézier segments at global t in [0, 1]. */
function evaluateSplineAt(
  segments: BezierSegment[],
  globalT: number,
): { x: number; y: number } {
  const n = segments.length;
  const scaled = globalT * n;
  const segIdx = Math.min(Math.floor(scaled), n - 1);
  const localT = scaled - segIdx;
  return cubicBezierPoint(segments[segIdx], Math.min(localT, 1));
}

export function createRouteParticles(
  splines: BezierSegment[][],
  type: 'road' | 'railway',
): RouteParticle[] {
  const particles: RouteParticle[] = [];
  const speed = type === 'railway' ? RAILWAY_SPEED : ROAD_SPEED;

  for (let i = 0; i < splines.length; i++) {
    const segs = splines[i];
    if (segs.length === 0) continue;
    const totalLength = estimateSplineLength(segs);
    const count = type === 'railway' ? Math.min(2, Math.max(1, Math.round(totalLength / 150))) : 1;

    for (let j = 0; j < count; j++) {
      particles.push({
        t: j / count,
        splineIndex: i,
        totalLength,
        speed,
      });
    }
  }
  return particles;
}

export function updateParticles(particles: RouteParticle[], deltaSec: number): void {
  for (const p of particles) {
    p.t += (p.speed * deltaSec) / p.totalLength;
    p.t = p.t % 1;
    if (p.t < 0) p.t += 1;
  }
}

export class RouteAnimator {
  readonly container = new Container();
  private graphics = new Graphics();
  private roadParticles: RouteParticle[] = [];
  private railwayParticles: RouteParticle[] = [];
  private roadSplines: BezierSegment[][] = [];
  private railwaySplines: BezierSegment[][] = [];
  private getZoom: () => number;

  constructor(getZoom: () => number) {
    this.getZoom = getZoom;
    this.container.addChild(this.graphics);
  }

  init(roadSplines: BezierSegment[][], railwaySplines: BezierSegment[][]): void {
    this.roadSplines = roadSplines;
    this.railwaySplines = railwaySplines;
    this.roadParticles = createRouteParticles(roadSplines, 'road');
    this.railwayParticles = createRouteParticles(railwaySplines, 'railway');
  }

  update(ticker: Ticker): void {
    const deltaSec = ticker.deltaMS / 1000;
    const zoom = this.getZoom();

    if (zoom < MIN_ZOOM_FOR_PARTICLES) {
      this.graphics.clear();
      return;
    }

    updateParticles(this.roadParticles, deltaSec);
    updateParticles(this.railwayParticles, deltaSec);

    this.graphics.clear();

    // Draw road particles (small squares)
    for (const p of this.roadParticles) {
      const segs = this.roadSplines[p.splineIndex];
      if (!segs || segs.length === 0) continue;
      const pos = evaluateSplineAt(segs, p.t);
      const half = ROAD_PARTICLE_SIZE / 2;
      this.graphics.rect(pos.x - half, pos.y - half, ROAD_PARTICLE_SIZE, ROAD_PARTICLE_SIZE);
      this.graphics.fill({ color: ROAD_PARTICLE_COLOR });
    }

    // Draw railway particles (small rectangles)
    for (const p of this.railwayParticles) {
      const segs = this.railwaySplines[p.splineIndex];
      if (!segs || segs.length === 0) continue;
      const pos = evaluateSplineAt(segs, p.t);
      const hw = RAILWAY_PARTICLE_SIZE_W / 2;
      const hh = RAILWAY_PARTICLE_SIZE_H / 2;
      this.graphics.rect(pos.x - hw, pos.y - hh, RAILWAY_PARTICLE_SIZE_W, RAILWAY_PARTICLE_SIZE_H);
      this.graphics.fill({ color: RAILWAY_PARTICLE_COLOR });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 5e: Run tests to verify they pass**

Run: `bun run test -- src/ui/__tests__/RouteAnimator.test.ts`
Expected: PASS

**Step 5f: Wire RouteAnimator into MapRenderer**

In `src/ui/MapRenderer.ts`:

1. Import `RouteAnimator`:

```ts
import { RouteAnimator } from './layers/RouteAnimator';
```

2. Add field:

```ts
private routeAnimator: RouteAnimator;
```

3. In constructor, after building routeLayer, create and init the animator:

```ts
this.routeAnimator = new RouteAnimator(() => this.camera.scale);
this.worldContainer.addChild(this.routeAnimator.container);

// After routeLayer.build():
this.routeAnimator.init(
  this.routeLayer.computedRoadSplines,
  this.routeLayer.computedRailwaySplines,
);
```

4. In `onFrame`, update the animator:

```ts
private onFrame(): void {
  this.routeAnimator.update(this.app.ticker);
  if (!this.camera.isDirty) return;
  this.camera.clearDirty();
}
```

5. In `destroy`:

```ts
this.routeAnimator.destroy();
```

**Step 5g: Visual verification**

Run: `bun run dev`
Verify:
- Small dots move along roads (brown, slow)
- Small rectangles move along railways (dark, faster)
- Particles disappear at very low zoom
- Performance stays at 60fps

**Step 5h: Run full quality checks**

Run: `bun run check`
Expected: lint + typecheck + tests all pass

**Step 5i: Commit**

```bash
git add src/ui/layers/RouteAnimator.ts src/ui/__tests__/RouteAnimator.test.ts src/ui/layers/RouteLayer.ts src/ui/MapRenderer.ts
git commit -m "feat: add animated route particles for roads and railways"
```

---

### Task 6: Fix pre-existing type errors

**Files:**
- Modify: `src/core/map/types.ts`
- Modify: `src/core/map/RoadGenerator.ts`
- Modify: `src/ui/Sidebar.ts`

There are 5 pre-existing type errors related to `roadReuseCost` and `railwayReuseCost` properties not existing on `RoadParams`. These block the pre-commit hook. Fix them before any commit that needs the hook.

**Step 1: Add missing fields to RoadParams**

In `src/core/map/types.ts`, add to `RoadParams`:

```ts
roadReuseCost: number;
railwayReuseCost: number;
```

And add defaults to `DEFAULT_GENERATION_PARAMS.roads`:

```ts
roadReuseCost: 0.1,
railwayReuseCost: 0.1,
```

**Step 2: Run quality checks**

Run: `bun run check`
Expected: all pass

**Step 3: Commit**

```bash
git add src/core/map/types.ts
git commit -m "fix: add missing roadReuseCost and railwayReuseCost to RoadParams"
```

**Note:** This task should be done FIRST, before all other tasks, so that all subsequent commits can pass the pre-commit hook cleanly.
