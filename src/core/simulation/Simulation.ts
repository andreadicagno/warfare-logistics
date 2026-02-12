import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import type { ResourceType } from '@data/types';
import { DemandResolver } from './DemandResolver';
import { NetworkGraph } from './NetworkGraph';
import { ProductionPhase } from './ProductionPhase';
import { TransportPhase } from './TransportPhase';
import type { PlacedDepot, PlacedFactory, SimSupplyLine, SimulationState } from './types';
import {
  DEPOT_TABLE,
  emptyStorage,
  FACTORY_TABLE,
  IMPASSABLE_TERRAIN,
  SUPPLY_LINE_TABLE,
  TICKS_PER_DAY,
} from './types';

let nextId = 0;
const uid = (): string => `e-${++nextId}`;

export class Simulation {
  readonly state: SimulationState;
  private readonly gameMap: GameMap;
  private network = new NetworkGraph();

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.state = {
      tick: 0,
      factories: new Map(),
      depots: new Map(),
      supplyLines: new Map(),
      shipments: [],
      occupiedHexes: new Map(),
      version: 0,
    };
  }

  // -- Tick --

  tick(): void {
    this.state.tick++;

    // Reset daily counters at start of each day
    if (this.state.tick % TICKS_PER_DAY === 0) {
      for (const line of this.state.supplyLines.values()) {
        line.capacityUsedToday = 0;
      }
      for (const depot of this.state.depots.values()) {
        depot.throughputUsedToday = 0;
      }
    }

    // Phase 1: Production
    ProductionPhase.run([...this.state.factories.values()]);

    // Phase 2: Demand resolution -> create new shipments
    const newShipments = DemandResolver.resolve(
      this.state.factories,
      this.state.depots,
      this.state.supplyLines,
      this.network,
    );
    this.state.shipments.push(...newShipments);

    // Phase 3: Transport
    const result = TransportPhase.run(this.state.shipments, this.state.depots);
    this.state.shipments = result.active;

    this.state.version++;
  }

  // -- Build Operations --

  addFactory(hex: HexCoord, resourceType: ResourceType): PlacedFactory | null {
    if (!this.canPlace(hex)) return null;

    const stats = FACTORY_TABLE[0]; // Level 1
    const factory: PlacedFactory = {
      id: uid(),
      resourceType,
      level: 1,
      hex,
      buffer: 0,
      bufferCapacity: stats.bufferCapacity,
      productionPerDay: stats.productionPerDay,
      connectedLineIds: [],
    };

    this.state.factories.set(factory.id, factory);
    this.state.occupiedHexes.set(HexGrid.key(hex), factory.id);
    this.connectFacilityToLines(factory.id, hex);
    this.rebuildNetwork();
    this.state.version++;
    return factory;
  }

  addDepot(hex: HexCoord): PlacedDepot | null {
    if (!this.canPlace(hex)) return null;

    const stats = DEPOT_TABLE[0]; // Level 1
    const depot: PlacedDepot = {
      id: uid(),
      level: 1,
      hex,
      storage: emptyStorage(),
      maxStoragePerResource: stats.storagePerResource,
      throughputPerDay: stats.throughputPerDay,
      throughputUsedToday: 0,
      connectedLineIds: [],
    };

    this.state.depots.set(depot.id, depot);
    this.state.occupiedHexes.set(HexGrid.key(hex), depot.id);
    this.connectFacilityToLines(depot.id, hex);
    this.rebuildNetwork();
    this.state.version++;
    return depot;
  }

  addSupplyLine(from: HexCoord, to: HexCoord): SimSupplyLine | null {
    const hexPath = this.routePath(from, to);
    if (!hexPath || hexPath.length < 2) return null;

    const stats = SUPPLY_LINE_TABLE[0]; // Level 1
    const line: SimSupplyLine = {
      id: uid(),
      level: 1,
      hexPath,
      capacityPerDay: stats.capacityPerDay,
      speedHexPerHour: stats.speedHexPerHour,
      capacityUsedToday: 0,
      connectedFacilityIds: [],
    };

    this.state.supplyLines.set(line.id, line);
    this.connectLineToFacilities(line);
    this.rebuildNetwork();
    this.state.version++;
    return line;
  }

  demolish(entityId: string): void {
    // Try factory
    const factory = this.state.factories.get(entityId);
    if (factory) {
      this.state.factories.delete(entityId);
      this.state.occupiedHexes.delete(HexGrid.key(factory.hex));
      this.disconnectFacility(entityId);
      this.rebuildNetwork();
      this.state.version++;
      return;
    }

    // Try depot
    const depot = this.state.depots.get(entityId);
    if (depot) {
      this.state.depots.delete(entityId);
      this.state.occupiedHexes.delete(HexGrid.key(depot.hex));
      this.disconnectFacility(entityId);
      this.rebuildNetwork();
      this.state.version++;
      return;
    }

    // Try supply line
    const line = this.state.supplyLines.get(entityId);
    if (line) {
      this.state.supplyLines.delete(entityId);
      // Remove line reference from connected facilities
      for (const facId of line.connectedFacilityIds) {
        const fac = this.state.factories.get(facId) ?? this.state.depots.get(facId);
        if (fac) {
          fac.connectedLineIds = fac.connectedLineIds.filter((id) => id !== entityId);
        }
      }
      this.rebuildNetwork();
      this.state.version++;
    }
  }

  upgrade(entityId: string): void {
    const factory = this.state.factories.get(entityId);
    if (factory && factory.level < 5) {
      factory.level++;
      const stats = FACTORY_TABLE[factory.level - 1];
      factory.productionPerDay = stats.productionPerDay;
      factory.bufferCapacity = stats.bufferCapacity;
      this.state.version++;
      return;
    }

    const depot = this.state.depots.get(entityId);
    if (depot && depot.level < 5) {
      depot.level++;
      const stats = DEPOT_TABLE[depot.level - 1];
      depot.maxStoragePerResource = stats.storagePerResource;
      depot.throughputPerDay = stats.throughputPerDay;
      this.state.version++;
      return;
    }

    const line = this.state.supplyLines.get(entityId);
    if (line && line.level < 5) {
      line.level++;
      const stats = SUPPLY_LINE_TABLE[line.level - 1];
      line.capacityPerDay = stats.capacityPerDay;
      line.speedHexPerHour = stats.speedHexPerHour;
      this.state.version++;
    }
  }

  // -- Queries --

  getFacilityAt(hex: HexCoord): PlacedFactory | PlacedDepot | null {
    const id = this.state.occupiedHexes.get(HexGrid.key(hex));
    if (!id) return null;
    return this.state.factories.get(id) ?? this.state.depots.get(id) ?? null;
  }

  getSupplyLineAt(hex: HexCoord): SimSupplyLine | null {
    const key = HexGrid.key(hex);
    for (const line of this.state.supplyLines.values()) {
      if (line.hexPath.some((h) => HexGrid.key(h) === key)) {
        return line;
      }
    }
    return null;
  }

  // -- Internal Helpers --

  private canPlace(hex: HexCoord): boolean {
    if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) return false;
    const cell = this.gameMap.cells.get(HexGrid.key(hex));
    if (!cell || IMPASSABLE_TERRAIN.has(cell.terrain)) return false;
    if (this.state.occupiedHexes.has(HexGrid.key(hex))) return false;
    return true;
  }

  private routePath(from: HexCoord, to: HexCoord): HexCoord[] | null {
    // Simple straight-line routing, skipping impassable hexes
    const path = HexGrid.line(from, to);
    for (const hex of path) {
      if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) return null;
      const cell = this.gameMap.cells.get(HexGrid.key(hex));
      if (!cell || IMPASSABLE_TERRAIN.has(cell.terrain)) return null;
    }
    return path;
  }

  private connectFacilityToLines(facilityId: string, hex: HexCoord): void {
    const neighbors = new Set<string>();
    neighbors.add(HexGrid.key(hex));
    for (const n of HexGrid.neighbors(hex)) {
      neighbors.add(HexGrid.key(n));
    }

    for (const line of this.state.supplyLines.values()) {
      const adjacent = line.hexPath.some((h) => neighbors.has(HexGrid.key(h)));
      if (adjacent && !line.connectedFacilityIds.includes(facilityId)) {
        line.connectedFacilityIds.push(facilityId);
        const fac = this.state.factories.get(facilityId) ?? this.state.depots.get(facilityId);
        if (fac && !fac.connectedLineIds.includes(line.id)) {
          fac.connectedLineIds.push(line.id);
        }
      }
    }
  }

  private connectLineToFacilities(line: SimSupplyLine): void {
    // Include neighbors of each hex in the path
    const adjacentKeys = new Set<string>();
    for (const hex of line.hexPath) {
      adjacentKeys.add(HexGrid.key(hex));
      for (const n of HexGrid.neighbors(hex)) {
        adjacentKeys.add(HexGrid.key(n));
      }
    }

    const allFacilities = [...this.state.factories.values(), ...this.state.depots.values()];

    for (const fac of allFacilities) {
      if (adjacentKeys.has(HexGrid.key(fac.hex))) {
        if (!line.connectedFacilityIds.includes(fac.id)) {
          line.connectedFacilityIds.push(fac.id);
        }
        if (!fac.connectedLineIds.includes(line.id)) {
          fac.connectedLineIds.push(line.id);
        }
      }
    }
  }

  private disconnectFacility(facilityId: string): void {
    for (const line of this.state.supplyLines.values()) {
      line.connectedFacilityIds = line.connectedFacilityIds.filter((id) => id !== facilityId);
    }
  }

  private rebuildNetwork(): void {
    this.network.clear();
    for (const line of this.state.supplyLines.values()) {
      const weight = 1 / line.speedHexPerHour;
      const facs = line.connectedFacilityIds;
      for (let i = 0; i < facs.length; i++) {
        for (let j = i + 1; j < facs.length; j++) {
          this.network.addEdge(facs[i], facs[j], weight);
          this.network.addEdge(facs[j], facs[i], weight);
        }
      }
    }
  }
}
