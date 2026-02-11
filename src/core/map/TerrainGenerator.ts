import { createNoise2D } from 'simplex-noise';
import { HexGrid } from './HexGrid';
import { mulberry32 } from './rng';
import type { HexCell, HexCoord, MapConfig } from './types';
import { TerrainType } from './types';

type Geography = MapConfig['geography'];

const GEOGRAPHY_OFFSETS: Record<Geography, number> = {
  plains: 0.1,
  mixed: 0,
  mountainous: -0.1,
};

export class TerrainGenerator {
  static generate(
    width: number,
    height: number,
    geography: Geography,
    seed: number,
  ): Map<string, HexCell> {
    const rng = mulberry32(seed);
    const elevationNoise = createNoise2D(rng);
    const moistureNoise = createNoise2D(rng);

    const cells = new Map<string, HexCell>();

    for (let q = 0; q < width; q++) {
      for (let r = 0; r < height; r++) {
        const coord: HexCoord = { q, r };
        const elevation = TerrainGenerator.sampleElevation(coord, width, height, elevationNoise);
        const moisture = TerrainGenerator.sampleMoisture(coord, moistureNoise);
        const terrain = TerrainGenerator.assignTerrain(elevation, moisture, geography);

        cells.set(HexGrid.key(coord), {
          coord,
          terrain,
          elevation,
          moisture,
          riverEdges: new Set(),
          settlement: null,
        });
      }
    }

    return cells;
  }

  private static sampleElevation(
    coord: HexCoord,
    width: number,
    height: number,
    noise: (x: number, y: number) => number,
  ): number {
    const scale1 = 0.05;
    const scale2 = 0.1;
    const scale3 = 0.2;

    let value =
      (0.6 * (noise(coord.q * scale1, coord.r * scale1) + 1)) / 2 +
      (0.3 * (noise(coord.q * scale2, coord.r * scale2) + 1)) / 2 +
      (0.1 * (noise(coord.q * scale3, coord.r * scale3) + 1)) / 2;

    const cx = coord.q / width - 0.5;
    const cy = coord.r / height - 0.5;
    const distFromCenter = Math.sqrt(cx * cx + cy * cy) * 2;
    const falloff = Math.max(0, 1 - distFromCenter * distFromCenter);
    value *= falloff;

    return Math.max(0, Math.min(1, value));
  }

  private static sampleMoisture(coord: HexCoord, noise: (x: number, y: number) => number): number {
    const scale = 0.08;
    const value = (noise(coord.q * scale + 100, coord.r * scale + 100) + 1) / 2;
    return Math.max(0, Math.min(1, value));
  }

  static assignTerrain(elevation: number, moisture: number, geography: Geography): TerrainType {
    const offset = GEOGRAPHY_OFFSETS[geography];
    const moistureThreshold = 0.5;

    if (elevation < 0.2 + offset) return TerrainType.Water;
    if (elevation < 0.35 + offset) {
      return moisture > moistureThreshold ? TerrainType.Marsh : TerrainType.Plains;
    }
    if (elevation < 0.55 + offset) {
      return moisture > moistureThreshold ? TerrainType.Forest : TerrainType.Plains;
    }
    if (elevation < 0.75 + offset) {
      return moisture > moistureThreshold ? TerrainType.Forest : TerrainType.Hills;
    }
    return TerrainType.Mountain;
  }
}
