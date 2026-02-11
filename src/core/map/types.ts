export interface HexCoord {
  q: number;
  r: number;
}

export type UrbanTier = 'metropolis' | 'city' | 'town';

export interface UrbanCluster {
  id: string;
  tier: UrbanTier;
  center: HexCoord;
  cells: HexCoord[];
}

export interface SupplyHub {
  coord: HexCoord;
  size: 'large' | 'small';
}

export enum TerrainType {
  Water = 'water',
  River = 'river',
  Plains = 'plains',
  Marsh = 'marsh',
  Forest = 'forest',
  Hills = 'hills',
  Mountain = 'mountain',
  Urban = 'urban',
}

export interface HexCell {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
  moisture: number;
  navigable?: boolean;
  urbanClusterId: string | null;
}

export interface RoutePath {
  hexes: HexCoord[];
  type: 'road' | 'railway';
}

export interface GameMap {
  width: number;
  height: number;
  cells: Map<string, HexCell>;
  urbanClusters: UrbanCluster[];
  supplyHubs: SupplyHub[];
  roads: RoutePath[];
  railways: RoutePath[];
}

export interface SeaSides {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

export interface TerrainParams {
  geography: 'plains' | 'mixed' | 'mountainous';
  elevationScaleLarge: number;
  elevationScaleMedium: number;
  elevationScaleDetail: number;
  noiseWeightLarge: number;
  noiseWeightMedium: number;
  noiseWeightDetail: number;
  falloffStrength: number;
  moistureScale: number;
  waterThreshold: number;
  coastalThreshold: number;
  lowlandThreshold: number;
  highlandThreshold: number;
  lakeMoistureThreshold: number;
}

export interface SmoothingParams {
  groupTolerance: number;
  minGroupDifference: number;
}

export interface RiverParams {
  minSources: number;
  maxSources: number;
  sourceMinElevation: number;
  sourceMinSpacing: number;
  minRiverLength: number;
  wideRiverMinLength: number;
  wideRiverFraction: number;
  lakeMinSize: number;
  lakeMaxSize: number;
}

export interface UrbanParams {
  metropolisDensity: number;
  cityDensity: number;
  townDensity: number;
  minMetropolisSpacing: number;
  minCitySpacing: number;
  minTownSpacing: number;
  riverBonus: number;
  waterBonus: number;
  plainsBonus: number;
}

export interface RoadParams {
  infrastructure: 'none' | 'basic' | 'developed';
  plainsCost: number;
  forestCost: number;
  hillsCost: number;
  marshCost: number;
  riverCost: number;
  urbanCost: number;
  cityConnectionDistance: number;
  railwayRedundancy: number;
  roadReuseCost: number;
  railwayReuseCost: number;
}

export interface GenerationParams {
  width: number;
  height: number;
  seed: number;
  seaSides: SeaSides;
  terrain: TerrainParams;
  smoothing: SmoothingParams;
  rivers: RiverParams;
  urban: UrbanParams;
  roads: RoadParams;
}

export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  width: 200,
  height: 150,
  seed: Date.now(),
  seaSides: { north: true, south: true, east: true, west: true },
  terrain: {
    geography: 'mixed',
    elevationScaleLarge: 0.05,
    elevationScaleMedium: 0.1,
    elevationScaleDetail: 0.2,
    noiseWeightLarge: 0.6,
    noiseWeightMedium: 0.3,
    noiseWeightDetail: 0.1,
    falloffStrength: 2.0,
    moistureScale: 0.08,
    waterThreshold: 0.2,
    coastalThreshold: 0.35,
    lowlandThreshold: 0.55,
    highlandThreshold: 0.75,
    lakeMoistureThreshold: 0.7,
  },
  smoothing: {
    groupTolerance: 1,
    minGroupDifference: 2,
  },
  rivers: {
    minSources: 3,
    maxSources: 5,
    sourceMinElevation: 0.55,
    sourceMinSpacing: 5,
    minRiverLength: 3,
    wideRiverMinLength: 8,
    wideRiverFraction: 0.6,
    lakeMinSize: 3,
    lakeMaxSize: 6,
  },
  urban: {
    metropolisDensity: 2,
    cityDensity: 5,
    townDensity: 8,
    minMetropolisSpacing: 10,
    minCitySpacing: 6,
    minTownSpacing: 4,
    riverBonus: 3,
    waterBonus: 2,
    plainsBonus: 1,
  },
  roads: {
    infrastructure: 'developed',
    plainsCost: 1,
    forestCost: 2,
    hillsCost: 3,
    marshCost: 3,
    riverCost: 6,
    urbanCost: 1,
    cityConnectionDistance: 20,
    railwayRedundancy: 2,
    roadReuseCost: 0.1,
    railwayReuseCost: 0.1,
  },
};
