import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { TerrainGenerator } from '../TerrainGenerator';

describe('RiverGenerator', () => {
  function makeMap() {
    return TerrainGenerator.generate(40, 30, 'mixed', 42);
  }

  describe('generate', () => {
    it('produces 3-5 rivers', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      expect(rivers.length).toBeGreaterThanOrEqual(3);
      expect(rivers.length).toBeLessThanOrEqual(5);
    });

    it('rivers have at least 2 edges', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      for (const river of rivers) {
        expect(river.edges.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('sets riverEdges on cells along the path', () => {
      const cells = makeMap();
      RiverGenerator.generate(cells, 40, 30, 42);
      let edgeCount = 0;
      for (const cell of cells.values()) {
        edgeCount += cell.riverEdges.size;
      }
      expect(edgeCount).toBeGreaterThan(0);
    });

    it('river sources start at high elevation', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      for (const river of rivers) {
        const sourceHex = river.edges[0].hex;
        const sourceCell = cells.get(HexGrid.key(sourceHex))!;
        expect(sourceCell.elevation).toBeGreaterThan(0.5);
      }
    });

    it('rivers flow generally downhill', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      for (const river of rivers) {
        if (river.edges.length < 2) continue;
        const firstCell = cells.get(HexGrid.key(river.edges[0].hex))!;
        const lastCell = cells.get(HexGrid.key(river.edges[river.edges.length - 1].hex))!;
        expect(firstCell.elevation).toBeGreaterThanOrEqual(lastCell.elevation);
      }
    });

    it('is deterministic', () => {
      const cells1 = makeMap();
      const rivers1 = RiverGenerator.generate(cells1, 40, 30, 42);
      const cells2 = makeMap();
      const rivers2 = RiverGenerator.generate(cells2, 40, 30, 42);
      expect(rivers1.length).toBe(rivers2.length);
      for (let i = 0; i < rivers1.length; i++) {
        expect(rivers1[i].edges.length).toBe(rivers2[i].edges.length);
      }
    });
  });
});
