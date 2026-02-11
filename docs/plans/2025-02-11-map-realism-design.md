# Map Realism Improvements — Design

## Problem

The current map generator produces terrain that looks fragmented and noisy:

- Terrain types scattered in small 2-5 hex patches instead of coherent geographic regions
- Diagonal banding artifact from simplex noise threshold boundaries
- No visual depth — flat coloring without elevation sense
- Sidebar exposes 40+ technical sliders incomprehensible to non-developers

## Goals

1. Terrain forms large, coherent geographic regions (forests spanning 30+ hexes, wide plains, mountain ranges)
2. Natural-looking region boundaries (curved, organic — not straight bands)
3. Visual depth through elevation-based shading
4. Sidebar simplified to 6-8 intuitive controls

## Changes

### 1. Noise Parameter Tuning

**File**: `src/core/map/TerrainGenerator.ts`

Reduce noise frequencies to produce larger terrain features:

| Parameter | Current | New |
|-----------|---------|-----|
| `elevationScaleLarge` | 0.05 | 0.025 |
| `elevationScaleMedium` | 0.1 | 0.06 |
| `elevationScaleDetail` | 0.2 | 0.15 |
| `noiseWeightLarge` | 0.6 | 0.75 |
| `noiseWeightMedium` | 0.3 | 0.2 |
| `noiseWeightDetail` | 0.1 | 0.05 |
| `moistureScale` | 0.08 | 0.04 |

Effect: Terrain regions roughly double in size. Large-scale noise dominates (75%), producing broad landmass shapes. Medium and detail add subtle variation without fragmenting regions.

### 2. Domain Warping

**File**: `src/core/map/TerrainGenerator.ts`

Add domain warping to both elevation and moisture noise sampling. Instead of:

```
elevation = noise(q * scale, r * scale)
```

Use:

```
warpX = warpNoise(q * warpScale, r * warpScale) * warpStrength
warpY = warpNoise2(q * warpScale, r * warpScale) * warpStrength
elevation = noise(q * scale + warpX, r * scale + warpY)
```

**Parameters** (added to `TerrainParams`):
- `warpScale`: 0.015 — frequency of the warping noise (low = broad distortion)
- `warpStrength`: 8.0 — how far coordinates are displaced (in hex units)

The warping noise uses separate seed offsets (+200, +300) to be independent from elevation/moisture noise.

Apply warping to moisture noise too, with slightly different parameters (`warpScale * 1.3`, `warpStrength * 0.7`) so elevation and biome boundaries don't perfectly coincide.

**Effect**: Diagonal banding eliminated. Region boundaries become curved and organic, resembling natural coastlines and forest edges.

### 3. Iterative Majority-Rule Smoothing

**File**: `src/core/map/SmoothingPass.ts`

Replace current single-pass anomaly removal with iterative majority-rule smoothing.

**Algorithm** (3 passes):

For each pass:
1. For every non-river, non-urban cell:
   - Count terrain types among the 6 hex neighbors
   - If 4+ neighbors share the same terrain AND that terrain differs from the cell → convert cell to majority terrain
   - Mountains require 5+ neighbors to be overwritten (isolated peaks allowed)
   - Water cells adjacent to other water (coastal) are never converted
2. Apply all changes simultaneously (snapshot-based, no cascading within a pass)
3. Repeat for 3 total passes

**Final pass**: Remove isolated water (current behavior preserved).

**New parameter** (added to `SmoothingParams`):
- `passes`: 3 — number of smoothing iterations

Replaces `groupTolerance` and `minGroupDifference` which are removed.

**Effect**: Small scattered patches (1-3 hexes) absorbed into surrounding regions. Region boundaries smoothed into organic shapes. Three passes sufficient — diminishing returns beyond that.

### 4. Elevation Shading in Rendering

**File**: `src/ui/layers/TerrainLayer.ts`

Add three visual depth effects using the elevation value already stored per hex cell:

#### 4a. Elevation-based luminosity

Adjust hex base color brightness proportional to elevation:
- Elevation 0.0 → darken by 12%
- Elevation 1.0 → lighten by 12%
- Linear interpolation between
- Stacks with existing ±8% noise variation (total range: ±20%)

#### 4b. Ambient occlusion (neighbor contrast)

For each hex, compare its elevation to the average elevation of its 6 neighbors:
- Cell lower than neighbors → darken by up to 5% (valley)
- Cell higher than neighbors → lighten by up to 5% (ridge)
- Proportional to elevation difference

#### 4c. Enhanced elevation borders

Where two adjacent hexes have elevation difference > 0.15:
- Border width: 1.0px (instead of default 0.5px)
- Border color: 40% darker (instead of default 30%)
- Creates subtle contour line effect at steep terrain changes

**Effect**: Mountains and ridges visually "pop" from the landscape. Valleys appear as darker corridors. Plains look uniform and flat. The map gains a 3D quality without explicit lighting direction.

### 5. Simplified Sidebar Controls

**Files**: `src/ui/Sidebar.ts`, `src/core/map/types.ts`

#### High-level controls (always visible)

Replace 40+ sliders with 8 intuitive controls:

| Control | Type | Options | Maps to |
|---------|------|---------|---------|
| **Preset** | dropdown | Default, Archipelago, Continental, Peninsula, Mountain Fortress, River Delta + custom | All params |
| **Map Size** | dropdown | Small, Medium, Large | width, height |
| **Coastline** | visual clickable | N/S/E/W sides | seaSides |
| **Landscape** | dropdown | Flat, Rolling, Mountainous | geography + elevation thresholds |
| **Vegetation** | dropdown | Sparse, Moderate, Dense | moistureScale + forest/lake thresholds |
| **Water** | dropdown | Dry, Normal, Wet | waterThreshold + coastalThreshold + lakeMoisture |
| **Rivers** | dropdown | Few, Some, Many | minSources, maxSources, spacing |
| **Urbanization** | dropdown | Rural, Moderate, Dense | all urban density + spacing params |
| **Roads** | dropdown | None, Basic, Developed | infrastructure (already exists) |
| **Seed** | number input + random button | — | seed |

Each dropdown maps to predetermined parameter values. For example:

**Vegetation**:
- Sparse: moistureScale 0.03, lakeMoistureThreshold 0.8 (less forest, fewer lakes)
- Moderate: moistureScale 0.04, lakeMoistureThreshold 0.7 (balanced)
- Dense: moistureScale 0.06, lakeMoistureThreshold 0.55 (heavy forest, many lakes)

**Water**:
- Dry: waterThreshold 0.12, coastalThreshold 0.25
- Normal: waterThreshold 0.2, coastalThreshold 0.35
- Wet: waterThreshold 0.3, coastalThreshold 0.45

**Rivers**:
- Few: minSources 1, maxSources 3, sourceMinSpacing 8
- Some: minSources 3, maxSources 6, sourceMinSpacing 5
- Many: minSources 6, maxSources 12, sourceMinSpacing 3

**Urbanization**:
- Rural: metropolisDensity 1, cityDensity 2, townDensity 4, large spacing
- Moderate: metropolisDensity 2, cityDensity 5, townDensity 8, medium spacing
- Dense: metropolisDensity 3, cityDensity 8, townDensity 12, tight spacing

#### Layer toggles

Keep the current layer visibility checkboxes as-is (Terrain, Routes, Supply Hubs, Selection).

#### Advanced section

All current slider controls remain accessible in a collapsible "Advanced" section, hidden by default. Changing any advanced slider switches the relevant high-level control to show "(Custom)" to indicate manual override.

## Implementation Notes

- Domain warping requires 2 additional simplex noise instances (warp X, warp Y) — minimal performance impact since they use the same noise function
- Smoothing passes iterate the full map 3 times — for a 200×150 map that's 90,000 cells × 3 = 270,000 iterations. Trivial performance cost
- Elevation shading adds per-hex computation during terrain layer build, but this only runs once (cached)
- Sidebar refactor is purely UI — the underlying `GenerationParams` type and `getParams()` output remain unchanged. The high-level controls are a convenience layer that maps to the same params

## Out of Scope

- New terrain subtypes (light forest, steppe, farmland)
- Ridge noise for mountain ranges
- Rain shadow / correlated moisture-elevation
- Directional lighting simulation
- Biome transition zones

These can be added in a follow-up iteration if the base improvements aren't sufficient.
