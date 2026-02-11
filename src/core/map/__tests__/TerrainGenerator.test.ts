import { describe, expect, it } from 'vitest';
import { TerrainGenerator } from '../TerrainGenerator';
import { TerrainType } from '../types';

describe('TerrainGenerator', () => {
  const smallWidth = 40;
  const smallHeight = 30;

  describe('generate', () => {
    it('returns a cell for every hex in bounds', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      expect(cells.size).toBe(smallWidth * smallHeight);
    });

    it('assigns valid terrain types to all cells', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      const validTerrains = new Set(Object.values(TerrainType));
      for (const cell of cells.values()) {
        expect(validTerrains.has(cell.terrain)).toBe(true);
      }
    });

    it('elevation values are in 0-1 range', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      for (const cell of cells.values()) {
        expect(cell.elevation).toBeGreaterThanOrEqual(0);
        expect(cell.elevation).toBeLessThanOrEqual(1);
      }
    });

    it('moisture values are in 0-1 range', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      for (const cell of cells.values()) {
        expect(cell.moisture).toBeGreaterThanOrEqual(0);
        expect(cell.moisture).toBeLessThanOrEqual(1);
      }
    });

    it('produces water hexes at low elevation', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      const waterCells = [...cells.values()].filter((c) => c.terrain === TerrainType.Water);
      expect(waterCells.length).toBeGreaterThan(0);
      for (const cell of waterCells) {
        expect(cell.elevation).toBeLessThan(0.25);
      }
    });

    it('produces mountains at high elevation', () => {
      const cells = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 12345);
      const mountains = [...cells.values()].filter((c) => c.terrain === TerrainType.Mountain);
      expect(mountains.length).toBeGreaterThan(0);
      for (const cell of mountains) {
        expect(cell.elevation).toBeGreaterThan(0.65);
      }
    });

    it('is deterministic with same seed', () => {
      const a = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 99);
      const b = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 99);
      for (const [key, cellA] of a) {
        const cellB = b.get(key)!;
        expect(cellA.terrain).toBe(cellB.terrain);
        expect(cellA.elevation).toBe(cellB.elevation);
      }
    });

    it('produces different results with different seeds', () => {
      const a = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 1);
      const b = TerrainGenerator.generate(smallWidth, smallHeight, 'mixed', 2);
      let differences = 0;
      for (const [key, cellA] of a) {
        const cellB = b.get(key)!;
        if (cellA.terrain !== cellB.terrain) differences++;
      }
      expect(differences).toBeGreaterThan(0);
    });

    it('mountainous geography produces more mountains than plains geography', () => {
      const mountainous = TerrainGenerator.generate(smallWidth, smallHeight, 'mountainous', 42);
      const plains = TerrainGenerator.generate(smallWidth, smallHeight, 'plains', 42);
      const countMountains = (cells: Map<string, { terrain: TerrainType }>) =>
        [...cells.values()].filter(
          (c) => c.terrain === TerrainType.Mountain || c.terrain === TerrainType.Hills,
        ).length;
      expect(countMountains(mountainous)).toBeGreaterThan(countMountains(plains));
    });
  });

  describe('assignTerrain', () => {
    it('returns Water for low elevation', () => {
      expect(TerrainGenerator.assignTerrain(0.1, 0.5, 'mixed')).toBe(TerrainType.Water);
    });

    it('returns Mountain for high elevation', () => {
      expect(TerrainGenerator.assignTerrain(0.9, 0.5, 'mixed')).toBe(TerrainType.Mountain);
    });

    it('returns Marsh for low-mid elevation and high moisture', () => {
      expect(TerrainGenerator.assignTerrain(0.28, 0.8, 'mixed')).toBe(TerrainType.Marsh);
    });

    it('returns Forest for mid elevation and high moisture', () => {
      expect(TerrainGenerator.assignTerrain(0.45, 0.8, 'mixed')).toBe(TerrainType.Forest);
    });

    it('returns Plains for mid-low elevation and low moisture', () => {
      expect(TerrainGenerator.assignTerrain(0.4, 0.2, 'mixed')).toBe(TerrainType.Plains);
    });

    it('returns Hills for mid-high elevation and low moisture', () => {
      expect(TerrainGenerator.assignTerrain(0.65, 0.2, 'mixed')).toBe(TerrainType.Hills);
    });
  });
});
