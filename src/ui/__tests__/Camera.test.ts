import { describe, it, expect } from 'vitest';
import { Camera } from '../Camera';

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
