# Map Generation - System Design

**Date**: 2025-02-11
**Status**: Approved for implementation

---

## 1. Overview

Procedural generation of the hex-based strategic map. The map is the foundation all other systems sit on: facilities are placed on hexes, routes connect hexes, the front line divides hexes into territories.

This design covers terrain generation, river placement, settlement placement, and initial infrastructure. Front line generation is out of scope and will be designed separately.

---

## 2. Hex Grid

### Coordinate System

Flat-top hex grid using **axial coordinates** (q, r). Cube coordinates (q, r, s where q + r + s = 0) used internally for distance and algorithms. Offset coordinates only at the rendering layer.

Reference: Red Blob Games hex grid guide.

### Map Sizes

| Size | Columns (q) | Rows (r) | ~Total Hexes | Feel |
|------|-------------|----------|-------------|------|
| Small | 40 | 30 | 1,200 | Quick games, tight logistics |
| Medium | 60 | 45 | 2,700 | Standard play |
| Large | 80 | 60 | 4,800 | Complex networks |

### Hex Data

Each hex stores:

| Field | Type | Description |
|-------|------|-------------|
| `coord` | HexCoord | Axial position (q, r) |
| `terrain` | TerrainType | Plains, Forest, Hills, Mountain, Water, Marsh |
| `elevation` | number (0-1) | Drives terrain assignment and river flow |
| `moisture` | number (0-1) | Secondary noise, affects terrain variant |
| `riverEdges` | Set\<number\> | Edge directions (0-5) where rivers flow |
| `settlement` | SettlementType \| null | Town or City, if any |

---

## 3. Terrain Generation Pipeline

Generation runs in 4 sequential phases.

### Phase 1: Elevation Map

- Generate 2D Simplex noise at 2-3 octaves
- Apply distance-from-center falloff to lower map edges → natural coastline
- Output: continuous elevation value (0.0 - 1.0) per hex

### Phase 2: Terrain Assignment

Use elevation + a secondary Simplex noise layer (moisture) to determine terrain:

| Elevation | Moisture Low | Moisture High |
|-----------|-------------|---------------|
| 0.00 - 0.20 | Water | Water |
| 0.20 - 0.35 | Plains | Marsh |
| 0.35 - 0.55 | Plains | Forest |
| 0.55 - 0.75 | Hills | Forest |
| 0.75 - 1.00 | Mountain | Mountain |

Thresholds adjust per the sandbox **geography** setting:
- **Plains**: shift elevation thresholds up (more low terrain)
- **Mixed**: default thresholds
- **Mountainous**: shift thresholds down (more high terrain)

### Phase 3: River Generation

1. Select 3-5 high-elevation hexes as river sources
2. Flow downhill along hex edges using greedy algorithm (always pick lowest-elevation neighbor)
3. Rivers merge when paths meet
4. Rivers terminate at water hexes or map edge
5. Store as edge flags (`riverEdges` set) on each hex the river passes through

### Phase 4: Smoothing Pass

- Remove single-hex terrain anomalies (lone mountain surrounded by plains, etc.)
- Ensure water bodies are contiguous (no single water hex islands)
- Validate at least one large connected landmass exists

---

## 4. Settlement Placement

### Cities (3-6 per map depending on size)

Scoring per plains/forest hex:
- +3 if adjacent to river
- +2 if on coast (adjacent to water)
- +1 per plains neighbor
- -2 if adjacent to another city candidate

Place cities at highest-scoring hexes. **Minimum distance: 8 hexes** between cities.

### Towns (8-15 per map)

Scoring per plains/forest/hills hex:
- +2 if within 5-10 hexes of a city
- +1 if adjacent to river
- -3 if within 3 hexes of another town

Place towns at highest-scoring positions.

---

## 5. Initial Infrastructure

Roads and railways give the map a pre-existing transport skeleton the player can expand.

### Roads

- Connect each town to its nearest city
- Connect cities to each other if within 20 hexes
- Pathfinding uses A* with terrain costs: Plains (1) < Forest (2) < Hills (3). Mountains and water are impassable (must bridge rivers)

### Railways

- Connect cities to each other (subset of road connections, most direct routes)
- Count depends on sandbox **initialInfrastructure** setting:
  - None: no pre-built railways
  - Basic: 1-2 railway lines
  - Developed: railways between all connected cities

---

## 6. Code Architecture

### File Structure

```
src/core/map/
├── HexGrid.ts          # Hex math utilities (pure functions, no state)
├── MapGenerator.ts     # Orchestrates the 4-phase pipeline
├── TerrainGenerator.ts # Noise + elevation → terrain assignment
├── RiverGenerator.ts   # River flow along hex edges
├── SettlementPlacer.ts # City/town scoring and placement
├── RoadGenerator.ts    # A* pathfinding for initial road/rail connections
└── types.ts            # HexCell, HexCoord, TerrainType, etc.
```

### Key Types

```typescript
interface HexCoord {
  q: number;
  r: number;
}

enum TerrainType {
  Water = 'water',
  Plains = 'plains',
  Marsh = 'marsh',
  Forest = 'forest',
  Hills = 'hills',
  Mountain = 'mountain',
}

enum SettlementType {
  Town = 'town',
  City = 'city',
}

interface HexCell {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
  moisture: number;
  riverEdges: Set<number>;       // 0-5 edge directions
  settlement: SettlementType | null;
}

interface RoutePath {
  hexes: HexCoord[];             // ordered list of hexes the route passes through
  type: 'road' | 'railway';
}

interface RiverPath {
  edges: Array<{ hex: HexCoord; edge: number }>;  // hex + edge direction
}

interface GameMap {
  width: number;                 // hex columns
  height: number;                // hex rows
  cells: Map<string, HexCell>;   // key = "q,r"
  rivers: RiverPath[];
  roads: RoutePath[];
  railways: RoutePath[];
}
```

### Entry Point

```typescript
// Single entry point for map generation
const map: GameMap = MapGenerator.generate(sandboxConfig);
```

### HexGrid Utilities

`HexGrid.ts` is a pure utility module with static methods:

| Method | Description |
|--------|-------------|
| `neighbors(coord)` | Returns the 6 adjacent hex coordinates |
| `distance(a, b)` | Manhattan distance between two hexes |
| `ring(center, radius)` | All hexes at exact distance from center |
| `line(a, b)` | Hexes along a straight line |
| `toPixel(coord)` | Convert axial coord to pixel position for rendering |
| `fromPixel(x, y)` | Convert pixel position back to axial coord |
| `key(coord)` | Convert coord to string key "q,r" for Map lookups |

---

## 7. Dependencies

- **Simplex noise library**: `simplex-noise` npm package (small, no dependencies)
- No other external dependencies required

---

## 8. Sandbox Config Integration

The map generator reads these fields from `SandboxConfig`:

| Config Field | Effect on Generation |
|-------------|---------------------|
| `mapSize` | Determines grid dimensions (small/medium/large) |
| `geography` | Shifts elevation thresholds for terrain distribution |
| `initialInfrastructure` | Controls how many roads/railways are pre-built |
