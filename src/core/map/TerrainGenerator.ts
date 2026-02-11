import { createNoise2D } from 'simplex-noise';
import { HexGrid } from './HexGrid';
import { mulberry32 } from './rng';
import type { HexCell, HexCoord, SeaSides, TerrainParams } from './types';
import { TerrainType } from './types';

const GEOGRAPHY_OFFSETS: Record<TerrainParams['geography'], number> = {
  plains: 0.1,
  mixed: 0,
  mountainous: -0.1,
};

export class TerrainGenerator {
  static generate(
    width: number,
    height: number,
    params: TerrainParams,
    seaSides: SeaSides,
    seed: number,
  ): Map<string, HexCell> {
    const rng = mulberry32(seed);
    const elevationNoise = createNoise2D(rng);
    const moistureNoise = createNoise2D(rng);

    const cells = new Map<string, HexCell>();

    for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {
        const q = col;
        const r = row - Math.floor(col / 2);
        const coord: HexCoord = { q, r };
        const elevation = TerrainGenerator.sampleElevation(
          coord,
          width,
          height,
          params,
          seaSides,
          elevationNoise,
        );
        const moisture = TerrainGenerator.sampleMoisture(coord, params, moistureNoise);
        const terrain = TerrainGenerator.assignTerrain(elevation, moisture, params);

        cells.set(HexGrid.key(coord), {
          coord,
          terrain,
          elevation,
          moisture,
          urbanClusterId: null,
        });
      }
    }

    return cells;
  }

  private static sampleElevation(
    coord: HexCoord,
    width: number,
    height: number,
    params: TerrainParams,
    seaSides: SeaSides,
    noise: (x: number, y: number) => number,
  ): number {
    const scale1 = params.elevationScaleLarge;
    const scale2 = params.elevationScaleMedium;
    const scale3 = params.elevationScaleDetail;

    let value =
      (params.noiseWeightLarge * (noise(coord.q * scale1, coord.r * scale1) + 1)) / 2 +
      (params.noiseWeightMedium * (noise(coord.q * scale2, coord.r * scale2) + 1)) / 2 +
      (params.noiseWeightDetail * (noise(coord.q * scale3, coord.r * scale3) + 1)) / 2;

    // Use offset row for falloff so it's symmetric on the rectangular map
    const row = coord.r + Math.floor(coord.q / 2);
    const nx = coord.q / width;
    const ny = row / height;
    let falloff = 1.0;
    const strength = params.falloffStrength;
    if (seaSides.west) falloff *= Math.min(1, (nx / 0.3) ** strength);
    if (seaSides.east) falloff *= Math.min(1, ((1 - nx) / 0.3) ** strength);
    if (seaSides.north) falloff *= Math.min(1, (ny / 0.3) ** strength);
    if (seaSides.south) falloff *= Math.min(1, ((1 - ny) / 0.3) ** strength);
    value *= falloff;

    return Math.max(0, Math.min(1, value));
  }

  private static sampleMoisture(
    coord: HexCoord,
    params: TerrainParams,
    noise: (x: number, y: number) => number,
  ): number {
    const scale = params.moistureScale;
    const value = (noise(coord.q * scale + 100, coord.r * scale + 100) + 1) / 2;
    return Math.max(0, Math.min(1, value));
  }

  static assignTerrain(elevation: number, moisture: number, params: TerrainParams): TerrainType {
    const offset = GEOGRAPHY_OFFSETS[params.geography];
    const moistureThreshold = 0.5;

    if (elevation < params.waterThreshold + offset) return TerrainType.Water;
    if (elevation < params.coastalThreshold + offset) {
      if (moisture > params.lakeMoistureThreshold) return TerrainType.Water; // noise-based inland lake
      return moisture > moistureThreshold ? TerrainType.Marsh : TerrainType.Plains;
    }
    if (elevation < params.lowlandThreshold + offset) {
      return moisture > moistureThreshold ? TerrainType.Forest : TerrainType.Plains;
    }
    if (elevation < params.highlandThreshold + offset) {
      return moisture > moistureThreshold ? TerrainType.Forest : TerrainType.Hills;
    }
    return TerrainType.Mountain;
  }
}
