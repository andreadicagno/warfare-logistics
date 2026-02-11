# UI: Debug Overlay & Generator Toolbar

**Date**: 2025-02-11

## Overview

Two new UI components rendered as HTML overlays on top of the PixiJS canvas:

1. **Debug Overlay** (top-right) — real-time game/map info for development
2. **Generator Toolbar** (bottom bar) — controls to tweak and regenerate the world map

## Debug Overlay

**Position**: top-right corner, 8px padding from edges.

**Content** (updated every frame):

- FPS (from PixiJS ticker)
- Zoom level (from Camera scale)
- Cursor hex coordinate (q, r) — from SelectionLayer/hover tracking
- Visible cell count — from Camera visible bounds
- Cell detail panel (when cursor is over a valid hex):
  - Terrain type
  - Elevation (0-1)
  - Moisture (0-1)
  - River edges (if any)
  - Road/Railway presence
  - Settlement type (if any)
- Shows "Cell Info: —" when cursor is not over a cell

**Style**: semi-transparent dark background (`rgba(0,0,0,0.7)`), monospace white text, ~12px font. No border — minimal debug aesthetic.

**Toggle**: F3 key to show/hide. Visible by default.

## Generator Toolbar

**Position**: full-width bar at bottom of screen, ~48px height.

**Controls** (inline, left to right):

| Control | Type | Options |
|---------|------|---------|
| Size | `<select>` | small, medium, large |
| Geography | `<select>` | plains, mixed, mountainous |
| Infrastructure | `<select>` | none, basic, developed |
| Seed | `<input type="number">` + randomize button | numeric, current seed shown |
| Generate | `<button>` | triggers regeneration |

**Style**: solid dark background (`rgba(0,0,0,0.85)`), 1px top border (`rgba(255,255,255,0.1)`). Compact controls with gray labels, white values. Consistent dark theme.

**Behavior on Generate**:

1. Read current values from all controls
2. Destroy current MapRenderer
3. Call `MapGenerator.generate()` with new config
4. Create new MapRenderer with generated map
5. Reset camera to center of new map at default zoom
6. Debug overlay updates automatically on next frame

## Architecture

### New Files

- `src/ui/DebugOverlay.ts` — HTML overlay for debug info
- `src/ui/GeneratorToolbar.ts` — HTML toolbar with generation controls

### Why HTML (not PixiJS)

Both components are standard UI controls (text, dropdowns, buttons). HTML is simpler, more accessible, and keeps the PixiJS canvas dedicated to map rendering with zero performance impact on the game loop.

### Integration in Game.ts

```
Game.init():
  1. Generate initial map (unchanged)
  2. Create MapRenderer (unchanged)
  3. Create DebugOverlay → attaches to ticker for FPS
  4. Create GeneratorToolbar → receives onGenerate callback

Game.onGenerate(config: MapConfig):
  1. Destroy current MapRenderer
  2. Generate new map with config
  3. Create new MapRenderer
  4. Reset camera to center

Game.onFrame():
  1. Update renderer (unchanged)
  2. Update DebugOverlay with current frame info
```

### Data Flow for Debug Overlay

Each frame, `Game.ts` composes a debug info object from:

- `app.ticker.FPS` → FPS
- `camera.scale` → zoom level
- Hover/selection state → cursor hex coordinate
- `Camera.getVisibleBounds()` → visible cell count
- `GameMap.cells.get()` → cell details (terrain, elevation, moisture, rivers, roads, settlement)

### Files Modified

- `Game.ts` — orchestrate new UI components, add `onGenerate()` method
- `main.ts` — minor: ensure HTML container structure supports overlays

### Files Unchanged

All core modules (`MapGenerator`, `HexGrid`, `TerrainGenerator`, `RiverGenerator`, etc.) remain untouched.
