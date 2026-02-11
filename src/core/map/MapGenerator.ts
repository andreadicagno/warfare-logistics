import { RoadGenerator } from './RoadGenerator';
import { SettlementPlacer } from './SettlementPlacer';
import { SmoothingPass } from './SmoothingPass';
import { TerrainGenerator } from './TerrainGenerator';
import type { GameMap, MapConfig } from './types';

const MAP_SIZES: Record<MapConfig['mapSize'], { width: number; height: number }> = {
  small: { width: 40, height: 30 },
  medium: { width: 60, height: 45 },
  large: { width: 80, height: 60 },
};

export class MapGenerator {
  static generate(config: MapConfig): GameMap {
    const { width, height } = MAP_SIZES[config.mapSize];

    // Phase 1 & 2: Elevation + terrain assignment
    const cells = TerrainGenerator.generate(width, height, config.geography, config.seed);

    // Phase 3: Smoothing
    SmoothingPass.apply(cells, width, height);

    // Settlement placement
    SettlementPlacer.place(cells, width, height);

    // Initial infrastructure
    const { roads, railways } = RoadGenerator.generate(
      cells,
      width,
      height,
      config.initialInfrastructure,
    );

    return {
      width,
      height,
      cells,
      roads,
      railways,
    };
  }
}
