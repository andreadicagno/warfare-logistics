# Playground Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an interactive `/playground` route where the player places factories and depots on a hex map, draws supply lines, and watches resources flow via a tick-based demand-driven simulation engine.

**Architecture:** The playground is a parallel page alongside the existing map view — no existing code is modified. A hash router in `main.ts` chooses between the map view (`Game`) and the new `PlaygroundPage`. The simulation engine lives in `src/core/simulation/` as pure logic (no rendering), fully unit-tested. The UI lives in `src/ui/playground/` with HTML overlays (toolbar, time controls, info panel) and PixiJS layers (facility icons, supply line paths, shipment particles) rendered on top of the existing terrain map.

**Tech Stack:** TypeScript, PixiJS v8, Vitest, Bun, Vite (path aliases: `@core/*`, `@ui/*`, `@data/*`)

---

## Existing Code Reference

Key files the implementer must understand:

| File | What it does |
|------|-------------|
| `src/main.ts` | Entry point — creates PixiJS `Application`, inits `Game` |
| `src/game/Game.ts` | Orchestrates map generation, renderer, sidebar, debug overlay |
| `src/core/map/types.ts` | `HexCoord`, `HexCell`, `TerrainType`, `GameMap`, `GenerationParams` |
| `src/core/map/HexGrid.ts` | Static utility: `key()`, `neighbors()`, `distance()`, `line()`, `inBounds()` |
| `src/data/types.ts` | `ResourceType` enum, `ResourceStorage` interface |
| `src/ui/HexRenderer.ts` | `hexToPixel()`, `pixelToHex()`, `vertices()` — HEX_SIZE=16 |
| `src/ui/MapRenderer.ts` | Composes all layers, camera, pointer events, frame loop |
| `src/ui/Camera.ts` | Pan/zoom camera — `screenToWorld()`, `worldToScreen()` |
| `src/ui/layers/SelectionLayer.ts` | Hover highlight pattern (lightweight, no `build()`) |
| `src/ui/layers/SupplyHubLayer.ts` | Versioned layer pattern: `build(version)`, `updateData()`, `destroy()` |
| `src/ui/presets.ts` | `BUILT_IN_PRESETS` — generation parameter presets |

### Key Patterns

**Layer pattern** — Every render layer follows this structure:
```typescript
class SomeLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private builtVersion = -1;

  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();
    // draw everything
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Hex key format:** `HexGrid.key({q, r})` → `"q,r"` — used as Map keys.

**PixiJS v8 API:** `new Graphics()` with method chaining: `.poly(flat).fill({color, alpha}).stroke({width, color})`. No `beginFill/endFill`.

**ResourceStorage:** Keyed by enum string values: `{ fuel: 0, ammo: 0, food: 0, parts: 0 }`.

---

## Task 1: Simulation Types

Define all simulation-specific types in a single file. These types are used by every subsequent task.

**Files:**
- Create: `src/core/simulation/types.ts`

**Step 1: Write the type definitions**

```typescript
import type { HexCoord } from '@core/map/types';
import { ResourceType } from '@data/types';
import type { ResourceStorage } from '@data/types';

// ── Bible Tables ──

export const FACTORY_TABLE = [
  { level: 1, productionPerDay: 10, bufferCapacity: 20 },
  { level: 2, productionPerDay: 25, bufferCapacity: 50 },
  { level: 3, productionPerDay: 50, bufferCapacity: 100 },
  { level: 4, productionPerDay: 85, bufferCapacity: 170 },
  { level: 5, productionPerDay: 130, bufferCapacity: 260 },
] as const;

export const DEPOT_TABLE = [
  { level: 1, storagePerResource: 50, throughputPerDay: 60 },
  { level: 2, storagePerResource: 100, throughputPerDay: 120 },
  { level: 3, storagePerResource: 180, throughputPerDay: 200 },
  { level: 4, storagePerResource: 280, throughputPerDay: 300 },
  { level: 5, storagePerResource: 400, throughputPerDay: 420 },
] as const;

export const SUPPLY_LINE_TABLE = [
  { level: 1, capacityPerDay: 30, speedHexPerHour: 5 },
  { level: 2, capacityPerDay: 80, speedHexPerHour: 8 },
  { level: 3, capacityPerDay: 180, speedHexPerHour: 12 },
  { level: 4, capacityPerDay: 350, speedHexPerHour: 17 },
  { level: 5, capacityPerDay: 600, speedHexPerHour: 24 },
] as const;

export const RESOURCE_COLORS: Record<ResourceType, number> = {
  [ResourceType.Fuel]: 0xccaa22,
  [ResourceType.Ammo]: 0x666666,
  [ResourceType.Food]: 0x44aa44,
  [ResourceType.Parts]: 0xcc8833,
};

export const TICKS_PER_DAY = 1440;

// ── Impassable terrain for placement ──

export const IMPASSABLE_TERRAIN = new Set(['water', 'mountain']);

// ── Simulation Entities ──

export interface PlacedFactory {
  id: string;
  resourceType: ResourceType;
  level: number;
  hex: HexCoord;
  buffer: number;
  bufferCapacity: number;
  productionPerDay: number;
  connectedLineIds: string[];
}

export interface PlacedDepot {
  id: string;
  level: number;
  hex: HexCoord;
  storage: ResourceStorage;
  maxStoragePerResource: number;
  throughputPerDay: number;
  throughputUsedToday: number;
  connectedLineIds: string[];
}

export interface SimSupplyLine {
  id: string;
  level: number;
  hexPath: HexCoord[];
  capacityPerDay: number;
  speedHexPerHour: number;
  capacityUsedToday: number;
  connectedFacilityIds: string[];
}

export interface Shipment {
  id: string;
  resourceType: ResourceType;
  amount: number;
  sourceId: string;
  destinationId: string;
  path: HexCoord[];
  progress: number;
  speedHexPerHour: number;
}

export type FacilityEntity = PlacedFactory | PlacedDepot;

export function isFactory(entity: FacilityEntity): entity is PlacedFactory {
  return 'resourceType' in entity;
}

export function isDepot(entity: FacilityEntity): entity is PlacedDepot {
  return 'storage' in entity && !('resourceType' in entity);
}

// ── Simulation State ──

export interface SimulationState {
  tick: number;
  factories: Map<string, PlacedFactory>;
  depots: Map<string, PlacedDepot>;
  supplyLines: Map<string, SimSupplyLine>;
  shipments: Shipment[];
  occupiedHexes: Map<string, string>; // hex key → facility id
  version: number;
}

// ── Build Tools ──

export type BuildTool =
  | 'select'
  | 'fuel-factory'
  | 'ammo-factory'
  | 'food-factory'
  | 'parts-factory'
  | 'depot'
  | 'supply-line'
  | 'demolish';

export function emptyStorage(): ResourceStorage {
  return {
    [ResourceType.Fuel]: 0,
    [ResourceType.Ammo]: 0,
    [ResourceType.Food]: 0,
    [ResourceType.Parts]: 0,
  };
}
```

**Step 2: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS — no type errors.

**Step 3: Commit**

```bash
git add src/core/simulation/types.ts
git commit -m "feat(playground): add simulation type definitions"
```

---

## Task 2: NetworkGraph — Supply Network Pathfinding

Build the graph that connects facilities through supply lines for shortest-path routing.

**Files:**
- Create: `src/core/simulation/NetworkGraph.ts`
- Create: `src/core/simulation/__tests__/NetworkGraph.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { NetworkGraph } from '../NetworkGraph';

describe('NetworkGraph', () => {
  it('finds shortest path between two directly connected nodes', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    expect(graph.shortestPath('A', 'B')).toEqual(['A', 'B']);
  });

  it('finds shortest path through intermediate nodes', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    graph.addEdge('B', 'C', 1);
    graph.addEdge('A', 'C', 10);
    expect(graph.shortestPath('A', 'C')).toEqual(['A', 'B', 'C']);
  });

  it('returns null for disconnected nodes', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    expect(graph.shortestPath('A', 'C')).toBeNull();
  });

  it('returns single-element path for same source and destination', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    expect(graph.shortestPath('A', 'A')).toEqual(['A']);
  });

  it('handles bidirectional edges', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 2);
    graph.addEdge('B', 'A', 2);
    expect(graph.shortestPath('B', 'A')).toEqual(['B', 'A']);
  });

  it('prefers faster (lower weight) paths', () => {
    const graph = new NetworkGraph();
    // Fast path: A → D → C (weight 2)
    graph.addEdge('A', 'D', 1);
    graph.addEdge('D', 'C', 1);
    // Slow path: A → B → C (weight 20)
    graph.addEdge('A', 'B', 10);
    graph.addEdge('B', 'C', 10);
    expect(graph.shortestPath('A', 'C')).toEqual(['A', 'D', 'C']);
  });

  it('clears all edges', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    graph.clear();
    expect(graph.shortestPath('A', 'B')).toBeNull();
  });

  it('returns all reachable facility IDs from a node', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    graph.addEdge('B', 'C', 1);
    const reachable = graph.reachableFrom('A');
    expect(reachable).toContain('B');
    expect(reachable).toContain('C');
    expect(reachable).not.toContain('D');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/core/simulation/__tests__/NetworkGraph.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```typescript
/**
 * Weighted directed graph with Dijkstra shortest-path.
 * Nodes are string IDs (facility IDs or hex keys).
 * Edge weight = 1/speed (lower = faster path).
 */
export class NetworkGraph {
  private adjacency = new Map<string, Map<string, number>>();

  addEdge(from: string, to: string, weight: number): void {
    if (!this.adjacency.has(from)) this.adjacency.set(from, new Map());
    if (!this.adjacency.has(to)) this.adjacency.set(to, new Map());
    const existing = this.adjacency.get(from)!.get(to);
    if (existing === undefined || weight < existing) {
      this.adjacency.get(from)!.set(to, weight);
    }
  }

  clear(): void {
    this.adjacency.clear();
  }

  shortestPath(from: string, to: string): string[] | null {
    if (from === to) return [from];
    if (!this.adjacency.has(from) || !this.adjacency.has(to)) return null;

    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const visited = new Set<string>();

    // Simple priority queue via sorted array (adequate for small graphs)
    const queue: Array<{ node: string; cost: number }> = [];

    dist.set(from, 0);
    queue.push({ node: from, cost: 0 });

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const { node, cost } = queue.shift()!;

      if (visited.has(node)) continue;
      visited.add(node);

      if (node === to) {
        // Reconstruct path
        const path: string[] = [];
        let current: string | undefined = to;
        while (current !== undefined) {
          path.unshift(current);
          current = prev.get(current);
        }
        return path;
      }

      const neighbors = this.adjacency.get(node);
      if (!neighbors) continue;

      for (const [neighbor, weight] of neighbors) {
        if (visited.has(neighbor)) continue;
        const newCost = cost + weight;
        const oldCost = dist.get(neighbor);
        if (oldCost === undefined || newCost < oldCost) {
          dist.set(neighbor, newCost);
          prev.set(neighbor, node);
          queue.push({ node: neighbor, cost: newCost });
        }
      }
    }

    return null;
  }

  reachableFrom(start: string): string[] {
    const visited = new Set<string>();
    const stack = [start];

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      const neighbors = this.adjacency.get(node);
      if (neighbors) {
        for (const neighbor of neighbors.keys()) {
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
      }
    }

    visited.delete(start);
    return [...visited];
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/core/simulation/__tests__/NetworkGraph.test.ts`
Expected: PASS — all 8 tests green.

**Step 5: Commit**

```bash
git add src/core/simulation/NetworkGraph.ts src/core/simulation/__tests__/NetworkGraph.test.ts
git commit -m "feat(playground): add NetworkGraph with Dijkstra pathfinding"
```

---

## Task 3: ProductionPhase

Factories produce resources each tick and fill their internal buffer.

**Files:**
- Create: `src/core/simulation/ProductionPhase.ts`
- Create: `src/core/simulation/__tests__/ProductionPhase.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { ResourceType } from '@data/types';
import { ProductionPhase } from '../ProductionPhase';
import type { PlacedFactory } from '../types';
import { TICKS_PER_DAY } from '../types';

function makeFactory(overrides: Partial<PlacedFactory> = {}): PlacedFactory {
  return {
    id: 'f1',
    resourceType: ResourceType.Fuel,
    level: 1,
    hex: { q: 0, r: 0 },
    buffer: 0,
    bufferCapacity: 20,
    productionPerDay: 10,
    connectedLineIds: [],
    ...overrides,
  };
}

describe('ProductionPhase', () => {
  it('adds per-tick production to the factory buffer', () => {
    const factory = makeFactory();
    ProductionPhase.run([factory]);
    const expectedPerTick = 10 / TICKS_PER_DAY;
    expect(factory.buffer).toBeCloseTo(expectedPerTick);
  });

  it('caps buffer at bufferCapacity', () => {
    const factory = makeFactory({ buffer: 19.999, bufferCapacity: 20 });
    ProductionPhase.run([factory]);
    expect(factory.buffer).toBe(20);
  });

  it('does not exceed bufferCapacity even with high production', () => {
    const factory = makeFactory({ buffer: 20, bufferCapacity: 20 });
    ProductionPhase.run([factory]);
    expect(factory.buffer).toBe(20);
  });

  it('processes multiple factories independently', () => {
    const f1 = makeFactory({ id: 'f1', buffer: 0, productionPerDay: 10 });
    const f2 = makeFactory({ id: 'f2', buffer: 10, productionPerDay: 25 });
    ProductionPhase.run([f1, f2]);
    expect(f1.buffer).toBeCloseTo(10 / TICKS_PER_DAY);
    expect(f2.buffer).toBeCloseTo(10 + 25 / TICKS_PER_DAY);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/core/simulation/__tests__/ProductionPhase.test.ts`
Expected: FAIL.

**Step 3: Write the implementation**

```typescript
import type { PlacedFactory } from './types';
import { TICKS_PER_DAY } from './types';

export class ProductionPhase {
  static run(factories: PlacedFactory[]): void {
    for (const factory of factories) {
      if (factory.buffer >= factory.bufferCapacity) continue;
      const perTick = factory.productionPerDay / TICKS_PER_DAY;
      factory.buffer = Math.min(factory.buffer + perTick, factory.bufferCapacity);
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/core/simulation/__tests__/ProductionPhase.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/simulation/ProductionPhase.ts src/core/simulation/__tests__/ProductionPhase.test.ts
git commit -m "feat(playground): add ProductionPhase — factories fill buffers each tick"
```

---

## Task 4: TransportPhase

Move shipments along their paths and deliver on arrival.

**Files:**
- Create: `src/core/simulation/TransportPhase.ts`
- Create: `src/core/simulation/__tests__/TransportPhase.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { ResourceType } from '@data/types';
import { TransportPhase } from '../TransportPhase';
import type { PlacedDepot, Shipment } from '../types';
import { emptyStorage, TICKS_PER_DAY } from '../types';

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 's1',
    resourceType: ResourceType.Fuel,
    amount: 5,
    sourceId: 'f1',
    destinationId: 'd1',
    path: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
    progress: 0,
    speedHexPerHour: 60, // 1 hex/min = 60 hex/hr → crosses 3-hex path in 3 ticks
    ...overrides,
  };
}

function makeDepot(overrides: Partial<PlacedDepot> = {}): PlacedDepot {
  return {
    id: 'd1',
    level: 1,
    hex: { q: 2, r: 0 },
    storage: emptyStorage(),
    maxStoragePerResource: 50,
    throughputPerDay: 60,
    throughputUsedToday: 0,
    connectedLineIds: [],
    ...overrides,
  };
}

describe('TransportPhase', () => {
  it('advances shipment progress based on speed and path length', () => {
    const shipment = makeShipment({ speedHexPerHour: 6 }); // 0.1 hex/min
    const depots = new Map<string, PlacedDepot>();
    const result = TransportPhase.run([shipment], depots);
    // progress increment = speedHexPerHour / (pathLength * 60) = 6 / (3 * 60) = 0.0333...
    expect(shipment.progress).toBeCloseTo(1 / 30);
    expect(result.delivered).toHaveLength(0);
    expect(result.active).toHaveLength(1);
  });

  it('delivers shipment when progress >= 1.0', () => {
    const shipment = makeShipment({ progress: 0.99, speedHexPerHour: 60 });
    const depot = makeDepot();
    const depots = new Map([['d1', depot]]);
    const result = TransportPhase.run([shipment], depots);
    expect(result.delivered).toHaveLength(1);
    expect(result.active).toHaveLength(0);
    expect(depot.storage[ResourceType.Fuel]).toBe(5);
  });

  it('caps delivered resources at depot max storage', () => {
    const shipment = makeShipment({ progress: 0.99, speedHexPerHour: 60, amount: 100 });
    const depot = makeDepot({ storage: { ...emptyStorage(), [ResourceType.Fuel]: 40 } });
    const depots = new Map([['d1', depot]]);
    TransportPhase.run([shipment], depots);
    expect(depot.storage[ResourceType.Fuel]).toBe(50);
  });

  it('drops shipment if destination depot no longer exists', () => {
    const shipment = makeShipment({ progress: 0.99, speedHexPerHour: 60 });
    const depots = new Map<string, PlacedDepot>();
    const result = TransportPhase.run([shipment], depots);
    expect(result.delivered).toHaveLength(1);
    expect(result.active).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/core/simulation/__tests__/TransportPhase.test.ts`
Expected: FAIL.

**Step 3: Write the implementation**

```typescript
import type { PlacedDepot, Shipment } from './types';

export interface TransportResult {
  active: Shipment[];
  delivered: Shipment[];
}

export class TransportPhase {
  static run(shipments: Shipment[], depots: Map<string, PlacedDepot>): TransportResult {
    const active: Shipment[] = [];
    const delivered: Shipment[] = [];

    for (const shipment of shipments) {
      const pathLength = shipment.path.length;
      const progressPerTick = shipment.speedHexPerHour / (pathLength * 60);
      shipment.progress += progressPerTick;

      if (shipment.progress >= 1.0) {
        // Deliver
        const depot = depots.get(shipment.destinationId);
        if (depot) {
          const space = depot.maxStoragePerResource - depot.storage[shipment.resourceType];
          const toDeliver = Math.min(shipment.amount, Math.max(0, space));
          depot.storage[shipment.resourceType] += toDeliver;
        }
        delivered.push(shipment);
      } else {
        active.push(shipment);
      }
    }

    return { active, delivered };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/core/simulation/__tests__/TransportPhase.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/simulation/TransportPhase.ts src/core/simulation/__tests__/TransportPhase.test.ts
git commit -m "feat(playground): add TransportPhase — move and deliver shipments"
```

---

## Task 5: DemandResolver

Depots broadcast demand, find sources via shortest path, create shipments.

**Files:**
- Create: `src/core/simulation/DemandResolver.ts`
- Create: `src/core/simulation/__tests__/DemandResolver.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { ResourceType } from '@data/types';
import { DemandResolver } from '../DemandResolver';
import { NetworkGraph } from '../NetworkGraph';
import type { PlacedDepot, PlacedFactory, SimSupplyLine } from '../types';
import { emptyStorage } from '../types';

function makeFactory(overrides: Partial<PlacedFactory> = {}): PlacedFactory {
  return {
    id: 'f1',
    resourceType: ResourceType.Fuel,
    level: 1,
    hex: { q: 0, r: 0 },
    buffer: 10,
    bufferCapacity: 20,
    productionPerDay: 10,
    connectedLineIds: ['sl1'],
    ...overrides,
  };
}

function makeDepot(overrides: Partial<PlacedDepot> = {}): PlacedDepot {
  return {
    id: 'd1',
    level: 1,
    hex: { q: 3, r: 0 },
    storage: emptyStorage(),
    maxStoragePerResource: 50,
    throughputPerDay: 60,
    throughputUsedToday: 0,
    connectedLineIds: ['sl1'],
    ...overrides,
  };
}

function makeSupplyLine(overrides: Partial<SimSupplyLine> = {}): SimSupplyLine {
  return {
    id: 'sl1',
    level: 1,
    hexPath: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }],
    capacityPerDay: 30,
    speedHexPerHour: 5,
    capacityUsedToday: 0,
    connectedFacilityIds: ['f1', 'd1'],
    ...overrides,
  };
}

function buildGraph(factories: PlacedFactory[], depots: PlacedDepot[], lines: SimSupplyLine[]): NetworkGraph {
  const graph = new NetworkGraph();
  for (const line of lines) {
    for (const facId of line.connectedFacilityIds) {
      for (const otherId of line.connectedFacilityIds) {
        if (facId !== otherId) {
          graph.addEdge(facId, otherId, 1 / line.speedHexPerHour);
        }
      }
    }
  }
  return graph;
}

describe('DemandResolver', () => {
  it('creates a shipment from factory to demanding depot', () => {
    const factory = makeFactory({ buffer: 10 });
    const depot = makeDepot({ storage: emptyStorage() });
    const line = makeSupplyLine();
    const graph = buildGraph([factory], [depot], [line]);

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map([['sl1', line]]),
      graph,
    );

    expect(shipments.length).toBeGreaterThan(0);
    expect(shipments[0].sourceId).toBe('f1');
    expect(shipments[0].destinationId).toBe('d1');
    expect(shipments[0].resourceType).toBe(ResourceType.Fuel);
    expect(factory.buffer).toBeLessThan(10);
  });

  it('does not create shipment when depot is full', () => {
    const depot = makeDepot({
      storage: {
        [ResourceType.Fuel]: 50,
        [ResourceType.Ammo]: 50,
        [ResourceType.Food]: 50,
        [ResourceType.Parts]: 50,
      },
    });
    const factory = makeFactory({ buffer: 10 });
    const line = makeSupplyLine();
    const graph = buildGraph([factory], [depot], [line]);

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map([['sl1', line]]),
      graph,
    );

    expect(shipments).toHaveLength(0);
  });

  it('does not create shipment when factory buffer is empty', () => {
    const factory = makeFactory({ buffer: 0 });
    const depot = makeDepot();
    const line = makeSupplyLine();
    const graph = buildGraph([factory], [depot], [line]);

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map([['sl1', line]]),
      graph,
    );

    expect(shipments).toHaveLength(0);
  });

  it('respects supply line capacity per day', () => {
    const factory = makeFactory({ buffer: 20 });
    const depot = makeDepot();
    const line = makeSupplyLine({ capacityPerDay: 5, capacityUsedToday: 5 });
    const graph = buildGraph([factory], [depot], [line]);

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map([['sl1', line]]),
      graph,
    );

    expect(shipments).toHaveLength(0);
  });

  it('does not create shipment when no path exists', () => {
    const factory = makeFactory({ connectedLineIds: [] });
    const depot = makeDepot({ connectedLineIds: [] });
    const graph = new NetworkGraph(); // empty graph

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map(),
      graph,
    );

    expect(shipments).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/core/simulation/__tests__/DemandResolver.test.ts`
Expected: FAIL.

**Step 3: Write the implementation**

```typescript
import { ResourceType } from '@data/types';
import { NetworkGraph } from './NetworkGraph';
import type { PlacedDepot, PlacedFactory, Shipment, SimSupplyLine } from './types';
import { TICKS_PER_DAY } from './types';

let nextShipmentId = 0;

export class DemandResolver {
  static resolve(
    factories: Map<string, PlacedFactory>,
    depots: Map<string, PlacedDepot>,
    supplyLines: Map<string, SimSupplyLine>,
    network: NetworkGraph,
  ): Shipment[] {
    const shipments: Shipment[] = [];
    const resourceTypes = Object.values(ResourceType);

    for (const depot of depots.values()) {
      for (const resType of resourceTypes) {
        const demand = depot.maxStoragePerResource - depot.storage[resType];
        if (demand <= 0) continue;

        // Find sources — factories producing this resource type with buffer > 0
        const sources: PlacedFactory[] = [];
        for (const factory of factories.values()) {
          if (factory.resourceType === resType && factory.buffer > 0) {
            sources.push(factory);
          }
        }

        if (sources.length === 0) continue;

        // Sort by distance (path length) — closest first
        const sourcesWithPath = sources
          .map((factory) => ({
            factory,
            path: network.shortestPath(factory.id, depot.id),
          }))
          .filter((s): s is { factory: PlacedFactory; path: string[] } => s.path !== null)
          .sort((a, b) => a.path.length - b.path.length);

        let remainingDemand = demand;

        for (const { factory, path } of sourcesWithPath) {
          if (remainingDemand <= 0) break;
          if (factory.buffer <= 0) continue;

          // Find the supply line connecting these facilities
          const line = DemandResolver.findLine(factory.id, depot.id, supplyLines);
          if (!line) continue;

          // Check capacity
          const remainingCapacity = line.capacityPerDay - line.capacityUsedToday;
          if (remainingCapacity <= 0) continue;

          // Determine shipment amount
          const perTickCapacity = remainingCapacity / TICKS_PER_DAY;
          const amount = Math.min(factory.buffer, remainingDemand, perTickCapacity);
          if (amount <= 0.001) continue;

          // Deduct from source
          factory.buffer -= amount;

          // Build hex path from factory hex to depot hex via supply line
          const hexPath = line.hexPath;

          shipments.push({
            id: `ship-${++nextShipmentId}`,
            resourceType: resType,
            amount,
            sourceId: factory.id,
            destinationId: depot.id,
            path: hexPath,
            progress: 0,
            speedHexPerHour: line.speedHexPerHour,
          });

          line.capacityUsedToday += amount;
          remainingDemand -= amount;
        }
      }
    }

    return shipments;
  }

  private static findLine(
    sourceId: string,
    destId: string,
    supplyLines: Map<string, SimSupplyLine>,
  ): SimSupplyLine | null {
    for (const line of supplyLines.values()) {
      if (
        line.connectedFacilityIds.includes(sourceId) &&
        line.connectedFacilityIds.includes(destId)
      ) {
        return line;
      }
    }
    return null;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/core/simulation/__tests__/DemandResolver.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/simulation/DemandResolver.ts src/core/simulation/__tests__/DemandResolver.test.ts
git commit -m "feat(playground): add DemandResolver — demand-driven shipment dispatch"
```

---

## Task 6: Simulation Engine

Main engine that wires phases together, manages state, and provides add/remove APIs.

**Files:**
- Create: `src/core/simulation/Simulation.ts`
- Create: `src/core/simulation/__tests__/Simulation.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { ResourceType } from '@data/types';
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCell } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { Simulation } from '../Simulation';

function makeMap(): GameMap {
  const cells = new Map<string, HexCell>();
  // Create a 10x10 plains grid
  for (let q = 0; q < 10; q++) {
    for (let r = 0; r < 10; r++) {
      const coord = { q, r };
      cells.set(HexGrid.key(coord), {
        coord,
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
    supplyHubs: [],
    supplyLines: [],
  };
}

describe('Simulation', () => {
  it('initializes at tick 0', () => {
    const sim = new Simulation(makeMap());
    expect(sim.state.tick).toBe(0);
  });

  it('adds a factory on a valid hex', () => {
    const sim = new Simulation(makeMap());
    const result = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    expect(result).not.toBeNull();
    expect(sim.state.factories.size).toBe(1);
    expect(sim.state.occupiedHexes.has(HexGrid.key({ q: 0, r: 0 }))).toBe(true);
  });

  it('rejects factory on occupied hex', () => {
    const sim = new Simulation(makeMap());
    sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    const result = sim.addFactory({ q: 0, r: 0 }, ResourceType.Ammo);
    expect(result).toBeNull();
  });

  it('rejects factory on water terrain', () => {
    const map = makeMap();
    const waterHex = { q: 5, r: 5 };
    map.cells.set(HexGrid.key(waterHex), {
      coord: waterHex,
      terrain: TerrainType.Water,
      elevation: 0,
      moisture: 1,
      urbanClusterId: null,
    });
    const sim = new Simulation(map);
    const result = sim.addFactory(waterHex, ResourceType.Fuel);
    expect(result).toBeNull();
  });

  it('adds a depot on a valid hex', () => {
    const sim = new Simulation(makeMap());
    const result = sim.addDepot({ q: 3, r: 3 });
    expect(result).not.toBeNull();
    expect(sim.state.depots.size).toBe(1);
  });

  it('adds a supply line between two hexes', () => {
    const sim = new Simulation(makeMap());
    const result = sim.addSupplyLine({ q: 0, r: 0 }, { q: 3, r: 0 });
    expect(result).not.toBeNull();
    expect(sim.state.supplyLines.size).toBe(1);
    expect(result!.hexPath.length).toBeGreaterThanOrEqual(2);
  });

  it('auto-connects facilities adjacent to supply line', () => {
    const sim = new Simulation(makeMap());
    const factory = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    const depot = sim.addDepot({ q: 3, r: 0 });
    const line = sim.addSupplyLine({ q: 0, r: 0 }, { q: 3, r: 0 });

    expect(factory!.connectedLineIds).toContain(line!.id);
    expect(depot!.connectedLineIds).toContain(line!.id);
    expect(line!.connectedFacilityIds).toContain(factory!.id);
    expect(line!.connectedFacilityIds).toContain(depot!.id);
  });

  it('advances tick and produces resources', () => {
    const sim = new Simulation(makeMap());
    sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    sim.tick();
    expect(sim.state.tick).toBe(1);
    const factory = [...sim.state.factories.values()][0];
    expect(factory.buffer).toBeGreaterThan(0);
  });

  it('removes a factory via demolish', () => {
    const sim = new Simulation(makeMap());
    const factory = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    sim.demolish(factory!.id);
    expect(sim.state.factories.size).toBe(0);
    expect(sim.state.occupiedHexes.has(HexGrid.key({ q: 0, r: 0 }))).toBe(false);
  });

  it('removes a supply line via demolish', () => {
    const sim = new Simulation(makeMap());
    const line = sim.addSupplyLine({ q: 0, r: 0 }, { q: 3, r: 0 });
    sim.demolish(line!.id);
    expect(sim.state.supplyLines.size).toBe(0);
  });

  it('upgrades a factory', () => {
    const sim = new Simulation(makeMap());
    const factory = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    sim.upgrade(factory!.id);
    const upgraded = sim.state.factories.get(factory!.id);
    expect(upgraded!.level).toBe(2);
    expect(upgraded!.productionPerDay).toBe(25);
    expect(upgraded!.bufferCapacity).toBe(50);
  });

  it('does not upgrade beyond level 5', () => {
    const sim = new Simulation(makeMap());
    const factory = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    for (let i = 0; i < 5; i++) sim.upgrade(factory!.id);
    const f = sim.state.factories.get(factory!.id)!;
    expect(f.level).toBe(5);
  });

  it('resets daily capacities at start of new day', () => {
    const sim = new Simulation(makeMap());
    sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    sim.addDepot({ q: 3, r: 0 });
    const line = sim.addSupplyLine({ q: 0, r: 0 }, { q: 3, r: 0 });

    // Simulate one full day
    for (let i = 0; i < 1440; i++) sim.tick();

    const sl = sim.state.supplyLines.get(line!.id)!;
    // capacityUsedToday should have been reset at tick 1440
    expect(sl.capacityUsedToday).toBeLessThanOrEqual(sl.capacityPerDay);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/core/simulation/__tests__/Simulation.test.ts`
Expected: FAIL.

**Step 3: Write the implementation**

```typescript
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import type { ResourceType } from '@data/types';
import { DemandResolver } from './DemandResolver';
import { NetworkGraph } from './NetworkGraph';
import { ProductionPhase } from './ProductionPhase';
import { TransportPhase } from './TransportPhase';
import type { PlacedDepot, PlacedFactory, SimSupplyLine, SimulationState } from './types';
import {
  DEPOT_TABLE,
  FACTORY_TABLE,
  IMPASSABLE_TERRAIN,
  SUPPLY_LINE_TABLE,
  TICKS_PER_DAY,
  emptyStorage,
} from './types';

let nextId = 0;
const uid = (): string => `e-${++nextId}`;

export class Simulation {
  readonly state: SimulationState;
  private readonly gameMap: GameMap;
  private network = new NetworkGraph();

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.state = {
      tick: 0,
      factories: new Map(),
      depots: new Map(),
      supplyLines: new Map(),
      shipments: [],
      occupiedHexes: new Map(),
      version: 0,
    };
  }

  // ── Tick ──

  tick(): void {
    this.state.tick++;

    // Reset daily counters at start of each day
    if (this.state.tick % TICKS_PER_DAY === 0) {
      for (const line of this.state.supplyLines.values()) {
        line.capacityUsedToday = 0;
      }
      for (const depot of this.state.depots.values()) {
        depot.throughputUsedToday = 0;
      }
    }

    // Phase 1: Production
    ProductionPhase.run([...this.state.factories.values()]);

    // Phase 2: Demand resolution → create new shipments
    const newShipments = DemandResolver.resolve(
      this.state.factories,
      this.state.depots,
      this.state.supplyLines,
      this.network,
    );
    this.state.shipments.push(...newShipments);

    // Phase 3: Transport
    const result = TransportPhase.run(this.state.shipments, this.state.depots);
    this.state.shipments = result.active;

    this.state.version++;
  }

  // ── Build Operations ──

  addFactory(hex: HexCoord, resourceType: ResourceType): PlacedFactory | null {
    if (!this.canPlace(hex)) return null;

    const stats = FACTORY_TABLE[0]; // Level 1
    const factory: PlacedFactory = {
      id: uid(),
      resourceType,
      level: 1,
      hex,
      buffer: 0,
      bufferCapacity: stats.bufferCapacity,
      productionPerDay: stats.productionPerDay,
      connectedLineIds: [],
    };

    this.state.factories.set(factory.id, factory);
    this.state.occupiedHexes.set(HexGrid.key(hex), factory.id);
    this.connectFacilityToLines(factory.id, hex);
    this.rebuildNetwork();
    this.state.version++;
    return factory;
  }

  addDepot(hex: HexCoord): PlacedDepot | null {
    if (!this.canPlace(hex)) return null;

    const stats = DEPOT_TABLE[0]; // Level 1
    const depot: PlacedDepot = {
      id: uid(),
      level: 1,
      hex,
      storage: emptyStorage(),
      maxStoragePerResource: stats.storagePerResource,
      throughputPerDay: stats.throughputPerDay,
      throughputUsedToday: 0,
      connectedLineIds: [],
    };

    this.state.depots.set(depot.id, depot);
    this.state.occupiedHexes.set(HexGrid.key(hex), depot.id);
    this.connectFacilityToLines(depot.id, hex);
    this.rebuildNetwork();
    this.state.version++;
    return depot;
  }

  addSupplyLine(from: HexCoord, to: HexCoord): SimSupplyLine | null {
    const hexPath = this.routePath(from, to);
    if (!hexPath || hexPath.length < 2) return null;

    const stats = SUPPLY_LINE_TABLE[0]; // Level 1
    const line: SimSupplyLine = {
      id: uid(),
      level: 1,
      hexPath,
      capacityPerDay: stats.capacityPerDay,
      speedHexPerHour: stats.speedHexPerHour,
      capacityUsedToday: 0,
      connectedFacilityIds: [],
    };

    this.state.supplyLines.set(line.id, line);
    this.connectLineToFacilities(line);
    this.rebuildNetwork();
    this.state.version++;
    return line;
  }

  demolish(entityId: string): void {
    // Try factory
    const factory = this.state.factories.get(entityId);
    if (factory) {
      this.state.factories.delete(entityId);
      this.state.occupiedHexes.delete(HexGrid.key(factory.hex));
      this.disconnectFacility(entityId);
      this.rebuildNetwork();
      this.state.version++;
      return;
    }

    // Try depot
    const depot = this.state.depots.get(entityId);
    if (depot) {
      this.state.depots.delete(entityId);
      this.state.occupiedHexes.delete(HexGrid.key(depot.hex));
      this.disconnectFacility(entityId);
      this.rebuildNetwork();
      this.state.version++;
      return;
    }

    // Try supply line
    const line = this.state.supplyLines.get(entityId);
    if (line) {
      this.state.supplyLines.delete(entityId);
      // Remove line reference from connected facilities
      for (const facId of line.connectedFacilityIds) {
        const fac = this.state.factories.get(facId) ?? this.state.depots.get(facId);
        if (fac) {
          fac.connectedLineIds = fac.connectedLineIds.filter((id) => id !== entityId);
        }
      }
      this.rebuildNetwork();
      this.state.version++;
    }
  }

  upgrade(entityId: string): void {
    const factory = this.state.factories.get(entityId);
    if (factory && factory.level < 5) {
      factory.level++;
      const stats = FACTORY_TABLE[factory.level - 1];
      factory.productionPerDay = stats.productionPerDay;
      factory.bufferCapacity = stats.bufferCapacity;
      this.state.version++;
      return;
    }

    const depot = this.state.depots.get(entityId);
    if (depot && depot.level < 5) {
      depot.level++;
      const stats = DEPOT_TABLE[depot.level - 1];
      depot.maxStoragePerResource = stats.storagePerResource;
      depot.throughputPerDay = stats.throughputPerDay;
      this.state.version++;
      return;
    }

    const line = this.state.supplyLines.get(entityId);
    if (line && line.level < 5) {
      line.level++;
      const stats = SUPPLY_LINE_TABLE[line.level - 1];
      line.capacityPerDay = stats.capacityPerDay;
      line.speedHexPerHour = stats.speedHexPerHour;
      this.state.version++;
    }
  }

  // ── Queries ──

  getFacilityAt(hex: HexCoord): PlacedFactory | PlacedDepot | null {
    const id = this.state.occupiedHexes.get(HexGrid.key(hex));
    if (!id) return null;
    return this.state.factories.get(id) ?? this.state.depots.get(id) ?? null;
  }

  getSupplyLineAt(hex: HexCoord): SimSupplyLine | null {
    const key = HexGrid.key(hex);
    for (const line of this.state.supplyLines.values()) {
      if (line.hexPath.some((h) => HexGrid.key(h) === key)) {
        return line;
      }
    }
    return null;
  }

  // ── Internal Helpers ──

  private canPlace(hex: HexCoord): boolean {
    if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) return false;
    const cell = this.gameMap.cells.get(HexGrid.key(hex));
    if (!cell || IMPASSABLE_TERRAIN.has(cell.terrain)) return false;
    if (this.state.occupiedHexes.has(HexGrid.key(hex))) return false;
    return true;
  }

  private routePath(from: HexCoord, to: HexCoord): HexCoord[] | null {
    // Simple straight-line routing, skipping impassable hexes
    const path = HexGrid.line(from, to);
    for (const hex of path) {
      if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) return null;
      const cell = this.gameMap.cells.get(HexGrid.key(hex));
      if (!cell || IMPASSABLE_TERRAIN.has(cell.terrain)) return null;
    }
    return path;
  }

  private connectFacilityToLines(facilityId: string, hex: HexCoord): void {
    const neighbors = new Set<string>();
    neighbors.add(HexGrid.key(hex));
    for (const n of HexGrid.neighbors(hex)) {
      neighbors.add(HexGrid.key(n));
    }

    for (const line of this.state.supplyLines.values()) {
      const adjacent = line.hexPath.some((h) => neighbors.has(HexGrid.key(h)));
      if (adjacent && !line.connectedFacilityIds.includes(facilityId)) {
        line.connectedFacilityIds.push(facilityId);
        const fac = this.state.factories.get(facilityId) ?? this.state.depots.get(facilityId);
        if (fac && !fac.connectedLineIds.includes(line.id)) {
          fac.connectedLineIds.push(line.id);
        }
      }
    }
  }

  private connectLineToFacilities(line: SimSupplyLine): void {
    const lineHexKeys = new Set(line.hexPath.map((h) => HexGrid.key(h)));

    // Also include neighbors of each hex in the path
    const adjacentKeys = new Set<string>();
    for (const hex of line.hexPath) {
      adjacentKeys.add(HexGrid.key(hex));
      for (const n of HexGrid.neighbors(hex)) {
        adjacentKeys.add(HexGrid.key(n));
      }
    }

    const allFacilities = [
      ...this.state.factories.values(),
      ...this.state.depots.values(),
    ];

    for (const fac of allFacilities) {
      if (adjacentKeys.has(HexGrid.key(fac.hex))) {
        if (!line.connectedFacilityIds.includes(fac.id)) {
          line.connectedFacilityIds.push(fac.id);
        }
        if (!fac.connectedLineIds.includes(line.id)) {
          fac.connectedLineIds.push(line.id);
        }
      }
    }
  }

  private disconnectFacility(facilityId: string): void {
    for (const line of this.state.supplyLines.values()) {
      line.connectedFacilityIds = line.connectedFacilityIds.filter((id) => id !== facilityId);
    }
  }

  private rebuildNetwork(): void {
    this.network.clear();
    for (const line of this.state.supplyLines.values()) {
      const weight = 1 / line.speedHexPerHour;
      const facs = line.connectedFacilityIds;
      for (let i = 0; i < facs.length; i++) {
        for (let j = i + 1; j < facs.length; j++) {
          this.network.addEdge(facs[i], facs[j], weight);
          this.network.addEdge(facs[j], facs[i], weight);
        }
      }
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/core/simulation/__tests__/Simulation.test.ts`
Expected: PASS.

**Step 5: Run all simulation tests together**

Run: `bun run test -- src/core/simulation/`
Expected: PASS — all tests green.

**Step 6: Run full quality check**

Run: `bun run check`
Expected: PASS — lint, typecheck, tests all green.

**Step 7: Commit**

```bash
git add src/core/simulation/Simulation.ts src/core/simulation/__tests__/Simulation.test.ts
git commit -m "feat(playground): add Simulation engine — tick loop, build/demolish/upgrade APIs"
```

---

## Task 7: Hash Router

Add a simple hash router to `main.ts` so `#/playground` loads the playground and `#/` loads the existing map view.

**Files:**
- Modify: `src/main.ts`

**Step 1: Modify main.ts to add hash routing**

The updated `main.ts` should:
1. Create the PixiJS `Application` as before
2. Check `location.hash` to decide which page to initialize
3. On `#/playground` → create and init `PlaygroundPage` (to be implemented in Task 8)
4. Otherwise → create and init `Game` (existing behavior)
5. Listen for `hashchange` to support switching (reload-based for simplicity)

```typescript
import { Game } from '@game/Game';
import { Application } from 'pixi.js';

async function init() {
  const app = new Application();

  await app.init({
    background: '#1a1a2e',
    resizeTo: window,
    antialias: true,
  });

  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container not found');
  }
  container.appendChild(app.canvas);

  const route = location.hash.replace('#', '') || '/';

  if (route === '/playground') {
    // Dynamic import to avoid loading playground code on map view
    const { PlaygroundPage } = await import('@ui/playground/PlaygroundPage');
    const page = new PlaygroundPage(app);
    await page.init();
    console.log('Playground initialized');
  } else {
    const game = new Game(app);
    await game.init();
    console.log('Supply Line initialized');
  }
}

init().catch(console.error);
```

**Note:** `PlaygroundPage` doesn't exist yet — this will fail to compile until Task 8. That's expected.

**Step 2: Verify typecheck fails (expected)**

Run: `bun run typecheck`
Expected: FAIL — `PlaygroundPage` not found. This is correct — we're creating it in Task 8.

**Step 3: Do NOT commit yet** — commit together with Task 8.

---

## Task 8: PlaygroundPage Skeleton

Create the page orchestrator that wires together the map, simulation, and UI panels.

**Files:**
- Create: `src/ui/playground/PlaygroundPage.ts`

**Step 1: Write the PlaygroundPage**

This is the initial skeleton that:
1. Generates a small map with fixed seed
2. Creates the terrain layer + camera
3. Creates a `Simulation` instance
4. Sets up the frame loop
5. Creates placeholder containers for toolbar, time controls, info panel

```typescript
import { MapGenerator } from '@core/map/MapGenerator';
import type { GameMap, HexCoord } from '@core/map/types';
import { DEFAULT_GENERATION_PARAMS } from '@core/map/types';
import { Simulation } from '@core/simulation/Simulation';
import type { Application } from 'pixi.js';
import { Container } from 'pixi.js';
import { Camera } from '../Camera';
import { HexRenderer } from '../HexRenderer';
import { SelectionLayer } from '../layers/SelectionLayer';
import { TerrainLayer } from '../layers/TerrainLayer';

const PLAYGROUND_SEED = 42;
const PLAYGROUND_MAP_SIZE = { width: 60, height: 45 };

export class PlaygroundPage {
  private app: Application;
  private gameMap!: GameMap;
  private simulation!: Simulation;
  private worldContainer!: Container;
  private camera!: Camera;
  private terrainLayer!: TerrainLayer;
  private selectionLayer!: SelectionLayer;
  private boundOnFrame!: () => void;

  constructor(app: Application) {
    this.app = app;
  }

  async init(): Promise<void> {
    // Generate a small, fixed-seed map
    const params = {
      ...DEFAULT_GENERATION_PARAMS,
      width: PLAYGROUND_MAP_SIZE.width,
      height: PLAYGROUND_MAP_SIZE.height,
      seed: PLAYGROUND_SEED,
    };
    this.gameMap = MapGenerator.generate(params);

    // Create simulation
    this.simulation = new Simulation(this.gameMap);

    // Scene graph
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    // Camera
    this.camera = new Camera(this.worldContainer, this.app);

    // Terrain layer
    this.terrainLayer = new TerrainLayer(this.gameMap);
    this.worldContainer.addChild(this.terrainLayer.container);

    // Selection layer
    this.selectionLayer = new SelectionLayer();
    this.worldContainer.addChild(this.selectionLayer.container);

    // Initial build
    const bounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(bounds);

    // Center camera
    const centerCol = Math.floor(this.gameMap.width / 2);
    const centerRow = Math.floor(this.gameMap.height / 2);
    const centerCoord = { q: centerCol, r: centerRow - Math.floor(centerCol / 2) };
    const centerPx = HexRenderer.hexToPixel(centerCoord);
    this.camera.centerOn(centerPx.x, centerPx.y);
    this.camera.clearDirty();
    this.terrainLayer.build(this.camera.getVisibleBounds());

    // Attach camera controls
    this.camera.attach();

    // Pointer tracking
    this.app.stage.on('pointermove', this.onPointerMove);

    // Frame loop
    this.boundOnFrame = this.onFrame.bind(this);
    this.app.ticker.add(this.boundOnFrame);
  }

  get hoveredHex(): HexCoord | null {
    return this.selectionLayer.hoveredHex;
  }

  private onPointerMove = (e: { global: { x: number; y: number } }): void => {
    const world = this.camera.screenToWorld(e.global.x, e.global.y);
    const hex = HexRenderer.pixelToHex(world.x, world.y);
    this.selectionLayer.setHover(hex);
  };

  private onFrame(): void {
    // Rebuild terrain if camera panned
    if (this.camera.isDirty) {
      const bounds = this.camera.getVisibleBounds();
      this.terrainLayer.build(bounds);
      this.camera.clearDirty();
    }
  }

  destroy(): void {
    this.app.ticker.remove(this.boundOnFrame);
    this.app.stage.off('pointermove', this.onPointerMove);
    this.camera.detach();
    this.terrainLayer.destroy();
    this.selectionLayer.destroy();
    this.app.stage.removeChild(this.worldContainer);
    this.worldContainer.destroy();
  }
}
```

**Step 2: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 3: Manual smoke test**

Run: `bun run dev`
Navigate to: `http://localhost:3000/#/playground`
Expected: See a small hex map with terrain, pan/zoom works, hover highlights hexes. No toolbar or panels yet.

**Step 4: Commit**

```bash
git add src/main.ts src/ui/playground/PlaygroundPage.ts
git commit -m "feat(playground): add hash router and PlaygroundPage skeleton"
```

---

## Task 9: BuildToolbar (HTML Overlay)

Vertical toolbar on the left with tool selection buttons and keyboard shortcuts.

**Files:**
- Create: `src/ui/playground/BuildToolbar.ts`
- Modify: `src/ui/playground/PlaygroundPage.ts`

**Step 1: Write the BuildToolbar**

```typescript
import type { BuildTool } from '@core/simulation/types';

const TOOLS: Array<{ tool: BuildTool; label: string; shortcut: string; icon: string }> = [
  { tool: 'select', label: 'Select', shortcut: '1', icon: '⊙' },
  { tool: 'fuel-factory', label: 'Fuel Factory', shortcut: '2', icon: '🛢' },
  { tool: 'ammo-factory', label: 'Ammo Factory', shortcut: '3', icon: '💣' },
  { tool: 'food-factory', label: 'Food Factory', shortcut: '4', icon: '🍞' },
  { tool: 'parts-factory', label: 'Parts Factory', shortcut: '5', icon: '⚙' },
  { tool: 'depot', label: 'Depot', shortcut: '6', icon: '📦' },
  { tool: 'supply-line', label: 'Supply Line', shortcut: '7', icon: '╱' },
  { tool: 'demolish', label: 'Demolish', shortcut: '8', icon: '✕' },
];

export class BuildToolbar {
  private container: HTMLDivElement;
  private activeTool: BuildTool = 'select';
  private buttons: Map<BuildTool, HTMLButtonElement> = new Map();
  private onToolChange: (tool: BuildTool) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(parent: HTMLElement, onToolChange: (tool: BuildTool) => void) {
    this.onToolChange = onToolChange;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
      display: flex; flex-direction: column; gap: 2px;
      background: rgba(20, 20, 35, 0.85); border-radius: 6px;
      padding: 6px; z-index: 10; border: 1px solid rgba(255,255,255,0.1);
    `;

    for (const { tool, label, shortcut, icon } of TOOLS) {
      const btn = document.createElement('button');
      btn.title = `${label} (${shortcut})`;
      btn.textContent = icon;
      btn.style.cssText = `
        width: 36px; height: 36px; border: 1px solid rgba(255,255,255,0.15);
        background: rgba(40, 40, 60, 0.8); color: #ccc; font-size: 16px;
        border-radius: 4px; cursor: pointer; display: flex;
        align-items: center; justify-content: center; padding: 0;
      `;
      btn.addEventListener('click', () => this.setTool(tool));
      this.buttons.set(tool, btn);
      this.container.appendChild(btn);
    }

    this.highlightActive();
    parent.appendChild(this.container);

    this.boundKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.boundKeyDown);
  }

  get tool(): BuildTool {
    return this.activeTool;
  }

  setTool(tool: BuildTool): void {
    this.activeTool = tool;
    this.highlightActive();
    this.onToolChange(tool);
  }

  private highlightActive(): void {
    for (const [tool, btn] of this.buttons) {
      btn.style.background =
        tool === this.activeTool ? 'rgba(200, 160, 64, 0.4)' : 'rgba(40, 40, 60, 0.8)';
      btn.style.borderColor =
        tool === this.activeTool ? 'rgba(200, 160, 64, 0.6)' : 'rgba(255,255,255,0.15)';
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'Escape') {
      this.setTool('select');
      return;
    }

    const toolDef = TOOLS.find((t) => t.shortcut === e.key);
    if (toolDef) {
      this.setTool(toolDef.tool);
    }
  }

  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    this.container.remove();
  }
}
```

**Step 2: Wire into PlaygroundPage**

Add to `PlaygroundPage.init()` (after camera attach):
- Create `BuildToolbar` in the canvas parent container
- Store a `currentTool` property
- On tool change, update `currentTool`

Add fields:
```typescript
private toolbar!: BuildToolbar;
private currentTool: BuildTool = 'select';
```

Add to `init()` after `this.camera.attach()`:
```typescript
const htmlContainer = this.app.canvas.parentElement;
if (htmlContainer) {
  this.toolbar = new BuildToolbar(htmlContainer, (tool) => {
    this.currentTool = tool;
  });
}
```

Add to `destroy()`:
```typescript
this.toolbar?.destroy();
```

Add the import for `BuildToolbar` and `BuildTool`.

**Step 3: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 4: Manual smoke test**

Run: `bun run dev`
Navigate to: `http://localhost:3000/#/playground`
Expected: Vertical toolbar on the left side, buttons highlight on click, keyboard shortcuts 1-8 work, ESC returns to select.

**Step 5: Commit**

```bash
git add src/ui/playground/BuildToolbar.ts src/ui/playground/PlaygroundPage.ts
git commit -m "feat(playground): add BuildToolbar with keyboard shortcuts"
```

---

## Task 10: TimeControls (HTML Overlay)

Top-right floating bar with pause/play/step/speed controls and tick counter.

**Files:**
- Create: `src/ui/playground/TimeControls.ts`
- Modify: `src/ui/playground/PlaygroundPage.ts`

**Step 1: Write the TimeControls**

```typescript
import { TICKS_PER_DAY } from '@core/simulation/types';

export type TimeAction = 'step' | 'play' | 'pause';
export type TimeSpeed = 1 | 2 | 4;

export class TimeControls {
  private container: HTMLDivElement;
  private tickDisplay: HTMLSpanElement;
  private playPauseBtn: HTMLButtonElement;
  private speedBtns: Map<TimeSpeed, HTMLButtonElement> = new Map();
  private _isPlaying = false;
  private _speed: TimeSpeed = 1;
  private onAction: (action: TimeAction) => void;
  private onSpeedChange: (speed: TimeSpeed) => void;

  constructor(
    parent: HTMLElement,
    onAction: (action: TimeAction) => void,
    onSpeedChange: (speed: TimeSpeed) => void,
  ) {
    this.onAction = onAction;
    this.onSpeedChange = onSpeedChange;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; right: 12px; top: 12px;
      display: flex; align-items: center; gap: 6px;
      background: rgba(20, 20, 35, 0.85); border-radius: 6px;
      padding: 6px 10px; z-index: 10; border: 1px solid rgba(255,255,255,0.1);
      font-family: monospace; font-size: 13px; color: #ccc;
    `;

    // Step button
    const stepBtn = this.makeButton('⏭', 'Step forward 1 tick');
    stepBtn.addEventListener('click', () => this.onAction('step'));

    // Play/Pause button
    this.playPauseBtn = this.makeButton('▶', 'Play');
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());

    // Speed buttons
    for (const speed of [1, 2, 4] as TimeSpeed[]) {
      const btn = this.makeButton(`${speed}x`, `Speed ${speed}x`);
      btn.addEventListener('click', () => this.setSpeed(speed));
      this.speedBtns.set(speed, btn);
    }

    // Tick display
    this.tickDisplay = document.createElement('span');
    this.tickDisplay.style.cssText = 'margin-left: 8px; color: #aaa;';
    this.tickDisplay.textContent = 'Day 1 — Tick 0';

    this.container.append(stepBtn, this.playPauseBtn);
    for (const btn of this.speedBtns.values()) {
      this.container.appendChild(btn);
    }
    this.container.appendChild(this.tickDisplay);

    this.highlightSpeed();
    parent.appendChild(this.container);
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get speed(): TimeSpeed {
    return this._speed;
  }

  updateTick(tick: number): void {
    const day = Math.floor(tick / TICKS_PER_DAY) + 1;
    const tickInDay = tick % TICKS_PER_DAY;
    this.tickDisplay.textContent = `Day ${day} — Tick ${tickInDay}`;
  }

  private togglePlayPause(): void {
    this._isPlaying = !this._isPlaying;
    this.playPauseBtn.textContent = this._isPlaying ? '⏸' : '▶';
    this.playPauseBtn.title = this._isPlaying ? 'Pause' : 'Play';
    this.onAction(this._isPlaying ? 'play' : 'pause');
  }

  private setSpeed(speed: TimeSpeed): void {
    this._speed = speed;
    this.highlightSpeed();
    this.onSpeedChange(speed);
  }

  private highlightSpeed(): void {
    for (const [speed, btn] of this.speedBtns) {
      btn.style.background =
        speed === this._speed ? 'rgba(200, 160, 64, 0.4)' : 'rgba(40, 40, 60, 0.8)';
      btn.style.borderColor =
        speed === this._speed ? 'rgba(200, 160, 64, 0.6)' : 'rgba(255,255,255,0.15)';
    }
  }

  private makeButton(text: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title;
    btn.style.cssText = `
      width: 32px; height: 28px; border: 1px solid rgba(255,255,255,0.15);
      background: rgba(40, 40, 60, 0.8); color: #ccc; font-size: 13px;
      border-radius: 4px; cursor: pointer; padding: 0;
      font-family: monospace;
    `;
    return btn;
  }

  destroy(): void {
    this.container.remove();
  }
}
```

**Step 2: Wire into PlaygroundPage**

Add fields:
```typescript
private timeControls!: TimeControls;
private isPlaying = false;
private tickSpeed: TimeSpeed = 1;
private tickAccumulator = 0;
```

Add to `init()` in the `htmlContainer` block:
```typescript
this.timeControls = new TimeControls(
  htmlContainer,
  (action) => {
    if (action === 'step') {
      this.simulation.tick();
    } else if (action === 'play') {
      this.isPlaying = true;
    } else {
      this.isPlaying = false;
    }
  },
  (speed) => {
    this.tickSpeed = speed;
  },
);
```

Update `onFrame()` to advance simulation when playing:
```typescript
private onFrame(): void {
  const dt = this.app.ticker.deltaMS / 1000;

  if (this.camera.isDirty) {
    const bounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(bounds);
    this.camera.clearDirty();
  }

  if (this.isPlaying) {
    this.tickAccumulator += dt * this.tickSpeed;
    while (this.tickAccumulator >= 1) {
      this.simulation.tick();
      this.tickAccumulator -= 1;
    }
  }

  this.timeControls?.updateTick(this.simulation.state.tick);
}
```

Add import for `TimeControls` and `TimeSpeed`.

Add to `destroy()`:
```typescript
this.timeControls?.destroy();
```

**Step 3: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 4: Manual smoke test**

Run: `bun run dev`
Navigate to: `http://localhost:3000/#/playground`
Expected: Time controls bar in top-right. Step button advances 1 tick. Play starts auto-advancing. Speed buttons change rate. Day/tick counter updates.

**Step 5: Commit**

```bash
git add src/ui/playground/TimeControls.ts src/ui/playground/PlaygroundPage.ts
git commit -m "feat(playground): add TimeControls — play/pause/step/speed + tick counter"
```

---

## Task 11: BuildController — Click-to-Place Logic

Handle hex clicks based on active tool — place factories, depots, supply lines, demolish.

**Files:**
- Create: `src/ui/playground/BuildController.ts`
- Modify: `src/ui/playground/PlaygroundPage.ts`

**Step 1: Write the BuildController**

```typescript
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import type { Simulation } from '@core/simulation/Simulation';
import type { BuildTool, FacilityEntity } from '@core/simulation/types';
import { ResourceType } from '@data/types';

const TOOL_TO_RESOURCE: Partial<Record<BuildTool, ResourceType>> = {
  'fuel-factory': ResourceType.Fuel,
  'ammo-factory': ResourceType.Ammo,
  'food-factory': ResourceType.Food,
  'parts-factory': ResourceType.Parts,
};

export class BuildController {
  private simulation: Simulation;
  private gameMap: GameMap;
  private supplyLineStart: HexCoord | null = null;
  private onSelect: (entity: FacilityEntity | null) => void;

  constructor(
    simulation: Simulation,
    gameMap: GameMap,
    onSelect: (entity: FacilityEntity | null) => void,
  ) {
    this.simulation = simulation;
    this.gameMap = gameMap;
    this.onSelect = onSelect;
  }

  handleClick(hex: HexCoord, tool: BuildTool): void {
    if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) return;

    switch (tool) {
      case 'select':
        this.handleSelect(hex);
        break;
      case 'fuel-factory':
      case 'ammo-factory':
      case 'food-factory':
      case 'parts-factory':
        this.handlePlaceFactory(hex, TOOL_TO_RESOURCE[tool]!);
        break;
      case 'depot':
        this.handlePlaceDepot(hex);
        break;
      case 'supply-line':
        this.handleSupplyLine(hex);
        break;
      case 'demolish':
        this.handleDemolish(hex);
        break;
    }
  }

  cancelAction(): void {
    this.supplyLineStart = null;
  }

  get pendingSupplyLineStart(): HexCoord | null {
    return this.supplyLineStart;
  }

  private handleSelect(hex: HexCoord): void {
    const facility = this.simulation.getFacilityAt(hex);
    this.onSelect(facility);
  }

  private handlePlaceFactory(hex: HexCoord, resourceType: ResourceType): void {
    this.simulation.addFactory(hex, resourceType);
  }

  private handlePlaceDepot(hex: HexCoord): void {
    this.simulation.addDepot(hex);
  }

  private handleSupplyLine(hex: HexCoord): void {
    if (this.supplyLineStart === null) {
      this.supplyLineStart = hex;
    } else {
      this.simulation.addSupplyLine(this.supplyLineStart, hex);
      this.supplyLineStart = null;
    }
  }

  private handleDemolish(hex: HexCoord): void {
    // Try facility first
    const facility = this.simulation.getFacilityAt(hex);
    if (facility) {
      this.simulation.demolish(facility.id);
      this.onSelect(null);
      return;
    }
    // Try supply line
    const line = this.simulation.getSupplyLineAt(hex);
    if (line) {
      this.simulation.demolish(line.id);
    }
  }
}
```

**Step 2: Wire into PlaygroundPage**

Add field:
```typescript
private buildController!: BuildController;
private selectedEntity: FacilityEntity | null = null;
```

Add to `init()` after simulation creation:
```typescript
this.buildController = new BuildController(this.simulation, this.gameMap, (entity) => {
  this.selectedEntity = entity;
});
```

Add click handler to `init()` after camera attach:
```typescript
this.app.stage.on('pointerdown', this.onPointerDown);
```

Add the click handler method:
```typescript
private onPointerDown = (e: { global: { x: number; y: number } }): void => {
  const world = this.camera.screenToWorld(e.global.x, e.global.y);
  const hex = HexRenderer.pixelToHex(world.x, world.y);
  if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) return;
  this.buildController.handleClick(hex, this.currentTool);
};
```

Update `destroy()`:
```typescript
this.app.stage.off('pointerdown', this.onPointerDown);
```

Add imports for `BuildController`, `FacilityEntity`, `HexGrid`.

**Step 3: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/ui/playground/BuildController.ts src/ui/playground/PlaygroundPage.ts
git commit -m "feat(playground): add BuildController — click-to-place factories, depots, supply lines"
```

---

## Task 12: Playground Render Layers — Facility + Supply Line Visualization

Add render layers so placed facilities and supply lines actually appear on the map.

**Files:**
- Create: `src/ui/playground/PlaygroundFacilityLayer.ts`
- Create: `src/ui/playground/PlaygroundSupplyLineLayer.ts`
- Modify: `src/ui/playground/PlaygroundPage.ts`

**Step 1: Write the PlaygroundFacilityLayer**

Renders factories (colored squares with resource icon) and depots (cross icon) on the map.

```typescript
import type { PlacedDepot, PlacedFactory, SimulationState } from '@core/simulation/types';
import { RESOURCE_COLORS, isFactory } from '@core/simulation/types';
import { ResourceType } from '@data/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const ICON_SIZE = 10;
const ICON_BG = 0xd4c8a0;
const ICON_BORDER = 0x2a2a35;
const BAR_WIDTH = 2;
const BAR_HEIGHT = 10;
const BAR_GAP = 1;
const BAR_BG = 0x333333;

export class PlaygroundFacilityLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private builtVersion = -1;

  constructor() {
    this.container.addChild(this.graphics);
  }

  build(state: SimulationState): void {
    if (this.builtVersion === state.version) return;
    this.builtVersion = state.version;
    this.graphics.clear();

    for (const factory of state.factories.values()) {
      this.drawFactory(factory);
    }
    for (const depot of state.depots.values()) {
      this.drawDepot(depot);
    }
  }

  private drawFactory(factory: PlacedFactory): void {
    const px = HexRenderer.hexToPixel(factory.hex);
    const color = RESOURCE_COLORS[factory.resourceType];
    const half = ICON_SIZE / 2;

    // Background
    this.graphics.rect(px.x - half, px.y - half, ICON_SIZE, ICON_SIZE);
    this.graphics.fill({ color: ICON_BG });
    this.graphics.rect(px.x - half, px.y - half, ICON_SIZE, ICON_SIZE);
    this.graphics.stroke({ width: 1, color: ICON_BORDER });

    // Resource color dot
    this.graphics.circle(px.x, px.y, 3);
    this.graphics.fill({ color });

    // Buffer bar above
    const barY = px.y - half - 4;
    const fillRatio = factory.bufferCapacity > 0 ? factory.buffer / factory.bufferCapacity : 0;
    this.graphics.rect(px.x - half, barY, ICON_SIZE, 2);
    this.graphics.fill({ color: BAR_BG });
    this.graphics.rect(px.x - half, barY, ICON_SIZE * fillRatio, 2);
    this.graphics.fill({ color });

    // Level indicator
    if (factory.level > 1) {
      this.drawLevelPips(px.x, px.y + half + 2, factory.level);
    }
  }

  private drawDepot(depot: PlacedDepot): void {
    const px = HexRenderer.hexToPixel(depot.hex);
    const half = ICON_SIZE / 2;

    // Background
    this.graphics.rect(px.x - half, px.y - half, ICON_SIZE, ICON_SIZE);
    this.graphics.fill({ color: ICON_BG });
    this.graphics.rect(px.x - half, px.y - half, ICON_SIZE, ICON_SIZE);
    this.graphics.stroke({ width: 1, color: ICON_BORDER });

    // Cross (+)
    this.graphics.moveTo(px.x - 3, px.y);
    this.graphics.lineTo(px.x + 3, px.y);
    this.graphics.stroke({ width: 1.5, color: 0x333333 });
    this.graphics.moveTo(px.x, px.y - 3);
    this.graphics.lineTo(px.x, px.y + 3);
    this.graphics.stroke({ width: 1.5, color: 0x333333 });

    // Resource bars above
    const resources = [ResourceType.Fuel, ResourceType.Ammo, ResourceType.Food, ResourceType.Parts];
    const totalWidth = resources.length * BAR_WIDTH + (resources.length - 1) * BAR_GAP;
    let barX = px.x - totalWidth / 2;
    const barTop = px.y - half - BAR_HEIGHT - 2;

    for (const res of resources) {
      const fillRatio =
        depot.maxStoragePerResource > 0 ? depot.storage[res] / depot.maxStoragePerResource : 0;

      // Background bar
      this.graphics.rect(barX, barTop, BAR_WIDTH, BAR_HEIGHT);
      this.graphics.fill({ color: BAR_BG });

      // Fill bar (from bottom)
      const fillHeight = BAR_HEIGHT * fillRatio;
      this.graphics.rect(barX, barTop + BAR_HEIGHT - fillHeight, BAR_WIDTH, fillHeight);
      this.graphics.fill({ color: RESOURCE_COLORS[res] });

      barX += BAR_WIDTH + BAR_GAP;
    }

    // Level indicator
    if (depot.level > 1) {
      this.drawLevelPips(px.x, px.y + half + 2, depot.level);
    }
  }

  private drawLevelPips(cx: number, y: number, level: number): void {
    const pipSize = 1.5;
    const gap = 2;
    const totalWidth = level * pipSize + (level - 1) * gap;
    let x = cx - totalWidth / 2;
    for (let i = 0; i < level; i++) {
      this.graphics.circle(x + pipSize / 2, y, pipSize / 2);
      this.graphics.fill({ color: 0xc8a040 });
      x += pipSize + gap;
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Write the PlaygroundSupplyLineLayer**

Renders supply line hex paths as colored lines.

```typescript
import type { SimulationState, SimSupplyLine } from '@core/simulation/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const LINE_COLOR = 0x8888aa;
const LINE_WIDTH_BY_LEVEL = [1.5, 2, 2.5, 3, 3.5];

export class PlaygroundSupplyLineLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private builtVersion = -1;

  constructor() {
    this.container.addChild(this.graphics);
  }

  build(state: SimulationState): void {
    if (this.builtVersion === state.version) return;
    this.builtVersion = state.version;
    this.graphics.clear();

    for (const line of state.supplyLines.values()) {
      this.drawLine(line);
    }
  }

  private drawLine(line: SimSupplyLine): void {
    if (line.hexPath.length < 2) return;

    const width = LINE_WIDTH_BY_LEVEL[line.level - 1] ?? 1.5;
    const firstPx = HexRenderer.hexToPixel(line.hexPath[0]);
    this.graphics.moveTo(firstPx.x, firstPx.y);

    for (let i = 1; i < line.hexPath.length; i++) {
      const px = HexRenderer.hexToPixel(line.hexPath[i]);
      this.graphics.lineTo(px.x, px.y);
    }

    this.graphics.stroke({ width, color: LINE_COLOR, alpha: 0.7 });
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 3: Wire both layers into PlaygroundPage**

Add fields:
```typescript
private facilityLayer!: PlaygroundFacilityLayer;
private supplyLineLayer!: PlaygroundSupplyLineLayer;
private lastSimVersion = -1;
```

In `init()`, after creating the selection layer:
```typescript
this.supplyLineLayer = new PlaygroundSupplyLineLayer();
this.worldContainer.addChild(this.supplyLineLayer.container);
this.facilityLayer = new PlaygroundFacilityLayer();
this.worldContainer.addChild(this.facilityLayer.container);
```

Make sure to add them **before** the selection layer in the scene graph (so hover renders on top). Reorder the addChild calls:
```typescript
// Order: terrain → supply lines → facilities → selection
this.worldContainer.addChild(this.terrainLayer.container);
this.worldContainer.addChild(this.supplyLineLayer.container);
this.worldContainer.addChild(this.facilityLayer.container);
this.worldContainer.addChild(this.selectionLayer.container);
```

Update `onFrame()` to rebuild layers when simulation version changes:
```typescript
if (this.simulation.state.version !== this.lastSimVersion) {
  this.lastSimVersion = this.simulation.state.version;
  this.facilityLayer.build(this.simulation.state);
  this.supplyLineLayer.build(this.simulation.state);
}
```

Add imports and destroy calls for both layers.

**Step 4: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 5: Manual smoke test**

Run: `bun run dev`
Navigate to: `http://localhost:3000/#/playground`
Expected:
- Select Fuel Factory tool (key 2), click a hex → gold square appears
- Select Depot tool (key 6), click a hex → cross icon with 4 resource bars
- Select Supply Line tool (key 7), click two hexes → line drawn between them
- Step time forward → factory buffer bar grows
- Connected factory+depot → resources flow (shipments move, depot bars fill)

**Step 6: Commit**

```bash
git add src/ui/playground/PlaygroundFacilityLayer.ts src/ui/playground/PlaygroundSupplyLineLayer.ts src/ui/playground/PlaygroundPage.ts
git commit -m "feat(playground): add facility and supply line render layers"
```

---

## Task 13: ShipmentLayer — Animated Resource Particles

Render shipments as colored particles moving along supply line paths.

**Files:**
- Create: `src/ui/playground/ShipmentLayer.ts`
- Modify: `src/ui/playground/PlaygroundPage.ts`

**Step 1: Write the ShipmentLayer**

```typescript
import type { Shipment } from '@core/simulation/types';
import { RESOURCE_COLORS } from '@core/simulation/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const PARTICLE_RADIUS = 2.5;

export class ShipmentLayer {
  readonly container = new Container();
  private graphics = new Graphics();

  constructor() {
    this.container.addChild(this.graphics);
  }

  update(shipments: Shipment[]): void {
    this.graphics.clear();

    for (const shipment of shipments) {
      if (shipment.path.length < 2) continue;

      // Interpolate position along path
      const totalSegments = shipment.path.length - 1;
      const exactPos = shipment.progress * totalSegments;
      const segIndex = Math.min(Math.floor(exactPos), totalSegments - 1);
      const segProgress = exactPos - segIndex;

      const fromPx = HexRenderer.hexToPixel(shipment.path[segIndex]);
      const toPx = HexRenderer.hexToPixel(shipment.path[segIndex + 1]);

      const x = fromPx.x + (toPx.x - fromPx.x) * segProgress;
      const y = fromPx.y + (toPx.y - fromPx.y) * segProgress;

      const color = RESOURCE_COLORS[shipment.resourceType];

      this.graphics.circle(x, y, PARTICLE_RADIUS);
      this.graphics.fill({ color, alpha: 0.9 });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Wire into PlaygroundPage**

Add field:
```typescript
private shipmentLayer!: ShipmentLayer;
```

In `init()`, add after supply line layer (before selection layer):
```typescript
this.shipmentLayer = new ShipmentLayer();
this.worldContainer.addChild(this.shipmentLayer.container);
```

Scene graph order: terrain → supply lines → shipments → facilities → selection.

Update `onFrame()` to update shipment positions every frame:
```typescript
this.shipmentLayer.update(this.simulation.state.shipments);
```

Add import and destroy call.

**Step 3: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 4: Manual smoke test**

Run: `bun run dev`
Navigate to: `http://localhost:3000/#/playground`
Expected: Place factory → supply line → depot. Play simulation. See colored dots moving along the supply line from factory to depot.

**Step 5: Commit**

```bash
git add src/ui/playground/ShipmentLayer.ts src/ui/playground/PlaygroundPage.ts
git commit -m "feat(playground): add ShipmentLayer — animated resource particles"
```

---

## Task 14: InfoPanel — Facility Details on Selection

Bottom-right panel showing facility stats, upgrade and demolish buttons.

**Files:**
- Create: `src/ui/playground/InfoPanel.ts`
- Modify: `src/ui/playground/PlaygroundPage.ts`

**Step 1: Write the InfoPanel**

```typescript
import type { PlacedDepot, PlacedFactory, FacilityEntity } from '@core/simulation/types';
import { RESOURCE_COLORS, isFactory, FACTORY_TABLE, DEPOT_TABLE } from '@core/simulation/types';
import { ResourceType } from '@data/types';

export class InfoPanel {
  private container: HTMLDivElement;
  private contentEl: HTMLDivElement;
  private onUpgrade: (id: string) => void;
  private onDemolish: (id: string) => void;
  private currentEntityId: string | null = null;

  constructor(
    parent: HTMLElement,
    onUpgrade: (id: string) => void,
    onDemolish: (id: string) => void,
  ) {
    this.onUpgrade = onUpgrade;
    this.onDemolish = onDemolish;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; right: 12px; bottom: 12px;
      width: 280px; min-height: 100px;
      background: rgba(20, 20, 35, 0.9); border-radius: 6px;
      padding: 12px; z-index: 10; border: 1px solid rgba(255,255,255,0.1);
      font-family: monospace; font-size: 12px; color: #ccc;
      display: none;
    `;

    this.contentEl = document.createElement('div');
    this.container.appendChild(this.contentEl);
    parent.appendChild(this.container);
  }

  show(entity: FacilityEntity): void {
    this.currentEntityId = entity.id;
    this.container.style.display = 'block';

    if (isFactory(entity)) {
      this.renderFactory(entity);
    } else {
      this.renderDepot(entity);
    }
  }

  hide(): void {
    this.currentEntityId = null;
    this.container.style.display = 'none';
  }

  update(entity: FacilityEntity | null): void {
    if (!entity) {
      this.hide();
      return;
    }
    if (entity.id === this.currentEntityId) {
      // Refresh content (resource bars may have changed)
      this.show(entity);
    }
  }

  private renderFactory(factory: PlacedFactory): void {
    const typeName = this.factoryTypeName(factory.resourceType);
    const colorHex = `#${RESOURCE_COLORS[factory.resourceType].toString(16).padStart(6, '0')}`;
    const fillPct = factory.bufferCapacity > 0
      ? Math.round((factory.buffer / factory.bufferCapacity) * 100)
      : 0;
    const canUpgrade = factory.level < 5;

    this.contentEl.innerHTML = `
      <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: ${colorHex}">
        ${typeName} — Lv.${factory.level}
      </div>
      <div style="margin-bottom: 4px;">
        Buffer: ${this.bar(fillPct, colorHex)} ${Math.round(factory.buffer)}/${factory.bufferCapacity}
      </div>
      <div style="margin-bottom: 8px;">Production: ${factory.productionPerDay}/day</div>
      <div style="margin-bottom: 4px; color: #888;">
        Connected: ${factory.connectedLineIds.length} line(s)
      </div>
      <div style="margin-top: 8px; display: flex; gap: 6px;">
        ${canUpgrade ? `<button id="pg-upgrade" style="${this.btnStyle()}">Upgrade to Lv.${factory.level + 1}</button>` : ''}
        <button id="pg-demolish" style="${this.btnStyle('#993333')}">Demolish</button>
      </div>
    `;

    this.attachButtons(factory.id);
  }

  private renderDepot(depot: PlacedDepot): void {
    const resources = [ResourceType.Fuel, ResourceType.Ammo, ResourceType.Food, ResourceType.Parts];
    const canUpgrade = depot.level < 5;

    const barsHtml = resources
      .map((res) => {
        const current = Math.round(depot.storage[res]);
        const max = depot.maxStoragePerResource;
        const pct = max > 0 ? Math.round((current / max) * 100) : 0;
        const colorHex = `#${RESOURCE_COLORS[res].toString(16).padStart(6, '0')}`;
        const name = res.charAt(0).toUpperCase() + res.slice(1);
        return `<div>${name}: ${this.bar(pct, colorHex)} ${current}/${max}</div>`;
      })
      .join('');

    this.contentEl.innerHTML = `
      <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #ccc">
        Depot — Lv.${depot.level}
      </div>
      <div style="margin-bottom: 8px; line-height: 1.6;">${barsHtml}</div>
      <div style="margin-bottom: 4px;">Throughput: ${depot.throughputPerDay}/day</div>
      <div style="margin-bottom: 4px; color: #888;">
        Connected: ${depot.connectedLineIds.length} line(s)
      </div>
      <div style="margin-top: 8px; display: flex; gap: 6px;">
        ${canUpgrade ? `<button id="pg-upgrade" style="${this.btnStyle()}">Upgrade to Lv.${depot.level + 1}</button>` : ''}
        <button id="pg-demolish" style="${this.btnStyle('#993333')}">Demolish</button>
      </div>
    `;

    this.attachButtons(depot.id);
  }

  private attachButtons(entityId: string): void {
    const upgradeBtn = document.getElementById('pg-upgrade');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.onUpgrade(entityId));
    }
    const demolishBtn = document.getElementById('pg-demolish');
    if (demolishBtn) {
      demolishBtn.addEventListener('click', () => this.onDemolish(entityId));
    }
  }

  private bar(pct: number, color: string): string {
    const filled = Math.round(pct / 10);
    const empty = 10 - filled;
    return `<span style="color: ${color}">${'█'.repeat(filled)}</span><span style="color: #333">${'░'.repeat(empty)}</span>`;
  }

  private factoryTypeName(type: ResourceType): string {
    const names: Record<ResourceType, string> = {
      [ResourceType.Fuel]: 'Fuel Factory',
      [ResourceType.Ammo]: 'Ammo Factory',
      [ResourceType.Food]: 'Food Factory',
      [ResourceType.Parts]: 'Parts Factory',
    };
    return names[type];
  }

  private btnStyle(bg = '#334'): string {
    return `
      padding: 4px 10px; border: 1px solid rgba(255,255,255,0.2);
      background: ${bg}; color: #ccc; font-size: 11px; font-family: monospace;
      border-radius: 3px; cursor: pointer;
    `;
  }

  destroy(): void {
    this.container.remove();
  }
}
```

**Step 2: Wire into PlaygroundPage**

Add field:
```typescript
private infoPanel!: InfoPanel;
```

In `init()` (inside `htmlContainer` block):
```typescript
this.infoPanel = new InfoPanel(
  htmlContainer,
  (id) => {
    this.simulation.upgrade(id);
    // Refresh panel with updated entity
    const entity = this.simulation.state.factories.get(id) ?? this.simulation.state.depots.get(id);
    if (entity) this.infoPanel.show(entity);
  },
  (id) => {
    this.simulation.demolish(id);
    this.infoPanel.hide();
    this.selectedEntity = null;
  },
);
```

Update the `onSelect` callback in `BuildController` constructor to also show/hide the info panel:
```typescript
this.buildController = new BuildController(this.simulation, this.gameMap, (entity) => {
  this.selectedEntity = entity;
  if (entity) {
    this.infoPanel?.show(entity);
  } else {
    this.infoPanel?.hide();
  }
});
```

In `onFrame()`, refresh the info panel if an entity is selected (resource bars update):
```typescript
if (this.selectedEntity) {
  const updated = this.simulation.state.factories.get(this.selectedEntity.id)
    ?? this.simulation.state.depots.get(this.selectedEntity.id);
  this.infoPanel?.update(updated ?? null);
  if (!updated) {
    this.selectedEntity = null;
  }
}
```

Add import and destroy call.

**Step 3: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 4: Manual smoke test**

Run: `bun run dev`
Navigate to: `http://localhost:3000/#/playground`
Expected:
- Place factory → select it → info panel shows type, level, buffer bar, production rate
- Place depot → select it → shows 4 resource bars, throughput, connections
- Click "Upgrade" → level increases, stats update
- Click "Demolish" → facility removed, panel hides

**Step 5: Run full quality check**

Run: `bun run check`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/ui/playground/InfoPanel.ts src/ui/playground/PlaygroundPage.ts
git commit -m "feat(playground): add InfoPanel — facility stats, upgrade, demolish"
```

---

## Task 15: Placement Validation Overlay

Add visual feedback for hex hover — green tint for valid placement, red for invalid.

**Files:**
- Create: `src/ui/playground/PlacementOverlay.ts`
- Modify: `src/ui/playground/PlaygroundPage.ts`

**Step 1: Write the PlacementOverlay**

```typescript
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import type { SimulationState } from '@core/simulation/types';
import { IMPASSABLE_TERRAIN } from '@core/simulation/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const VALID_COLOR = 0x44aa44;
const INVALID_COLOR = 0xcc3333;
const OVERLAY_ALPHA = 0.2;

export class PlacementOverlay {
  readonly container = new Container();
  private graphics = new Graphics();
  private lastHexKey: string | null = null;
  private lastValid: boolean | null = null;

  constructor() {
    this.container.addChild(this.graphics);
  }

  update(
    hex: HexCoord | null,
    gameMap: GameMap,
    state: SimulationState,
    isPlacementTool: boolean,
  ): void {
    if (!hex || !isPlacementTool) {
      if (this.lastHexKey !== null) {
        this.graphics.clear();
        this.lastHexKey = null;
        this.lastValid = null;
      }
      return;
    }

    const key = HexGrid.key(hex);
    const valid = this.canPlace(hex, gameMap, state);

    if (key === this.lastHexKey && valid === this.lastValid) return;

    this.lastHexKey = key;
    this.lastValid = valid;
    this.graphics.clear();

    const px = HexRenderer.hexToPixel(hex);
    const verts = HexRenderer.vertices(px.x, px.y);
    const flat = verts.flatMap((v) => [v.x, v.y]);

    const color = valid ? VALID_COLOR : INVALID_COLOR;
    this.graphics.poly(flat);
    this.graphics.fill({ color, alpha: OVERLAY_ALPHA });
  }

  private canPlace(hex: HexCoord, gameMap: GameMap, state: SimulationState): boolean {
    if (!HexGrid.inBounds(hex, gameMap.width, gameMap.height)) return false;
    const cell = gameMap.cells.get(HexGrid.key(hex));
    if (!cell || IMPASSABLE_TERRAIN.has(cell.terrain)) return false;
    if (state.occupiedHexes.has(HexGrid.key(hex))) return false;
    return true;
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Wire into PlaygroundPage**

Add field:
```typescript
private placementOverlay!: PlacementOverlay;
```

In `init()`, add after selection layer:
```typescript
this.placementOverlay = new PlacementOverlay();
this.worldContainer.addChild(this.placementOverlay.container);
```

Update `onPointerMove` to also update the placement overlay:
```typescript
private onPointerMove = (e: { global: { x: number; y: number } }): void => {
  const world = this.camera.screenToWorld(e.global.x, e.global.y);
  const hex = HexRenderer.pixelToHex(world.x, world.y);
  this.selectionLayer.setHover(hex);

  const isPlacementTool = this.currentTool !== 'select' && this.currentTool !== 'demolish';
  this.placementOverlay.update(hex, this.gameMap, this.simulation.state, isPlacementTool);
};
```

Add import and destroy call.

**Step 3: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS.

**Step 4: Manual smoke test**

Expected: With a placement tool selected, hovering over valid hexes shows green tint; water/mountain/occupied hexes show red tint. Select/demolish tools don't show overlay.

**Step 5: Commit**

```bash
git add src/ui/playground/PlacementOverlay.ts src/ui/playground/PlaygroundPage.ts
git commit -m "feat(playground): add PlacementOverlay — green/red placement validation"
```

---

## Task 16: Final Polish & Quality Gate

Run all checks, fix any issues, add barrel export.

**Files:**
- Create: `src/core/simulation/index.ts`
- Modify: `vitest.config.ts` (exclude playground UI from coverage)

**Step 1: Create barrel export**

```typescript
export { Simulation } from './Simulation';
export type {
  BuildTool,
  FacilityEntity,
  PlacedDepot,
  PlacedFactory,
  Shipment,
  SimSupplyLine,
  SimulationState,
} from './types';
export { RESOURCE_COLORS, isFactory, isDepot, emptyStorage } from './types';
```

**Step 2: Update vitest.config.ts coverage exclusions**

Add to the `exclude` array:
```typescript
'src/ui/playground/**',
```

**Step 3: Run full quality check**

Run: `bun run check`
Expected: PASS — lint, typecheck, tests all green.

**Step 4: Manual end-to-end test**

Run: `bun run dev`
Navigate to: `http://localhost:3000/#/playground`

Test flow:
1. Select Fuel Factory (key 2) → click hex → factory appears with gold dot
2. Select Depot (key 6) → click hex 3 hexes away → depot appears with cross
3. Select Supply Line (key 7) → click factory hex → click depot hex → line drawn
4. Click Step (⏭) several times → factory buffer bar fills
5. Continue stepping → shipments appear as gold dots moving along supply line
6. More stepping → depot fuel bar fills
7. Select factory (key 1, click) → info panel shows stats
8. Click "Upgrade" → level increases
9. Click "Demolish" → factory removed
10. Press Play (▶) → simulation runs automatically
11. Change speed to 4x → faster
12. Navigate to `http://localhost:3000/#/` → original map view loads

**Step 5: Commit**

```bash
git add src/core/simulation/index.ts vitest.config.ts
git commit -m "feat(playground): add barrel export, finalize coverage config"
```

---

## Summary

| Task | What | New Files | Tests |
|------|------|-----------|-------|
| 1 | Simulation types | `simulation/types.ts` | — |
| 2 | NetworkGraph | `simulation/NetworkGraph.ts` | 8 tests |
| 3 | ProductionPhase | `simulation/ProductionPhase.ts` | 4 tests |
| 4 | TransportPhase | `simulation/TransportPhase.ts` | 4 tests |
| 5 | DemandResolver | `simulation/DemandResolver.ts` | 5 tests |
| 6 | Simulation engine | `simulation/Simulation.ts` | 11 tests |
| 7 | Hash router | `main.ts` (modify) | — |
| 8 | PlaygroundPage skeleton | `playground/PlaygroundPage.ts` | — |
| 9 | BuildToolbar | `playground/BuildToolbar.ts` | — |
| 10 | TimeControls | `playground/TimeControls.ts` | — |
| 11 | BuildController | `playground/BuildController.ts` | — |
| 12 | Facility + Supply Line layers | `playground/PlaygroundFacilityLayer.ts`, `PlaygroundSupplyLineLayer.ts` | — |
| 13 | ShipmentLayer | `playground/ShipmentLayer.ts` | — |
| 14 | InfoPanel | `playground/InfoPanel.ts` | — |
| 15 | PlacementOverlay | `playground/PlacementOverlay.ts` | — |
| 16 | Polish + quality gate | `simulation/index.ts`, `vitest.config.ts` | — |

Total: **16 tasks**, ~32 tests, ~15 new files, 2 modified files. No existing code touched except `main.ts` (hash router) and `vitest.config.ts` (coverage exclusion).
