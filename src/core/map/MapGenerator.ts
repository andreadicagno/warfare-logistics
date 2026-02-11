import { Profiler } from '../Profiler';
import { RiverGenerator } from './RiverGenerator';
import { RoadGenerator } from './RoadGenerator';
import { SmoothingPass } from './SmoothingPass';
import { SupplyHubPlacer } from './SupplyHubPlacer';
import { TerrainGenerator } from './TerrainGenerator';
import type { GameMap, GenerationParams } from './types';
import { UrbanGenerator } from './UrbanGenerator';

export const MAP_SIZE_PRESETS = {
  small: { width: 200, height: 150 },
  medium: { width: 300, height: 225 },
  large: { width: 400, height: 300 },
} as const;

export class MapGenerator {
  static generate(params: GenerationParams): GameMap {
    const { width, height } = params;
    const prof = new Profiler(`MapGenerator (${width}×${height} = ${width * height} cells)`);

    // Phase 1 & 2: Elevation + terrain assignment
    const cells = prof.measure('Terrain generation', () =>
      TerrainGenerator.generate(width, height, params.terrain, params.seaSides, params.seed),
    );

    // Phase 3: Rivers
    prof.measure('River generation', () =>
      RiverGenerator.generate(cells, width, height, params.seed, params.rivers),
    );

    // Phase 4: Smoothing
    prof.measure('Smoothing pass', () =>
      SmoothingPass.apply(cells, width, height, params.smoothing),
    );

    // Phase 5: Urban clusters
    const urbanClusters = prof.measure('Urban generation', () =>
      UrbanGenerator.generate(cells, width, height, params.urban, params.seed),
    );

    // Phase 6: Supply hubs
    const supplyHubs = prof.measure('Supply hub placement', () =>
      SupplyHubPlacer.place(cells, width, height, urbanClusters, params.seed),
    );

    // Phase 7: Roads & railways
    const { roads, railways } = prof.measure('Road & railway generation', () =>
      RoadGenerator.generate(cells, width, height, params.roads, urbanClusters),
    );

    prof.log();

    return { width, height, seed: params.seed, cells, urbanClusters, supplyHubs, roads, railways };
  }
}
