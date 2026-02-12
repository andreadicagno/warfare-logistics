# Terrain

The hex map is built from 8 terrain types. Each hex has an elevation (0-1) and moisture (0-1) value from noise generation, which determines its terrain assignment.

## Overview

<!-- component: terrain-preview -->

| Type | Hex Color | Movement Cost | Elevation Range | Moisture Range |
|------|-----------|--------------|-----------------|----------------|
| Water | `0x1a3a5c` | Impassable | 0.00 - 0.20 | - |
| River | `0x4a90b8` | 6 | - | Generated |
| Plains | `0x8a9e5e` | 1 | 0.20 - 0.55 | Low |
| Marsh | `0x5a7a6a` | 3 | 0.20 - 0.55 | High |
| Forest | `0x2d5a2d` | 2 | 0.35 - 0.55 | - |
| Hills | `0x9e8a5a` | 3 | 0.55 - 0.75 | - |
| Mountain | `0xb0aab0` | Impassable | 0.75 - 1.00 | - |
| Urban | `0x7a7a7a` | 1 | On plains | Placed |

Status: `[IMPLEMENTED]`

---

## Water

<!-- component: terrain-preview type=water -->

| Property | Value |
|----------|-------|
| Color | `0x1a3a5c` |
| Movement Cost | Impassable (land units) |
| Elevation Range | 0.00 - 0.20 |
| Moisture Range | - |

Deep ocean and lake hexes. Generated from the lowest elevation band. No terrain pattern — solid fill with subtle noise-based luminosity variation (+/-8%).

## River

<!-- component: terrain-preview type=river -->

| Property | Value |
|----------|-------|
| Color | `0x4a90b8` |
| Movement Cost | 6 |
| Elevation Range | - |
| Moisture Range | Generated |

Rivers flow downhill from high elevation to water. Generated via greedy descent algorithm — each river starts at a random high-elevation hex and follows the steepest downhill path. No terrain pattern — solid fill.

## Plains

<!-- component: terrain-preview type=plains -->

| Property | Value |
|----------|-------|
| Color | `0x8a9e5e` |
| Movement Cost | 1 |
| Elevation Range | 0.20 - 0.55 |
| Moisture Range | Low |

The default passable terrain. Fastest movement cost. Low-moisture hexes in the mid-elevation band become plains. No terrain pattern — solid fill with noise variation.

## Marsh

<!-- component: terrain-preview type=marsh -->

| Property | Value |
|----------|-------|
| Color | `0x5a7a6a` |
| Movement Cost | 3 |
| Elevation Range | 0.20 - 0.55 |
| Moisture Range | High |

Wetland terrain that slows movement. High-moisture hexes in the mid-elevation band become marsh. Pattern: 3-4 horizontal dashes (reed marks) in darkened base color.

## Forest

<!-- component: terrain-preview type=forest -->

| Property | Value |
|----------|-------|
| Color | `0x2d5a2d` |
| Movement Cost | 2 |
| Elevation Range | 0.35 - 0.55 |
| Moisture Range | - |

Wooded terrain with moderate movement penalty. Pattern: 2-3 small circle outlines (tree canopies) placed pseudo-randomly within the hex.

## Hills

<!-- component: terrain-preview type=hills -->

| Property | Value |
|----------|-------|
| Color | `0x9e8a5a` |
| Movement Cost | 3 |
| Elevation Range | 0.55 - 0.75 |
| Moisture Range | - |

Elevated terrain with slow movement. Pattern: 2-3 quadratic bezier arcs (contour lines) drawn horizontally across the hex.

## Mountain

<!-- component: terrain-preview type=mountain -->

| Property | Value |
|----------|-------|
| Color | `0xb0aab0` |
| Movement Cost | Impassable |
| Elevation Range | 0.75 - 1.00 |
| Moisture Range | - |

The highest terrain. Impassable to all land units. Pattern: 1-2 small triangle outlines (peak symbols) placed pseudo-randomly.

## Urban

<!-- component: terrain-preview type=urban -->

| Property | Value |
|----------|-------|
| Color | `0x7a7a7a` |
| Movement Cost | 1 |
| Elevation Range | On plains |
| Moisture Range | Placed |

Settlements placed by the urban generator on plains clusters. Density gradient: dense centers (`0x606060`) have 10-14 building dots, sparse edges (`0x8a8a8a`) have 4-6. Pattern: small filled squares scattered with center bias. Dense urban hexes get a boundary outline on edges adjacent to non-urban terrain.
