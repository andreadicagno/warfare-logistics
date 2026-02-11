import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import { MockSimulation } from '@core/mock/MockSimulation';
import type { RouteHealth } from '@core/mock/types';
import { Profiler } from '@core/Profiler';
import { type Application, Container } from 'pixi.js';
import { Camera } from './Camera';
import { HexRenderer } from './HexRenderer';
import { FlowLayer } from './layers/FlowLayer';
import { FrontLineLayer } from './layers/FrontLineLayer';
import { RouteLayer } from './layers/RouteLayer';
import { SelectionLayer } from './layers/SelectionLayer';
import { SupplyFlowLayer } from './layers/SupplyFlowLayer';
import { SupplyHubLayer } from './layers/SupplyHubLayer';
import { TerrainLayer } from './layers/TerrainLayer';
import { TerritoryLayer } from './layers/TerritoryLayer';
import { UnitLayer } from './layers/UnitLayer';
import { VehicleLayer } from './layers/VehicleLayer';

export type LayerName =
  | 'terrain'
  | 'territory'
  | 'routes'
  | 'flows'
  | 'vehicles'
  | 'supplyHubs'
  | 'supplyFlow'
  | 'frontLine'
  | 'units'
  | 'selection';

export class MapRenderer {
  private app: Application;
  private gameMap: GameMap;
  private worldContainer: Container;
  private camera: Camera;
  private terrainLayer: TerrainLayer;
  private territoryLayer: TerritoryLayer;
  private routeLayer: RouteLayer;
  private flowLayer: FlowLayer;
  private vehicleLayer: VehicleLayer;
  private supplyHubLayer: SupplyHubLayer;
  private supplyFlowLayer: SupplyFlowLayer;
  private frontLineLayer: FrontLineLayer;
  private unitLayer: UnitLayer;
  private selectionLayer: SelectionLayer;
  private boundOnFrame: () => void;
  private disabledLayers = new Set<LayerName>();
  private mockSim: MockSimulation;
  private lastMockVersion = -1;
  private isPaused = false;

  constructor(app: Application, gameMap: GameMap) {
    const prof = new Profiler('MapRenderer');

    this.app = app;
    this.gameMap = gameMap;

    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.camera = new Camera(this.worldContainer, this.app);

    // Create MockSimulation
    this.mockSim = new MockSimulation(gameMap);

    // Build route health maps from mock state
    const roadHealths = new Map<number, RouteHealth>();
    const railwayHealths = new Map<number, RouteHealth>();
    for (let i = 0; i < this.mockSim.state.routeStates.length; i++) {
      const rs = this.mockSim.state.routeStates[i];
      if (rs.route.type === 'road') {
        const idx = gameMap.roads.indexOf(rs.route);
        if (idx >= 0) roadHealths.set(idx, rs.health);
      } else {
        const idx = gameMap.railways.indexOf(rs.route);
        if (idx >= 0) railwayHealths.set(idx, rs.health);
      }
    }

    // Create layers
    this.terrainLayer = new TerrainLayer(gameMap);
    this.territoryLayer = new TerritoryLayer(
      gameMap,
      this.mockSim.state.territory,
      this.mockSim.state.frontLineEdges,
    );
    this.routeLayer = new RouteLayer(
      gameMap,
      roadHealths,
      railwayHealths,
      this.mockSim.state.accessRamps,
    );
    this.flowLayer = new FlowLayer(() => this.camera.scale);
    this.vehicleLayer = new VehicleLayer(() => this.camera.scale);
    this.supplyHubLayer = new SupplyHubLayer(this.mockSim.state.facilities);
    this.supplyFlowLayer = new SupplyFlowLayer(() => this.camera.scale);
    this.frontLineLayer = new FrontLineLayer();
    this.unitLayer = new UnitLayer();
    this.selectionLayer = new SelectionLayer();

    // Add to scene graph in correct rendering order
    this.worldContainer.addChild(this.terrainLayer.container);
    this.worldContainer.addChild(this.territoryLayer.container);
    this.worldContainer.addChild(this.routeLayer.container);
    this.worldContainer.addChild(this.flowLayer.container);
    this.worldContainer.addChild(this.vehicleLayer.container);
    this.worldContainer.addChild(this.supplyHubLayer.container);
    this.worldContainer.addChild(this.supplyFlowLayer.container);
    this.worldContainer.addChild(this.frontLineLayer.container);
    this.worldContainer.addChild(this.unitLayer.container);
    this.worldContainer.addChild(this.selectionLayer.container);

    const bounds = this.camera.getVisibleBounds();
    prof.measure('TerrainLayer.build()', () => this.terrainLayer.build(bounds));
    prof.measure('RouteLayer.build()', () => this.routeLayer.build(0));

    // Initialize data and build versioned layers
    this.territoryLayer.build(this.mockSim.state.version);
    this.frontLineLayer.updateData(this.mockSim.state.frontLineEdges);
    this.frontLineLayer.build(this.mockSim.state.version);
    this.unitLayer.updateData(this.mockSim.state.units);
    this.unitLayer.updateFormations(this.mockSim.state.formations);
    this.unitLayer.build(this.mockSim.state.version);
    this.supplyHubLayer.build(this.mockSim.state.version);
    this.supplyFlowLayer.updateData(this.mockSim.state.facilities, this.mockSim.state.units);
    this.supplyFlowLayer.rebuild(this.mockSim.state.version);
    this.lastMockVersion = this.mockSim.state.version;

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
    this.routeLayer.build(0);
    this.supplyHubLayer.build(this.lastMockVersion);

    // Initialize FlowLayer (replaces RouteAnimator)
    prof.measure('FlowLayer.init()', () => {
      this.flowLayer.init(
        this.routeLayer.computedRoadSplines,
        this.routeLayer.computedRailwaySplines,
        roadHealths,
        railwayHealths,
      );
    });

    // Initialize VehicleLayer
    this.vehicleLayer.init(
      this.routeLayer.computedRoadSplines,
      this.routeLayer.computedRailwaySplines,
    );

    this.camera.attach();

    this.app.stage.on('pointermove', this.onPointerMove);

    this.boundOnFrame = this.onFrame.bind(this);
    this.app.ticker.add(this.boundOnFrame);

    prof.log();
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
      this.buildLayer(layer);
    } else {
      this.disabledLayers.add(layer);
    }
  }

  setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  private layerContainer(layer: LayerName): Container | null {
    switch (layer) {
      case 'terrain':
        return this.terrainLayer.container;
      case 'territory':
        return this.territoryLayer.container;
      case 'routes':
        return this.routeLayer.container;
      case 'flows':
        return this.flowLayer.container;
      case 'vehicles':
        return this.vehicleLayer.container;
      case 'supplyHubs':
        return this.supplyHubLayer.container;
      case 'supplyFlow':
        return this.supplyFlowLayer.container;
      case 'frontLine':
        return this.frontLineLayer.container;
      case 'units':
        return this.unitLayer.container;
      case 'selection':
        return this.selectionLayer.container;
    }
  }

  private buildLayer(layer: LayerName): void {
    switch (layer) {
      case 'terrain':
        this.terrainLayer.build(this.camera.getVisibleBounds());
        break;
      case 'territory':
        this.territoryLayer.build(this.lastMockVersion);
        break;
      case 'routes':
        this.routeLayer.build(this.lastMockVersion);
        break;
      case 'supplyHubs':
        this.supplyHubLayer.build(this.lastMockVersion);
        break;
      case 'supplyFlow':
        this.supplyFlowLayer.rebuild(this.lastMockVersion);
        break;
      case 'frontLine':
        this.frontLineLayer.build(this.lastMockVersion);
        break;
      case 'units':
        this.unitLayer.build(this.lastMockVersion);
        break;
      // flows, vehicles, selection don't have build()
    }
  }

  destroy(): void {
    this.app.ticker.remove(this.boundOnFrame);
    this.app.stage.off('pointermove', this.onPointerMove);
    this.camera.detach();
    this.terrainLayer.destroy();
    this.territoryLayer.destroy();
    this.routeLayer.destroy();
    this.flowLayer.destroy();
    this.vehicleLayer.destroy();
    this.supplyHubLayer.destroy();
    this.supplyFlowLayer.destroy();
    this.frontLineLayer.destroy();
    this.unitLayer.destroy();
    this.selectionLayer.destroy();
    this.app.stage.removeChild(this.worldContainer);
    this.worldContainer.destroy();
  }

  private onPointerMove = (e: { global: { x: number; y: number } }): void => {
    const hex = this.getHexAtScreen(e.global.x, e.global.y);
    this.selectionLayer.setHover(hex);
  };

  private onFrame(): void {
    const dt = this.app.ticker.deltaMS / 1000;

    // Update mock simulation
    if (!this.isPaused) {
      this.mockSim.update(dt);
    }

    // Rebuild static layers if mock state version changed
    if (this.mockSim.state.version !== this.lastMockVersion) {
      this.lastMockVersion = this.mockSim.state.version;
      this.territoryLayer.updateData(
        this.mockSim.state.territory,
        this.mockSim.state.frontLineEdges,
      );
      this.territoryLayer.build(this.lastMockVersion);
      this.frontLineLayer.updateData(this.mockSim.state.frontLineEdges);
      this.frontLineLayer.build(this.lastMockVersion);
      this.unitLayer.updateData(this.mockSim.state.units);
      this.unitLayer.updateFormations(this.mockSim.state.formations);
      this.unitLayer.build(this.lastMockVersion);
      this.supplyHubLayer.updateData(this.mockSim.state.facilities);
      this.supplyHubLayer.build(this.lastMockVersion);
      this.supplyFlowLayer.updateData(this.mockSim.state.facilities, this.mockSim.state.units);
      this.supplyFlowLayer.rebuild(this.lastMockVersion);
    }

    // Per-frame animated layers
    this.flowLayer.update(this.app.ticker);
    this.vehicleLayer.update(this.app.ticker, this.mockSim.state.vehicles);
    this.supplyFlowLayer.update(this.app.ticker);
    this.unitLayer.update(dt);
  }
}
