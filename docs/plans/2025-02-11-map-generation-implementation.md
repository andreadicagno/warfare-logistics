# Map Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the procedural hex-based map generation system described in `docs/plans/2025-02-11-map-generation-design.md`.

**Architecture:** Bottom-up build of 7 modules under `src/core/map/`. Each module is a pure function or stateless class. The pipeline flows: noise → terrain → rivers → smoothing → settlements → roads → GameMap. All hex math lives in a single utility module. TDD with Vitest.

**Tech Stack:** TypeScript (strict), Vitest (testing), simplex-noise (noise generation), Bun (runtime)

---

## Task 0: Project Setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Install dependencies**

Run:
```bash
bun add simplex-noise
bun add -d vitest
```

**Step 2: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@game': path.resolve(__dirname, './src/game'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@data': path.resolve(__dirname, './src/data'),
    },
  },
  test: {
    globals: true,
  },
});
```

**Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Verify setup**

Run: `bun run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add package.json bun.lock vitest.config.ts
git commit -m "chore: add vitest and simplex-noise dependencies"
```

---

## Task 1: Map Types

**Files:**
- Create: `src/core/map/types.ts`

This file defines all types used by the map generation system. The design doc specifies exact interfaces. These types are *separate* from `src/data/types.ts` — they represent the generated map structure, not gameplay entities.

**Step 1: Write the types file**

Create `src/core/map/types.ts`:

```typescript
export interface HexCoord {
  q: number;
  r: number;
}

export enum TerrainType {
  Water = 'water',
  Plains = 'plains',
  Marsh = 'marsh',
  Forest = 'forest',
  Hills = 'hills',
  Mountain = 'mountain',
}

export enum SettlementType {
  Town = 'town',
  City = 'city',
}

export interface HexCell {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
  moisture: number;
  riverEdges: Set<number>;
  settlement: SettlementType | null;
}

export interface RoutePath {
  hexes: HexCoord[];
  type: 'road' | 'railway';
}

export interface RiverPath {
  edges: Array<{ hex: HexCoord; edge: number }>;
}

export interface GameMap {
  width: number;
  height: number;
  cells: Map<string, HexCell>;
  rivers: RiverPath[];
  roads: RoutePath[];
  railways: RoutePath[];
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/map/types.ts
git commit -m "feat(map): add map type definitions"
```

---

## Task 2: HexGrid Utilities

**Files:**
- Create: `src/core/map/HexGrid.ts`
- Create: `src/core/map/__tests__/HexGrid.test.ts`

Pure utility module — no state, all static methods. This is the foundation every other module depends on.

### Step 1: Write failing tests

Create `src/core/map/__tests__/HexGrid.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { HexGrid } from '../HexGrid';
import type { HexCoord } from '../types';

describe('HexGrid', () => {
  describe('key', () => {
    it('converts coord to string key', () => {
      expect(HexGrid.key({ q: 3, r: -2 })).toBe('3,-2');
    });

    it('handles zero coordinates', () => {
      expect(HexGrid.key({ q: 0, r: 0 })).toBe('0,0');
    });
  });

  describe('neighbors', () => {
    it('returns 6 neighbors for origin', () => {
      const result = HexGrid.neighbors({ q: 0, r: 0 });
      expect(result).toHaveLength(6);
    });

    it('returns correct neighbor coordinates (flat-top axial)', () => {
      const result = HexGrid.neighbors({ q: 2, r: 3 });
      // Flat-top axial directions: [+1,0], [+1,-1], [0,-1], [-1,0], [-1,+1], [0,+1]
      expect(result).toContainEqual({ q: 3, r: 3 });
      expect(result).toContainEqual({ q: 3, r: 2 });
      expect(result).toContainEqual({ q: 2, r: 2 });
      expect(result).toContainEqual({ q: 1, r: 3 });
      expect(result).toContainEqual({ q: 1, r: 4 });
      expect(result).toContainEqual({ q: 2, r: 4 });
    });
  });

  describe('distance', () => {
    it('returns 0 for same hex', () => {
      expect(HexGrid.distance({ q: 3, r: 4 }, { q: 3, r: 4 })).toBe(0);
    });

    it('returns 1 for adjacent hexes', () => {
      expect(HexGrid.distance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    });

    it('returns correct distance for distant hexes', () => {
      // Cube distance: max(|dq|, |dr|, |ds|) where s = -q - r
      // (0,0) → (3, -1): cube = (3, -1, -2), dist = max(3,1,2) = 3
      expect(HexGrid.distance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    });
  });

  describe('ring', () => {
    it('returns single hex for radius 0', () => {
      const result = HexGrid.ring({ q: 0, r: 0 }, 0);
      expect(result).toEqual([{ q: 0, r: 0 }]);
    });

    it('returns 6 hexes for radius 1', () => {
      const result = HexGrid.ring({ q: 0, r: 0 }, 1);
      expect(result).toHaveLength(6);
    });

    it('returns 12 hexes for radius 2', () => {
      const result = HexGrid.ring({ q: 0, r: 0 }, 2);
      expect(result).toHaveLength(12);
    });
  });

  describe('toPixel', () => {
    it('returns origin for (0,0)', () => {
      const result = HexGrid.toPixel({ q: 0, r: 0 });
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
    });

    it('offsets x for increasing q', () => {
      const a = HexGrid.toPixel({ q: 0, r: 0 });
      const b = HexGrid.toPixel({ q: 1, r: 0 });
      expect(b.x).toBeGreaterThan(a.x);
    });
  });

  describe('fromPixel', () => {
    it('round-trips through toPixel', () => {
      const original: HexCoord = { q: 5, r: -3 };
      const pixel = HexGrid.toPixel(original);
      const result = HexGrid.fromPixel(pixel.x, pixel.y);
      expect(result.q).toBe(original.q);
      expect(result.r).toBe(original.r);
    });
  });

  describe('inBounds', () => {
    it('returns true for valid coordinates', () => {
      expect(HexGrid.inBounds({ q: 5, r: 5 }, 40, 30)).toBe(true);
    });

    it('returns false for negative q', () => {
      expect(HexGrid.inBounds({ q: -1, r: 5 }, 40, 30)).toBe(false);
    });

    it('returns false for q >= width', () => {
      expect(HexGrid.inBounds({ q: 40, r: 5 }, 40, 30)).toBe(false);
    });

    it('returns false for r >= height', () => {
      expect(HexGrid.inBounds({ q: 5, r: 30 }, 40, 30)).toBe(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/core/map/__tests__/HexGrid.test.ts`
Expected: FAIL — cannot resolve `../HexGrid`

**Step 3: Implement HexGrid**

Create `src/core/map/HexGrid.ts`:

```typescript
import type { HexCoord } from './types';

// Flat-top axial direction vectors (edges 0-5, clockwise from east)
const DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },   // 0: E
  { q: 1, r: -1 },  // 1: NE
  { q: 0, r: -1 },  // 2: NW
  { q: -1, r: 0 },  // 3: W
  { q: -1, r: 1 },  // 4: SW
  { q: 0, r: 1 },   // 5: SE
];

// Flat-top hex geometry constants (unit size = 1)
const HEX_SIZE = 1;
const SQRT3 = Math.sqrt(3);

export class HexGrid {
  static readonly DIRECTIONS = DIRECTIONS;

  /** Convert axial coord to string key "q,r" for Map lookups */
  static key(coord: HexCoord): string {
    return `${coord.q},${coord.r}`;
  }

  /** Returns the 6 adjacent hex coordinates */
  static neighbors(coord: HexCoord): HexCoord[] {
    return DIRECTIONS.map((d) => ({
      q: coord.q + d.q,
      r: coord.r + d.r,
    }));
  }

  /** Cube (Manhattan) distance between two hexes */
  static distance(a: HexCoord, b: HexCoord): number {
    // Convert to cube: s = -q - r
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    const ds = Math.abs((-a.q - a.r) - (-b.q - b.r));
    return Math.max(dq, dr, ds);
  }

  /** All hexes at exact distance (radius) from center */
  static ring(center: HexCoord, radius: number): HexCoord[] {
    if (radius === 0) return [{ q: center.q, r: center.r }];

    const results: HexCoord[] = [];
    // Start at direction 4 (SW) scaled by radius
    let hex: HexCoord = {
      q: center.q + DIRECTIONS[4].q * radius,
      r: center.r + DIRECTIONS[4].r * radius,
    };

    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < radius; step++) {
        results.push({ q: hex.q, r: hex.r });
        hex = {
          q: hex.q + DIRECTIONS[side].q,
          r: hex.r + DIRECTIONS[side].r,
        };
      }
    }
    return results;
  }

  /** Convert axial coord to pixel position (flat-top) */
  static toPixel(coord: HexCoord): { x: number; y: number } {
    const x = HEX_SIZE * (3 / 2) * coord.q;
    const y = HEX_SIZE * (SQRT3 / 2 * coord.q + SQRT3 * coord.r);
    return { x, y };
  }

  /** Convert pixel position back to nearest axial coord (flat-top) */
  static fromPixel(x: number, y: number): HexCoord {
    const q = (2 / 3) * x / HEX_SIZE;
    const r = (-1 / 3 * x + SQRT3 / 3 * y) / HEX_SIZE;
    return HexGrid.roundAxial(q, r);
  }

  /** Round fractional axial coordinates to nearest hex */
  private static roundAxial(q: number, r: number): HexCoord {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) {
      rq = -rr - rs;
    } else if (dr > ds) {
      rr = -rq - rs;
    }
    return { q: rq, r: rr };
  }

  /** Check if coord is within map bounds (0-indexed) */
  static inBounds(coord: HexCoord, width: number, height: number): boolean {
    return coord.q >= 0 && coord.q < width && coord.r >= 0 && coord.r < height;
  }

  /** Get the direction index (0-5) for the edge between two adjacent hexes */
  static edgeDirection(from: HexCoord, to: HexCoord): number | null {
    const dq = to.q - from.q;
    const dr = to.r - from.r;
    for (let i = 0; i < 6; i++) {
      if (DIRECTIONS[i].q === dq && DIRECTIONS[i].r === dr) return i;
    }
    return null;
  }

  /** Get the opposite edge direction */
  static oppositeEdge(edge: number): number {
    return (edge + 3) % 6;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/core/map/__tests__/HexGrid.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/map/HexGrid.ts src/core/map/__tests__/HexGrid.test.ts
git commit -m "feat(map): add HexGrid utility module with tests"
```

---

## Task 3: Terrain Generator

**Files:**
- Create: `src/core/map/TerrainGenerator.ts`
- Create: `src/core/map/__tests__/TerrainGenerator.test.ts`

Implements Phase 1 (elevation) and Phase 2 (terrain assignment) from the design doc. Takes a seed, map dimensions, and geography setting. Returns a Map of HexCells with terrain, elevation, and moisture populated.

### Step 1: Write failing tests

Create `src/core/map/__tests__/TerrainGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TerrainGenerator } from '../TerrainGenerator';
import { TerrainType } from '../types';
import { HexGrid } from '../HexGrid';

describe('TerrainGenerator', () => {
  const smallWidth = 40;
  const smallHeight = 30;

  describe('generate', () => {
    it('returns a cell for every hex in bounds', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      expect(cells.size).toBe(smallWidth * smallHeight);
    });

    it('assigns valid terrain types to all cells', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      const validTerrains = new Set(Object.values(TerrainType));
      for (const cell of cells.values()) {
        expect(validTerrains.has(cell.terrain)).toBe(true);
      }
    });

    it('elevation values are in 0-1 range', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      for (const cell of cells.values()) {
        expect(cell.elevation).toBeGreaterThanOrEqual(0);
        expect(cell.elevation).toBeLessThanOrEqual(1);
      }
    });

    it('moisture values are in 0-1 range', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      for (const cell of cells.values()) {
        expect(cell.moisture).toBeGreaterThanOrEqual(0);
        expect(cell.moisture).toBeLessThanOrEqual(1);
      }
    });

    it('produces water hexes at low elevation', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      const waterCells = [...cells.values()].filter((c) => c.terrain === TerrainType.Water);
      expect(waterCells.length).toBeGreaterThan(0);
      for (const cell of waterCells) {
        expect(cell.elevation).toBeLessThan(0.25);
      }
    });

    it('produces mountains at high elevation', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      const mountains = [...cells.values()].filter((c) => c.terrain === TerrainType.Mountain);
      expect(mountains.length).toBeGreaterThan(0);
      for (const cell of mountains) {
        expect(cell.elevation).toBeGreaterThan(0.65);
      }
    });

    it('is deterministic with same seed', () => {
      const a = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 99);
      const b = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 99);
      for (const [key, cellA] of a) {
        const cellB = b.get(key)!;
        expect(cellA.terrain).toBe(cellB.terrain);
        expect(cellA.elevation).toBe(cellB.elevation);
      }
    });

    it('produces different results with different seeds', () => {
      const a = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 1);
      const b = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 2);
      let differences = 0;
      for (const [key, cellA] of a) {
        const cellB = b.get(key)!;
        if (cellA.terrain !== cellB.terrain) differences++;
      }
      expect(differences).toBeGreaterThan(0);
    });

    it('mountainous geography produces more mountains than plains geography', () => {
      const mountainous = TerrainGenerator.generate(smallWidth, smallHeight, 'mountainous', 42);
      const plains = TerrainGenerator.generate(smallWidth, smallHeight, 'plains', 42);
      const countMountains = (cells: Map<string, { terrain: TerrainType }>) =>
        [...cells.values()].filter(
          (c) => c.terrain === TerrainType.Mountain || c.terrain === TerrainType.Hills
        ).length;
      expect(countMountains(mountainous)).toBeGreaterThan(countMountains(plains));
    });
  });

  describe('assignTerrain', () => {
    it('returns Water for low elevation', () => {
      expect(TerrainGenerator.assignTerrain(0.1, 0.5, 'mixed')).toBe(TerrainType.Water);
    });

    it('returns Mountain for high elevation', () => {
      expect(TerrainGenerator.assignTerrain(0.9, 0.5, 'mixed')).toBe(TerrainType.Mountain);
    });

    it('returns Marsh for low-mid elevation and high moisture', () => {
      expect(TerrainGenerator.assignTerrain(0.28, 0.8, 'mixed')).toBe(TerrainType.Marsh);
    });

    it('returns Forest for mid elevation and high moisture', () => {
      expect(TerrainGenerator.assignTerrain(0.45, 0.8, 'mixed')).toBe(TerrainType.Forest);
    });

    it('returns Plains for mid-low elevation and low moisture', () => {
      expect(TerrainGenerator.assignTerrain(0.4, 0.2, 'mixed')).toBe(TerrainType.Plains);
    });

    it('returns Hills for mid-high elevation and low moisture', () => {
      expect(TerrainGenerator.assignTerrain(0.65, 0.2, 'mixed')).toBe(TerrainType.Hills);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/core/map/__tests__/TerrainGenerator.test.ts`
Expected: FAIL — cannot resolve `../TerrainGenerator`

**Step 3: Implement TerrainGenerator**

Create `src/core/map/TerrainGenerator.ts`:

```typescript
import { createNoise2D } from 'simplex-noise';
import type { HexCell, HexCoord } from './types';
import { TerrainType } from './types';
import { HexGrid } from './HexGrid';

type Geography = 'plains' | 'mixed' | 'mountainous';

// Elevation threshold offsets per geography setting
const GEOGRAPHY_OFFSETS: Record<Geography, number> = {
  plains: 0.1,       // shift thresholds up → more low terrain
  mixed: 0,
  mountainous: -0.1, // shift thresholds down → more high terrain
};

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TerrainGenerator {
  static generate(
    width: number,
    height: number,
    geography: Geography,
    seed: number
  ): Map<string, HexCell> {
    const rng = mulberry32(seed);
    const elevationNoise = createNoise2D(rng);
    const moistureNoise = createNoise2D(rng);

    const cells = new Map<string, HexCell>();

    for (let q = 0; q < width; q++) {
      for (let r = 0; r < height; r++) {
        const coord: HexCoord = { q, r };
        const elevation = TerrainGenerator.sampleElevation(
          coord, width, height, elevationNoise
        );
        const moisture = TerrainGenerator.sampleMoisture(coord, moistureNoise);
        const terrain = TerrainGenerator.assignTerrain(elevation, moisture, geography);

        cells.set(HexGrid.key(coord), {
          coord,
          terrain,
          elevation,
          moisture,
          riverEdges: new Set(),
          settlement: null,
        });
      }
    }

    return cells;
  }

  /** Multi-octave elevation with edge falloff */
  private static sampleElevation(
    coord: HexCoord,
    width: number,
    height: number,
    noise: (x: number, y: number) => number
  ): number {
    const scale1 = 0.05;
    const scale2 = 0.1;
    const scale3 = 0.2;

    // Layer 3 octaves of noise
    let value =
      0.6 * (noise(coord.q * scale1, coord.r * scale1) + 1) / 2 +
      0.3 * (noise(coord.q * scale2, coord.r * scale2) + 1) / 2 +
      0.1 * (noise(coord.q * scale3, coord.r * scale3) + 1) / 2;

    // Distance-from-center falloff
    const cx = coord.q / width - 0.5;
    const cy = coord.r / height - 0.5;
    const distFromCenter = Math.sqrt(cx * cx + cy * cy) * 2; // 0 at center, ~1.4 at corners
    const falloff = Math.max(0, 1 - distFromCenter * distFromCenter);
    value *= falloff;

    return Math.max(0, Math.min(1, value));
  }

  /** Secondary noise layer for moisture */
  private static sampleMoisture(
    coord: HexCoord,
    noise: (x: number, y: number) => number
  ): number {
    const scale = 0.08;
    const value = (noise(coord.q * scale + 100, coord.r * scale + 100) + 1) / 2;
    return Math.max(0, Math.min(1, value));
  }

  /** Map elevation + moisture to terrain type using design doc thresholds */
  static assignTerrain(
    elevation: number,
    moisture: number,
    geography: Geography
  ): TerrainType {
    const offset = GEOGRAPHY_OFFSETS[geography];
    const moistureThreshold = 0.5;

    if (elevation < 0.20 + offset) return TerrainType.Water;
    if (elevation < 0.35 + offset) {
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
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/core/map/__tests__/TerrainGenerator.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/map/TerrainGenerator.ts src/core/map/__tests__/TerrainGenerator.test.ts
git commit -m "feat(map): add terrain generation with elevation and moisture noise"
```

---

## Task 4: River Generator

**Files:**
- Create: `src/core/map/RiverGenerator.ts`
- Create: `src/core/map/__tests__/RiverGenerator.test.ts`

Implements Phase 3 from the design doc. Selects high-elevation sources, flows downhill greedily, stores edge flags on cells.

### Step 1: Write failing tests

Create `src/core/map/__tests__/RiverGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RiverGenerator } from '../RiverGenerator';
import { TerrainGenerator } from '../TerrainGenerator';
import { TerrainType } from '../types';
import { HexGrid } from '../HexGrid';
import type { HexCell, RiverPath } from '../types';

describe('RiverGenerator', () => {
  function makeMap() {
    return TerrainGenerator.generate(40, 30, 'mixed', 42);
  }

  describe('generate', () => {
    it('produces 3-5 rivers', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      expect(rivers.length).toBeGreaterThanOrEqual(3);
      expect(rivers.length).toBeLessThanOrEqual(5);
    });

    it('rivers have at least 2 edges', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      for (const river of rivers) {
        expect(river.edges.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('sets riverEdges on cells along the path', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      let edgeCount = 0;
      for (const cell of cells.values()) {
        edgeCount += cell.riverEdges.size;
      }
      expect(edgeCount).toBeGreaterThan(0);
    });

    it('river sources start at high elevation', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      for (const river of rivers) {
        const sourceHex = river.edges[0].hex;
        const sourceCell = cells.get(HexGrid.key(sourceHex))!;
        expect(sourceCell.elevation).toBeGreaterThan(0.5);
      }
    });

    it('rivers terminate at water or map edge', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      for (const river of rivers) {
        const lastEdge = river.edges[river.edges.length - 1];
        const lastHex = lastEdge.hex;
        const dir = HexGrid.DIRECTIONS[lastEdge.edge];
        const nextCoord = { q: lastHex.q + dir.q, r: lastHex.r + dir.r };
        const nextCell = cells.get(HexGrid.key(nextCoord));
        // Either next cell is water, or it's out of bounds
        const isOutOfBounds = !HexGrid.inBounds(nextCoord, 40, 30);
        const isWater = nextCell?.terrain === TerrainType.Water;
        expect(isOutOfBounds || isWater).toBe(true);
      }
    });

    it('is deterministic', () => {
      const cells1 = makeMap();
      const rivers1 = RiverGenerator.generate(cells1, 40, 30, 42);
      const cells2 = makeMap();
      const rivers2 = RiverGenerator.generate(cells2, 40, 30, 42);
      expect(rivers1.length).toBe(rivers2.length);
      for (let i = 0; i < rivers1.length; i++) {
        expect(rivers1[i].edges.length).toBe(rivers2[i].edges.length);
      }
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/core/map/__tests__/RiverGenerator.test.ts`
Expected: FAIL — cannot resolve `../RiverGenerator`

**Step 3: Implement RiverGenerator**

Create `src/core/map/RiverGenerator.ts`:

```typescript
import type { HexCell, HexCoord, RiverPath } from './types';
import { TerrainType } from './types';
import { HexGrid } from './HexGrid';

const RIVER_COUNT_MIN = 3;
const RIVER_COUNT_MAX = 5;

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RiverGenerator {
  static generate(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    seed: number
  ): RiverPath[] {
    const rng = mulberry32(seed + 1000); // offset seed from terrain
    const sources = RiverGenerator.selectSources(cells, width, height, rng);
    const rivers: RiverPath[] = [];
    const usedHexes = new Set<string>();

    for (const source of sources) {
      const river = RiverGenerator.flowDownhill(source, cells, width, height, usedHexes);
      if (river.edges.length >= 2) {
        rivers.push(river);
        // Mark hexes as used to avoid overlap
        for (const edge of river.edges) {
          usedHexes.add(HexGrid.key(edge.hex));
        }
      }
    }

    return rivers;
  }

  /** Select 3-5 high-elevation hexes as river sources */
  private static selectSources(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    rng: () => number
  ): HexCoord[] {
    const count = RIVER_COUNT_MIN + Math.floor(rng() * (RIVER_COUNT_MAX - RIVER_COUNT_MIN + 1));

    // Get all high-elevation land hexes, sorted by elevation descending
    const candidates = [...cells.values()]
      .filter(
        (c) =>
          c.elevation > 0.55 &&
          c.terrain !== TerrainType.Water &&
          c.terrain !== TerrainType.Marsh
      )
      .sort((a, b) => b.elevation - a.elevation);

    const sources: HexCoord[] = [];
    for (const candidate of candidates) {
      if (sources.length >= count) break;
      // Ensure sources are spread out (min 8 hexes apart)
      const tooClose = sources.some(
        (s) => HexGrid.distance(s, candidate.coord) < 8
      );
      if (!tooClose) {
        sources.push(candidate.coord);
      }
    }

    return sources;
  }

  /** Greedily flow downhill from source, recording edge crossings */
  private static flowDownhill(
    source: HexCoord,
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    usedHexes: Set<string>
  ): RiverPath {
    const edges: RiverPath['edges'] = [];
    let current = source;
    const visited = new Set<string>();
    visited.add(HexGrid.key(current));

    const MAX_LENGTH = 100;

    for (let step = 0; step < MAX_LENGTH; step++) {
      const currentCell = cells.get(HexGrid.key(current))!;
      const neighbors = HexGrid.neighbors(current);

      // Find the lowest-elevation neighbor
      let bestNeighbor: HexCoord | null = null;
      let bestElevation = currentCell.elevation;
      let bestDirection = -1;

      for (let dir = 0; dir < 6; dir++) {
        const neighbor = neighbors[dir];
        const key = HexGrid.key(neighbor);
        if (visited.has(key)) continue;

        if (!HexGrid.inBounds(neighbor, width, height)) {
          // River flows off map edge — record and stop
          edges.push({ hex: current, edge: dir });
          currentCell.riverEdges.add(dir);
          return { edges };
        }

        const neighborCell = cells.get(key)!;

        // If neighbor is water, flow into it and stop
        if (neighborCell.terrain === TerrainType.Water) {
          edges.push({ hex: current, edge: dir });
          currentCell.riverEdges.add(dir);
          neighborCell.riverEdges.add(HexGrid.oppositeEdge(dir));
          return { edges };
        }

        if (neighborCell.elevation < bestElevation && !usedHexes.has(key)) {
          bestElevation = neighborCell.elevation;
          bestNeighbor = neighbor;
          bestDirection = dir;
        }
      }

      if (bestNeighbor === null || bestDirection === -1) break;

      // Record the edge crossing
      edges.push({ hex: current, edge: bestDirection });
      currentCell.riverEdges.add(bestDirection);
      const nextCell = cells.get(HexGrid.key(bestNeighbor))!;
      nextCell.riverEdges.add(HexGrid.oppositeEdge(bestDirection));

      visited.add(HexGrid.key(bestNeighbor));
      current = bestNeighbor;
    }

    return { edges };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/core/map/__tests__/RiverGenerator.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/map/RiverGenerator.ts src/core/map/__tests__/RiverGenerator.test.ts
git commit -m "feat(map): add river generation with downhill flow"
```

---

## Task 5: Smoothing Pass

**Files:**
- Create: `src/core/map/SmoothingPass.ts`
- Create: `src/core/map/__tests__/SmoothingPass.test.ts`

Implements Phase 4 from the design doc. Removes terrain anomalies and ensures water contiguity.

### Step 1: Write failing tests

Create `src/core/map/__tests__/SmoothingPass.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SmoothingPass } from '../SmoothingPass';
import { HexGrid } from '../HexGrid';
import type { HexCell } from '../types';
import { TerrainType } from '../types';

function makeCell(q: number, r: number, terrain: TerrainType, elevation = 0.5): HexCell {
  return {
    coord: { q, r },
    terrain,
    elevation,
    moisture: 0.5,
    riverEdges: new Set(),
    settlement: null,
  };
}

describe('SmoothingPass', () => {
  describe('removeSingleHexAnomalies', () => {
    it('replaces a lone mountain surrounded by plains', () => {
      const cells = new Map<string, HexCell>();
      // 7-hex cluster: center is mountain, all neighbors are plains
      cells.set('5,5', makeCell(5, 5, TerrainType.Mountain, 0.8));
      for (const n of HexGrid.neighbors({ q: 5, r: 5 })) {
        cells.set(HexGrid.key(n), makeCell(n.q, n.r, TerrainType.Plains, 0.4));
      }
      // Add neighbors-of-neighbors so the smoothing has full context
      for (const n of HexGrid.neighbors({ q: 5, r: 5 })) {
        for (const nn of HexGrid.neighbors(n)) {
          const key = HexGrid.key(nn);
          if (!cells.has(key)) {
            cells.set(key, makeCell(nn.q, nn.r, TerrainType.Plains, 0.4));
          }
        }
      }

      SmoothingPass.removeSingleHexAnomalies(cells, 20, 20);
      expect(cells.get('5,5')!.terrain).not.toBe(TerrainType.Mountain);
    });

    it('keeps a mountain that has mountain neighbors', () => {
      const cells = new Map<string, HexCell>();
      cells.set('5,5', makeCell(5, 5, TerrainType.Mountain, 0.8));
      const neighbors = HexGrid.neighbors({ q: 5, r: 5 });
      // Half mountain, half hills
      neighbors.forEach((n, i) => {
        const terrain = i < 3 ? TerrainType.Mountain : TerrainType.Hills;
        cells.set(HexGrid.key(n), makeCell(n.q, n.r, terrain, 0.7));
      });

      SmoothingPass.removeSingleHexAnomalies(cells, 20, 20);
      expect(cells.get('5,5')!.terrain).toBe(TerrainType.Mountain);
    });
  });

  describe('removeIsolatedWater', () => {
    it('replaces a single water hex surrounded by land', () => {
      const cells = new Map<string, HexCell>();
      cells.set('5,5', makeCell(5, 5, TerrainType.Water, 0.1));
      for (const n of HexGrid.neighbors({ q: 5, r: 5 })) {
        cells.set(HexGrid.key(n), makeCell(n.q, n.r, TerrainType.Plains, 0.4));
      }

      SmoothingPass.removeIsolatedWater(cells, 20, 20);
      expect(cells.get('5,5')!.terrain).not.toBe(TerrainType.Water);
    });

    it('keeps water that is adjacent to other water', () => {
      const cells = new Map<string, HexCell>();
      cells.set('5,5', makeCell(5, 5, TerrainType.Water, 0.1));
      const neighbors = HexGrid.neighbors({ q: 5, r: 5 });
      cells.set(HexGrid.key(neighbors[0]), makeCell(neighbors[0].q, neighbors[0].r, TerrainType.Water, 0.1));
      for (let i = 1; i < neighbors.length; i++) {
        cells.set(HexGrid.key(neighbors[i]), makeCell(neighbors[i].q, neighbors[i].r, TerrainType.Plains, 0.4));
      }

      SmoothingPass.removeIsolatedWater(cells, 20, 20);
      expect(cells.get('5,5')!.terrain).toBe(TerrainType.Water);
    });
  });

  describe('apply (full pipeline)', () => {
    it('runs without error on generated terrain', () => {
      // Use TerrainGenerator output for a realistic test
      const { TerrainGenerator } = require('../TerrainGenerator');
      const cells = TerrainGenerator.generate(40, 30, 'mixed', 42);
      expect(() => SmoothingPass.apply(cells, 40, 30)).not.toThrow();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/core/map/__tests__/SmoothingPass.test.ts`
Expected: FAIL — cannot resolve `../SmoothingPass`

**Step 3: Implement SmoothingPass**

Create `src/core/map/SmoothingPass.ts`:

```typescript
import type { HexCell } from './types';
import { TerrainType } from './types';
import { HexGrid } from './HexGrid';

// Terrain "weight" groups for anomaly detection
const TERRAIN_GROUP: Record<TerrainType, number> = {
  [TerrainType.Water]: 0,
  [TerrainType.Marsh]: 1,
  [TerrainType.Plains]: 2,
  [TerrainType.Forest]: 3,
  [TerrainType.Hills]: 4,
  [TerrainType.Mountain]: 5,
};

export class SmoothingPass {
  /** Run all smoothing steps */
  static apply(cells: Map<string, HexCell>, width: number, height: number): void {
    SmoothingPass.removeSingleHexAnomalies(cells, width, height);
    SmoothingPass.removeIsolatedWater(cells, width, height);
  }

  /** Replace hexes whose terrain is wildly different from all neighbors */
  static removeSingleHexAnomalies(
    cells: Map<string, HexCell>,
    width: number,
    height: number
  ): void {
    const changes: Array<{ key: string; terrain: TerrainType }> = [];

    for (const [key, cell] of cells) {
      const neighbors = HexGrid.neighbors(cell.coord)
        .filter((n) => HexGrid.inBounds(n, width, height))
        .map((n) => cells.get(HexGrid.key(n))!)
        .filter(Boolean);

      if (neighbors.length === 0) continue;

      const cellGroup = TERRAIN_GROUP[cell.terrain];
      const neighborGroups = neighbors.map((n) => TERRAIN_GROUP[n.terrain]);
      const avgGroup = neighborGroups.reduce((a, b) => a + b, 0) / neighborGroups.length;

      // If this hex differs by more than 2 groups from the average of its neighbors,
      // and no neighbor shares its terrain group, it's an anomaly
      const hasSameGroupNeighbor = neighborGroups.some(
        (g) => Math.abs(g - cellGroup) <= 1
      );

      if (!hasSameGroupNeighbor && Math.abs(cellGroup - avgGroup) > 2) {
        // Replace with the most common neighbor terrain
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

    // Apply changes
    for (const change of changes) {
      cells.get(change.key)!.terrain = change.terrain;
    }
  }

  /** Remove isolated single water hexes surrounded entirely by land */
  static removeIsolatedWater(
    cells: Map<string, HexCell>,
    width: number,
    height: number
  ): void {
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
      // Replace with Marsh (natural transition from water)
      cells.get(key)!.terrain = TerrainType.Marsh;
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/core/map/__tests__/SmoothingPass.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/map/SmoothingPass.ts src/core/map/__tests__/SmoothingPass.test.ts
git commit -m "feat(map): add terrain smoothing pass"
```

---

## Task 6: Settlement Placer

**Files:**
- Create: `src/core/map/SettlementPlacer.ts`
- Create: `src/core/map/__tests__/SettlementPlacer.test.ts`

Scores hexes and places cities and towns per the design doc scoring rules.

### Step 1: Write failing tests

Create `src/core/map/__tests__/SettlementPlacer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SettlementPlacer } from '../SettlementPlacer';
import { TerrainGenerator } from '../TerrainGenerator';
import { RiverGenerator } from '../RiverGenerator';
import { SmoothingPass } from '../SmoothingPass';
import { SettlementType, TerrainType } from '../types';
import { HexGrid } from '../HexGrid';

describe('SettlementPlacer', () => {
  function makeMap() {
    const cells = TerrainGenerator.generate(40, 30, 'mixed', 42);
    RiverGenerator.generate(cells, 40, 30, 42);
    SmoothingPass.apply(cells, 40, 30);
    return cells;
  }

  describe('place', () => {
    it('places 3-6 cities on a small map', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const cities = [...cells.values()].filter(
        (c) => c.settlement === SettlementType.City
      );
      expect(cities.length).toBeGreaterThanOrEqual(3);
      expect(cities.length).toBeLessThanOrEqual(6);
    });

    it('places 8-15 towns on a small map', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const towns = [...cells.values()].filter(
        (c) => c.settlement === SettlementType.Town
      );
      expect(towns.length).toBeGreaterThanOrEqual(8);
      expect(towns.length).toBeLessThanOrEqual(15);
    });

    it('cities are at least 8 hexes apart', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const cities = [...cells.values()].filter(
        (c) => c.settlement === SettlementType.City
      );
      for (let i = 0; i < cities.length; i++) {
        for (let j = i + 1; j < cities.length; j++) {
          expect(
            HexGrid.distance(cities[i].coord, cities[j].coord)
          ).toBeGreaterThanOrEqual(8);
        }
      }
    });

    it('cities are on plains or forest terrain', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const cities = [...cells.values()].filter(
        (c) => c.settlement === SettlementType.City
      );
      for (const city of cities) {
        expect([TerrainType.Plains, TerrainType.Forest]).toContain(city.terrain);
      }
    });

    it('towns are on plains, forest, or hills terrain', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const towns = [...cells.values()].filter(
        (c) => c.settlement === SettlementType.Town
      );
      for (const town of towns) {
        expect([TerrainType.Plains, TerrainType.Forest, TerrainType.Hills]).toContain(
          town.terrain
        );
      }
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/core/map/__tests__/SettlementPlacer.test.ts`
Expected: FAIL — cannot resolve `../SettlementPlacer`

**Step 3: Implement SettlementPlacer**

Create `src/core/map/SettlementPlacer.ts`:

```typescript
import type { HexCell, HexCoord } from './types';
import { TerrainType, SettlementType } from './types';
import { HexGrid } from './HexGrid';

// Settlement counts scale with map area
const CITY_DENSITY = 3 / 1200; // ~3 cities per 1200 hexes (small map)
const TOWN_DENSITY = 8 / 1200; // ~8 towns per 1200 hexes (small map)

const MIN_CITY_DISTANCE = 8;
const MIN_TOWN_DISTANCE = 3;

export class SettlementPlacer {
  static place(
    cells: Map<string, HexCell>,
    width: number,
    height: number
  ): void {
    const totalHexes = width * height;

    // City count: 3-6 scaled by map size
    const cityCount = Math.min(6, Math.max(3, Math.round(totalHexes * CITY_DENSITY)));
    // Town count: 8-15 scaled by map size
    const townCount = Math.min(15, Math.max(8, Math.round(totalHexes * TOWN_DENSITY)));

    SettlementPlacer.placeCities(cells, width, height, cityCount);
    SettlementPlacer.placeTowns(cells, width, height, townCount);
  }

  private static placeCities(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    count: number
  ): void {
    // Score all plains/forest hexes
    const candidates: Array<{ coord: HexCoord; score: number }> = [];

    for (const cell of cells.values()) {
      if (cell.terrain !== TerrainType.Plains && cell.terrain !== TerrainType.Forest) continue;

      let score = 0;
      const neighbors = HexGrid.neighbors(cell.coord)
        .filter((n) => HexGrid.inBounds(n, width, height))
        .map((n) => cells.get(HexGrid.key(n))!)
        .filter(Boolean);

      // +3 if adjacent to river
      if (cell.riverEdges.size > 0) score += 3;

      // +2 if on coast (adjacent to water)
      if (neighbors.some((n) => n.terrain === TerrainType.Water)) score += 2;

      // +1 per plains neighbor
      score += neighbors.filter((n) => n.terrain === TerrainType.Plains).length;

      candidates.push({ coord: cell.coord, score });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Place cities with minimum distance constraint
    const placed: HexCoord[] = [];
    for (const candidate of candidates) {
      if (placed.length >= count) break;
      const tooClose = placed.some(
        (c) => HexGrid.distance(c, candidate.coord) < MIN_CITY_DISTANCE
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
    count: number
  ): void {
    // Collect city locations
    const cities = [...cells.values()]
      .filter((c) => c.settlement === SettlementType.City)
      .map((c) => c.coord);

    // Score all valid hexes
    const candidates: Array<{ coord: HexCoord; score: number }> = [];

    for (const cell of cells.values()) {
      if (cell.settlement !== null) continue; // skip existing settlements
      if (
        cell.terrain !== TerrainType.Plains &&
        cell.terrain !== TerrainType.Forest &&
        cell.terrain !== TerrainType.Hills
      ) continue;

      let score = 0;

      // +2 if within 5-10 hexes of a city
      for (const city of cities) {
        const dist = HexGrid.distance(cell.coord, city);
        if (dist >= 5 && dist <= 10) {
          score += 2;
          break; // only count once
        }
      }

      // +1 if adjacent to river
      if (cell.riverEdges.size > 0) score += 1;

      candidates.push({ coord: cell.coord, score });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Place towns with minimum distance from other towns
    const placed: HexCoord[] = [];
    for (const candidate of candidates) {
      if (placed.length >= count) break;

      // -3 if within 3 hexes of another town
      const tooCloseToTown = placed.some(
        (t) => HexGrid.distance(t, candidate.coord) < MIN_TOWN_DISTANCE
      );
      if (tooCloseToTown) continue;

      const cell = cells.get(HexGrid.key(candidate.coord))!;
      cell.settlement = SettlementType.Town;
      placed.push(candidate.coord);
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/core/map/__tests__/SettlementPlacer.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/map/SettlementPlacer.ts src/core/map/__tests__/SettlementPlacer.test.ts
git commit -m "feat(map): add settlement placement with scoring"
```

---

## Task 7: Road Generator (A* Pathfinding)

**Files:**
- Create: `src/core/map/RoadGenerator.ts`
- Create: `src/core/map/__tests__/RoadGenerator.test.ts`

Implements initial infrastructure from the design doc. Connects settlements via A* with terrain costs. Generates roads and railways based on `initialInfrastructure` setting.

### Step 1: Write failing tests

Create `src/core/map/__tests__/RoadGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RoadGenerator } from '../RoadGenerator';
import { TerrainGenerator } from '../TerrainGenerator';
import { RiverGenerator } from '../RiverGenerator';
import { SmoothingPass } from '../SmoothingPass';
import { SettlementPlacer } from '../SettlementPlacer';
import { SettlementType, TerrainType } from '../types';
import { HexGrid } from '../HexGrid';
import type { HexCell, RoutePath } from '../types';

describe('RoadGenerator', () => {
  function makeMap() {
    const cells = TerrainGenerator.generate(40, 30, 'mixed', 42);
    RiverGenerator.generate(cells, 40, 30, 42);
    SmoothingPass.apply(cells, 40, 30);
    SettlementPlacer.place(cells, 40, 30);
    return cells;
  }

  describe('generate', () => {
    it('produces road routes', () => {
      const cells = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, 'basic');
      expect(roads.length).toBeGreaterThan(0);
    });

    it('all roads have type road', () => {
      const cells = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, 'basic');
      for (const road of roads) {
        expect(road.type).toBe('road');
      }
    });

    it('road paths contain only adjacent hexes', () => {
      const cells = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, 'basic');
      for (const road of roads) {
        for (let i = 1; i < road.hexes.length; i++) {
          expect(HexGrid.distance(road.hexes[i - 1], road.hexes[i])).toBe(1);
        }
      }
    });

    it('roads avoid mountains and water', () => {
      const cells = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, 'basic');
      for (const road of roads) {
        for (const hex of road.hexes) {
          const cell = cells.get(HexGrid.key(hex))!;
          expect(cell.terrain).not.toBe(TerrainType.Mountain);
          expect(cell.terrain).not.toBe(TerrainType.Water);
        }
      }
    });

    it('produces no railways with infrastructure=none', () => {
      const cells = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, 'none');
      expect(railways.length).toBe(0);
    });

    it('produces some railways with infrastructure=basic', () => {
      const cells = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, 'basic');
      expect(railways.length).toBeGreaterThanOrEqual(1);
      expect(railways.length).toBeLessThanOrEqual(2);
    });

    it('produces railways between all cities with infrastructure=developed', () => {
      const cells = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, 'developed');
      expect(railways.length).toBeGreaterThanOrEqual(2);
    });

    it('all railways have type railway', () => {
      const cells = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, 'developed');
      for (const rail of railways) {
        expect(rail.type).toBe('railway');
      }
    });
  });

  describe('astar', () => {
    it('finds path between two adjacent hexes', () => {
      const cells = new Map<string, HexCell>();
      // Create a 3x3 grid of plains
      for (let q = 0; q < 3; q++) {
        for (let r = 0; r < 3; r++) {
          const coord = { q, r };
          cells.set(HexGrid.key(coord), {
            coord,
            terrain: TerrainType.Plains,
            elevation: 0.4,
            moisture: 0.3,
            riverEdges: new Set(),
            settlement: null,
          });
        }
      }
      const path = RoadGenerator.astar({ q: 0, r: 0 }, { q: 2, r: 0 }, cells, 3, 3);
      expect(path).not.toBeNull();
      expect(path![0]).toEqual({ q: 0, r: 0 });
      expect(path![path!.length - 1]).toEqual({ q: 2, r: 0 });
    });

    it('returns null if no path exists (surrounded by mountains)', () => {
      const cells = new Map<string, HexCell>();
      // Target surrounded by mountains
      cells.set('2,2', {
        coord: { q: 2, r: 2 },
        terrain: TerrainType.Plains,
        elevation: 0.4,
        moisture: 0.3,
        riverEdges: new Set(),
        settlement: null,
      });
      cells.set('0,0', {
        coord: { q: 0, r: 0 },
        terrain: TerrainType.Plains,
        elevation: 0.4,
        moisture: 0.3,
        riverEdges: new Set(),
        settlement: null,
      });
      for (const n of HexGrid.neighbors({ q: 2, r: 2 })) {
        cells.set(HexGrid.key(n), {
          coord: n,
          terrain: TerrainType.Mountain,
          elevation: 0.9,
          moisture: 0.3,
          riverEdges: new Set(),
          settlement: null,
        });
      }
      const path = RoadGenerator.astar({ q: 0, r: 0 }, { q: 2, r: 2 }, cells, 5, 5);
      expect(path).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/core/map/__tests__/RoadGenerator.test.ts`
Expected: FAIL — cannot resolve `../RoadGenerator`

**Step 3: Implement RoadGenerator**

Create `src/core/map/RoadGenerator.ts`:

```typescript
import type { HexCell, HexCoord, RoutePath } from './types';
import { TerrainType, SettlementType } from './types';
import { HexGrid } from './HexGrid';

type Infrastructure = 'none' | 'basic' | 'developed';

// Terrain movement costs for A*
const TERRAIN_COST: Record<TerrainType, number> = {
  [TerrainType.Plains]: 1,
  [TerrainType.Forest]: 2,
  [TerrainType.Hills]: 3,
  [TerrainType.Marsh]: 3,
  [TerrainType.Mountain]: Infinity,
  [TerrainType.Water]: Infinity,
};

export class RoadGenerator {
  static generate(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    infrastructure: Infrastructure
  ): { roads: RoutePath[]; railways: RoutePath[] } {
    const cities = [...cells.values()]
      .filter((c) => c.settlement === SettlementType.City)
      .map((c) => c.coord);
    const towns = [...cells.values()]
      .filter((c) => c.settlement === SettlementType.Town)
      .map((c) => c.coord);

    const roads: RoutePath[] = [];
    const usedPairs = new Set<string>();

    // Connect each town to its nearest city
    for (const town of towns) {
      let nearestCity: HexCoord | null = null;
      let nearestDist = Infinity;
      for (const city of cities) {
        const dist = HexGrid.distance(town, city);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestCity = city;
        }
      }
      if (nearestCity) {
        const pairKey = RoadGenerator.pairKey(town, nearestCity);
        if (!usedPairs.has(pairKey)) {
          const path = RoadGenerator.astar(town, nearestCity, cells, width, height);
          if (path) {
            roads.push({ hexes: path, type: 'road' });
            usedPairs.add(pairKey);
          }
        }
      }
    }

    // Connect cities to each other if within 20 hexes
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        if (HexGrid.distance(cities[i], cities[j]) <= 20) {
          const pairKey = RoadGenerator.pairKey(cities[i], cities[j]);
          if (!usedPairs.has(pairKey)) {
            const path = RoadGenerator.astar(cities[i], cities[j], cells, width, height);
            if (path) {
              roads.push({ hexes: path, type: 'road' });
              usedPairs.add(pairKey);
            }
          }
        }
      }
    }

    // Railways: subset of city-to-city connections
    const railways: RoutePath[] = [];
    if (infrastructure !== 'none') {
      const cityPairs: Array<{ from: HexCoord; to: HexCoord; dist: number }> = [];
      for (let i = 0; i < cities.length; i++) {
        for (let j = i + 1; j < cities.length; j++) {
          cityPairs.push({
            from: cities[i],
            to: cities[j],
            dist: HexGrid.distance(cities[i], cities[j]),
          });
        }
      }
      cityPairs.sort((a, b) => a.dist - b.dist);

      const railCount = infrastructure === 'basic'
        ? Math.min(2, cityPairs.length)
        : cityPairs.length;

      for (let i = 0; i < railCount; i++) {
        const path = RoadGenerator.astar(
          cityPairs[i].from, cityPairs[i].to, cells, width, height
        );
        if (path) {
          railways.push({ hexes: path, type: 'railway' });
        }
      }
    }

    return { roads, railways };
  }

  /** A* pathfinding with terrain costs */
  static astar(
    start: HexCoord,
    goal: HexCoord,
    cells: Map<string, HexCell>,
    width: number,
    height: number
  ): HexCoord[] | null {
    const startKey = HexGrid.key(start);
    const goalKey = HexGrid.key(goal);

    const openSet = new Map<string, { coord: HexCoord; f: number }>();
    openSet.set(startKey, { coord: start, f: HexGrid.distance(start, goal) });

    const gScore = new Map<string, number>();
    gScore.set(startKey, 0);

    const cameFrom = new Map<string, string>();

    while (openSet.size > 0) {
      // Find node with lowest f score
      let currentKey = '';
      let currentF = Infinity;
      for (const [key, node] of openSet) {
        if (node.f < currentF) {
          currentF = node.f;
          currentKey = key;
        }
      }

      if (currentKey === goalKey) {
        return RoadGenerator.reconstructPath(cameFrom, currentKey, cells);
      }

      const current = openSet.get(currentKey)!.coord;
      openSet.delete(currentKey);

      for (const neighbor of HexGrid.neighbors(current)) {
        if (!HexGrid.inBounds(neighbor, width, height)) continue;

        const neighborKey = HexGrid.key(neighbor);
        const neighborCell = cells.get(neighborKey);
        if (!neighborCell) continue;

        const cost = TERRAIN_COST[neighborCell.terrain];
        if (!isFinite(cost)) continue;

        const tentativeG = (gScore.get(currentKey) ?? Infinity) + cost;

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + HexGrid.distance(neighbor, goal);
          openSet.set(neighborKey, { coord: neighbor, f });
        }
      }
    }

    return null; // no path found
  }

  private static reconstructPath(
    cameFrom: Map<string, string>,
    endKey: string,
    cells: Map<string, HexCell>
  ): HexCoord[] {
    const path: HexCoord[] = [];
    let current = endKey;
    while (current) {
      const cell = cells.get(current)!;
      path.unshift(cell.coord);
      current = cameFrom.get(current)!;
    }
    return path;
  }

  private static pairKey(a: HexCoord, b: HexCoord): string {
    const keyA = HexGrid.key(a);
    const keyB = HexGrid.key(b);
    return keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/core/map/__tests__/RoadGenerator.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/map/RoadGenerator.ts src/core/map/__tests__/RoadGenerator.test.ts
git commit -m "feat(map): add road and railway generation with A* pathfinding"
```

---

## Task 8: Map Generator Orchestrator

**Files:**
- Create: `src/core/map/MapGenerator.ts`
- Create: `src/core/map/__tests__/MapGenerator.test.ts`
- Modify: `src/core/map/types.ts` — add `MapConfig` type
- Modify: `src/core/index.ts` — re-export map module

Orchestrates the full 4-phase pipeline. Single entry point: `MapGenerator.generate(config)`.

### Step 1: Add MapConfig type

Add to the end of `src/core/map/types.ts`:

```typescript
export interface MapConfig {
  mapSize: 'small' | 'medium' | 'large';
  geography: 'plains' | 'mixed' | 'mountainous';
  initialInfrastructure: 'none' | 'basic' | 'developed';
  seed: number;
}
```

### Step 2: Write failing tests

Create `src/core/map/__tests__/MapGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MapGenerator } from '../MapGenerator';
import { TerrainType, SettlementType } from '../types';
import type { MapConfig, GameMap } from '../types';

describe('MapGenerator', () => {
  const config: MapConfig = {
    mapSize: 'small',
    geography: 'mixed',
    initialInfrastructure: 'basic',
    seed: 42,
  };

  describe('generate', () => {
    it('returns a GameMap with correct dimensions for small', () => {
      const map = MapGenerator.generate(config);
      expect(map.width).toBe(40);
      expect(map.height).toBe(30);
    });

    it('returns correct dimensions for medium', () => {
      const map = MapGenerator.generate({ ...config, mapSize: 'medium' });
      expect(map.width).toBe(60);
      expect(map.height).toBe(45);
    });

    it('returns correct dimensions for large', () => {
      const map = MapGenerator.generate({ ...config, mapSize: 'large' });
      expect(map.width).toBe(80);
      expect(map.height).toBe(60);
    });

    it('populates cells map with correct count', () => {
      const map = MapGenerator.generate(config);
      expect(map.cells.size).toBe(40 * 30);
    });

    it('produces rivers', () => {
      const map = MapGenerator.generate(config);
      expect(map.rivers.length).toBeGreaterThan(0);
    });

    it('produces roads', () => {
      const map = MapGenerator.generate(config);
      expect(map.roads.length).toBeGreaterThan(0);
    });

    it('produces railways with basic infrastructure', () => {
      const map = MapGenerator.generate(config);
      expect(map.railways.length).toBeGreaterThanOrEqual(1);
    });

    it('has settlements placed', () => {
      const map = MapGenerator.generate(config);
      const settlements = [...map.cells.values()].filter(
        (c) => c.settlement !== null
      );
      expect(settlements.length).toBeGreaterThan(0);
    });

    it('is deterministic', () => {
      const a = MapGenerator.generate(config);
      const b = MapGenerator.generate(config);
      expect(a.cells.size).toBe(b.cells.size);
      expect(a.rivers.length).toBe(b.rivers.length);
      expect(a.roads.length).toBe(b.roads.length);
      for (const [key, cellA] of a.cells) {
        const cellB = b.cells.get(key)!;
        expect(cellA.terrain).toBe(cellB.terrain);
        expect(cellA.settlement).toBe(cellB.settlement);
      }
    });

    it('produces different maps with different seeds', () => {
      const a = MapGenerator.generate({ ...config, seed: 1 });
      const b = MapGenerator.generate({ ...config, seed: 2 });
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

**Step 3: Run tests to verify they fail**

Run: `bunx vitest run src/core/map/__tests__/MapGenerator.test.ts`
Expected: FAIL — cannot resolve `../MapGenerator`

**Step 4: Implement MapGenerator**

Create `src/core/map/MapGenerator.ts`:

```typescript
import type { GameMap, MapConfig } from './types';
import { TerrainGenerator } from './TerrainGenerator';
import { RiverGenerator } from './RiverGenerator';
import { SmoothingPass } from './SmoothingPass';
import { SettlementPlacer } from './SettlementPlacer';
import { RoadGenerator } from './RoadGenerator';

const MAP_SIZES: Record<string, { width: number; height: number }> = {
  small: { width: 40, height: 30 },
  medium: { width: 60, height: 45 },
  large: { width: 80, height: 60 },
};

export class MapGenerator {
  static generate(config: MapConfig): GameMap {
    const { width, height } = MAP_SIZES[config.mapSize];

    // Phase 1 & 2: Elevation + terrain assignment
    const cells = TerrainGenerator.generate(width, height, config.geography, config.seed);

    // Phase 3: Rivers
    const rivers = RiverGenerator.generate(cells, width, height, config.seed);

    // Phase 4: Smoothing
    SmoothingPass.apply(cells, width, height);

    // Settlement placement
    SettlementPlacer.place(cells, width, height);

    // Initial infrastructure
    const { roads, railways } = RoadGenerator.generate(
      cells, width, height, config.initialInfrastructure
    );

    return {
      width,
      height,
      cells,
      rivers,
      roads,
      railways,
    };
  }
}
```

**Step 5: Update barrel exports**

Update `src/core/index.ts`:

```typescript
/**
 * Core module - simulation logic
 */
export { MapGenerator } from './map/MapGenerator';
export { HexGrid } from './map/HexGrid';
export type { GameMap, HexCell, HexCoord, MapConfig } from './map/types';
export { TerrainType, SettlementType } from './map/types';
```

**Step 6: Run tests to verify they pass**

Run: `bunx vitest run src/core/map/__tests__/MapGenerator.test.ts`
Expected: All tests PASS

**Step 7: Run all tests**

Run: `bunx vitest run`
Expected: All tests PASS across all test files

**Step 8: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 9: Commit**

```bash
git add src/core/map/MapGenerator.ts src/core/map/__tests__/MapGenerator.test.ts src/core/map/types.ts src/core/index.ts
git commit -m "feat(map): add MapGenerator orchestrator and barrel exports"
```

---

## Task 9: Integration — Wire Into Game

**Files:**
- Modify: `src/game/Game.ts`

Connect MapGenerator to the existing Game class. Generate a map on init and log results. This is a minimal integration — rendering is a separate future task.

### Step 1: Modify Game.ts to generate a map

In `src/game/Game.ts`, add imports and call MapGenerator in `init()`:

Add import at top:
```typescript
import { MapGenerator } from '@core/map/MapGenerator';
import type { GameMap } from '@core/map/types';
import { TerrainType, SettlementType } from '@core/map/types';
```

Add a field:
```typescript
private map: GameMap | null = null;
```

In `init()`, before `this.drawTestScreen()`, add:
```typescript
this.map = MapGenerator.generate({
  mapSize: 'small',
  geography: 'mixed',
  initialInfrastructure: 'basic',
  seed: Date.now(),
});

const terrainCounts = new Map<string, number>();
for (const cell of this.map.cells.values()) {
  terrainCounts.set(cell.terrain, (terrainCounts.get(cell.terrain) ?? 0) + 1);
}
console.log('Map generated:', {
  size: `${this.map.width}x${this.map.height}`,
  cells: this.map.cells.size,
  rivers: this.map.rivers.length,
  roads: this.map.roads.length,
  railways: this.map.railways.length,
  terrain: Object.fromEntries(terrainCounts),
  cities: [...this.map.cells.values()].filter((c) => c.settlement === SettlementType.City).length,
  towns: [...this.map.cells.values()].filter((c) => c.settlement === SettlementType.Town).length,
});
```

### Step 2: Typecheck

Run: `bun run typecheck`
Expected: No errors

### Step 3: Run dev server and verify console output

Run: `bun run dev`
Expected: Browser opens, console shows map generation stats (terrain distribution, settlement count, route count)

### Step 4: Commit

```bash
git add src/game/Game.ts
git commit -m "feat: wire map generation into Game init"
```

---

## Summary

| Task | Module | Tests | Description |
|------|--------|-------|-------------|
| 0 | — | — | Install vitest + simplex-noise, configure |
| 1 | types.ts | — | Map type definitions |
| 2 | HexGrid.ts | 11 tests | Hex math utilities |
| 3 | TerrainGenerator.ts | 9 tests | Noise-based terrain generation |
| 4 | RiverGenerator.ts | 6 tests | Downhill river flow |
| 5 | SmoothingPass.ts | 4 tests | Terrain anomaly removal |
| 6 | SettlementPlacer.ts | 5 tests | City/town scoring & placement |
| 7 | RoadGenerator.ts | 9 tests | A* pathfinding for roads/railways |
| 8 | MapGenerator.ts | 9 tests | Full pipeline orchestrator |
| 9 | Game.ts | — | Integration, console verification |
