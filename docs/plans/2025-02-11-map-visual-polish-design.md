# Map Visual Polish — Design

## Overview

Aesthetic improvements to the hex map: thinner borders, better color contrast, richer hex visuals, and animated routes.

## 1. Hex Borders — Subtle Grid

**Current**: 1px stroke, fixed dark charcoal (`0x2a2a35`) for all terrains.

**New**:
- Stroke width: **0.5px**
- Border color: **per-terrain**, computed as `darken(fillColor, 0.3)` — a 30% darker version of the hex fill
- Effect: grid is perceptible without dominating. Dark terrains (water, forest) have nearly invisible borders; light terrains (plains, mountains) show a gentle edge

**Changes**: `TerrainLayer.ts` — remove `BORDER_COLOR` constant, compute border color per hex from its fill color.

## 2. Revised Color Palette

Goal: every terrain type has a unique chromatic identity. Key fix: mountains (light gray) vs urban (brick red) are now completely distinct.

| Terrain       | Old         | New         | Description              |
|---------------|-------------|-------------|--------------------------|
| Water         | `0x2b4a6b`  | `0x1a3a5c`  | Deep saturated blue      |
| Plains        | `0x6b7a4a`  | `0x8a9e5e`  | Warm light green         |
| Forest        | `0x3a5a35`  | `0x2d5a2d`  | Pure intense green       |
| Hills         | `0x7a6b50`  | `0x9e8a5a`  | Golden brown             |
| Mountain      | `0x5a5a65`  | `0xb0aab0`  | Light cool gray (rock)   |
| Marsh         | `0x4a6a55`  | `0x5a7a6a`  | Murky teal-green         |
| Urban         | `0x4a4a4a`  | `0x8b5e4b`  | Brick red-brown          |
| Urban (dense) | `0x404040`  | `0x6b4535`  | Darker brick             |
| Urban (sparse)| `0x555555`  | `0x9b6e5b`  | Lighter brick            |

## 3. Hex Visual Richness

### Phase A — Noise Variation

- Each hex gets a **±8% luminosity shift** based on simplex noise sampled at (q, r)
- Noise frequency: ~0.15 (low — creates soft zones, not per-hex randomness)
- Seed: same as map seed (deterministic)
- Computed once during geometry build, zero runtime cost

### Phase B — Terrain Patterns

Subtle cartographic symbols drawn over the fill in a slightly darker/lighter tint:

| Terrain   | Pattern                                              |
|-----------|------------------------------------------------------|
| Plains    | None — clean color represents open fields            |
| Forest    | 2-3 small circles (stylized tree canopies)           |
| Hills     | 2-3 small parallel arcs (topographic contour lines)  |
| Mountain  | 1-2 small pointed triangles (peaks)                  |
| Marsh     | 3-4 short horizontal dashes (stagnant water)         |
| Water     | None — color is sufficient                           |
| Urban     | Keeps existing building grid, adapted to new colors  |

Patterns are generated once during geometry build, positioned with seed-based pseudo-random offsets.

## 4. Animated Route Particles

### Railways — Trains
- Shape: small dark rectangle (3×2 px)
- Speed: ~30 px/second
- Density: 1-2 particles per railway segment, evenly spaced
- Color: dark gray, matching railway palette
- Direction: alternating per segment for bidirectional traffic feel

### Roads — Trucks
- Shape: small square (2×2 px)
- Speed: ~20 px/second
- Density: 1 particle per road segment
- Color: dark brown, matching road palette

### Technical Approach
- New `RouteAnimator` class manages the animation loop
- Each particle holds a `t` value (0→1) along the spline, incremented per frame
- Wraps to 0 when exceeding 1 (continuous loop)
- Positions computed with the existing Bézier evaluation from `RouteLayer`
- Runs on PixiJS ticker, independent of static geometry build
- Particles hidden at zoom < 0.5x to avoid visual noise

## Implementation Order

1. Hex borders (small, isolated change)
2. Color palette (swap constants)
3. Noise variation (Phase A of visual richness)
4. Terrain patterns (Phase B of visual richness)
5. Route animation (new system, independent of above)
