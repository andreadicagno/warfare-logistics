import { RiverGenerator } from './RiverGenerator';
import { RoadGenerator } from './RoadGenerator';
import { SettlementPlacer } from './SettlementPlacer';
import { SmoothingPass } from './SmoothingPass';
import { TerrainGenerator } from './TerrainGenerator';
import type { GameMap, MapConfig } from './types';
import { DEFAULT_GENERATION_PARAMS } from './types';

const MAP_SIZES: Record<MapConfig['mapSize'], { width: number; height: number }> = {
  small: { width: 40, height: 30 },
  medium: { width: 60, height: 45 },
  large: { width: 80, height: 60 },
};

export class MapGenerator {
  static generate(config: MapConfig): GameMap {
    const { width, height } = MAP_SIZES[config.mapSize];

    // Phase 1 & 2: Elevation + terrain assignment
    const cells = TerrainGenerator.generate(
      width,
      height,
      { ...DEFAULT_GENERATION_PARAMS.terrain, geography: config.geography },
      DEFAULT_GENERATION_PARAMS.seaSides,
      config.seed,
    );

    // Phase 3: Rivers
    RiverGenerator.generate(cells, width, height, config.seed, DEFAULT_GENERATION_PARAMS.rivers);

    // Phase 4: Smoothing
    SmoothingPass.apply(cells, width, height, DEFAULT_GENERATION_PARAMS.smoothing);

    // Settlement placement
    SettlementPlacer.place(cells, width, height, DEFAULT_GENERATION_PARAMS.settlements);

    // Initial infrastructure
    const { roads, railways } = RoadGenerator.generate(cells, width, height, {
      ...DEFAULT_GENERATION_PARAMS.roads,
      infrastructure: config.initialInfrastructure,
    });

    return {
      width,
      height,
      cells,
      roads,
      railways,
    };
  }
}
