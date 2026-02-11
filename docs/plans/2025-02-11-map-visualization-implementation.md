# Map Visualization UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render the procedurally generated hex map using PixiJS with a layered architecture, camera controls (pan + zoom), and hover interaction.

**Architecture:** A `MapRenderer` orchestrator creates a `worldContainer` with 5 layers (Terrain, River, Route, Settlement, Selection) and a `Camera` for pan/zoom. A `HexRenderer` utility computes hex polygon vertices. All pixel positions use `HexGrid.toPixel()` scaled by `HEX_SIZE = 16`. PixiJS v8 Graphics API is used for all drawing.

**Tech Stack:** TypeScript (strict), PixiJS v8.16.0, Vitest (testing), Bun (runtime)

---

## Prerequisites

These modules already exist and are ready to use:
- `src/core/map/types.ts` — `GameMap`, `HexCell`, `HexCoord`, `TerrainType`, `SettlementType`, `RiverPath`, `RoutePath`
- `src/core/map/HexGrid.ts` — `toPixel()`, `fromPixel()`, `key()`, `inBounds()`, `neighbors()`, `DIRECTIONS`
- `src/game/Game.ts` — PixiJS `Application` initialized with `background: '#1a1a2e'`, `resizeTo: window`, `antialias: true`

**Note on HexGrid.toPixel():** `HexGrid` uses `HEX_SIZE = 1` (unit coordinates). The rendering layer must scale all pixel positions by `HexRenderer.HEX_SIZE = 16` to get actual screen pixels.

**Note on PixiJS v8 Graphics API:** In v8, shapes are defined with `moveTo`/`lineTo`/`poly`/`circle`/`rect`, then filled with `.fill({ color, alpha })` and stroked with `.stroke({ width, color, alpha })`. Each `.fill()` or `.stroke()` call applies to the most recently defined shape path. A single `Graphics` instance can hold many shapes.

---

## Task 1: HexRenderer Utility

**Files:**
- Create: `src/ui/HexRenderer.ts`
- Create: `src/ui/__tests__/HexRenderer.test.ts`

Static utility for hex polygon geometry at the rendering scale. This is the foundation for all layers.

**Step 1: Write the failing test**

Create `src/ui/__tests__/HexRenderer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { HexRenderer } from '../HexRenderer';

describe('HexRenderer', () => {
  describe('HEX_SIZE', () => {
    it('is 16 pixels', () => {
      expect(HexRenderer.HEX_SIZE).toBe(16);
    });
  });

  describe('vertices', () => {
    it('returns 6 vertices', () => {
      const verts = HexRenderer.vertices(0, 0);
      expect(verts).toHaveLength(6);
    });

    it('vertices are at HEX_SIZE distance from center', () => {
      const verts = HexRenderer.vertices(100, 200);
      for (const v of verts) {
        const dx = v.x - 100;
        const dy = v.y - 200;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(16, 1);
      }
    });

    it('first vertex is at 0 degrees (flat-top: rightmost point)', () => {
      const verts = HexRenderer.vertices(0, 0);
      // Flat-top hex: vertex 0 is at angle 0° → (HEX_SIZE, 0)
      expect(verts[0].x).toBeCloseTo(16, 1);
      expect(verts[0].y).toBeCloseTo(0, 1);
    });

    it('vertices are offset by center position', () => {
      const cx = 50;
      const cy = 75;
      const verts = HexRenderer.vertices(cx, cy);
      // vertex 0 is at (cx + HEX_SIZE, cy)
      expect(verts[0].x).toBeCloseTo(cx + 16, 1);
      expect(verts[0].y).toBeCloseTo(cy, 1);
    });
  });

  describe('edgeMidpoint', () => {
    it('returns midpoint between two adjacent vertices', () => {
      const verts = HexRenderer.vertices(0, 0);
      const mid = HexRenderer.edgeMidpoint(0, 0, 0);
      // Edge 0 is between vertex 0 and vertex 1
      const expectedX = (verts[0].x + verts[1].x) / 2;
      const expectedY = (verts[0].y + verts[1].y) / 2;
      expect(mid.x).toBeCloseTo(expectedX, 1);
      expect(mid.y).toBeCloseTo(expectedY, 1);
    });

    it('edge 5 wraps between vertex 5 and vertex 0', () => {
      const verts = HexRenderer.vertices(0, 0);
      const mid = HexRenderer.edgeMidpoint(0, 0, 5);
      const expectedX = (verts[5].x + verts[0].x) / 2;
      const expectedY = (verts[5].y + verts[0].y) / 2;
      expect(mid.x).toBeCloseTo(expectedX, 1);
      expect(mid.y).toBeCloseTo(expectedY, 1);
    });

    it('midpoint is offset by center position', () => {
      const mid0 = HexRenderer.edgeMidpoint(0, 0, 0);
      const mid1 = HexRenderer.edgeMidpoint(100, 200, 0);
      expect(mid1.x).toBeCloseTo(mid0.x + 100, 1);
      expect(mid1.y).toBeCloseTo(mid0.y + 200, 1);
    });
  });

  describe('hexToPixel', () => {
    it('scales HexGrid.toPixel by HEX_SIZE', () => {
      // HexGrid.toPixel({q:1, r:0}) = { x: 1.5, y: sqrt(3)/2 }
      // hexToPixel should multiply by 16: { x: 24, y: ~13.86 }
      const p = HexRenderer.hexToPixel({ q: 1, r: 0 });
      expect(p.x).toBeCloseTo(1.5 * 16, 1);
      expect(p.y).toBeCloseTo((Math.sqrt(3) / 2) * 16, 1);
    });

    it('origin hex maps to (0, 0)', () => {
      const p = HexRenderer.hexToPixel({ q: 0, r: 0 });
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    });
  });

  describe('pixelToHex', () => {
    it('round-trips with hexToPixel', () => {
      const original = { q: 5, r: 3 };
      const pixel = HexRenderer.hexToPixel(original);
      const result = HexRenderer.pixelToHex(pixel.x, pixel.y);
      expect(result.q).toBe(5);
      expect(result.r).toBe(3);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run src/ui/__tests__/HexRenderer.test.ts`
Expected: FAIL — cannot resolve `../HexRenderer`

**Step 3: Write minimal implementation**

Create `src/ui/HexRenderer.ts`:

```typescript
import { HexGrid } from '@core/map/HexGrid';
import type { HexCoord } from '@core/map/types';

export class HexRenderer {
  static readonly HEX_SIZE = 16;

  /** Returns 6 vertex positions for a flat-top hex centered at (cx, cy) */
  static vertices(cx: number, cy: number): Array<{ x: number; y: number }> {
    const verts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      verts.push({
        x: cx + HexRenderer.HEX_SIZE * Math.cos(angle),
        y: cy + HexRenderer.HEX_SIZE * Math.sin(angle),
      });
    }
    return verts;
  }

  /** Returns the midpoint of edge `edge` (0-5) for a hex centered at (cx, cy) */
  static edgeMidpoint(
    cx: number,
    cy: number,
    edge: number,
  ): { x: number; y: number } {
    const verts = HexRenderer.vertices(cx, cy);
    const a = verts[edge];
    const b = verts[(edge + 1) % 6];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Convert HexCoord to pixel position, scaled by HEX_SIZE */
  static hexToPixel(coord: HexCoord): { x: number; y: number } {
    const unit = HexGrid.toPixel(coord);
    return {
      x: unit.x * HexRenderer.HEX_SIZE,
      y: unit.y * HexRenderer.HEX_SIZE,
    };
  }

  /** Convert pixel position back to HexCoord (inverse of hexToPixel) */
  static pixelToHex(x: number, y: number): HexCoord {
    return HexGrid.fromPixel(x / HexRenderer.HEX_SIZE, y / HexRenderer.HEX_SIZE);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run src/ui/__tests__/HexRenderer.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/ui/HexRenderer.ts src/ui/__tests__/HexRenderer.test.ts
git commit -m "feat(ui): add HexRenderer utility for hex polygon geometry"
```

---

## Task 2: Camera System

**Files:**
- Create: `src/ui/Camera.ts`
- Create: `src/ui/__tests__/Camera.test.ts`

Pan/zoom controller that transforms a `worldContainer`. The Camera doesn't depend on PixiJS event system for its core math — event wiring happens in `attach()` which we test separately.

**Step 1: Write the failing test**

Create `src/ui/__tests__/Camera.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Camera } from '../Camera';

// Minimal mock for Container
function mockContainer(): {
  position: { x: number; y: number };
  scale: { x: number; y: number; set(v: number): void };
} {
  return {
    position: { x: 0, y: 0 },
    scale: {
      x: 1,
      y: 1,
      set(v: number) {
        this.x = v;
        this.y = v;
      },
    },
  };
}

// Minimal mock for Application
function mockApp(): {
  screen: { width: number; height: number };
  stage: { on: () => void; off: () => void; eventMode: string };
  canvas: { addEventListener: () => void; removeEventListener: () => void };
} {
  return {
    screen: { width: 1920, height: 1080 },
    stage: { on: () => {}, off: () => {}, eventMode: 'static' },
    canvas: { addEventListener: () => {}, removeEventListener: () => {} },
  };
}

describe('Camera', () => {
  describe('screenToWorld', () => {
    it('returns world coordinates at default zoom and position', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      const world = camera.screenToWorld(100, 200);
      // At scale 1 and position (0,0): world = screen
      expect(world.x).toBeCloseTo(100);
      expect(world.y).toBeCloseTo(200);
    });

    it('accounts for container position (pan)', () => {
      const container = mockContainer();
      container.position.x = 50;
      container.position.y = -30;
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      const world = camera.screenToWorld(100, 200);
      // world = (screen - position) / scale
      expect(world.x).toBeCloseTo(50);
      expect(world.y).toBeCloseTo(230);
    });

    it('accounts for zoom scale', () => {
      const container = mockContainer();
      container.scale.set(2);
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      const world = camera.screenToWorld(100, 200);
      expect(world.x).toBeCloseTo(50);
      expect(world.y).toBeCloseTo(100);
    });
  });

  describe('worldToScreen', () => {
    it('is inverse of screenToWorld', () => {
      const container = mockContainer();
      container.position.x = 30;
      container.position.y = -50;
      container.scale.set(1.5);
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      const screen = camera.worldToScreen(100, 200);
      const back = camera.screenToWorld(screen.x, screen.y);
      expect(back.x).toBeCloseTo(100, 1);
      expect(back.y).toBeCloseTo(200, 1);
    });
  });

  describe('getVisibleBounds', () => {
    it('returns world-space bounds of the screen', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      const bounds = camera.getVisibleBounds();
      // At scale 1, position (0,0), screen 1920x1080
      expect(bounds.minX).toBeCloseTo(0);
      expect(bounds.minY).toBeCloseTo(0);
      expect(bounds.maxX).toBeCloseTo(1920);
      expect(bounds.maxY).toBeCloseTo(1080);
    });

    it('adjusts for zoom', () => {
      const container = mockContainer();
      container.scale.set(2);
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      const bounds = camera.getVisibleBounds();
      // At scale 2, visible area is half the screen in world coords
      expect(bounds.maxX).toBeCloseTo(960);
      expect(bounds.maxY).toBeCloseTo(540);
    });

    it('adjusts for pan', () => {
      const container = mockContainer();
      container.position.x = -100;
      container.position.y = -200;
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      const bounds = camera.getVisibleBounds();
      expect(bounds.minX).toBeCloseTo(100);
      expect(bounds.minY).toBeCloseTo(200);
    });
  });

  describe('centerOn', () => {
    it('positions container so that world point is at screen center', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      camera.centerOn(500, 400);
      // Container position should center (500,400) on a 1920x1080 screen
      expect(container.position.x).toBeCloseTo(1920 / 2 - 500);
      expect(container.position.y).toBeCloseTo(1080 / 2 - 400);
    });

    it('accounts for current zoom level', () => {
      const container = mockContainer();
      container.scale.set(2);
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      camera.centerOn(500, 400);
      expect(container.position.x).toBeCloseTo(1920 / 2 - 500 * 2);
      expect(container.position.y).toBeCloseTo(1080 / 2 - 400 * 2);
    });
  });

  describe('applyZoom', () => {
    it('clamps zoom to min/max range', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      // Zoom way in — should clamp to maxScale (2.0)
      camera.applyZoom(-100, 960, 540);
      expect(container.scale.x).toBe(2.0);
    });

    it('zooms out but not below minScale', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      camera.applyZoom(100, 960, 540);
      expect(container.scale.x).toBeGreaterThanOrEqual(0.3);
    });

    it('preserves the point under cursor during zoom', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      const screenX = 500;
      const screenY = 300;
      const worldBefore = camera.screenToWorld(screenX, screenY);
      camera.applyZoom(-3, screenX, screenY);
      const worldAfter = camera.screenToWorld(screenX, screenY);
      expect(worldAfter.x).toBeCloseTo(worldBefore.x, 0);
      expect(worldAfter.y).toBeCloseTo(worldBefore.y, 0);
    });
  });

  describe('applyPan', () => {
    it('moves container position by delta', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      camera.applyPan(10, -20);
      expect(container.position.x).toBe(10);
      expect(container.position.y).toBe(-20);
    });
  });

  describe('dirty flag', () => {
    it('is true initially', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      expect(camera.isDirty).toBe(true);
    });

    it('can be cleared', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      camera.clearDirty();
      expect(camera.isDirty).toBe(false);
    });

    it('is set after pan', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      camera.clearDirty();
      camera.applyPan(10, 0);
      expect(camera.isDirty).toBe(true);
    });

    it('is set after zoom', () => {
      const container = mockContainer();
      const app = mockApp();
      const camera = new Camera(container as any, app as any);
      camera.clearDirty();
      camera.applyZoom(-1, 100, 100);
      expect(camera.isDirty).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run src/ui/__tests__/Camera.test.ts`
Expected: FAIL — cannot resolve `../Camera`

**Step 3: Write minimal implementation**

Create `src/ui/Camera.ts`:

```typescript
import type { Application, Container } from 'pixi.js';

export class Camera {
  private container: Container;
  private app: Application;
  private minScale = 0.3;
  private maxScale = 2.0;
  private _isDirty = true;
  private _isDragging = false;
  private lastPointer = { x: 0, y: 0 };

  constructor(container: Container, app: Application) {
    this.container = container;
    this.app = app;
  }

  get isDirty(): boolean {
    return this._isDirty;
  }

  clearDirty(): void {
    this._isDirty = false;
  }

  /** Convert screen pixel position to world coordinates */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.container.position.x) / this.container.scale.x,
      y: (screenY - this.container.position.y) / this.container.scale.y,
    };
  }

  /** Convert world coordinates to screen pixel position */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.container.scale.x + this.container.position.x,
      y: worldY * this.container.scale.y + this.container.position.y,
    };
  }

  /** Get world-space bounds of the current viewport */
  getVisibleBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(
      this.app.screen.width,
      this.app.screen.height,
    );
    return {
      minX: topLeft.x,
      minY: topLeft.y,
      maxX: bottomRight.x,
      maxY: bottomRight.y,
    };
  }

  /** Center the viewport on a world position */
  centerOn(worldX: number, worldY: number): void {
    this.container.position.x =
      this.app.screen.width / 2 - worldX * this.container.scale.x;
    this.container.position.y =
      this.app.screen.height / 2 - worldY * this.container.scale.y;
    this._isDirty = true;
  }

  /** Apply zoom centered on a screen position. deltaY > 0 = zoom out. */
  applyZoom(deltaY: number, screenX: number, screenY: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);

    const zoomFactor = 1 - deltaY * 0.001;
    const newScale = Math.min(
      this.maxScale,
      Math.max(this.minScale, this.container.scale.x * zoomFactor),
    );
    this.container.scale.set(newScale);

    // Adjust position so point under cursor stays fixed
    const worldAfter = this.screenToWorld(screenX, screenY);
    this.container.position.x +=
      (worldAfter.x - worldBefore.x) * this.container.scale.x;
    this.container.position.y +=
      (worldAfter.y - worldBefore.y) * this.container.scale.y;

    this._isDirty = true;
  }

  /** Apply a pan delta (in screen pixels) */
  applyPan(dx: number, dy: number): void {
    this.container.position.x += dx;
    this.container.position.y += dy;
    this._isDirty = true;
  }

  /** Register input event listeners */
  attach(): void {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.on('pointerdown', this.onPointerDown);
    this.app.stage.on('pointermove', this.onPointerMove);
    this.app.stage.on('pointerup', this.onPointerUp);
    this.app.stage.on('pointerupoutside', this.onPointerUp);
    this.app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** Remove input event listeners */
  detach(): void {
    this.app.stage.off('pointerdown', this.onPointerDown);
    this.app.stage.off('pointermove', this.onPointerMove);
    this.app.stage.off('pointerup', this.onPointerUp);
    this.app.stage.off('pointerupoutside', this.onPointerUp);
    this.app.canvas.removeEventListener('wheel', this.onWheel);
  }

  private onPointerDown = (e: { global: { x: number; y: number } }): void => {
    this._isDragging = true;
    this.lastPointer.x = e.global.x;
    this.lastPointer.y = e.global.y;
  };

  private onPointerMove = (e: { global: { x: number; y: number } }): void => {
    if (!this._isDragging) return;
    const dx = e.global.x - this.lastPointer.x;
    const dy = e.global.y - this.lastPointer.y;
    this.applyPan(dx, dy);
    this.lastPointer.x = e.global.x;
    this.lastPointer.y = e.global.y;
  };

  private onPointerUp = (): void => {
    this._isDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.applyZoom(e.deltaY, e.offsetX, e.offsetY);
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run src/ui/__tests__/Camera.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/ui/Camera.ts src/ui/__tests__/Camera.test.ts
git commit -m "feat(ui): add Camera system with pan, zoom, and coordinate transforms"
```

---

## Task 3: TerrainLayer

**Files:**
- Create: `src/ui/layers/TerrainLayer.ts`

Draws filled hexagons colored by terrain type. This is the bottom layer and the most visually prominent.

**Step 1: Write the implementation**

Create `src/ui/layers/TerrainLayer.ts`:

```typescript
import { Container, Graphics } from 'pixi.js';
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { HexRenderer } from '../HexRenderer';

const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Water]: 0x2b4a6b,
  [TerrainType.Plains]: 0x6b7a4a,
  [TerrainType.Forest]: 0x3a5a35,
  [TerrainType.Hills]: 0x7a6b50,
  [TerrainType.Mountain]: 0x5a5a65,
  [TerrainType.Marsh]: 0x4a6a55,
};

const BORDER_COLOR = 0x2a2a35;

export class TerrainLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): void {
    this.graphics.clear();

    const margin = HexRenderer.HEX_SIZE * 2;
    const minQ = Math.max(
      0,
      HexRenderer.pixelToHex(bounds.minX - margin, bounds.minY).q - 1,
    );
    const maxQ = Math.min(
      this.gameMap.width - 1,
      HexRenderer.pixelToHex(bounds.maxX + margin, bounds.maxY).q + 1,
    );
    const minR = Math.max(
      0,
      HexRenderer.pixelToHex(bounds.minX, bounds.minY - margin).r - 1,
    );
    const maxR = Math.min(
      this.gameMap.height - 1,
      HexRenderer.pixelToHex(bounds.maxX, bounds.maxY + margin).r + 1,
    );

    for (let q = minQ; q <= maxQ; q++) {
      for (let r = minR; r <= maxR; r++) {
        const cell = this.gameMap.cells.get(HexGrid.key({ q, r }));
        if (!cell) continue;

        const px = HexRenderer.hexToPixel(cell.coord);
        const verts = HexRenderer.vertices(px.x, px.y);
        const flat = verts.flatMap((v) => [v.x, v.y]);

        this.graphics.poly(flat);
        this.graphics.fill({ color: TERRAIN_COLORS[cell.terrain] });
        this.graphics.poly(flat);
        this.graphics.stroke({ width: 1, color: BORDER_COLOR });
      }
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/layers/TerrainLayer.ts
git commit -m "feat(ui): add TerrainLayer for colored hex rendering"
```

---

## Task 4: RiverLayer

**Files:**
- Create: `src/ui/layers/RiverLayer.ts`

Draws blue-grey lines on hex edges where rivers flow.

**Step 1: Write the implementation**

Create `src/ui/layers/RiverLayer.ts`:

```typescript
import { Container, Graphics } from 'pixi.js';
import type { GameMap } from '@core/map/types';
import { HexRenderer } from '../HexRenderer';

const RIVER_COLOR = 0x4a7a9a;
const RIVER_WIDTH = 3;

export class RiverLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(_bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): void {
    this.graphics.clear();

    for (const river of this.gameMap.rivers) {
      if (river.edges.length < 2) continue;

      // Compute midpoints for all edges in this river path
      const midpoints: Array<{ x: number; y: number }> = [];
      for (const entry of river.edges) {
        const px = HexRenderer.hexToPixel(entry.hex);
        const mid = HexRenderer.edgeMidpoint(px.x, px.y, entry.edge);
        midpoints.push(mid);
      }

      // Draw a polyline through the midpoints
      this.graphics.moveTo(midpoints[0].x, midpoints[0].y);
      for (let i = 1; i < midpoints.length; i++) {
        this.graphics.lineTo(midpoints[i].x, midpoints[i].y);
      }
      this.graphics.stroke({ width: RIVER_WIDTH, color: RIVER_COLOR });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/layers/RiverLayer.ts
git commit -m "feat(ui): add RiverLayer for river edge rendering"
```

---

## Task 5: RouteLayer

**Files:**
- Create: `src/ui/layers/RouteLayer.ts`

Draws roads (dashed brown lines) and railways (solid dark lines with perpendicular ties) through hex centers.

**Step 1: Write the implementation**

Create `src/ui/layers/RouteLayer.ts`:

```typescript
import { Container, Graphics } from 'pixi.js';
import type { GameMap, RoutePath } from '@core/map/types';
import { HexRenderer } from '../HexRenderer';

const ROAD_COLOR = 0x6b5a40;
const ROAD_WIDTH = 2;
const RAILWAY_COLOR = 0x3a3a45;
const RAILWAY_WIDTH = 3;
const TIE_LENGTH = 6;
const TIE_SPACING = 10;

export class RouteLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(_bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): void {
    this.graphics.clear();
    this.drawRoads();
    this.drawRailways();
  }

  private drawRoads(): void {
    for (const route of this.gameMap.roads) {
      if (route.hexes.length < 2) continue;
      const points = route.hexes.map((h) => HexRenderer.hexToPixel(h));

      // Dashed line: draw segments with gaps
      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i];
        const to = points[i + 1];
        this.drawDashedLine(from.x, from.y, to.x, to.y, 6, 4);
      }
    }
  }

  private drawRailways(): void {
    for (const route of this.gameMap.railways) {
      if (route.hexes.length < 2) continue;
      const points = route.hexes.map((h) => HexRenderer.hexToPixel(h));

      // Solid rail line
      this.graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.graphics.lineTo(points[i].x, points[i].y);
      }
      this.graphics.stroke({ width: RAILWAY_WIDTH, color: RAILWAY_COLOR });

      // Railway ties (perpendicular marks)
      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i];
        const to = points[i + 1];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        // Normal vector (perpendicular)
        const nx = -dy / len;
        const ny = dx / len;

        const ties = Math.floor(len / TIE_SPACING);
        for (let t = 1; t <= ties; t++) {
          const frac = t / (ties + 1);
          const cx = from.x + dx * frac;
          const cy = from.y + dy * frac;
          this.graphics.moveTo(
            cx - nx * TIE_LENGTH / 2,
            cy - ny * TIE_LENGTH / 2,
          );
          this.graphics.lineTo(
            cx + nx * TIE_LENGTH / 2,
            cy + ny * TIE_LENGTH / 2,
          );
          this.graphics.stroke({ width: 1, color: RAILWAY_COLOR });
        }
      }
    }
  }

  private drawDashedLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLength: number,
    gapLength: number,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const totalLen = Math.sqrt(dx * dx + dy * dy);
    if (totalLen === 0) return;
    const ux = dx / totalLen;
    const uy = dy / totalLen;

    let pos = 0;
    while (pos < totalLen) {
      const dashEnd = Math.min(pos + dashLength, totalLen);
      this.graphics.moveTo(x1 + ux * pos, y1 + uy * pos);
      this.graphics.lineTo(x1 + ux * dashEnd, y1 + uy * dashEnd);
      this.graphics.stroke({ width: ROAD_WIDTH, color: ROAD_COLOR });
      pos = dashEnd + gapLength;
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/layers/RouteLayer.ts
git commit -m "feat(ui): add RouteLayer for road and railway rendering"
```

---

## Task 6: SettlementLayer

**Files:**
- Create: `src/ui/layers/SettlementLayer.ts`

Draws circles for cities and towns at hex centers.

**Step 1: Write the implementation**

Create `src/ui/layers/SettlementLayer.ts`:

```typescript
import { Container, Graphics } from 'pixi.js';
import { HexGrid } from '@core/map/HexGrid';
import type { GameMap } from '@core/map/types';
import { SettlementType } from '@core/map/types';
import { HexRenderer } from '../HexRenderer';

const CITY_FILL = 0xd4c8a0;
const CITY_BORDER = 0x2a2a35;
const CITY_RADIUS = 8;
const TOWN_FILL = 0xa09880;
const TOWN_RADIUS = 4;

export class SettlementLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): void {
    this.graphics.clear();

    const margin = HexRenderer.HEX_SIZE * 2;
    const minQ = Math.max(
      0,
      HexRenderer.pixelToHex(bounds.minX - margin, bounds.minY).q - 1,
    );
    const maxQ = Math.min(
      this.gameMap.width - 1,
      HexRenderer.pixelToHex(bounds.maxX + margin, bounds.maxY).q + 1,
    );
    const minR = Math.max(
      0,
      HexRenderer.pixelToHex(bounds.minX, bounds.minY - margin).r - 1,
    );
    const maxR = Math.min(
      this.gameMap.height - 1,
      HexRenderer.pixelToHex(bounds.maxX, bounds.maxY + margin).r + 1,
    );

    for (let q = minQ; q <= maxQ; q++) {
      for (let r = minR; r <= maxR; r++) {
        const cell = this.gameMap.cells.get(HexGrid.key({ q, r }));
        if (!cell || cell.settlement === null) continue;

        const px = HexRenderer.hexToPixel(cell.coord);

        if (cell.settlement === SettlementType.City) {
          this.graphics.circle(px.x, px.y, CITY_RADIUS);
          this.graphics.fill({ color: CITY_FILL });
          this.graphics.circle(px.x, px.y, CITY_RADIUS);
          this.graphics.stroke({ width: 2, color: CITY_BORDER });
        } else {
          this.graphics.circle(px.x, px.y, TOWN_RADIUS);
          this.graphics.fill({ color: TOWN_FILL });
        }
      }
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/layers/SettlementLayer.ts
git commit -m "feat(ui): add SettlementLayer for city and town markers"
```

---

## Task 7: SelectionLayer

**Files:**
- Create: `src/ui/layers/SelectionLayer.ts`

Draws an amber highlight on the hex under the cursor. Only redraws when the hover target changes.

**Step 1: Write the implementation**

Create `src/ui/layers/SelectionLayer.ts`:

```typescript
import { Container, Graphics } from 'pixi.js';
import type { HexCoord } from '@core/map/types';
import { HexRenderer } from '../HexRenderer';

const HOVER_COLOR = 0xc8a040;
const HOVER_FILL_ALPHA = 0.1;
const HOVER_STROKE_WIDTH = 2;

export class SelectionLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private currentHex: HexCoord | null = null;

  constructor() {
    this.container.addChild(this.graphics);
  }

  /** Update hover target. Returns true if it changed. */
  setHover(coord: HexCoord | null): boolean {
    if (
      coord?.q === this.currentHex?.q &&
      coord?.r === this.currentHex?.r
    ) {
      return false;
    }

    this.graphics.clear();
    this.currentHex = coord;

    if (!coord) return true;

    const px = HexRenderer.hexToPixel(coord);
    const verts = HexRenderer.vertices(px.x, px.y);
    const flat = verts.flatMap((v) => [v.x, v.y]);

    this.graphics.poly(flat);
    this.graphics.fill({ color: HOVER_COLOR, alpha: HOVER_FILL_ALPHA });
    this.graphics.poly(flat);
    this.graphics.stroke({ width: HOVER_STROKE_WIDTH, color: HOVER_COLOR });

    return true;
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/layers/SelectionLayer.ts
git commit -m "feat(ui): add SelectionLayer for hex hover highlight"
```

---

## Task 8: MapRenderer Orchestrator

**Files:**
- Create: `src/ui/MapRenderer.ts`
- Modify: `src/ui/index.ts`

The MapRenderer wires everything together: creates the `worldContainer`, instantiates all 5 layers and the Camera, and handles the frame loop for rebuilding dirty layers and updating selection.

**Step 1: Write the implementation**

Create `src/ui/MapRenderer.ts`:

```typescript
import { Container, type Application } from 'pixi.js';
import type { GameMap, HexCoord } from '@core/map/types';
import { HexGrid } from '@core/map/HexGrid';
import { Camera } from './Camera';
import { HexRenderer } from './HexRenderer';
import { TerrainLayer } from './layers/TerrainLayer';
import { RiverLayer } from './layers/RiverLayer';
import { RouteLayer } from './layers/RouteLayer';
import { SettlementLayer } from './layers/SettlementLayer';
import { SelectionLayer } from './layers/SelectionLayer';

export class MapRenderer {
  private app: Application;
  private gameMap: GameMap;
  private worldContainer: Container;
  private camera: Camera;
  private terrainLayer: TerrainLayer;
  private riverLayer: RiverLayer;
  private routeLayer: RouteLayer;
  private settlementLayer: SettlementLayer;
  private selectionLayer: SelectionLayer;
  private boundOnFrame: () => void;

  constructor(app: Application, gameMap: GameMap) {
    this.app = app;
    this.gameMap = gameMap;

    // World container holds all layers — Camera transforms this
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    // Camera
    this.camera = new Camera(this.worldContainer, this.app);

    // Create layers in stack order (bottom to top)
    this.terrainLayer = new TerrainLayer(gameMap);
    this.riverLayer = new RiverLayer(gameMap);
    this.routeLayer = new RouteLayer(gameMap);
    this.settlementLayer = new SettlementLayer(gameMap);
    this.selectionLayer = new SelectionLayer();

    this.worldContainer.addChild(this.terrainLayer.container);
    this.worldContainer.addChild(this.riverLayer.container);
    this.worldContainer.addChild(this.routeLayer.container);
    this.worldContainer.addChild(this.settlementLayer.container);
    this.worldContainer.addChild(this.selectionLayer.container);

    // Initial build
    const bounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(bounds);
    this.riverLayer.build(bounds);
    this.routeLayer.build(bounds);
    this.settlementLayer.build(bounds);

    // Center on map middle
    const centerCoord = {
      q: Math.floor(gameMap.width / 2),
      r: Math.floor(gameMap.height / 2),
    };
    const centerPx = HexRenderer.hexToPixel(centerCoord);
    this.camera.centerOn(centerPx.x, centerPx.y);
    this.camera.clearDirty();

    // Rebuild after centering so the visible hexes are correct
    const newBounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(newBounds);
    this.riverLayer.build(newBounds);
    this.routeLayer.build(newBounds);
    this.settlementLayer.build(newBounds);

    // Attach camera input
    this.camera.attach();

    // Hover detection
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointermove', this.onPointerMove);

    // Frame loop for dirty-checking
    this.boundOnFrame = this.onFrame.bind(this);
    this.app.ticker.add(this.boundOnFrame);
  }

  /** Get the hex coordinate at a screen position, or null if off-map */
  getHexAtScreen(screenX: number, screenY: number): HexCoord | null {
    const world = this.camera.screenToWorld(screenX, screenY);
    const hex = HexRenderer.pixelToHex(world.x, world.y);
    if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) {
      return null;
    }
    return hex;
  }

  /** Remove all rendering and listeners */
  destroy(): void {
    this.app.ticker.remove(this.boundOnFrame);
    this.app.stage.off('pointermove', this.onPointerMove);
    this.camera.detach();
    this.terrainLayer.destroy();
    this.riverLayer.destroy();
    this.routeLayer.destroy();
    this.settlementLayer.destroy();
    this.selectionLayer.destroy();
    this.app.stage.removeChild(this.worldContainer);
    this.worldContainer.destroy();
  }

  private onPointerMove = (e: { global: { x: number; y: number } }): void => {
    const hex = this.getHexAtScreen(e.global.x, e.global.y);
    this.selectionLayer.setHover(hex);
  };

  private onFrame(): void {
    if (!this.camera.isDirty) return;
    this.camera.clearDirty();

    const bounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(bounds);
    this.riverLayer.build(bounds);
    this.routeLayer.build(bounds);
    this.settlementLayer.build(bounds);
  }
}
```

**Step 2: Update barrel exports**

Modify `src/ui/index.ts` — uncomment and update the MapRenderer export:

```typescript
/**
 * UI module - rendering and interaction
 *
 * This module contains:
 * - Map rendering
 * - Facility/route/vehicle sprites
 * - Detail panels
 * - Notifications
 */

export { MapRenderer } from './MapRenderer';
// export { DetailPanel } from './DetailPanel';
// export { NotificationSystem } from './NotificationSystem';
```

**Step 3: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/ui/MapRenderer.ts src/ui/index.ts
git commit -m "feat(ui): add MapRenderer orchestrator with all layers and camera"
```

---

## Task 9: MapGenerator Orchestrator (if not yet created)

**Files:**
- Create: `src/core/map/MapGenerator.ts` (if it doesn't exist)
- Create: `src/core/map/__tests__/MapGenerator.test.ts` (if it doesn't exist)

This task creates the MapGenerator that combines TerrainGenerator + RiverGenerator into a single `GameMap` output. Check if these files already exist first — if they do, skip this task entirely.

**Step 1: Check if MapGenerator exists**

Run: `ls src/core/map/MapGenerator.ts`
If the file exists: **SKIP this entire task and proceed to Task 10.**

**Step 2: Write the failing test**

Create `src/core/map/__tests__/MapGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MapGenerator } from '../MapGenerator';
import type { MapConfig } from '../types';

describe('MapGenerator', () => {
  const config: MapConfig = {
    mapSize: 'small',
    geography: 'mixed',
    initialInfrastructure: 'none',
    seed: 42,
  };

  it('returns a GameMap with correct dimensions', () => {
    const map = MapGenerator.generate(config);
    expect(map.width).toBe(40);
    expect(map.height).toBe(30);
    expect(map.cells.size).toBe(1200);
  });

  it('populates rivers', () => {
    const map = MapGenerator.generate(config);
    expect(map.rivers.length).toBeGreaterThan(0);
  });

  it('has empty roads/railways with no infrastructure', () => {
    const map = MapGenerator.generate(config);
    expect(map.roads).toEqual([]);
    expect(map.railways).toEqual([]);
  });

  it('is deterministic', () => {
    const a = MapGenerator.generate(config);
    const b = MapGenerator.generate(config);
    expect(a.rivers.length).toBe(b.rivers.length);
    for (const [key, cellA] of a.cells) {
      const cellB = b.cells.get(key)!;
      expect(cellA.terrain).toBe(cellB.terrain);
    }
  });
});
```

**Step 3: Run test to verify it fails**

Run: `bunx vitest run src/core/map/__tests__/MapGenerator.test.ts`
Expected: FAIL — cannot resolve `../MapGenerator`

**Step 4: Implement MapGenerator**

Create `src/core/map/MapGenerator.ts`:

```typescript
import type { GameMap, MapConfig } from './types';
import { TerrainGenerator } from './TerrainGenerator';
import { RiverGenerator } from './RiverGenerator';

const MAP_SIZES: Record<string, { width: number; height: number }> = {
  small: { width: 40, height: 30 },
  medium: { width: 60, height: 45 },
  large: { width: 80, height: 60 },
};

export class MapGenerator {
  static generate(config: MapConfig): GameMap {
    const { width, height } = MAP_SIZES[config.mapSize];

    const cells = TerrainGenerator.generate(
      width,
      height,
      config.geography,
      config.seed,
    );

    const rivers = RiverGenerator.generate(cells, width, height, config.seed);

    return {
      width,
      height,
      cells,
      rivers,
      roads: [],
      railways: [],
    };
  }
}
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run src/core/map/__tests__/MapGenerator.test.ts`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/core/map/MapGenerator.ts src/core/map/__tests__/MapGenerator.test.ts
git commit -m "feat(map): add MapGenerator orchestrator combining terrain and rivers"
```

---

## Task 10: Wire Into Game

**Files:**
- Modify: `src/game/Game.ts`

Replace the placeholder test screen with the actual map rendering.

**Step 1: Modify Game.ts**

Replace the contents of `src/game/Game.ts` with:

```typescript
import { type Application } from 'pixi.js';
import { MapGenerator } from '@core/map/MapGenerator';
import type { GameMap } from '@core/map/types';
import { MapRenderer } from '@ui/MapRenderer';

export class Game {
  private app: Application;
  private isPaused: boolean = false;
  private map: GameMap | null = null;
  private mapRenderer: MapRenderer | null = null;

  constructor(app: Application) {
    this.app = app;
  }

  async init(): Promise<void> {
    // Generate the map
    this.map = MapGenerator.generate({
      mapSize: 'small',
      geography: 'mixed',
      initialInfrastructure: 'none',
      seed: Date.now(),
    });

    // Render the map
    this.mapRenderer = new MapRenderer(this.app, this.map);

    // Set up game loop
    this.app.ticker.add(this.update.bind(this));

    // Set up keyboard controls
    this.setupControls();

    console.log('Supply Line initialized — map rendered');
  }

  private setupControls(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.togglePause();
      }
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    console.log(this.isPaused ? 'Game paused' : 'Game resumed');
  }

  private update(_ticker: { deltaTime: number }): void {
    if (this.isPaused) return;
  }
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Run all tests**

Run: `bun run check`
Expected: All lint, type, and test checks pass

**Step 4: Run dev server and verify visually**

Run: `bun run dev`
Expected:
- Browser opens with dark background
- Hex grid visible with colored terrain (greens, browns, greys, blues)
- Blue-grey river lines visible
- Left-click drag pans the map
- Scroll wheel zooms in/out
- Amber hex highlight follows cursor
- Map starts centered

**Step 5: Commit**

```bash
git add src/game/Game.ts
git commit -m "feat: wire map visualization into Game, replacing placeholder screen"
```

---

## Task 11: Final Verification

**Files:** (none — verification only)

**Step 1: Run full quality gate**

Run: `bun run check`
Expected: All lint, typecheck, and tests pass

**Step 2: Run dev server for visual smoke test**

Run: `bun run dev`

Verify:
- [ ] Terrain colors match palette (Water=dark blue, Plains=olive, Forest=dark green, Hills=brown, Mountain=slate grey, Marsh=grey-green)
- [ ] Hex borders are subtle (1px, very dark)
- [ ] Rivers are blue-grey lines flowing through hex edges
- [ ] Pan works (left-click drag)
- [ ] Zoom works (scroll wheel, centered on cursor)
- [ ] Hover highlight appears as amber hex outline
- [ ] Map is centered on load
- [ ] Zooming out shows the whole map, zooming in shows hex detail
- [ ] No console errors

**Step 3: Commit any fixups if needed**

If any issues found during visual testing, fix and commit:
```bash
git add -A
git commit -m "fix(ui): address visual issues from smoke test"
```

---

## Summary

| Task | Module | Tests | Description |
|------|--------|-------|-------------|
| 1 | HexRenderer.ts | 9 tests | Hex polygon vertex + edge midpoint calculations |
| 2 | Camera.ts | 14 tests | Pan, zoom, coordinate transforms, dirty flag |
| 3 | TerrainLayer.ts | — | Colored hex polygons per terrain type |
| 4 | RiverLayer.ts | — | Blue-grey edge lines for rivers |
| 5 | RouteLayer.ts | — | Dashed roads + railways with ties |
| 6 | SettlementLayer.ts | — | City/town circle markers |
| 7 | SelectionLayer.ts | — | Amber hover highlight |
| 8 | MapRenderer.ts | — | Orchestrator: layers + camera + frame loop |
| 9 | MapGenerator.ts | 4 tests | Pipeline orchestrator (skip if exists) |
| 10 | Game.ts | — | Integration: replace placeholder with map |
| 11 | — | — | Visual verification + quality gate |
