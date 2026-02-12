# Playground — Design Document

Interactive sandbox page for testing the core supply chain loop: Factory → Supply Line → Depot.

## Goal

A `/playground` route where the player places facilities on a real hex map, draws supply lines, and watches resources flow in real-time driven by a demand-based simulation engine.

## Scope

### Implementing

- **Tick-based simulation** with phases: Production → Transport → Distribution (empty for now)
- **Factory** with internal depot (output buffer), 4 subtypes, 5 levels, bible production rates
- **Depot** with storage per resource type, 5 levels, bible capacity/throughput tables
- **Supply lines** drawn hex-to-hex with auto-routing, facilities auto-connect by adjacency
- **Demand-driven flow**: depots pull, factories buffer, network resolves shortest path
- **Shipments** as visible particles traveling along supply lines
- **Build toolbar** with tool selection + click-to-place
- **Time controls** (pause/play/step/speed)
- **Info panel** for selected facility stats, upgrade, demolish

### Simplified (not full bible spec)

- No construction time — instant placement
- No upgrade cost — free and instant (testing flow)
- No damage/health system
- No interdiction
- No CP economy

### Skipping entirely

- Units, combat, front line
- Rail Hubs, Ports
- Trains, Ships, Planes
- Factions & territory
- Sea/Air routes

## Page Layout

```
┌─────────────────────────────────────────────────────┐
│                              [⏮ ▶ ⏸ ⏭ 1x 2x 4x] │
│ ┌──┐                          Day 1 — Tick 42      │
│ │⊙ │  Select                                        │
│ │──│                                                │
│ │🛢│  Fuel Factory                                   │
│ │💣│  Ammo Factory                                   │
│ │🍞│  Food Factory         HEX MAP                   │
│ │⚙│  Parts Factory        (existing generator,       │
│ │📦│  Depot                 small preset,             │
│ │╱ │  Supply Line           fixed seed)               │
│ │──│                                                │
│ │✕ │  Demolish                                       │
│ └──┘                        ┌──────────────────────┐ │
│                             │ Fuel Factory — Lv.2  │ │
│                             │ ████░░ 45/100 Fuel   │ │
│                             │ Rate: 25/day         │ │
│                             │ [Upgrade] [Demolish] │ │
│                             └──────────────────────┘ │
└─────────────────────────────────────────────────────┘
  LEFT TOOLBAR                 BOTTOM-RIGHT INFO PANEL
```

- **Left toolbar** (~60px): vertical icon strip with tool buttons, separators, keyboard shortcuts 1-8
- **Top-right time controls**: floating bar — step back, play/pause, step forward, speed (1x/2x/4x), tick counter
- **Bottom-right info panel** (~300×200px): appears on facility selection — type, level, resource bars, production/throughput rate, connections, upgrade/demolish buttons
- **Map**: full-screen hex map behind all panels

## Simulation Engine

### Architecture

```
src/core/simulation/
├── types.ts              # SimulationState, PlacedFactory, PlacedDepot, SupplySegment, Shipment
├── Simulation.ts         # Main engine: tick(), addFactory(), addDepot(), addSupplyLine()
├── ProductionPhase.ts    # Factory production → fill internal depot
├── DemandResolver.ts     # Demand broadcast, shortest path, shipment dispatch
├── TransportPhase.ts     # Move shipments along supply lines
├── NetworkGraph.ts       # Supply network connectivity & shortest path (Dijkstra)
└── __tests__/            # Unit tests for each module
```

### SimulationState

```typescript
interface SimulationState {
  tick: number;
  factories: Map<string, PlacedFactory>;
  depots: Map<string, PlacedDepot>;
  supplyLines: Map<string, SupplyLine>;
  shipments: Shipment[];
  network: NetworkGraph;
}
```

### PlacedFactory

```typescript
interface PlacedFactory {
  id: string;
  resourceType: ResourceType;    // Fuel | Ammo | Food | Parts
  level: number;                 // 1-5
  hex: HexCoord;
  buffer: ResourceStorage;       // internal depot
  bufferCapacity: number;        // from bible table
  productionPerDay: number;      // from bible table
  connectedLineIds: string[];    // auto-populated by adjacency
}
```

### PlacedDepot

```typescript
interface PlacedDepot {
  id: string;
  level: number;                     // 1-5
  hex: HexCoord;
  storage: ResourceStorage;          // current stock per resource
  maxStorage: number;                // per resource, from bible table
  throughputPerDay: number;          // from bible table
  connectedLineIds: string[];        // auto-populated by adjacency
}
```

### SupplyLine

```typescript
interface SupplyLine {
  id: string;
  level: number;                // 1-5
  hexPath: HexCoord[];          // ordered hex sequence
  capacityPerDay: number;       // from bible table
  speedHexPerHour: number;      // from bible table
  connectedFacilityIds: string[];  // factories + depots adjacent to any hex in path
}
```

### Shipment

```typescript
interface Shipment {
  id: string;
  resourceType: ResourceType;
  amount: number;
  sourceId: string;             // factory or depot id
  destinationId: string;        // depot id
  path: HexCoord[];             // full hex path from source to destination
  progress: number;             // 0.0 → 1.0
  speedHexPerHour: number;      // determined by weakest segment
}
```

### Tick Phases

**1. ProductionPhase**

For each factory:
- Calculate per-tick production: `productionPerDay / 1440`
- Add to factory's buffer (capped at `bufferCapacity`)
- If buffer is full → production wasted (factory "paused")

**2. DemandResolver**

For each depot with available capacity (`maxStorage - current`):
- Broadcast demand for each resource type where `storage[type] < maxStorage`
- Find sources: factory buffers with stock of that type, or other depots with surplus
- For each demand, find shortest network path (Dijkstra on `NetworkGraph`)
- Check supply line capacity (don't exceed `capacityPerDay`)
- Create `Shipment` and deduct from source buffer/storage
- Priority: closest source first

**3. TransportPhase**

For each active shipment:
- Advance `progress` by `speedHexPerHour / (pathLength × 60)` per tick (since 1 tick = 1 minute)
- If `progress >= 1.0` → deliver: add `amount` to destination depot's storage, remove shipment

### NetworkGraph

Graph representation of the supply line network for pathfinding:

- **Nodes**: every hex that belongs to a supply line, plus facility hexes
- **Edges**: connections between adjacent hexes on the same supply line
- **Weights**: `1 / speed` (faster lines = cheaper path)
- **Dijkstra** for shortest path between any two connected facilities
- Rebuilt when supply lines are added/removed

## Build Interactions

### Toolbar Tools

| Tool | Shortcut | Click Action |
|------|----------|-------------|
| Select | `1` or `ESC` | Click facility → select & show info panel. Click empty → deselect |
| Fuel Factory | `2` | Click valid hex → place Lv.1 Fuel Factory |
| Ammo Factory | `3` | Click valid hex → place Lv.1 Ammo Factory |
| Food Factory | `4` | Click valid hex → place Lv.1 Food Factory |
| Parts Factory | `5` | Click valid hex → place Lv.1 Parts Factory |
| Depot | `6` | Click valid hex → place Lv.1 Depot |
| Supply Line | `7` | Click hex A → click hex B → auto-route supply line between them |
| Demolish | `8` | Click facility → remove + disconnect. Click supply line hex → remove line |

### Placement Constraints

- **Factories**: not on Water, Mountain, or occupied hex
- **Depots**: not on Water, Mountain, or occupied hex
- **Supply Lines**: auto-routed along passable terrain (not Water, not Mountain)
- **One facility per hex**

### Visual Feedback

- Hover with placement tool: green hex tint = valid, red = invalid
- Active tool highlighted in toolbar
- Supply line tool: first click highlights source hex, line preview follows cursor
- ESC or right-click cancels current action, returns to Select

### Auto-Connection

When a supply line is placed, the system checks all hexes in the line path for adjacent facilities (factories/depots). Any facility within 1 hex of the supply line path auto-connects. Same happens when a facility is placed near an existing supply line.

## Time Controls

- **Default state**: paused at Tick 0
- **Step forward** (`⏭`): advance exactly 1 tick, execute all phases
- **Play** (`▶`): auto-advance ticks at selected speed
- **Pause** (`⏸`): stop auto-advance
- **Speed**: 1x (1 tick/sec), 2x (2 ticks/sec), 4x (4 ticks/sec)
- **Display**: "Day {day} — Tick {tickInDay}" where `day = floor(tick / 1440) + 1`

## Info Panel (Bottom-Right)

Appears when a facility is selected. Semi-transparent dark background.

### Factory selected

```
Fuel Factory — Lv.2
Buffer: ████░░░░ 45/50
Production: 25/day
Connected: Supply Line #1, #3
[Upgrade to Lv.3] [Demolish]
```

### Depot selected

```
Depot — Lv.1
Fuel:  ████████░░ 40/50
Ammo:  ██░░░░░░░░ 10/50
Food:  ░░░░░░░░░░  0/50
Parts: ░░░░░░░░░░  0/50
Throughput: 60/day
Connected: Supply Line #1
[Upgrade to Lv.2] [Demolish]
```

## Playground UI

### File Structure

```
src/ui/playground/
├── PlaygroundPage.ts     # Page orchestrator: map + simulation + UI panels
├── BuildToolbar.ts       # Left toolbar with tool icons
├── TimeControls.ts       # Top-right time controls bar
├── InfoPanel.ts          # Bottom-right facility info
├── BuildController.ts    # Click → validate → place/connect logic
└── ShipmentLayer.ts      # Render layer for moving resource particles
```

### Routing

Simple hash router in `src/main.ts`:
- `#/` or default → existing map view (unchanged)
- `#/playground` → PlaygroundPage

### Wiring

1. `PlaygroundPage` creates `Simulation` + `MapRenderer` (existing small preset, fixed seed)
2. `BuildController` listens to hex clicks, validates placement, calls `Simulation.addFactory()` / `.addDepot()` / `.addSupplyLine()`
3. `TimeControls` calls `Simulation.tick()` for step, or starts interval for play
4. After each tick, `PlaygroundPage` syncs rendering layers from `SimulationState`
5. `ShipmentLayer` renders animated particles from `simulation.state.shipments`
6. `InfoPanel` updates when selection changes

### Existing Code

All existing code (map view, MockSimulation, render layers) remains **untouched**. The playground is a parallel page.

## Map Configuration

- Preset: existing default (standard small map)
- Seed: fixed value (e.g., `42`) for reproducibility
- No sidebar/generator controls — map is fixed
- Camera pan/zoom works normally

## Bible Values Used

### Factory Production (per day)

| Level | Production/day | Buffer Capacity |
|-------|---------------|----------------|
| 1 | 10 | 20 |
| 2 | 25 | 50 |
| 3 | 50 | 100 |
| 4 | 85 | 170 |
| 5 | 130 | 260 |

### Depot Storage & Throughput

| Level | Storage (per resource) | Throughput/day |
|-------|----------------------|---------------|
| 1 | 50 | 60 |
| 2 | 100 | 120 |
| 3 | 180 | 200 |
| 4 | 280 | 300 |
| 5 | 400 | 420 |

### Supply Line Speed & Capacity

| Level | Capacity/day | Speed (hex/hr) |
|-------|-------------|---------------|
| 1 | 30 | 5 |
| 2 | 80 | 8 |
| 3 | 180 | 12 |
| 4 | 350 | 17 |
| 5 | 600 | 24 |

## Resource Colors

| Resource | Color |
|----------|-------|
| Fuel | `0xccaa22` (gold) |
| Ammo | `0x666666` (grey) |
| Food | `0x44aa44` (green) |
| Parts | `0xcc8833` (orange) |
