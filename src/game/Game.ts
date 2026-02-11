import { MapGenerator } from '@core/map/MapGenerator';
import type { GameMap, HexCell, MapConfig } from '@core/map/types';
import type { DebugInfo } from '@ui/DebugOverlay';
import { DebugOverlay } from '@ui/DebugOverlay';
import { GeneratorToolbar } from '@ui/GeneratorToolbar';
import { KeyboardController } from '@ui/KeyboardController';
import { MapRenderer } from '@ui/MapRenderer';
import type { Application } from 'pixi.js';

const DEFAULT_CONFIG: MapConfig = {
  mapSize: 'small',
  geography: 'mixed',
  initialInfrastructure: 'none',
  seed: Date.now(),
};

export class Game {
  private app: Application;
  private isPaused: boolean = false;
  private map: GameMap | null = null;
  private mapRenderer: MapRenderer | null = null;
  private debugOverlay: DebugOverlay | null = null;
  private toolbar: GeneratorToolbar | null = null;
  private keyboardController: KeyboardController | null = null;
  private currentConfig: MapConfig = { ...DEFAULT_CONFIG };

  constructor(app: Application) {
    this.app = app;
  }

  async init(): Promise<void> {
    this.generateMap(this.currentConfig);

    const container = this.app.canvas.parentElement;
    if (container) {
      this.debugOverlay = new DebugOverlay(container);
      this.toolbar = new GeneratorToolbar(container, this.currentConfig, (config) =>
        this.onGenerate(config),
      );
    }

    this.keyboardController = new KeyboardController(this.app);
    this.keyboardController.attach();

    this.app.ticker.add(this.update.bind(this));
    this.setupControls();

    console.log('Supply Line initialized — map rendered');
  }

  private generateMap(config: MapConfig): void {
    this.mapRenderer?.destroy();
    this.map = MapGenerator.generate(config);
    this.mapRenderer = new MapRenderer(this.app, this.map);
    this.currentConfig = config;
  }

  private onGenerate(config: MapConfig): void {
    this.generateMap(config);
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
    console.log(this.isPaused ? 'Game paused' : 'Game resumed');
  }

  private update(_ticker: { deltaTime: number }): void {
    if (this.mapRenderer) {
      this.keyboardController?.update(this.mapRenderer.cameraRef);
    }
    this.updateDebugOverlay();

    if (this.isPaused) return;
    // Future: game simulation updates go here
  }

  private updateDebugOverlay(): void {
    if (!this.debugOverlay || !this.mapRenderer || !this.map) return;

    const hex = this.mapRenderer.hoveredHex;
    let cell: HexCell | null = null;
    let hasRoad = false;
    let hasRailway = false;

    if (hex) {
      const key = `${hex.q},${hex.r}`;
      cell = this.map.cells.get(key) ?? null;
      if (cell) {
        hasRoad = this.map.roads.some((r) => r.hexes.some((h) => h.q === hex.q && h.r === hex.r));
        hasRailway = this.map.railways.some((r) =>
          r.hexes.some((h) => h.q === hex.q && h.r === hex.r),
        );
      }
    }

    const info: DebugInfo = {
      fps: this.app.ticker.FPS,
      zoom: this.mapRenderer.zoom,
      cursorHex: hex,
      visibleCells: this.mapRenderer.visibleCellCount,
      cell,
      hasRoad,
      hasRailway,
    };

    this.debugOverlay.update(info);
  }

  destroy(): void {
    this.mapRenderer?.destroy();
    this.mapRenderer = null;
    this.map = null;
    this.debugOverlay?.destroy();
    this.debugOverlay = null;
    this.toolbar?.destroy();
    this.toolbar = null;
    this.keyboardController?.detach();
    this.keyboardController = null;
  }
}
