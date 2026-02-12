import type { HexCoord } from '@core/map/types';
import type { ResourceStorage } from '@data/types';
import { ResourceType } from '@data/types';

// ── Bible Tables ──

export const FACTORY_TABLE = [
  { level: 1, productionPerDay: 10, bufferCapacity: 20 },
  { level: 2, productionPerDay: 25, bufferCapacity: 50 },
  { level: 3, productionPerDay: 50, bufferCapacity: 100 },
  { level: 4, productionPerDay: 85, bufferCapacity: 170 },
  { level: 5, productionPerDay: 130, bufferCapacity: 260 },
] as const;

export const DEPOT_TABLE = [
  { level: 1, storagePerResource: 50, throughputPerDay: 60 },
  { level: 2, storagePerResource: 100, throughputPerDay: 120 },
  { level: 3, storagePerResource: 180, throughputPerDay: 200 },
  { level: 4, storagePerResource: 280, throughputPerDay: 300 },
  { level: 5, storagePerResource: 400, throughputPerDay: 420 },
] as const;

export const SUPPLY_LINE_TABLE = [
  { level: 1, capacityPerDay: 30, speedHexPerHour: 5 },
  { level: 2, capacityPerDay: 80, speedHexPerHour: 8 },
  { level: 3, capacityPerDay: 180, speedHexPerHour: 12 },
  { level: 4, capacityPerDay: 350, speedHexPerHour: 17 },
  { level: 5, capacityPerDay: 600, speedHexPerHour: 24 },
] as const;

export const RESOURCE_COLORS: Record<ResourceType, number> = {
  [ResourceType.Fuel]: 0xccaa22,
  [ResourceType.Ammo]: 0x666666,
  [ResourceType.Food]: 0x44aa44,
  [ResourceType.Parts]: 0xcc8833,
};

export const TICKS_PER_DAY = 1440;

// ── Impassable terrain for placement ──

export const IMPASSABLE_TERRAIN = new Set(['water', 'mountain']);

// ── Simulation Entities ──

export interface PlacedFactory {
  id: string;
  resourceType: ResourceType;
  level: number;
  hex: HexCoord;
  buffer: number;
  bufferCapacity: number;
  productionPerDay: number;
  connectedLineIds: string[];
}

export interface PlacedDepot {
  id: string;
  level: number;
  hex: HexCoord;
  storage: ResourceStorage;
  maxStoragePerResource: number;
  throughputPerDay: number;
  throughputUsedToday: number;
  connectedLineIds: string[];
}

export interface SimSupplyLine {
  id: string;
  level: number;
  hexPath: HexCoord[];
  capacityPerDay: number;
  speedHexPerHour: number;
  capacityUsedToday: number;
  connectedFacilityIds: string[];
}

export interface Shipment {
  id: string;
  resourceType: ResourceType;
  amount: number;
  sourceId: string;
  destinationId: string;
  path: HexCoord[];
  progress: number;
  speedHexPerHour: number;
}

export type FacilityEntity = PlacedFactory | PlacedDepot;

export function isFactory(entity: FacilityEntity): entity is PlacedFactory {
  return 'resourceType' in entity;
}

export function isDepot(entity: FacilityEntity): entity is PlacedDepot {
  return 'storage' in entity && !('resourceType' in entity);
}

// ── Simulation State ──

export interface SimulationState {
  tick: number;
  factories: Map<string, PlacedFactory>;
  depots: Map<string, PlacedDepot>;
  supplyLines: Map<string, SimSupplyLine>;
  shipments: Shipment[];
  occupiedHexes: Map<string, string>; // hex key → facility id
  version: number;
}

// ── Build Tools ──

export type BuildTool =
  | 'select'
  | 'fuel-factory'
  | 'ammo-factory'
  | 'food-factory'
  | 'parts-factory'
  | 'depot'
  | 'supply-line'
  | 'demolish';

export function emptyStorage(): ResourceStorage {
  return {
    [ResourceType.Fuel]: 0,
    [ResourceType.Ammo]: 0,
    [ResourceType.Food]: 0,
    [ResourceType.Parts]: 0,
  };
}
