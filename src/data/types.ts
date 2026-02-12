/**
 * Core type definitions for Supply Line
 */

// ============================================
// RESOURCES
// ============================================

export enum ResourceType {
  Fuel = 'fuel',
  Ammo = 'ammo',
  Food = 'food',
  Parts = 'parts',
}

export interface ResourceAmount {
  type: ResourceType;
  amount: number;
}

export interface ResourceStorage {
  [ResourceType.Fuel]: number;
  [ResourceType.Ammo]: number;
  [ResourceType.Food]: number;
  [ResourceType.Parts]: number;
}

// ============================================
// FACILITIES
// ============================================

export enum FacilityType {
  Depot = 'depot',
  Factory = 'factory',
  RailHub = 'rail_hub',
  Port = 'port',
}

export interface Position {
  x: number;
  y: number;
}

export interface Facility {
  id: string;
  type: FacilityType;
  position: Position;
  storage: ResourceStorage;
  maxStorage: ResourceStorage;
  throughput: number; // units per day
  health: number; // 0-100
  isOperational: boolean;
}

// ============================================
// VEHICLES
// ============================================

export enum VehicleType {
  Truck = 'truck',
  Train = 'train',
  Ship = 'ship', // Post-MVP
  Plane = 'plane', // Post-MVP
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  capacity: number;
  speed: number; // km per hour
  fuelConsumption: number; // fuel per km
  condition: number; // 0-100
  assignedRouteId: string | null;
}

// ============================================
// ROUTES
// ============================================

export enum RouteType {
  SupplyLine = 'supplyLine',
  Sea = 'sea', // Post-MVP
  Air = 'air', // Post-MVP
}

export enum RouteStatus {
  Operational = 'operational',
  Upgrading = 'upgrading',
  Building = 'building',
  Damaged = 'damaged',
  Destroyed = 'destroyed',
}

export interface Route {
  id: string;
  type: RouteType;
  level: number; // 1-5
  fromFacilityId: string;
  toFacilityId: string;
  distance: number; // km
  capacity: number; // max throughput
  status: RouteStatus;
  assignedVehicles: string[];
}

// ============================================
// FRONT / MILITARY UNITS
// ============================================

export enum UnitState {
  Attacking = 'attacking',
  Moving = 'moving',
  DefenseActive = 'defense_active',
  DefenseStandby = 'defense_standby',
  Retreating = 'retreating',
}

export interface MilitaryUnit {
  id: string;
  name: string;
  position: Position;
  state: UnitState;
  strength: number; // 0-100
  morale: number; // 0-100
  supplies: ResourceStorage;
  supplyThreshold: ResourceStorage; // minimum needed
  consumptionRate: ResourceStorage; // per day based on state
  linkedDepotId: string | null;
}

// ============================================
// GAME STATE
// ============================================

export interface Territory {
  id: string;
  position: Position;
  owner: 'player' | 'enemy' | 'neutral';
  controlPoints: number;
}

export interface GameState {
  day: number;
  timeScale: number; // 1 = normal, 2 = fast, etc.
  isPaused: boolean;
  playerTerritory: number;
  enemyTerritory: number;
  facilities: Map<string, Facility>;
  vehicles: Map<string, Vehicle>;
  routes: Map<string, Route>;
  units: Map<string, MilitaryUnit>;
  territories: Map<string, Territory>;
}

// ============================================
// EVENTS
// ============================================

export enum GameEventType {
  Bombardment = 'bombardment',
  FrontAdvance = 'front_advance',
  FrontRetreat = 'front_retreat',
  UnitRequest = 'unit_request',
  SupplyCritical = 'supply_critical',
  RouteDestroyed = 'route_destroyed',
  ConstructionComplete = 'construction_complete',
}

export interface GameEvent {
  id: string;
  type: GameEventType;
  timestamp: number;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  data?: Record<string, unknown>;
}

// ============================================
// CONFIGURATION
// ============================================

export interface SandboxConfig {
  mapSize: 'small' | 'medium' | 'large';
  geography: 'plains' | 'mixed' | 'mountainous';
  initialInfrastructure: 'none' | 'basic' | 'developed';
  frontDynamics: 'static' | 'slow' | 'dynamic' | 'chaotic';
  resourceConsumption: number; // multiplier 0.5 - 2.0
  combatIntensity: number; // 0 - 1
  interdictionLevel: number; // 0 - 1
  frontSpeed: number; // 0 - 1
  initialResources: 'scarce' | 'normal' | 'abundant';
}
