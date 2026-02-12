import { MapGenerator } from '@core/map/MapGenerator';
import type { GameMap, HexCoord } from '@core/map/types';
import { DEFAULT_GENERATION_PARAMS } from '@core/map/types';
import { Simulation } from '@core/simulation/Simulation';
import type { BuildTool } from '@core/simulation/types';
import type { Application } from 'pixi.js';
import { Container } from 'pixi.js';
import { Camera } from '../Camera';
import { HexRenderer } from '../HexRenderer';
import { SelectionLayer } from '../layers/SelectionLayer';
import { TerrainLayer } from '../layers/TerrainLayer';
import { BuildToolbar } from './BuildToolbar';
import type { TimeSpeed } from './TimeControls';
import { TimeControls } from './TimeControls';

const PLAYGROUND_SEED = 42;
const PLAYGROUND_MAP_SIZE = { width: 60, height: 45 };

export class PlaygroundPage {
  private app: Application;
  private gameMap!: GameMap;
  private _simulation!: Simulation;
  private worldContainer!: Container;
  private camera!: Camera;
  private terrainLayer!: TerrainLayer;
  private selectionLayer!: SelectionLayer;
  private boundOnFrame!: () => void;
  private toolbar!: BuildToolbar;
  private _currentTool: BuildTool = 'select';
  private timeControls!: TimeControls;
  private isPlaying = false;
  private tickSpeed: TimeSpeed = 1;
  private tickAccumulator = 0;

  constructor(app: Application) {
    this.app = app;
  }

  /** The simulation instance — available after init(). */
  get simulation(): Simulation {
    return this._simulation;
  }

  /** The currently active build tool. */
  get currentTool(): BuildTool {
    return this._currentTool;
  }

  async init(): Promise<void> {
    // Generate a small, fixed-seed map
    const params = {
      ...DEFAULT_GENERATION_PARAMS,
      width: PLAYGROUND_MAP_SIZE.width,
      height: PLAYGROUND_MAP_SIZE.height,
      seed: PLAYGROUND_SEED,
    };
    this.gameMap = MapGenerator.generate(params);

    // Create simulation
    this._simulation = new Simulation(this.gameMap);

    // Scene graph
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    // Camera
    this.camera = new Camera(this.worldContainer, this.app);

    // Terrain layer
    this.terrainLayer = new TerrainLayer(this.gameMap);
    this.worldContainer.addChild(this.terrainLayer.container);

    // Selection layer
    this.selectionLayer = new SelectionLayer();
    this.worldContainer.addChild(this.selectionLayer.container);

    // Initial build
    const bounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(bounds);

    // Center camera on map middle
    const centerCol = Math.floor(this.gameMap.width / 2);
    const centerRow = Math.floor(this.gameMap.height / 2);
    const centerCoord = { q: centerCol, r: centerRow - Math.floor(centerCol / 2) };
    const centerPx = HexRenderer.hexToPixel(centerCoord);
    this.camera.centerOn(centerPx.x, centerPx.y);
    this.camera.clearDirty();
    this.terrainLayer.build(this.camera.getVisibleBounds());

    // Attach camera controls
    this.camera.attach();

    // HTML overlays (toolbar + time controls)
    const htmlContainer = this.app.canvas.parentElement;
    if (htmlContainer) {
      this.toolbar = new BuildToolbar(htmlContainer, (tool) => {
        this._currentTool = tool;
      });

      this.timeControls = new TimeControls(
        htmlContainer,
        (action) => {
          if (action === 'step') {
            this._simulation.tick();
          } else if (action === 'play') {
            this.isPlaying = true;
          } else {
            this.isPlaying = false;
          }
        },
        (speed) => {
          this.tickSpeed = speed;
        },
      );
    }

    // Pointer tracking for hex hover
    this.app.stage.on('pointermove', this.onPointerMove);

    // Frame loop
    this.boundOnFrame = this.onFrame.bind(this);
    this.app.ticker.add(this.boundOnFrame);
  }

  get hoveredHex(): HexCoord | null {
    return this.selectionLayer.hoveredHex;
  }

  private onPointerMove = (e: { global: { x: number; y: number } }): void => {
    const world = this.camera.screenToWorld(e.global.x, e.global.y);
    const hex = HexRenderer.pixelToHex(world.x, world.y);
    this.selectionLayer.setHover(hex);
  };

  private onFrame(): void {
    const dt = this.app.ticker.deltaMS / 1000;

    if (this.camera.isDirty) {
      const bounds = this.camera.getVisibleBounds();
      this.terrainLayer.build(bounds);
      this.camera.clearDirty();
    }

    if (this.isPlaying) {
      this.tickAccumulator += dt * this.tickSpeed;
      while (this.tickAccumulator >= 1) {
        this._simulation.tick();
        this.tickAccumulator -= 1;
      }
    }

    this.timeControls?.updateTick(this._simulation.state.tick);
  }

  destroy(): void {
    this.app.ticker.remove(this.boundOnFrame);
    this.app.stage.off('pointermove', this.onPointerMove);
    this.toolbar?.destroy();
    this.timeControls?.destroy();
    this.camera.detach();
    this.terrainLayer.destroy();
    this.selectionLayer.destroy();
    this.app.stage.removeChild(this.worldContainer);
    this.worldContainer.destroy();
  }
}
