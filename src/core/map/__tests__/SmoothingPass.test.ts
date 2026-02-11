import { describe, it, expect } from 'vitest';
import { SmoothingPass } from '../SmoothingPass';
import { TerrainGenerator } from '../TerrainGenerator';
import { HexGrid } from '../HexGrid';
import type { HexCell } from '../types';
import { TerrainType } from '../types';

function makeCell(
  q: number,
  r: number,
  terrain: TerrainType,
  elevation = 0.5,
): HexCell {
  return {
    coord: { q, r },
    terrain,
    elevation,
    moisture: 0.5,
    riverEdges: new Set(),
    settlement: null,
  };
}

describe('SmoothingPass', () => {
  describe('removeSingleHexAnomalies', () => {
    it('replaces a lone mountain surrounded by plains', () => {
      const cells = new Map<string, HexCell>();
      cells.set('5,5', makeCell(5, 5, TerrainType.Mountain, 0.8));
      for (const n of HexGrid.neighbors({ q: 5, r: 5 })) {
        cells.set(
          HexGrid.key(n),
          makeCell(n.q, n.r, TerrainType.Plains, 0.4),
        );
      }
      for (const n of HexGrid.neighbors({ q: 5, r: 5 })) {
        for (const nn of HexGrid.neighbors(n)) {
          const key = HexGrid.key(nn);
          if (!cells.has(key)) {
            cells.set(key, makeCell(nn.q, nn.r, TerrainType.Plains, 0.4));
          }
        }
      }

      SmoothingPass.removeSingleHexAnomalies(cells, 20, 20);
      expect(cells.get('5,5')!.terrain).not.toBe(TerrainType.Mountain);
    });

    it('keeps a mountain that has mountain neighbors', () => {
      const cells = new Map<string, HexCell>();
      cells.set('5,5', makeCell(5, 5, TerrainType.Mountain, 0.8));
      const neighbors = HexGrid.neighbors({ q: 5, r: 5 });
      neighbors.forEach((n, i) => {
        const terrain = i < 3 ? TerrainType.Mountain : TerrainType.Hills;
        cells.set(HexGrid.key(n), makeCell(n.q, n.r, terrain, 0.7));
      });

      SmoothingPass.removeSingleHexAnomalies(cells, 20, 20);
      expect(cells.get('5,5')!.terrain).toBe(TerrainType.Mountain);
    });
  });

  describe('removeIsolatedWater', () => {
    it('replaces a single water hex surrounded by land', () => {
      const cells = new Map<string, HexCell>();
      cells.set('5,5', makeCell(5, 5, TerrainType.Water, 0.1));
      for (const n of HexGrid.neighbors({ q: 5, r: 5 })) {
        cells.set(
          HexGrid.key(n),
          makeCell(n.q, n.r, TerrainType.Plains, 0.4),
        );
      }

      SmoothingPass.removeIsolatedWater(cells, 20, 20);
      expect(cells.get('5,5')!.terrain).not.toBe(TerrainType.Water);
    });

    it('keeps water that is adjacent to other water', () => {
      const cells = new Map<string, HexCell>();
      cells.set('5,5', makeCell(5, 5, TerrainType.Water, 0.1));
      const neighbors = HexGrid.neighbors({ q: 5, r: 5 });
      cells.set(
        HexGrid.key(neighbors[0]),
        makeCell(neighbors[0].q, neighbors[0].r, TerrainType.Water, 0.1),
      );
      for (let i = 1; i < neighbors.length; i++) {
        cells.set(
          HexGrid.key(neighbors[i]),
          makeCell(neighbors[i].q, neighbors[i].r, TerrainType.Plains, 0.4),
        );
      }

      SmoothingPass.removeIsolatedWater(cells, 20, 20);
      expect(cells.get('5,5')!.terrain).toBe(TerrainType.Water);
    });
  });

  describe('apply (full pipeline)', () => {
    it('runs without error on generated terrain', () => {
      const cells = TerrainGenerator.generate(40, 30, 'mixed', 42);
      expect(() => SmoothingPass.apply(cells, 40, 30)).not.toThrow();
    });
  });
});
