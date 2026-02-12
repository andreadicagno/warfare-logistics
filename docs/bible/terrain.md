# Terrain

The hex map is built from 8 terrain types. Each hex has an elevation (0-1) and moisture (0-1) value from noise generation, which determines its terrain assignment.

## Terrain Types

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

## Visual Specs

- Hex size: 16px (flat-top axial)
- Color variation: +/-8% luminosity via simplex noise
- Terrain patterns: Marsh gets reed marks, Forest gets tree dots, Hills get contour lines
- Urban hexes: Density gradient from dense center (`0x606060`) to sparse edges (`0x8a8a8a`)
- Borders: 0.5px darkened edges between hexes
