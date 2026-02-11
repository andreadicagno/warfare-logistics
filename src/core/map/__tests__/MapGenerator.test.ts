import { describe, expect, it } from 'vitest';
import { MAP_SIZE_PRESETS, MapGenerator } from '../MapGenerator';
import type { GenerationParams } from '../types';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';

describe('MapGenerator', () => {
  const params: GenerationParams = {
    ...DEFAULT_GENERATION_PARAMS,
    width: 40,
    height: 30,
    seed: 42,
    roads: { ...DEFAULT_GENERATION_PARAMS.roads, infrastructure: 'basic' },
  };

  describe('MAP_SIZE_PRESETS', () => {
    it('defines small as 200x150', () => {
      expect(MAP_SIZE_PRESETS.small).toEqual({ width: 200, height: 150 });
    });

    it('defines medium as 300x225', () => {
      expect(MAP_SIZE_PRESETS.medium).toEqual({ width: 300, height: 225 });
    });

    it('defines large as 400x300', () => {
      expect(MAP_SIZE_PRESETS.large).toEqual({ width: 400, height: 300 });
    });
  });

  describe('generate', () => {
    it('returns a GameMap with specified dimensions', () => {
      const map = MapGenerator.generate(params);
      expect(map.width).toBe(40);
      expect(map.height).toBe(30);
    });

    it('populates cells map with correct count', () => {
      const map = MapGenerator.generate(params);
      expect(map.cells.size).toBe(40 * 30);
    });

    it('produces River terrain cells', () => {
      const map = MapGenerator.generate(params);
      const riverCells = [...map.cells.values()].filter((c) => c.terrain === TerrainType.River);
      expect(riverCells.length).toBeGreaterThan(0);
    });

    it('produces roads', () => {
      const map = MapGenerator.generate(params);
      expect(map.roads.length).toBeGreaterThan(0);
    });

    it('produces railways with basic infrastructure', () => {
      const map = MapGenerator.generate(params);
      expect(map.railways.length).toBeGreaterThanOrEqual(1);
    });

    it('has urban clusters placed', () => {
      const map = MapGenerator.generate(params);
      expect(map.urbanClusters.length).toBeGreaterThan(0);
    });

    it('has supply hubs placed', () => {
      const map = MapGenerator.generate(params);
      expect(map.supplyHubs.length).toBeGreaterThan(0);
    });

    it('has Urban terrain cells', () => {
      const map = MapGenerator.generate(params);
      const urbanCells = [...map.cells.values()].filter((c) => c.terrain === TerrainType.Urban);
      expect(urbanCells.length).toBeGreaterThan(0);
    });

    it('is deterministic', () => {
      const a = MapGenerator.generate(params);
      const b = MapGenerator.generate(params);
      expect(a.cells.size).toBe(b.cells.size);
      expect(a.roads.length).toBe(b.roads.length);
      expect(a.urbanClusters.length).toBe(b.urbanClusters.length);
      expect(a.supplyHubs.length).toBe(b.supplyHubs.length);
      for (const [key, cellA] of a.cells) {
        const cellB = b.cells.get(key)!;
        expect(cellA.terrain).toBe(cellB.terrain);
        expect(cellA.urbanClusterId).toBe(cellB.urbanClusterId);
      }
    });

    it('produces different maps with different seeds', () => {
      const a = MapGenerator.generate({ ...params, seed: 1 });
      const b = MapGenerator.generate({ ...params, seed: 2 });
      let differences = 0;
      for (const [key, cellA] of a.cells) {
        const cellB = b.cells.get(key)!;
        if (cellA.terrain !== cellB.terrain) differences++;
      }
      expect(differences).toBeGreaterThan(0);
    });
  });
});
