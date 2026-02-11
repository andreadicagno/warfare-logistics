import type { HexCoord, RoutePath } from '@core/map/types';
import type { ResourceStorage } from '@data/types';

export type Faction = 'allied' | 'enemy';

export type UnitType = 'infantry' | 'armor' | 'artillery';

export type Echelon = 'army' | 'corps' | 'division' | 'regiment' | 'battalion';

export interface MockUnit {
  id: string;
  name: string;
  faction: Faction;
  type: UnitType;
  coord: HexCoord;
  supplies: ResourceStorage; // 0-1 each (percentage)
  echelon: Echelon; // 'battalion' for line units, others for HQs
  parentFormationId: string; // id of parent formation
  isHq: boolean; // true for HQ units (regiment+)
}

export interface MockFormation {
  id: string;
  name: string;
  echelon: Echelon;
  faction: Faction;
  hqCoord: HexCoord;
  children: MockFormation[];
  units: MockUnit[];
}

export type FacilityKind = 'depot' | 'factory' | 'railHub';

export interface MockFacility {
  id: string;
  kind: FacilityKind;
  coord: HexCoord;
  size: 'large' | 'small';
  storage: ResourceStorage; // 0-1 each
  damaged: boolean;
}

export type RouteHealth = 'good' | 'congested' | 'stressed' | 'destroyed';

export interface MockRouteState {
  route: RoutePath;
  health: RouteHealth;
}

export interface MockVehicle {
  id: string;
  type: 'truck' | 'train';
  routeIndex: number; // index into roads[] or railways[]
  t: number; // 0-1 position along spline
  speed: number; // px/s
  direction: 1 | -1; // forward or return trip
}

export interface AccessRamp {
  facilityCoord: HexCoord;
  routeHexCoord: HexCoord;
  routeType: 'road' | 'railway';
}

export interface MockState {
  territory: Map<string, Faction>; // hex key -> faction
  frontLineEdges: Array<{ a: HexCoord; b: HexCoord }>; // edges between factions
  units: MockUnit[];
  formations: MockFormation[];
  facilities: MockFacility[];
  routeStates: MockRouteState[];
  vehicles: MockVehicle[];
  accessRamps: AccessRamp[];
  version: number; // increments on state change (for rebuild detection)
}
