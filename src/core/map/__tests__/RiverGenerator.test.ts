import { describe, it, expect } from 'vitest';
import { RiverGenerator } from '../RiverGenerator';
import { TerrainGenerator } from '../TerrainGenerator';
import { TerrainType } from '../types';
import { HexGrid } from '../HexGrid';

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

    it('rivers terminate at water or map edge', () => {
      const cells = makeMap();
      const rivers = RiverGenerator.generate(cells, 40, 30, 42);
      for (const river of rivers) {
        const lastEdge = river.edges[river.edges.length - 1];
        const lastHex = lastEdge.hex;
        const dir = HexGrid.DIRECTIONS[lastEdge.edge];
        const nextCoord = { q: lastHex.q + dir.q, r: lastHex.r + dir.r };
        const nextCell = cells.get(HexGrid.key(nextCoord));
        const isOutOfBounds = !HexGrid.inBounds(nextCoord, 40, 30);
        const isWater = nextCell?.terrain === TerrainType.Water;
        expect(isOutOfBounds || isWater).toBe(true);
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
