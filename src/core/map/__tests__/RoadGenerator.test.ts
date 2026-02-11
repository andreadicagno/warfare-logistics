import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { RoadGenerator } from '../RoadGenerator';
import { SettlementPlacer } from '../SettlementPlacer';
import { SmoothingPass } from '../SmoothingPass';
import { TerrainGenerator } from '../TerrainGenerator';
import type { HexCell, RoadParams } from '../types';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';

const defaultRoadParams = DEFAULT_GENERATION_PARAMS.roads;

function roadParamsWithInfra(infrastructure: RoadParams['infrastructure']): RoadParams {
  return { ...defaultRoadParams, infrastructure };
}

const defaultTerrainCost: Record<TerrainType, number> = {
  [TerrainType.Plains]: defaultRoadParams.plainsCost,
  [TerrainType.Forest]: defaultRoadParams.forestCost,
  [TerrainType.Hills]: defaultRoadParams.hillsCost,
  [TerrainType.Marsh]: defaultRoadParams.marshCost,
  [TerrainType.River]: defaultRoadParams.riverCost,
  [TerrainType.Mountain]: Infinity,
  [TerrainType.Water]: Infinity,
};

describe('RoadGenerator', () => {
  function makeMap() {
    const cells = TerrainGenerator.generate(
      40,
      30,
      DEFAULT_GENERATION_PARAMS.terrain,
      DEFAULT_GENERATION_PARAMS.seaSides,
      42,
    );
    RiverGenerator.generate(cells, 40, 30, 42, DEFAULT_GENERATION_PARAMS.rivers);
    SmoothingPass.apply(cells, 40, 30, DEFAULT_GENERATION_PARAMS.smoothing);
    SettlementPlacer.place(cells, 40, 30, DEFAULT_GENERATION_PARAMS.settlements);
    return cells;
  }

  describe('generate', () => {
    it('produces road routes', () => {
      const cells = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'));
      expect(roads.length).toBeGreaterThan(0);
    });

    it('all roads have type road', () => {
      const cells = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'));
      for (const road of roads) {
        expect(road.type).toBe('road');
      }
    });

    it('road paths contain only adjacent hexes', () => {
      const cells = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'));
      for (const road of roads) {
        for (let i = 1; i < road.hexes.length; i++) {
          expect(HexGrid.distance(road.hexes[i - 1], road.hexes[i])).toBe(1);
        }
      }
    });

    it('roads avoid mountains and water', () => {
      const cells = makeMap();
      const { roads } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'));
      for (const road of roads) {
        for (const hex of road.hexes) {
          const cell = cells.get(HexGrid.key(hex))!;
          expect(cell.terrain).not.toBe(TerrainType.Mountain);
          expect(cell.terrain).not.toBe(TerrainType.Water);
        }
      }
    });

    it('produces no railways with infrastructure=none', () => {
      const cells = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('none'));
      expect(railways.length).toBe(0);
    });

    it('produces some railways with infrastructure=basic', () => {
      const cells = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'));
      expect(railways.length).toBeGreaterThanOrEqual(1);
      expect(railways.length).toBeLessThanOrEqual(2);
    });

    it('produces railways between all cities with infrastructure=developed', () => {
      const cells = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('developed'));
      expect(railways.length).toBeGreaterThanOrEqual(2);
    });

    it('all railways have type railway', () => {
      const cells = makeMap();
      const { railways } = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('developed'));
      for (const rail of railways) {
        expect(rail.type).toBe('railway');
      }
    });
  });

  describe('astar', () => {
    it('finds path between two hexes on plains', () => {
      const cells = new Map<string, HexCell>();
      for (let q = 0; q < 3; q++) {
        for (let r = 0; r < 3; r++) {
          const coord = { q, r };
          cells.set(HexGrid.key(coord), {
            coord,
            terrain: TerrainType.Plains,
            elevation: 0.4,
            moisture: 0.3,
            settlement: null,
          });
        }
      }
      const path = RoadGenerator.astar(
        { q: 0, r: 0 },
        { q: 2, r: 0 },
        cells,
        3,
        3,
        defaultTerrainCost,
      );
      expect(path).not.toBeNull();
      expect(path![0]).toEqual({ q: 0, r: 0 });
      expect(path![path!.length - 1]).toEqual({ q: 2, r: 0 });
    });

    it('returns null if no path exists (surrounded by mountains)', () => {
      const cells = new Map<string, HexCell>();
      cells.set('2,2', {
        coord: { q: 2, r: 2 },
        terrain: TerrainType.Plains,
        elevation: 0.4,
        moisture: 0.3,
        settlement: null,
      });
      cells.set('0,0', {
        coord: { q: 0, r: 0 },
        terrain: TerrainType.Plains,
        elevation: 0.4,
        moisture: 0.3,
        settlement: null,
      });
      for (const n of HexGrid.neighbors({ q: 2, r: 2 })) {
        cells.set(HexGrid.key(n), {
          coord: n,
          terrain: TerrainType.Mountain,
          elevation: 0.9,
          moisture: 0.3,
          settlement: null,
        });
      }
      const path = RoadGenerator.astar(
        { q: 0, r: 0 },
        { q: 2, r: 2 },
        cells,
        5,
        5,
        defaultTerrainCost,
      );
      expect(path).toBeNull();
    });
  });
});
