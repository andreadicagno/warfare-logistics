# Keyboard Navigation Design

## Overview

Add keyboard controls for camera navigation (pan + zoom) to complement existing mouse controls.

## Key Bindings

| Action    | Keys                        |
| --------- | --------------------------- |
| Pan up    | W / Arrow Up                |
| Pan down  | S / Arrow Down              |
| Pan left  | A / Arrow Left              |
| Pan right | D / Arrow Right             |
| Zoom in   | + / =                       |
| Zoom out  | -                           |

Existing bindings (unchanged):
- Space → toggle pause
- F3 → toggle debug overlay

## Behavior

- **Continuous movement**: pan applies every frame while key is held
- **Multi-key**: simultaneous keys work (e.g. W+D = diagonal)
- **Zoom-compensated speed**: `panSpeed = basePanSpeed / camera.scale` so visual speed is constant regardless of zoom level
- **Keyboard zoom**: same increment as mouse wheel, centered on viewport center

## Implementation

### New module: `src/ui/KeyboardController.ts`

- Tracks currently pressed keys via `Set<string>` (keydown adds, keyup removes)
- `update(camera: Camera)` called each frame:
  - Reads pressed keys → computes pan delta (dx, dy)
  - Applies zoom-compensated pan via `camera.applyPan()`
  - Applies zoom via `camera.applyZoom()` if +/- pressed
- `attach()` / `detach()` manage window event listeners (same pattern as Camera)

### Integration in `Game.ts`

- Create `KeyboardController` in `init()`
- Call `keyboardController.update(camera)` in game loop
- Clean up in `destroy()`
- Remove Space/F3 handling from Game.ts → move to KeyboardController for single input ownership

## Constants

- `PAN_SPEED = 8` pixels/frame (at scale 1.0)
- `ZOOM_STEP = 0.05` per frame while held
