import type { HexCoord, RoutePath } from '@core/map/types';
import type { ResourceStorage } from '@data/types';

export type Faction = 'allied' | 'enemy';

export type UnitType = 'infantry' | 'armor' | 'artillery';

export interface MockUnit {
  id: string;
  name: string;
  faction: Faction;
  type: UnitType;
  coord: HexCoord;
  supplies: ResourceStorage; // 0-1 each (percentage)
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

export interface MockState {
  territory: Map<string, Faction>; // hex key -> faction
  frontLineEdges: Array<{ a: HexCoord; b: HexCoord }>; // edges between factions
  units: MockUnit[];
  facilities: MockFacility[];
  routeStates: MockRouteState[];
  vehicles: MockVehicle[];
  version: number; // increments on state change (for rebuild detection)
}
