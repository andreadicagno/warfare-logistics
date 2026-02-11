import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import { type Application, Container } from 'pixi.js';
import { Camera } from './Camera';
import { HexRenderer } from './HexRenderer';
import { RiverLayer } from './layers/RiverLayer';
import { RouteLayer } from './layers/RouteLayer';
import { SelectionLayer } from './layers/SelectionLayer';
import { SettlementLayer } from './layers/SettlementLayer';
import { TerrainLayer } from './layers/TerrainLayer';

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

    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.camera = new Camera(this.worldContainer, this.app);

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

    const bounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(bounds);
    this.riverLayer.build(bounds);
    this.routeLayer.build(bounds);
    this.settlementLayer.build(bounds);

    const centerCoord = {
      q: Math.floor(gameMap.width / 2),
      r: Math.floor(gameMap.height / 2),
    };
    const centerPx = HexRenderer.hexToPixel(centerCoord);
    this.camera.centerOn(centerPx.x, centerPx.y);
    this.camera.clearDirty();

    const newBounds = this.camera.getVisibleBounds();
    this.terrainLayer.build(newBounds);
    this.riverLayer.build(newBounds);
    this.routeLayer.build(newBounds);
    this.settlementLayer.build(newBounds);

    this.camera.attach();

    this.app.stage.on('pointermove', this.onPointerMove);

    this.boundOnFrame = this.onFrame.bind(this);
    this.app.ticker.add(this.boundOnFrame);
  }

  getHexAtScreen(screenX: number, screenY: number): HexCoord | null {
    const world = this.camera.screenToWorld(screenX, screenY);
    const hex = HexRenderer.pixelToHex(world.x, world.y);
    if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) {
      return null;
    }
    return hex;
  }

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
