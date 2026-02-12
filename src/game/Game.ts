import { MapGenerator } from '@core/map/MapGenerator';
import type { GameMap, GenerationParams, HexCell } from '@core/map/types';
import { DEFAULT_GENERATION_PARAMS } from '@core/map/types';
import { Profiler } from '@core/Profiler';
import type { DebugInfo } from '@ui/DebugOverlay';
import { DebugOverlay } from '@ui/DebugOverlay';
import { KeyboardController } from '@ui/KeyboardController';
import { MapRenderer } from '@ui/MapRenderer';
import { Sidebar } from '@ui/Sidebar';
import type { Application } from 'pixi.js';

export class Game {
  private static readonly PARAMS_STORAGE_KEY = 'supplyline:params';
  private static readonly ACTIVE_FPS = 60;
  private static readonly IDLE_FPS = 30;
  private static readonly IDLE_TIMEOUT_MS = 3000;

  private app: Application;
  private isPaused: boolean = false;
  private lastActivityTime = performance.now();
  private map: GameMap | null = null;
  private mapRenderer: MapRenderer | null = null;
  private debugOverlay: DebugOverlay | null = null;
  private sidebar: Sidebar | null = null;
  private keyboardController: KeyboardController | null = null;
  private currentParams: GenerationParams = { ...DEFAULT_GENERATION_PARAMS };

  constructor(app: Application) {
    this.app = app;
  }

  async init(): Promise<void> {
    this.currentParams = Game.loadParams();
    this.generateMap(this.currentParams);

    const container = this.app.canvas.parentElement;
    if (container) {
      this.debugOverlay = new DebugOverlay(container);
      this.sidebar = new Sidebar(container, this.currentParams, (params) =>
        this.onGenerate(params),
      );
      this.sidebar.setOnLayerToggle((layer, visible) => {
        this.mapRenderer?.setLayerVisible(layer, visible);
      });
    }

    this.keyboardController = new KeyboardController(this.app);
    this.keyboardController.attach();

    this.app.ticker.maxFPS = Game.ACTIVE_FPS;
    this.app.ticker.add(this.update.bind(this));
    this.setupControls();
    this.setupIdleDetection();

    console.log('Supply Line initialized — map rendered');
  }

  private generateMap(params: GenerationParams): void {
    const prof = new Profiler('Total generation');

    this.mapRenderer?.destroy();

    this.map = prof.measure('MapGenerator.generate()', () => MapGenerator.generate(params));
    this.mapRenderer = prof.measure(
      'MapRenderer (build layers)',
      () => new MapRenderer(this.app, this.map!),
    );
    this.currentParams = params;

    prof.log();
  }

  private onGenerate(params: GenerationParams): void {
    this.generateMap(params);
    Game.saveParams(params);
  }

  private static loadParams(): GenerationParams {
    try {
      const raw = localStorage.getItem(Game.PARAMS_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_GENERATION_PARAMS, ...JSON.parse(raw) };
      }
    } catch {
      // Ignore corrupt data
    }
    return { ...DEFAULT_GENERATION_PARAMS };
  }

  private static saveParams(params: GenerationParams): void {
    localStorage.setItem(Game.PARAMS_STORAGE_KEY, JSON.stringify(params));
  }

  private setupControls(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.togglePause();
      } else if (e.code === 'F3') {
        e.preventDefault();
        this.debugOverlay?.toggle();
      }
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.mapRenderer?.setPaused(this.isPaused);
    console.log(this.isPaused ? 'Game paused' : 'Game resumed');
  }

  private update(_ticker: { deltaTime: number }): void {
    this.updateIdleThrottle();

    if (this.mapRenderer) {
      this.keyboardController?.update(this.mapRenderer.cameraRef);
    }
    this.updateDebugOverlay();

    if (this.isPaused) return;
    // Future: game simulation updates go here
  }

  // --- Idle throttle ---

  private setupIdleDetection(): void {
    const canvas = this.app.canvas;
    canvas.addEventListener('pointermove', this.resetActivity);
    canvas.addEventListener('pointerdown', this.resetActivity);
    canvas.addEventListener('wheel', this.resetActivity);
    window.addEventListener('keydown', this.resetActivity);
  }

  private teardownIdleDetection(): void {
    const canvas = this.app.canvas;
    canvas.removeEventListener('pointermove', this.resetActivity);
    canvas.removeEventListener('pointerdown', this.resetActivity);
    canvas.removeEventListener('wheel', this.resetActivity);
    window.removeEventListener('keydown', this.resetActivity);
  }

  private resetActivity = (): void => {
    this.lastActivityTime = performance.now();
  };

  private updateIdleThrottle(): void {
    const idle = performance.now() - this.lastActivityTime > Game.IDLE_TIMEOUT_MS;
    const targetFps = idle ? Game.IDLE_FPS : Game.ACTIVE_FPS;
    if (this.app.ticker.maxFPS !== targetFps) {
      this.app.ticker.maxFPS = targetFps;
    }
  }

  private updateDebugOverlay(): void {
    if (!this.debugOverlay || !this.mapRenderer || !this.map) return;

    const hex = this.mapRenderer.hoveredHex;
    let cell: HexCell | null = null;
    let supplyLineLevel: number | null = null;

    if (hex) {
      const key = `${hex.q},${hex.r}`;
      cell = this.map.cells.get(key) ?? null;
      if (cell) {
        const line = this.map.supplyLines.find((l) =>
          l.hexes.some((h) => h.q === hex.q && h.r === hex.r),
        );
        supplyLineLevel = line?.level ?? null;
      }
    }

    const info: DebugInfo = {
      fps: this.app.ticker.FPS,
      zoom: this.mapRenderer.zoom,
      cursorHex: hex,
      visibleCells: this.mapRenderer.visibleCellCount,
      cell,
      supplyLineLevel,
    };

    this.debugOverlay.update(info);
  }

  destroy(): void {
    this.teardownIdleDetection();
    this.mapRenderer?.destroy();
    this.mapRenderer = null;
    this.map = null;
    this.debugOverlay?.destroy();
    this.debugOverlay = null;
    this.sidebar?.destroy();
    this.sidebar = null;
    this.keyboardController?.detach();
    this.keyboardController = null;
  }
}
