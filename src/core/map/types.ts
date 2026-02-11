export interface HexCoord {
  q: number;
  r: number;
}

export enum TerrainType {
  Water = 'water',
  Plains = 'plains',
  Marsh = 'marsh',
  Forest = 'forest',
  Hills = 'hills',
  Mountain = 'mountain',
}

export enum SettlementType {
  Town = 'town',
  City = 'city',
}

export interface HexCell {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
  moisture: number;
  riverEdges: Set<number>;
  settlement: SettlementType | null;
}

export interface RoutePath {
  hexes: HexCoord[];
  type: 'road' | 'railway';
}

export interface RiverPath {
  edges: Array<{ hex: HexCoord; edge: number }>;
}

export interface GameMap {
  width: number;
  height: number;
  cells: Map<string, HexCell>;
  rivers: RiverPath[];
  roads: RoutePath[];
  railways: RoutePath[];
}

export interface MapConfig {
  mapSize: 'small' | 'medium' | 'large';
  geography: 'plains' | 'mixed' | 'mountainous';
  initialInfrastructure: 'none' | 'basic' | 'developed';
  seed: number;
}
