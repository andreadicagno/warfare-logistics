import { describe, expect, it } from 'vitest';
import { MapGenerator } from '../MapGenerator';
import type { MapConfig } from '../types';
import { TerrainType } from '../types';

describe('MapGenerator', () => {
  const config: MapConfig = {
    mapSize: 'small',
    geography: 'mixed',
    initialInfrastructure: 'basic',
    seed: 42,
  };

  describe('generate', () => {
    it('returns a GameMap with correct dimensions for small', () => {
      const map = MapGenerator.generate(config);
      expect(map.width).toBe(40);
      expect(map.height).toBe(30);
    });

    it('returns correct dimensions for medium', () => {
      const map = MapGenerator.generate({ ...config, mapSize: 'medium' });
      expect(map.width).toBe(60);
      expect(map.height).toBe(45);
    });

    it('returns correct dimensions for large', () => {
      const map = MapGenerator.generate({ ...config, mapSize: 'large' });
      expect(map.width).toBe(80);
      expect(map.height).toBe(60);
    });

    it('populates cells map with correct count', () => {
      const map = MapGenerator.generate(config);
      expect(map.cells.size).toBe(40 * 30);
    });

    it('produces River terrain cells', () => {
      const map = MapGenerator.generate(config);
      const riverCells = [...map.cells.values()].filter((c) => c.terrain === TerrainType.River);
      expect(riverCells.length).toBeGreaterThan(0);
    });

    it('produces roads', () => {
      const map = MapGenerator.generate(config);
      expect(map.roads.length).toBeGreaterThan(0);
    });

    it('produces railways with basic infrastructure', () => {
      const map = MapGenerator.generate(config);
      expect(map.railways.length).toBeGreaterThanOrEqual(1);
    });

    it('has settlements placed', () => {
      const map = MapGenerator.generate(config);
      const settlements = [...map.cells.values()].filter((c) => c.settlement !== null);
      expect(settlements.length).toBeGreaterThan(0);
    });

    it('is deterministic', () => {
      const a = MapGenerator.generate(config);
      const b = MapGenerator.generate(config);
      expect(a.cells.size).toBe(b.cells.size);
      expect(a.roads.length).toBe(b.roads.length);
      for (const [key, cellA] of a.cells) {
        const cellB = b.cells.get(key)!;
        expect(cellA.terrain).toBe(cellB.terrain);
        expect(cellA.settlement).toBe(cellB.settlement);
      }
    });

    it('produces different maps with different seeds', () => {
      const a = MapGenerator.generate({ ...config, seed: 1 });
      const b = MapGenerator.generate({ ...config, seed: 2 });
      let differences = 0;
      for (const [key, cellA] of a.cells) {
        const cellB = b.cells.get(key)!;
        if (cellA.terrain !== cellB.terrain) differences++;
      }
      expect(differences).toBeGreaterThan(0);
    });
  });
});
