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
    this.map = MapGenerator.generate({
      mapSize: 'small',
      geography: 'mixed',
      initialInfrastructure: 'none',
      seed: Date.now(),
    });

    this.mapRenderer = new MapRenderer(this.app, this.map);

    this.app.ticker.add(this.update.bind(this));
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

  destroy(): void {
    this.mapRenderer?.destroy();
    this.mapRenderer = null;
    this.map = null;
  }
}
