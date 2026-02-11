import { RiverGenerator } from './RiverGenerator';
import { RoadGenerator } from './RoadGenerator';
import { SettlementPlacer } from './SettlementPlacer';
import { SmoothingPass } from './SmoothingPass';
import { TerrainGenerator } from './TerrainGenerator';
import type { GameMap, GenerationParams } from './types';

export const MAP_SIZE_PRESETS = {
  small: { width: 200, height: 150 },
  medium: { width: 300, height: 225 },
  large: { width: 400, height: 300 },
} as const;

export class MapGenerator {
  static generate(params: GenerationParams): GameMap {
    const { width, height } = params;

    // Phase 1 & 2: Elevation + terrain assignment
    const cells = TerrainGenerator.generate(
      width,
      height,
      params.terrain,
      params.seaSides,
      params.seed,
    );

    // Phase 3: Rivers
    RiverGenerator.generate(cells, width, height, params.seed, params.rivers);

    // Phase 4: Smoothing
    SmoothingPass.apply(cells, width, height, params.smoothing);

    // Settlement placement
    SettlementPlacer.place(cells, width, height, params.settlements);

    // Initial infrastructure
    const { roads, railways } = RoadGenerator.generate(cells, width, height, params.roads);

    return { width, height, cells, roads, railways };
  }
}
