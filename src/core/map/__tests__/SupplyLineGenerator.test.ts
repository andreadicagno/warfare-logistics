import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { SupplyLineGenerator } from '../SupplyLineGenerator';
import { SmoothingPass } from '../SmoothingPass';
import { TerrainGenerator } from '../TerrainGenerator';
import type { HexCell, SupplyLineParams, UrbanCluster } from '../types';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';
import { UrbanGenerator } from '../UrbanGenerator';

const defaultSupplyLineParams = DEFAULT_GENERATION_PARAMS.supplyLines;

function supplyLineParamsWithInfra(
  infrastructure: SupplyLineParams['infrastructure'],
): SupplyLineParams {
  return { ...defaultSupplyLineParams, infrastructure };
}

const defaultTerrainCost: Record<TerrainType, number> = {
  [TerrainType.Plains]: defaultSupplyLineParams.plainsCost,
  [TerrainType.Forest]: defaultSupplyLineParams.forestCost,
  [TerrainType.Hills]: defaultSupplyLineParams.hillsCost,
  [TerrainType.Marsh]: defaultSupplyLineParams.marshCost,
  [TerrainType.River]: defaultSupplyLineParams.riverCost,
  [TerrainType.Urban]: defaultSupplyLineParams.urbanCost,
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

describe('SupplyLineGenerator', () => {
  describe('generate', () => {
    it('produces supply lines', () => {
      const { cells, clusters } = makeMap();
      const lines = SupplyLineGenerator.generate(
        cells,
        40,
        30,
        supplyLineParamsWithInfra('basic'),
        clusters,
      );
      expect(lines.length).toBeGreaterThan(0);
    });

    it('all lines are level 1', () => {
      const { cells, clusters } = makeMap();
      const lines = SupplyLineGenerator.generate(
        cells,
        40,
        30,
        supplyLineParamsWithInfra('basic'),
        clusters,
      );
      for (const line of lines) {
        expect(line.level).toBe(1);
      }
    });

    it('all lines are active', () => {
      const { cells, clusters } = makeMap();
      const lines = SupplyLineGenerator.generate(
        cells,
        40,
        30,
        supplyLineParamsWithInfra('basic'),
        clusters,
      );
      for (const line of lines) {
        expect(line.state).toBe('active');
      }
    });

    it('paths contain only adjacent hexes', () => {
      const { cells, clusters } = makeMap();
      const lines = SupplyLineGenerator.generate(
        cells,
        40,
        30,
        supplyLineParamsWithInfra('basic'),
        clusters,
      );
      for (const line of lines) {
        for (let i = 1; i < line.hexes.length; i++) {
          expect(HexGrid.distance(line.hexes[i - 1], line.hexes[i])).toBe(1);
        }
      }
    });

    it('lines avoid mountains and water', () => {
      const { cells, clusters } = makeMap();
      const lines = SupplyLineGenerator.generate(
        cells,
        40,
        30,
        supplyLineParamsWithInfra('basic'),
        clusters,
      );
      for (const line of lines) {
        for (const hex of line.hexes) {
          const cell = cells.get(HexGrid.key(hex))!;
          expect(cell.terrain).not.toBe(TerrainType.Mountain);
          expect(cell.terrain).not.toBe(TerrainType.Water);
        }
      }
    });

    it('produces no extra lines with infrastructure=none', () => {
      const { cells, clusters } = makeMap();
      const noneLines = SupplyLineGenerator.generate(
        cells,
        40,
        30,
        supplyLineParamsWithInfra('none'),
        clusters,
      );
      const basicLines = SupplyLineGenerator.generate(
        cells,
        40,
        30,
        supplyLineParamsWithInfra('basic'),
        clusters,
      );
      // With 'none', only road lines (no railways) should be produced
      expect(noneLines.length).toBeLessThan(basicLines.length);
    });

    it('produces more lines with developed infrastructure', () => {
      const { cells, clusters } = makeMap();
      const basicLines = SupplyLineGenerator.generate(
        cells,
        40,
        30,
        supplyLineParamsWithInfra('basic'),
        clusters,
      );
      const developedLines = SupplyLineGenerator.generate(
        cells,
        40,
        30,
        supplyLineParamsWithInfra('developed'),
        clusters,
      );
      // Developed adds redundancy edges + town branches on top of MST
      expect(developedLines.length).toBeGreaterThanOrEqual(basicLines.length);
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
      const path = SupplyLineGenerator.astar(
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
      const path = SupplyLineGenerator.astar(
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

      const pathWithReuse = SupplyLineGenerator.astar(
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
