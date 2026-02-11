import { describe, expect, it } from 'vitest';
import { HexRenderer } from '../HexRenderer';

describe('HexRenderer', () => {
  describe('HEX_SIZE', () => {
    it('is 16 pixels', () => {
      expect(HexRenderer.HEX_SIZE).toBe(16);
    });
  });

  describe('vertices', () => {
    it('returns 6 vertices', () => {
      const verts = HexRenderer.vertices(0, 0);
      expect(verts).toHaveLength(6);
    });

    it('vertices are at HEX_SIZE distance from center', () => {
      const verts = HexRenderer.vertices(100, 200);
      for (const v of verts) {
        const dx = v.x - 100;
        const dy = v.y - 200;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(16, 1);
      }
    });

    it('first vertex is at 0 degrees (flat-top: rightmost point)', () => {
      const verts = HexRenderer.vertices(0, 0);
      expect(verts[0].x).toBeCloseTo(16, 1);
      expect(verts[0].y).toBeCloseTo(0, 1);
    });

    it('vertices are offset by center position', () => {
      const cx = 50;
      const cy = 75;
      const verts = HexRenderer.vertices(cx, cy);
      expect(verts[0].x).toBeCloseTo(cx + 16, 1);
      expect(verts[0].y).toBeCloseTo(cy, 1);
    });
  });

  describe('edgeMidpoint', () => {
    it('returns midpoint between two adjacent vertices', () => {
      const verts = HexRenderer.vertices(0, 0);
      const mid = HexRenderer.edgeMidpoint(0, 0, 0);
      const expectedX = (verts[0].x + verts[1].x) / 2;
      const expectedY = (verts[0].y + verts[1].y) / 2;
      expect(mid.x).toBeCloseTo(expectedX, 1);
      expect(mid.y).toBeCloseTo(expectedY, 1);
    });

    it('edge 5 wraps between vertex 5 and vertex 0', () => {
      const verts = HexRenderer.vertices(0, 0);
      const mid = HexRenderer.edgeMidpoint(0, 0, 5);
      const expectedX = (verts[5].x + verts[0].x) / 2;
      const expectedY = (verts[5].y + verts[0].y) / 2;
      expect(mid.x).toBeCloseTo(expectedX, 1);
      expect(mid.y).toBeCloseTo(expectedY, 1);
    });

    it('midpoint is offset by center position', () => {
      const mid0 = HexRenderer.edgeMidpoint(0, 0, 0);
      const mid1 = HexRenderer.edgeMidpoint(100, 200, 0);
      expect(mid1.x).toBeCloseTo(mid0.x + 100, 1);
      expect(mid1.y).toBeCloseTo(mid0.y + 200, 1);
    });
  });

  describe('hexToPixel', () => {
    it('scales HexGrid.toPixel by HEX_SIZE', () => {
      const p = HexRenderer.hexToPixel({ q: 1, r: 0 });
      expect(p.x).toBeCloseTo(1.5 * 16, 1);
      expect(p.y).toBeCloseTo((Math.sqrt(3) / 2) * 16, 1);
    });

    it('origin hex maps to (0, 0)', () => {
      const p = HexRenderer.hexToPixel({ q: 0, r: 0 });
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    });
  });

  describe('pixelToHex', () => {
    it('round-trips with hexToPixel', () => {
      const original = { q: 5, r: 3 };
      const pixel = HexRenderer.hexToPixel(original);
      const result = HexRenderer.pixelToHex(pixel.x, pixel.y);
      expect(result.q).toBe(5);
      expect(result.r).toBe(3);
    });
  });
});
