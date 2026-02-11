# Map Visualization UI - System Design

**Date**: 2025-02-11
**Status**: Approved for implementation

---

## 1. Overview

Rendering system for the procedurally generated hex map. Takes a `GameMap` from `MapGenerator` and renders it on screen using PixiJS with a layered architecture. Includes camera controls (pan + zoom) and hover interaction.

**Scope**: Map rendering + hover highlight only. No side panels, no notifications, no facility interaction.

**Visual Style**: Minimal/schematic with a dark military palette. Flat-colored hexagons, clean edges. "Map on a general staff table under lamplight."

---

## 2. File Structure

```
src/ui/
├── MapRenderer.ts          # Orchestrator: creates layers, manages camera, input
├── Camera.ts               # Pan + zoom transformations on worldContainer
├── HexRenderer.ts          # Utility: hex polygon vertex calculations
└── layers/
    ├── TerrainLayer.ts     # Colored hexagons per terrain type
    ├── RiverLayer.ts       # Blue-grey lines on hex edges
    ├── RouteLayer.ts       # Roads (dashed brown) and railways (dark grey + ties)
    ├── SettlementLayer.ts  # Circles for cities and towns
    └── SelectionLayer.ts   # Hover highlight on hex under cursor
```

---

## 3. Layer Stack

Layers are PixiJS `Container` instances, children of a single `worldContainer`. The worldContainer is transformed by the Camera for pan/zoom. All layers share the same coordinate space.

**Stack order** (bottom to top):

| Order | Layer | Content | Rebuild Frequency |
|-------|-------|---------|-------------------|
| 1 | TerrainLayer | Filled hex polygons | On camera viewport change |
| 2 | RiverLayer | Edge lines for rivers | On camera viewport change |
| 3 | RouteLayer | Road and railway lines | On camera viewport change |
| 4 | SettlementLayer | City/town markers | On camera viewport change |
| 5 | SelectionLayer | Hover highlight border | On hex change (mousemove) |

---

## 4. Color Palette

### Terrain

Dark military palette, desaturated tones:

| Terrain | Hex Color | Description |
|---------|-----------|-------------|
| Water | `#2b4a6b` | Dark blue, somber sea |
| Plains | `#6b7a4a` | Muted olive green |
| Forest | `#3a5a35` | Dark forest green |
| Hills | `#7a6b50` | Earthy brown |
| Mountain | `#5a5a65` | Slate grey |
| Marsh | `#4a6a55` | Grey-green swamp |

### Other Elements

| Element | Color | Details |
|---------|-------|---------|
| Background (off-map) | `#1a1a2e` | Already in project |
| Hex borders | `#2a2a35` | Very subtle, 1px |
| Rivers | `#4a7a9a` | Blue-grey, 3px |
| Roads | `#6b5a40` | Brown, dashed, 2px |
| Railways | `#3a3a45` | Dark grey, 3px + ties |
| City marker | `#d4c8a0` fill, `#2a2a35` border | Large circle (r=8) |
| Town marker | `#a09880` fill | Small circle (r=4) |
| Hover border | `#c8a040` | Amber, 2px, slight brighten |

---

## 5. Camera System

`Camera.ts` manages transformations on the `worldContainer`.

### Pan

- Left-click drag moves the map
- Soft bounds: worldContainer cannot leave the screen entirely
- Implementation: `pointerdown`/`pointermove`/`pointerup` on PixiJS stage
- Delta mouse position applied to `worldContainer.position`

### Zoom

- Mouse scroll wheel for zoom in/out
- Range: `0.3x` (see whole small map) to `2.0x` (hex detail)
- Zoom centered on cursor position (not screen center)
- Implementation: `wheel` event modifies `worldContainer.scale`, keeps point under cursor stationary

### API

```typescript
class Camera {
  private container: Container;  // worldContainer to transform
  private scale: number;         // current zoom level
  private minScale: number;      // 0.3
  private maxScale: number;      // 2.0
  private isDragging: boolean;
  private lastPointer: { x: number; y: number };

  constructor(container: Container, app: Application)
  attach(): void                              // register event listeners
  detach(): void                              // remove event listeners
  screenToWorld(x: number, y: number): { x: number; y: number }
  worldToScreen(x: number, y: number): { x: number; y: number }
  getVisibleBounds(): { minX: number; minY: number; maxX: number; maxY: number }
  centerOn(worldX: number, worldY: number): void
}
```

`screenToWorld()` is critical for the SelectionLayer: takes screen mouse position, inverts the camera transform, then `HexGrid.fromPixel()` identifies the hex.

---

## 6. Layer Details

### 6.1 TerrainLayer

Draws one filled hexagon per visible cell. Uses a single PixiJS `Graphics` instance for all hexes (batched into one draw call).

For each hex:
1. Calculate pixel position via `HexGrid.toPixel(coord)` scaled by hex size
2. Compute 6 vertices of the flat-top hexagon via `HexRenderer.vertices()`
3. Fill with terrain color
4. Stroke with `#2a2a35` border (1px)

### 6.2 RiverLayer

Draws blue-grey lines on hex edges where rivers flow.

For each `RiverPath` in `gameMap.rivers`:
- For each edge entry `{ hex, edge }`:
  - Calculate the midpoints of the two vertices defining that edge
  - Draw a line segment from edge midpoint to edge midpoint of the next edge in the path
  - Color: `#4a7a9a`, width: 3px

### 6.3 RouteLayer

Draws road and railway connections between hex centers.

**Roads:**
- For each `RoutePath` with `type: 'road'`:
  - Draw dashed line through the pixel centers of each hex in the path
  - Color: `#6b5a40`, width: 2px, dash pattern: `[6, 4]`

**Railways:**
- For each `RoutePath` with `type: 'railway'`:
  - Draw solid line through hex centers
  - Color: `#3a3a45`, width: 3px
  - Draw short perpendicular line segments at intervals (railway ties)

### 6.4 SettlementLayer

Draws markers for cities and towns.

For each cell with `settlement !== null`:
- **City**: filled circle, radius 8px, fill `#d4c8a0`, border `#2a2a35` (2px)
- **Town**: filled circle, radius 4px, fill `#a09880`, no border

Drawn at the pixel center of the hex.

### 6.5 SelectionLayer

Highlights the hex under the cursor.

- Listens to `pointermove` on stage
- Uses `Camera.screenToWorld()` + `HexGrid.fromPixel()` to identify hex
- If hex changed from previous frame:
  - Clear previous highlight
  - Draw hex outline: `#c8a040`, 2px, slight alpha on fill (0.1)
- Only redraws when hover target changes

---

## 7. HexRenderer Utility

Static utility for hex polygon geometry:

```typescript
class HexRenderer {
  static readonly HEX_SIZE = 16;  // pixels, outer radius

  // Returns the 6 vertex positions (flat-top) for a hex at given pixel center
  static vertices(cx: number, cy: number): Array<{ x: number; y: number }>

  // Returns the midpoint of a specific edge (0-5)
  static edgeMidpoint(cx: number, cy: number, edge: number): { x: number; y: number }
}
```

`HEX_SIZE = 16` means each hex is 32px wide (flat-top). At zoom 1.0 on a 1920x1080 screen, roughly 60x35 hexes visible — the entire small map fits with some margin.

---

## 8. Initialization Flow

```
Game.init()
  │
  ├── MapGenerator.generate(config) → GameMap
  │
  ├── new MapRenderer(app, gameMap)
  │     │
  │     ├── Create worldContainer → add to stage
  │     ├── Create Camera(worldContainer, app)
  │     ├── Create layers in order:
  │     │     TerrainLayer → RiverLayer → RouteLayer → SettlementLayer → SelectionLayer
  │     ├── Each layer.build(gameMap, visibleBounds)
  │     └── Camera.centerOn(map center)
  │
  └── Camera.attach() → start listening for input
```

**Cleanup**: `MapRenderer.destroy()` calls `Camera.detach()`, removes all layers, removes worldContainer from stage.

---

## 9. MapRenderer API

```typescript
class MapRenderer {
  constructor(app: Application, gameMap: GameMap)

  // Remove all rendering and listeners
  destroy(): void

  // Get the hex coordinate at a screen position, or null if off-map
  getHexAtScreen(screenX: number, screenY: number): HexCoord | null
}
```

Minimal public API. Internal details (layers, camera) are private. The Game class only needs to create and destroy the renderer.

---

## 10. Performance

### Viewport Culling

Each layer draws only the hexes visible in the current viewport.

- `Camera.getVisibleBounds()` returns the world-space rectangle visible on screen
- Convert to q/r range of hexes via `HexGrid.fromPixel()` on the corners
- Layers iterate only over this range instead of all cells
- On a large map (4800 hex) at zoom 2x, ~200 hexes are visible instead of 4800

### Graphics Batching

- Each layer uses a single `Graphics` instance for all its elements
- PixiJS batches draw calls within a single Graphics object
- Result: 5 draw calls total (one per layer), not thousands

### Rebuild On-Demand

- Layers call `build()` once at initialization
- Rebuild only when the visible hex set changes (camera moves beyond threshold)
- `SelectionLayer` redraws only when hover target hex changes
- Camera sets a `dirty` flag; layers check and rebuild on next frame if dirty

### Debounce

- Camera pan generates many mousemove events
- Heavy layers (terrain) don't reconstruct on every pixel
- Approach: rebuild when visible bounds shift by at least 1 hex

### Not Needed for MVP

- Texture atlas / sprite sheets (we use only Graphics primitives)
- Web Workers for generation (generation is fast, < 50ms)
- Level of detail (schematic hexes are readable even at 0.3x zoom)

**Expected performance**: 60fps on all map sizes with these optimizations. Bottleneck would be TerrainLayer rebuild (~4800 polygons for large map), but culling limits this to a few hundred per rebuild.

---

## 11. Dependencies

- **PixiJS** (already installed): Graphics, Container, Application, Text
- **HexGrid** (from `src/core/map/`): coordinate math, `toPixel`, `fromPixel`
- **No additional npm packages required**
