import { describe, expect, it } from 'vitest';
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

  describe('edgeDirection', () => {
    it('returns 0 for east neighbor', () => {
      expect(HexGrid.edgeDirection({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(0);
    });

    it('returns 5 for southeast neighbor', () => {
      expect(HexGrid.edgeDirection({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(5);
    });

    it('returns 3 for west neighbor', () => {
      expect(HexGrid.edgeDirection({ q: 0, r: 0 }, { q: -1, r: 0 })).toBe(3);
    });

    it('returns null for non-adjacent hexes', () => {
      expect(HexGrid.edgeDirection({ q: 0, r: 0 }, { q: 5, r: 5 })).toBeNull();
    });
  });

  describe('oppositeEdge', () => {
    it('returns 3 for edge 0 (E→W)', () => {
      expect(HexGrid.oppositeEdge(0)).toBe(3);
    });

    it('returns 0 for edge 3 (W→E)', () => {
      expect(HexGrid.oppositeEdge(3)).toBe(0);
    });

    it('returns 4 for edge 1 (NE→SW)', () => {
      expect(HexGrid.oppositeEdge(1)).toBe(4);
    });

    it('returns 2 for edge 5 (SE→NW)', () => {
      expect(HexGrid.oppositeEdge(5)).toBe(2);
    });
  });

  describe('line', () => {
    it('returns single hex for same start and end', () => {
      const result = HexGrid.line({ q: 3, r: 4 }, { q: 3, r: 4 });
      expect(result).toEqual([{ q: 3, r: 4 }]);
    });

    it('returns two hexes for adjacent hexes', () => {
      const result = HexGrid.line({ q: 0, r: 0 }, { q: 1, r: 0 });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ q: 0, r: 0 });
      expect(result[1]).toEqual({ q: 1, r: 0 });
    });

    it('returns correct length for longer lines', () => {
      const result = HexGrid.line({ q: 0, r: 0 }, { q: 4, r: 0 });
      expect(result).toHaveLength(5); // distance 4 → 5 hexes
    });

    it('all consecutive hexes are adjacent', () => {
      const result = HexGrid.line({ q: 0, r: 0 }, { q: 3, r: -2 });
      for (let i = 1; i < result.length; i++) {
        expect(HexGrid.distance(result[i - 1], result[i])).toBe(1);
      }
    });

    it('starts and ends at the correct hexes', () => {
      const a: HexCoord = { q: 2, r: 5 };
      const b: HexCoord = { q: 7, r: 1 };
      const result = HexGrid.line(a, b);
      expect(result[0]).toEqual(a);
      expect(result[result.length - 1]).toEqual(b);
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
