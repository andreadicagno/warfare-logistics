# Map Generation

The hex map is generated through a multi-stage pipeline using seeded random number generation for reproducibility.

## Pipeline Stages

### 1. Terrain Generation
- Simplex noise at 3 scales (large, medium, detail) with configurable weights
- Elevation and moisture fields determine terrain type
- Edge falloff creates coastlines when sea sides are enabled

Status: `[IMPLEMENTED]`

### 2. Smoothing Pass
- Groups isolated terrain hexes into surrounding terrain
- Reduces visual noise and creates more natural-looking regions
- Configurable tolerance and minimum group size

Status: `[IMPLEMENTED]`

### 3. River Generation
- Sources placed at high elevation with minimum spacing
- Greedy downhill flow following elevation gradient
- Wide rivers for long river segments
- Lakes formed at depressions

Status: `[IMPLEMENTED]`

### 4. Urban Generation
- Three tiers: Metropolis, City, Town
- Density and spacing parameters per tier
- Placement bonuses near rivers, water, and plains
- Urban clusters with center and surrounding cells

Status: `[IMPLEMENTED]`

### 5. Supply Hub Placement
- Supply hubs placed at urban cluster centers
- Large hubs at metropolises, small at cities/towns

Status: `[IMPLEMENTED]`

### 6. Supply Line Network
- Minimum spanning tree between supply hubs (Kruskal's algorithm)
- Additional redundancy edges for network resilience
- Terrain-based edge costs (plains cheap, hills/rivers expensive)
- Reuse cost discount for edges already in the network

Status: `[IMPLEMENTED]`

## Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| Width | 200 | Map width in hexes |
| Height | 150 | Map height in hexes |
| Seed | Random | Deterministic generation seed |
| Geography | mixed | plains / mixed / mountainous |
| Infrastructure | developed | none / basic / developed |

## Generation Config

See `src/core/map/types.ts` for the full `GenerationParams` interface with all configurable parameters for terrain, smoothing, rivers, urban placement, and supply lines.
