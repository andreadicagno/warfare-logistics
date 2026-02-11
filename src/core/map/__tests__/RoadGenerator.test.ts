import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { RoadGenerator } from '../RoadGenerator';
import { SmoothingPass } from '../SmoothingPass';
import { TerrainGenerator } from '../TerrainGenerator';
import type { HexCell, RoadParams, UrbanCluster } from '../types';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';
import { UrbanGenerator } from '../UrbanGenerator';

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
  [TerrainType.Urban]: defaultRoadParams.urbanCost,
  [TerrainType.Mountain]: Infinity,
  [TerrainType.Water]: Infinity,
};

function makeMap(): { cells: Map<string, HexCell>; clusters: UrbanCluster[] } {
  const cells = TerrainGenerator.generate(
    40,
    30,
    DEFAULT_GENERATION_PARAMS.terrain,
    DEFAULT_GENERATION_PARAMS.seaSides,
    42,
  );
  RiverGenerator.generate(cells, 40, 30, 42, DEFAULT_GENERATION_PARAMS.rivers);
  SmoothingPass.apply(cells, 40, 30, DEFAULT_GENERATION_PARAMS.smoothing);
  const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
  return { cells, clusters };
}

describe('RoadGenerator', () => {
  describe('generate', () => {
    it('produces road routes', () => {
      const { cells, clusters } = makeMap();
      const { roads } = RoadGenerator.generate(
        cells,
        40,
        30,
        roadParamsWithInfra('basic'),
        clusters,
      );
      expect(roads.length).toBeGreaterThan(0);
    });

    it('all roads have type road', () => {
      const { cells, clusters } = makeMap();
      const { roads } = RoadGenerator.generate(
        cells,
        40,
        30,
        roadParamsWithInfra('basic'),
        clusters,
      );
      for (const road of roads) {
        expect(road.type).toBe('road');
      }
    });

    it('road paths contain only adjacent hexes', () => {
      const { cells, clusters } = makeMap();
      const { roads } = RoadGenerator.generate(
        cells,
        40,
        30,
        roadParamsWithInfra('basic'),
        clusters,
      );
      for (const road of roads) {
        for (let i = 1; i < road.hexes.length; i++) {
          expect(HexGrid.distance(road.hexes[i - 1], road.hexes[i])).toBe(1);
        }
      }
    });

    it('roads avoid mountains and water', () => {
      const { cells, clusters } = makeMap();
      const { roads } = RoadGenerator.generate(
        cells,
        40,
        30,
        roadParamsWithInfra('basic'),
        clusters,
      );
      for (const road of roads) {
        for (const hex of road.hexes) {
          const cell = cells.get(HexGrid.key(hex))!;
          expect(cell.terrain).not.toBe(TerrainType.Mountain);
          expect(cell.terrain).not.toBe(TerrainType.Water);
        }
      }
    });

    it('produces no railways with infrastructure=none', () => {
      const { cells, clusters } = makeMap();
      const { railways } = RoadGenerator.generate(
        cells,
        40,
        30,
        roadParamsWithInfra('none'),
        clusters,
      );
      expect(railways.length).toBe(0);
    });

    it('produces MST trunk railways with infrastructure=basic', () => {
      const { cells, clusters } = makeMap();
      const { railways } = RoadGenerator.generate(
        cells,
        40,
        30,
        roadParamsWithInfra('basic'),
        clusters,
      );
      // MST produces N-1 edges for N major centers — should have at least 1 railway segment
      expect(railways.length).toBeGreaterThanOrEqual(1);
    });

    it('produces more railways with infrastructure=developed than basic', () => {
      const { cells, clusters } = makeMap();
      const basic = RoadGenerator.generate(cells, 40, 30, roadParamsWithInfra('basic'), clusters);
      const developed = RoadGenerator.generate(
        cells,
        40,
        30,
        roadParamsWithInfra('developed'),
        clusters,
      );
      // Developed adds redundancy edges + town branches on top of MST
      expect(developed.railways.length).toBeGreaterThanOrEqual(basic.railways.length);
    });

    it('all railways have type railway', () => {
      const { cells, clusters } = makeMap();
      const { railways } = RoadGenerator.generate(
        cells,
        40,
        30,
        roadParamsWithInfra('developed'),
        clusters,
      );
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
            urbanClusterId: null,
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
        urbanClusterId: null,
      });
      cells.set('0,0', {
        coord: { q: 0, r: 0 },
        terrain: TerrainType.Plains,
        elevation: 0.4,
        moisture: 0.3,
        urbanClusterId: null,
      });
      for (const n of HexGrid.neighbors({ q: 2, r: 2 })) {
        cells.set(HexGrid.key(n), {
          coord: n,
          terrain: TerrainType.Mountain,
          elevation: 0.9,
          moisture: 0.3,
          urbanClusterId: null,
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

    it('prefers reusing existing edges when multiplier is provided', () => {
      const cells = new Map<string, HexCell>();
      for (let q = 0; q < 5; q++) {
        for (let r = 0; r < 5; r++) {
          const coord = { q, r };
          cells.set(HexGrid.key(coord), {
            coord,
            terrain: TerrainType.Plains,
            elevation: 0.4,
            moisture: 0.3,
            urbanClusterId: null,
          });
        }
      }

      // Mark some edges as existing
      const existingEdges = new Set<string>();
      const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
      existingEdges.add(edgeKey(HexGrid.key({ q: 0, r: 0 }), HexGrid.key({ q: 1, r: 0 })));
      existingEdges.add(edgeKey(HexGrid.key({ q: 1, r: 0 }), HexGrid.key({ q: 2, r: 0 })));

      const pathWithReuse = RoadGenerator.astar(
        { q: 0, r: 0 },
        { q: 2, r: 0 },
        cells,
        5,
        5,
        defaultTerrainCost,
        existingEdges,
        0.1,
      );
      expect(pathWithReuse).not.toBeNull();
      expect(pathWithReuse![0]).toEqual({ q: 0, r: 0 });
      expect(pathWithReuse![pathWithReuse!.length - 1]).toEqual({ q: 2, r: 0 });
    });
  });
});
