# River & Lake Redesign

## Summary

Rivers become hex cells (new `River` terrain type) instead of edge-based paths. Lakes are generated from both noise and river termination. Roads and railways crossing river cells create bridges. Rivers are impassable barriers without a bridge.

## Data Model Changes

### New TerrainType

Add `River` to the existing terrain enum: Water, Plains, Forest, Hills, Mountain, Marsh, **River**.

### HexCell changes

- Add optional `navigable: boolean` — `true` for cells that are part of a 2-wide river, `false` otherwise.
- Remove `riverEdges: Set<number>` — no longer needed.

### GameMap changes

- Remove `rivers: RiverPath[]` — rivers are now terrain cells, no separate list needed.

### Types removed

- `RiverPath` interface — replaced by terrain cells.

### Bridges

No explicit bridge type. A bridge is the co-occurrence of a route (road/railway) and a `River` cell. Both rendering and game logic derive bridge status from this.

## River Generation

### Algorithm

Same greedy downhill approach: start at high elevation, flow toward low elevation. Instead of marking edges, convert cells to `River` terrain.

1. Select 3-5 source cells at elevation > 0.55 (Hills/Mountain), spaced at least 5 hexes apart.
2. For each source, trace downhill:
   - At each step, move to the lowest unvisited neighbor.
   - Convert the cell terrain to `River`.
   - Stop when reaching `Water`, map edge, or an existing `River` cell (confluence).
   - If stuck (no downhill neighbor and no water/edge/river), generate a termination lake.
3. Filter out rivers shorter than 3 cells.

### Width

- Rivers shorter than 8 cells: 1 cell wide. Not navigable.
- Rivers 8+ cells: the lower ~60% of the path widens to 2 cells. For each cell in the wide section, one lateral neighbor (perpendicular to flow direction) is also converted to `River`.
- All cells in the 2-wide section are marked `navigable: true`.
- Navigability is data-only for now — no transport mechanics yet.

### Confluences

Rivers may share cells. When a river reaches a cell already marked `River`, it stops there (natural confluence). The previous constraint preventing river overlap is removed.

## Lake Generation

All lakes use the existing `Water` terrain type. No new type needed. Lakes are distinguished from ocean by position (internal vs map edge).

### Noise-based lakes

During terrain assignment, cells with elevation 0.2–0.35 and moisture > 0.7 become `Water` instead of Plains/Marsh. This creates small internal water bodies (3-10 cells), naturally limited by the rarity of that parameter combination inland.

### River-termination lakes

When a river gets stuck (no downhill path to water, map edge, or another river), it generates a lake at its endpoint. The termination cell and 3-6 adjacent low-elevation cells are converted to `Water`. This ensures every river has a visually coherent ending.

### Interaction

- A river can terminate in a noise-based lake (reaches `Water`).
- A river-termination lake can be reached by a later river.

## Pathfinding (A*) Cost Changes

| Terrain  | Cost |
|----------|------|
| Plains   | 1    |
| Forest   | 2    |
| Hills    | 3    |
| Marsh    | 3    |
| River    | 6    |
| Mountain | Infinity |
| Water    | Infinity |

River cells cost 6 — expensive but traversable. This simulates bridge construction cost. Roads will prefer routes that avoid rivers but will cross when necessary.

Water (ocean/lakes) remains impassable for roads.

At runtime, river cells without a route are impassable for transport. River cells with a route (bridge) function normally.

## Settlement Placement

- Cities and towns are never placed on `River` or `Water` cells.
- City scoring bonus: having an adjacent `River` cell (replaces the old `riverEdges.size > 0` check). Cities still prefer river-adjacent locations.

## Rendering

### TerrainLayer

`River` gets its own color in the terrain palette — a distinct light blue/cyan, different from the darker blue of `Water`.

### RiverLayer

Eliminated. Rivers are rendered as terrain cells by `TerrainLayer`.

### RouteLayer — Bridges

Where a road or railway crosses a `River` cell, the route rendering adds a bridge indicator (e.g., a small rectangular platform under the route line, or a change in line style).

### Smoothing Pass

Must not convert isolated `River` cells — 1-wide rivers are intentional. Continues to smooth other terrain types normally.

## Generation Pipeline (updated)

```
1. TerrainGenerator.generate()
   → Cells with elevation + moisture
   → Noise-based lakes (Water cells inland)

2. RiverGenerator.generate()
   → Converts cells to River terrain
   → Generates termination lakes (Water cells)
   → Marks navigable on 2-wide sections

3. SmoothingPass.apply()
   → Smooth terrain, skip River cells

4. SettlementPlacer.place()
   → Cities prefer River-adjacent cells
   → Never placed on River/Water

5. RoadGenerator.generate()
   → A* with River cost = 6
   → Bridges are implicit (route + River cell)
```
