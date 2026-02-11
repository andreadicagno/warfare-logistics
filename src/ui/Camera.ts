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

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.container.position.x) / this.container.scale.x,
      y: (screenY - this.container.position.y) / this.container.scale.y,
    };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.container.scale.x + this.container.position.x,
      y: worldY * this.container.scale.y + this.container.position.y,
    };
  }

  getVisibleBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.app.screen.width, this.app.screen.height);
    return {
      minX: topLeft.x,
      minY: topLeft.y,
      maxX: bottomRight.x,
      maxY: bottomRight.y,
    };
  }

  centerOn(worldX: number, worldY: number): void {
    this.container.position.x = this.app.screen.width / 2 - worldX * this.container.scale.x;
    this.container.position.y = this.app.screen.height / 2 - worldY * this.container.scale.y;
    this._isDirty = true;
  }

  applyZoom(deltaY: number, screenX: number, screenY: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);
    const zoomFactor = 1 - deltaY * 0.01;
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.container.scale.x * zoomFactor));
    this.container.scale.set(newScale);
    const worldAfter = this.screenToWorld(screenX, screenY);
    this.container.position.x += (worldAfter.x - worldBefore.x) * this.container.scale.x;
    this.container.position.y += (worldAfter.y - worldBefore.y) * this.container.scale.y;
    this._isDirty = true;
  }

  applyPan(dx: number, dy: number): void {
    this.container.position.x += dx;
    this.container.position.y += dy;
    this._isDirty = true;
  }

  attach(): void {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', this.onPointerDown);
    this.app.stage.on('pointermove', this.onPointerMove);
    this.app.stage.on('pointerup', this.onPointerUp);
    this.app.stage.on('pointerupoutside', this.onPointerUp);
    this.app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

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
