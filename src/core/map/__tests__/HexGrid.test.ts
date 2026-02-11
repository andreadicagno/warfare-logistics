import { describe, it, expect } from 'vitest';
import { HexGrid } from '../HexGrid';
import type { HexCoord } from '../types';

describe('HexGrid', () => {
  describe('key', () => {
    it('converts coord to string key', () => {
      expect(HexGrid.key({ q: 3, r: -2 })).toBe('3,-2');
    });

    it('handles zero coordinates', () => {
      expect(HexGrid.key({ q: 0, r: 0 })).toBe('0,0');
    });
  });

  describe('neighbors', () => {
    it('returns 6 neighbors for origin', () => {
      const result = HexGrid.neighbors({ q: 0, r: 0 });
      expect(result).toHaveLength(6);
    });

    it('returns correct neighbor coordinates (flat-top axial)', () => {
      const result = HexGrid.neighbors({ q: 2, r: 3 });
      // Flat-top axial directions: [+1,0], [+1,-1], [0,-1], [-1,0], [-1,+1], [0,+1]
      expect(result).toContainEqual({ q: 3, r: 3 });
      expect(result).toContainEqual({ q: 3, r: 2 });
      expect(result).toContainEqual({ q: 2, r: 2 });
      expect(result).toContainEqual({ q: 1, r: 3 });
      expect(result).toContainEqual({ q: 1, r: 4 });
      expect(result).toContainEqual({ q: 2, r: 4 });
    });
  });

  describe('distance', () => {
    it('returns 0 for same hex', () => {
      expect(HexGrid.distance({ q: 3, r: 4 }, { q: 3, r: 4 })).toBe(0);
    });

    it('returns 1 for adjacent hexes', () => {
      expect(HexGrid.distance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    });

    it('returns correct distance for distant hexes', () => {
      expect(HexGrid.distance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    });
  });

  describe('ring', () => {
    it('returns single hex for radius 0', () => {
      const result = HexGrid.ring({ q: 0, r: 0 }, 0);
      expect(result).toEqual([{ q: 0, r: 0 }]);
    });

    it('returns 6 hexes for radius 1', () => {
      const result = HexGrid.ring({ q: 0, r: 0 }, 1);
      expect(result).toHaveLength(6);
    });

    it('returns 12 hexes for radius 2', () => {
      const result = HexGrid.ring({ q: 0, r: 0 }, 2);
      expect(result).toHaveLength(12);
    });
  });

  describe('toPixel', () => {
    it('returns origin for (0,0)', () => {
      const result = HexGrid.toPixel({ q: 0, r: 0 });
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
    });

    it('offsets x for increasing q', () => {
      const a = HexGrid.toPixel({ q: 0, r: 0 });
      const b = HexGrid.toPixel({ q: 1, r: 0 });
      expect(b.x).toBeGreaterThan(a.x);
    });
  });

  describe('fromPixel', () => {
    it('round-trips through toPixel', () => {
      const original: HexCoord = { q: 5, r: -3 };
      const pixel = HexGrid.toPixel(original);
      const result = HexGrid.fromPixel(pixel.x, pixel.y);
      expect(result.q).toBe(original.q);
      expect(result.r).toBe(original.r);
    });
  });

  describe('inBounds', () => {
    it('returns true for valid coordinates', () => {
      expect(HexGrid.inBounds({ q: 5, r: 5 }, 40, 30)).toBe(true);
    });

    it('returns false for negative q', () => {
      expect(HexGrid.inBounds({ q: -1, r: 5 }, 40, 30)).toBe(false);
    });

    it('returns false for q >= width', () => {
      expect(HexGrid.inBounds({ q: 40, r: 5 }, 40, 30)).toBe(false);
    });

    it('returns false for r >= height', () => {
      expect(HexGrid.inBounds({ q: 5, r: 30 }, 40, 30)).toBe(false);
    });
  });
});
