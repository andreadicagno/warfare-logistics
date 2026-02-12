# Unified Rendering & Bible Alignment

## Goal

Unify the rendering system so main map and playground share the same layer stack, fed by a common data interface. Simultaneously align all layers to the game bible specs. The playground becomes a full game sandbox (logistics + military units), the main map becomes an animated menu background.

## Architecture — Data Interface

The core abstraction is a `RenderState` object that decouples simulation from rendering. Any data source (MockSimulation for menu, real Simulation for playground) produces a `RenderState` that layers consume.

```ts
interface RenderState {
  map: GameMap;
  facilities: FacilityView[];
  units: UnitView[];
  supplyLines: SupplyLineView[];
  shipments: ShipmentView[];
  vehicles: VehicleView[];
  territory: TerritoryView;
  frontLine: FrontLineView;
  selection: HexCoord | null;
  version: number;
}
```

Each `*View` is a read-only, flat, logic-free type — pure rendering data.

### FacilityView

```ts
interface FacilityView {
  id: string;
  position: HexCoord;
  type: 'fuel-factory' | 'ammo-factory' | 'food-factory' | 'parts-factory' | 'depot';
  level: number;
  resources: ResourceLevels;    // current fill 0-1 per resource
  damaged: boolean;
}
```

### UnitView

```ts
interface UnitView {
  id: string;
  position: HexCoord;
  type: 'infantry' | 'armor' | 'artillery';
  faction: 'allied' | 'enemy';
  echelon: 'battalion' | 'regiment' | 'division' | 'corps';
  supply: { fuel: number; ammo: number; food: number };  // 0-1
  isHq: boolean;
}
```

### SupplyLineView

```ts
interface SupplyLineView {
  id: string;
  path: HexCoord[];
  level: number;             // 1-5
  health: 'good' | 'congested' | 'stressed' | 'destroyed';
  damagedSegments: number[]; // indices of damaged hex pairs
}
```

### ShipmentView

```ts
interface ShipmentView {
  id: string;
  supplyLineId: string;
  resource: 'fuel' | 'ammo' | 'food' | 'parts';
  progress: number;          // 0-1 along path
}
```

### VehicleView

```ts
interface VehicleView {
  id: string;
  type: 'truck' | 'train';
  position: { x: number; y: number };
  angle: number;
}
```

### TerritoryView

```ts
interface TerritoryView {
  hexFactions: Map<string, 'allied' | 'enemy'>;  // hex key → faction
}
```

### FrontLineView

```ts
interface FrontLineView {
  segments: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
}
```

Data sources:
- `MockSimulation.toRenderState()` — translates existing mock data (menu background)
- `Simulation.toRenderState()` — translates real simulation state (playground)

Layers don't know or care about the source. They receive `RenderState` and draw.

## Unified Layer Stack

One set of layers used by both menu and playground. Playground-specific duplicate layers (`PlaygroundFacilityLayer`, `PlaygroundSupplyLineLayer`, `ShipmentLayer`) are eliminated.

Layer stack (render order, bottom to top):

1. **TerrainLayer** — already bible-aligned, no changes
2. **TerritoryLayer** — already bible-aligned, no changes
3. **SupplyLineLayer** — fix: add red flash for damage, dashed grey + red X for destroyed, simplify level visuals
4. **ShipmentLayer** — promote playground version (particles along network paths), replace SupplyFlowLayer (wrong arc-based rendering)
5. **VehicleLayer** — no substantial changes
6. **FacilityLayer** — rewrite from SupplyHubLayer: resource-specific icon colors, 4x20px bars, damage alpha 0.7
7. **FrontLineLayer** — already bible-aligned, no changes
8. **UnitLayer** — fix: Armor diagonal slash, 4x2px supply bars, echelon pips above NATO box
9. **SelectionLayer** — no changes
10. **PlacementOverlay** — playground only (green/red hex validation during placement)

All layers receive `RenderState` in their `build()` method. The versioning/caching pattern remains unchanged.

## GameRenderer — Orchestrator

A single `GameRenderer` replaces both `MapRenderer` and the playground's custom layer stack.

```ts
class GameRenderer {
  constructor(app: Application, map: GameMap);

  setMode(mode: 'full' | 'menu'): void;
  update(state: RenderState, dt: number): void;

  camera: Camera;
  getHexAtScreen(x: number, y: number): HexCoord | null;
}
```

### Modes

**`mode: 'full'`** — All 10 layers active. Used by playground. Full interaction (click, selection, placement).

**`mode: 'menu'`** — Same visual rendering but no interaction. Used as menu background. Camera drifts slowly with easing (autopan). No selection, no placement overlay.

### Data flow

- **Menu**: `Game` creates `GameRenderer` in mode `menu`, fed by `MockSimulation.toRenderState()`
- **Playground**: `PlaygroundPage` creates `GameRenderer` in mode `full`, fed by `Simulation.toRenderState()`

Both call `renderer.update(state, dt)` in the frame loop. The renderer decides internally which layers to update based on mode and state version.

`MapRenderer` and the 3 playground layers are deleted. `GameRenderer` is the single rendering entry point.

## Adapters — MockSimulation and Simulation → RenderState

### MockSimulation.toRenderState()

Direct mapping of existing mock data (mock units, vehicles, front line, facilities) into `RenderState` format. No new logic — the mock data generation stays as-is, but the output becomes a uniform `RenderState`.

### Simulation.toRenderState()

Translates real simulation state into `RenderState`. Work needed:

- `factories/depots` → `FacilityView[]` — direct mapping, add damage field
- `supplyLines` → `SupplyLineView[]` — path hex, level, health
- `shipments` → `ShipmentView[]` — resource, progress, supply line reference
- **Units** (new) — `UnitManager` in simulation: units as resource consumers with position, type, faction, supply levels, echelon. Consume fuel/ammo/food based on type and activity.
- **Territory/FrontLine** (new) — derived from unit positions. Territory = controlled area, front line = boundary between factions.
- **Vehicles** (new) — derived from active shipments: each active shipment generates a visual vehicle moving along the path.

The biggest work is adding units and territory to the real Simulation.

## Bible Corrections — Detail

### FacilityLayer (rewrite from SupplyHubLayer)

| Aspect | Current | Bible Spec |
|--------|---------|------------|
| Icon background | Generic beige `0xd4c8a0` | Factory-specific resource color (Fuel `0xccaa22`, Ammo `0x666666`, Food `0x44aa44`, Parts `0xcc8833`) |
| Depot icon | Cross (+) | Cross (+) — no change |
| Resource bars | 2px wide, 10px tall | 4px wide, 20px tall |
| Bar background | `0x333333` | `0x333333` — no change |
| Damage overlay | Red X, alpha 0.3 | Red X `0xcc3333`, alpha 0.7 |
| Rail Hub | Present | Remove (post-MVP) |

### UnitLayer

| Aspect | Current | Bible Spec |
|--------|---------|------------|
| Armor symbol | Circle outline | Diagonal slash, stroke 2px |
| Infantry stroke | 1px | 1.5px |
| Supply bar height | 2px | 4px |
| Supply bar gap | 1px | 2px |
| Echelon pips | Not implemented | None (Bn), I (Rgt), II (Div), III (Corps) above NATO box |

### SupplyLineLayer

| Aspect | Current | Bible Spec |
|--------|---------|------------|
| Level visuals | 5 distinct types (trail/road/railway/dual/corridor) | 5 levels distinct by thickness and style (not infrastructure types) |
| Damaged segments | Not implemented | Red flash overlay on affected hexes |
| Destroyed | Not implemented | Dashed grey line with red X at break point |

### SupplyFlowLayer → ShipmentLayer

| Aspect | Current | Bible Spec |
|--------|---------|------------|
| Particle path | Arcs from facility to unit | Along supply line network (hex paths) |
| Density | Fixed | Proportional to line load (sparse = underutilized, dense = saturated) |

## Playground UI — Controls and Interaction

Rendering is identical between menu and playground. The playground has its own controls for simulation interaction. These are playground-specific (not needed in menu).

### Existing controls (keep and extend)

- **BuildToolbar** — placement of facilities and supply lines. Extend with unit placement.
- **TimeControls** — play/pause/step simulation.
- **InfoPanel** — stats for selected entity (facility, unit, supply line). Extend for unit info.
- **PlacementOverlay** — green/red validation during placement.

### New unit interactions

- Click unit → select, show stats in InfoPanel (type, supply levels, echelon, activity)
- Toolbar: unit section with placeable types (Infantry, Armor, Artillery)
- Placed unit → becomes consumer in simulation, requests supply
- Right-click or drag → movement order (path highlighted on map)
- Supply priority: configurable from InfoPanel for selected unit
- Echelon upgrade: from InfoPanel, if resources available

### Menu (mode menu)

- No interactive controls
- Camera autopan with slow random drift and easing
- Layers render normally, MockSimulation animates vehicles and flows
- Menu UI (Start, Settings buttons, etc.) rendered above — out of scope for this refactor

## Implementation Plan

### Phase 1 — RenderState and Adapters

- Define `RenderState`, `FacilityView`, `UnitView`, `SupplyLineView`, etc. view types
- Implement `MockSimulation.toRenderState()` — translate existing mock data
- Tests: verify mapping produces valid data

### Phase 2 — GameRenderer

- Create `GameRenderer` replacing `MapRenderer`
- Receives `RenderState` in `update()`, distributes to layers
- Supports `full` and `menu` modes
- Wire `Game.ts` to new `GameRenderer` with `MockSimulation.toRenderState()`
- Visual verification: main map must look identical to before

### Phase 3 — Bible Corrections on Layers

- FacilityLayer: rewrite with resource colors, 4x20px bars, damage alpha 0.7
- UnitLayer: Armor slash, 4x2px bars, echelon pips
- SupplyLineLayer: simplify level visuals, add damage flash/destroyed
- ShipmentLayer: promote from playground, in-network particles
- Update bible preview components if they exist

### Phase 4 — Simulation: Units and Territory

- `UnitManager` in real simulation: placement, movement, resource consumption
- Territory and FrontLine derived from unit positions
- Complete `Simulation.toRenderState()`
- Simulation tests

### Phase 5 — Playground on GameRenderer

- `PlaygroundPage` uses `GameRenderer` in mode `full`
- Delete 3 duplicate playground layers
- Extend `BuildToolbar` and `InfoPanel` for units
- End-to-end test: playground working with unified rendering

### Phase 6 — Cleanup

- Remove `MapRenderer`, `SupplyHubLayer`, `SupplyFlowLayer`, old playground layers
- Update bible pages if needed
- `bun run check` green
