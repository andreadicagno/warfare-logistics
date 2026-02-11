# Urban Terrain & Supply Hub Design

## Overview

Replace the current settlement system (City/Town markers as circles on the map) with two distinct concepts:

1. **Urban terrain** — Cities become a terrain type (`Urban`), rendered as clusters of hex cells with an urban pattern texture. They are part of the map's geography, like mountains or water.
2. **Supply hubs** — Logistical points rendered as circles (inheriting the current settlement visual). They can be placed anywhere on the map and are a gameplay concept, not terrain.

Roads and railways connect **urban clusters** to each other. Supply hubs are an independent layer that does not affect route generation.

## Urban Terrain

### Terrain Type

Add `Urban` to the `TerrainType` enum. Urban cells are impassable to rivers but traversable by roads (cost: 1, same as plains).

### Cluster Hierarchy

Three tiers of urban areas, scaled by map size:

| Tier | Name | Cell count | Per-map count | Description |
|------|------|-----------|---------------|-------------|
| 1 | Metropolis | 8–15 | 2–3 | Large urban sprawl, major hub |
| 2 | City | 4–7 | 4–6 | Mid-size urban area |
| 3 | Town | 2–3 | 6–10 | Small settlement cluster |

Counts scale with map area: `count = round(baseCount * (totalHexes / 1200))`, clamped to the ranges above.

### Generation Algorithm

New class: `UrbanGenerator` (replaces `SettlementPlacer`).

**Phase 1 — Seed selection** (same scoring logic as current `SettlementPlacer.placeCities`):
- Score all Plains/Forest cells by proximity to rivers, water, and plains neighbors
- Place metropolis seeds first (highest scores, minimum 10 hex spacing)
- Place city seeds next (minimum 6 hex spacing from all existing seeds)
- Place town seeds last (minimum 4 hex spacing)

**Phase 2 — Cluster growth** (flood-fill from each seed):
- Target size determined by tier (random within range using seeded RNG)
- Each step: pick a random neighbor of the current cluster boundary
- Eligible neighbors: Plains, Forest, or Hills (never Water, River, Mountain, or existing Urban)
- Prefer neighbors with elevation similar to seed (±0.1)
- Stop when target size reached or no eligible neighbors remain

**Phase 3 — Metadata**:
- Each cell in the cluster stores a reference to its cluster ID
- Each cluster tracks: tier, center coord (seed), cell count, list of cell coords

### Data Changes

```typescript
// In types.ts
export enum TerrainType {
  // ...existing...
  Urban = 'urban',
}

// New field on HexCell
export interface HexCell {
  // ...existing fields...
  urbanClusterId: string | null;  // null for non-urban cells
}

// New type for cluster metadata
export interface UrbanCluster {
  id: string;
  tier: 'metropolis' | 'city' | 'town';
  center: HexCoord;
  cells: HexCoord[];
}

// Add to GameMap
export interface GameMap {
  // ...existing fields...
  urbanClusters: UrbanCluster[];
}
```

### UrbanParams

```typescript
export interface UrbanParams {
  metropolisDensity: number;   // base count per 1200 hexes (default: 2)
  cityDensity: number;         // base count per 1200 hexes (default: 5)
  townDensity: number;         // base count per 1200 hexes (default: 8)
  minMetropolisSpacing: number; // min hex distance between metropolis seeds (default: 10)
  minCitySpacing: number;      // min hex distance between any seeds (default: 6)
  minTownSpacing: number;      // min hex distance between any seeds (default: 4)
  riverBonus: number;          // scoring bonus for river proximity (default: 3)
  waterBonus: number;          // scoring bonus for water proximity (default: 2)
  plainsBonus: number;         // scoring bonus per plains neighbor (default: 1)
}
```

Replaces `SettlementParams` in `GenerationParams`.

## Supply Hubs

### Concept

Supply hubs are logistical markers placed on the map. They inherit the current City/Town circle visual but represent supply infrastructure rather than population centers.

### Size Concept

Supply hubs have a size property that affects their visual radius and (in the future) their storage capacity and throughput:

| Size | Visual radius | Description |
|------|--------------|-------------|
| Large | 8px | Major depot, rail hub |
| Small | 4px | Forward supply point |

### Generation

New class: `SupplyHubPlacer`.

Automatic placement for map generation:
- 1 large hub per metropolis (placed at cluster center)
- 1 large hub per 2 cities (placed at cluster center of selected cities)
- 2–4 small hubs in strategic rural positions (intersections of road paths, edges of map)

Supply hubs can be placed on any terrain except Water and Mountain.

### Data

```typescript
export interface SupplyHub {
  coord: HexCoord;
  size: 'large' | 'small';
}

// Add to GameMap
export interface GameMap {
  // ...existing fields...
  supplyHubs: SupplyHub[];
}
```

The `settlement` field is **removed** from `HexCell`.

## Rendering

### Urban Cells — TerrainLayer

Urban cells are rendered in `TerrainLayer` like any other terrain type.

**Base color:** `#4A4A4A` (dark warm gray)

**Pattern overlay:** A grid of thin lighter lines (`#5A5A5A`) drawn inside each hex, evoking a street grid seen from above. The pattern consists of:
- 3–4 horizontal lines across the hex
- 2–3 vertical lines
- Lines are slightly offset per-cell (using coord hash) for organic variation

**Density variation** based on urban neighbor count:
- **Dense** (3+ urban neighbors): tighter grid spacing, darker base (`#404040`), additional small rectangles suggesting rooftops
- **Sparse** (1–2 urban neighbors): wider grid spacing, lighter base (`#555555`), fewer detail elements — suburban feel

**No border** between adjacent urban cells (skip border stroke when both cells are Urban), creating a continuous urban area visual.

### Supply Hubs — SupplyHubLayer

Replaces `SettlementLayer`. Same visual approach (circles with fill and optional stroke):
- Large hub: radius 8, fill `#D4C8A0`, border `#2A2A35`, stroke width 2
- Small hub: radius 4, fill `#A09880`, no border

### Route Cost

Add Urban to the terrain cost map in `RoadGenerator`:
```typescript
[TerrainType.Urban]: 1  // same as plains — easy to traverse
```

## Pipeline Changes

Current: Terrain → Rivers → Smoothing → Settlements → Roads

New: Terrain → Rivers → Smoothing → **Urban Clusters** → **Supply Hubs** → Roads

The `RoadGenerator` changes to target **urban cluster centers** instead of settlement cells:
- Cities/towns list is derived from `urbanClusters` (all tiers)
- Town→City connections become: small cluster → nearest larger cluster
- City→City connections become: metropolis/city clusters within range

## Files Changed

| File | Action |
|------|--------|
| `src/core/map/types.ts` | Add `Urban` terrain, `UrbanCluster`, `SupplyHub`, `UrbanParams`; remove `SettlementType`, `SettlementParams`, `settlement` from `HexCell` |
| `src/core/map/UrbanGenerator.ts` | **New** — cluster seed selection + flood-fill growth |
| `src/core/map/SupplyHubPlacer.ts` | **New** — supply hub auto-placement |
| `src/core/map/SettlementPlacer.ts` | **Delete** — replaced by UrbanGenerator |
| `src/core/map/MapGenerator.ts` | Update pipeline to use UrbanGenerator + SupplyHubPlacer |
| `src/core/map/RoadGenerator.ts` | Target urban cluster centers instead of settlements |
| `src/ui/layers/TerrainLayer.ts` | Add Urban color + grid pattern rendering |
| `src/ui/layers/SettlementLayer.ts` | **Rename** to `SupplyHubLayer.ts`, render hubs instead of settlements |
| `src/ui/MapRenderer.ts` | Update layer references |
| `src/ui/DebugOverlay.ts` | Show urban cluster info instead of settlement |
| `src/core/map/__tests__/` | Update/add tests for new generators |
