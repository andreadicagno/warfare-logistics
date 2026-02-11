import type { Application } from 'pixi.js';
import type { Camera } from './Camera';

const PAN_SPEED = 8;
const ZOOM_DELTA = 1.5;

const NAVIGATION_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Equal',
  'Minus',
  'NumpadAdd',
  'NumpadSubtract',
]);

export class KeyboardController {
  private pressedKeys = new Set<string>();
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.pressedKeys.clear();
  }

  update(camera: Camera): void {
    this.applyPan(camera);
    this.applyZoom(camera);
  }

  private applyPan(camera: Camera): void {
    let dx = 0;
    let dy = 0;

    if (this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) dy = 1;
    if (this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown')) dy = -1;
    if (this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft')) dx = 1;
    if (this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) dx = -1;

    if (dx === 0 && dy === 0) return;

    const speed = PAN_SPEED / camera.scale;
    camera.applyPan(dx * speed, dy * speed);
  }

  private applyZoom(camera: Camera): void {
    let deltaY = 0;

    if (this.pressedKeys.has('Equal') || this.pressedKeys.has('NumpadAdd')) deltaY = -ZOOM_DELTA;
    if (this.pressedKeys.has('Minus') || this.pressedKeys.has('NumpadSubtract'))
      deltaY = ZOOM_DELTA;

    if (deltaY === 0) return;

    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;
    camera.applyZoom(deltaY, centerX, centerY);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (NAVIGATION_KEYS.has(e.code)) {
      e.preventDefault();
    }
    this.pressedKeys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.pressedKeys.delete(e.code);
  };

  private onBlur = (): void => {
    this.pressedKeys.clear();
  };
}
