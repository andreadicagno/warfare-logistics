import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import { type Application, Container } from 'pixi.js';
import { Camera } from './Camera';
import { HexRenderer } from './HexRenderer';
import { RouteLayer } from './layers/RouteLayer';
import { SelectionLayer } from './layers/SelectionLayer';
import { SupplyHubLayer } from './layers/SupplyHubLayer';
import { TerrainLayer } from './layers/TerrainLayer';

export type LayerName = 'terrain' | 'routes' | 'supplyHubs' | 'selection';

export class MapRenderer {
  private app: Application;
  private gameMap: GameMap;
  private worldContainer: Container;
  private camera: Camera;
  private terrainLayer: TerrainLayer;
  private routeLayer: RouteLayer;
  private supplyHubLayer: SupplyHubLayer;
  private selectionLayer: SelectionLayer;
  private boundOnFrame: () => void;
  private disabledLayers = new Set<LayerName>();

  constructor(app: Application, gameMap: GameMap) {
    this.app = app;
    this.gameMap = gameMap;

    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.camera = new Camera(this.worldContainer, this.app);

    this.terrainLayer = new TerrainLayer(gameMap);
    this.routeLayer = new RouteLayer(gameMap);
    this.supplyHubLayer = new SupplyHubLayer(gameMap);
    this.selectionLayer = new SelectionLayer();

    this.worldContainer.addChild(this.terrainLayer.container);
    this.worldContainer.addChild(this.routeLayer.container);
    this.worldContainer.addChild(this.supplyHubLayer.container);
    this.worldContainer.addChild(this.selectionLayer.container);

    const bounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(bounds);
    this.routeLayer.build(bounds);
    this.supplyHubLayer.build(bounds);

    const centerCol = Math.floor(gameMap.width / 2);
    const centerRow = Math.floor(gameMap.height / 2);
    const centerCoord = {
      q: centerCol,
      r: centerRow - Math.floor(centerCol / 2),
    };
    const centerPx = HexRenderer.hexToPixel(centerCoord);
    this.camera.centerOn(centerPx.x, centerPx.y);
    this.camera.clearDirty();

    const newBounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(newBounds);
    this.routeLayer.build(newBounds);
    this.supplyHubLayer.build(newBounds);

    this.camera.attach();

    this.app.stage.on('pointermove', this.onPointerMove);

    this.boundOnFrame = this.onFrame.bind(this);
    this.app.ticker.add(this.boundOnFrame);
  }

  get cameraRef(): Camera {
    return this.camera;
  }

  get zoom(): number {
    return this.camera.scale;
  }

  get hoveredHex(): HexCoord | null {
    return this.selectionLayer.hoveredHex;
  }

  get visibleCellCount(): number {
    const bounds = this.camera.getVisibleBounds();
    const margin = HexRenderer.HEX_SIZE * 2;
    let count = 0;
    for (const cell of this.gameMap.cells.values()) {
      const px = HexRenderer.hexToPixel(cell.coord);
      if (
        px.x >= bounds.minX - margin &&
        px.x <= bounds.maxX + margin &&
        px.y >= bounds.minY - margin &&
        px.y <= bounds.maxY + margin
      ) {
        count++;
      }
    }
    return count;
  }

  getHexAtScreen(screenX: number, screenY: number): HexCoord | null {
    const world = this.camera.screenToWorld(screenX, screenY);
    const hex = HexRenderer.pixelToHex(world.x, world.y);
    if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) {
      return null;
    }
    return hex;
  }

  setLayerVisible(layer: LayerName, visible: boolean): void {
    const container = this.layerContainer(layer);
    if (!container) return;
    container.visible = visible;
    if (visible) {
      this.disabledLayers.delete(layer);
      // Rebuild immediately so it's up to date
      const bounds = this.camera.getVisibleBounds();
      this.buildLayer(layer, bounds);
    } else {
      this.disabledLayers.add(layer);
    }
  }

  private layerContainer(layer: LayerName): Container | null {
    switch (layer) {
      case 'terrain':
        return this.terrainLayer.container;
      case 'routes':
        return this.routeLayer.container;
      case 'supplyHubs':
        return this.supplyHubLayer.container;
      case 'selection':
        return this.selectionLayer.container;
    }
  }

  private buildLayer(
    layer: LayerName,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
  ): void {
    switch (layer) {
      case 'terrain':
        this.terrainLayer.build(bounds);
        break;
      case 'routes':
        this.routeLayer.build(bounds);
        break;
      case 'supplyHubs':
        this.supplyHubLayer.build(bounds);
        break;
      // selection doesn't have build()
    }
  }

  destroy(): void {
    this.app.ticker.remove(this.boundOnFrame);
    this.app.stage.off('pointermove', this.onPointerMove);
    this.camera.detach();
    this.terrainLayer.destroy();
    this.routeLayer.destroy();
    this.supplyHubLayer.destroy();
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
    // All layers build once and cache their geometry.
    // PixiJS handles viewport clipping on the GPU.
  }
}
