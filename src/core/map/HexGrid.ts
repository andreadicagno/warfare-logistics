import type { HexCoord } from './types';

// Flat-top axial direction vectors (edges 0-5, clockwise from east)
const DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },   // 0: E
  { q: 1, r: -1 },  // 1: NE
  { q: 0, r: -1 },  // 2: NW
  { q: -1, r: 0 },  // 3: W
  { q: -1, r: 1 },  // 4: SW
  { q: 0, r: 1 },   // 5: SE
];

// Flat-top hex geometry constants (unit size = 1)
const HEX_SIZE = 1;
const SQRT3 = Math.sqrt(3);

export class HexGrid {
  static readonly DIRECTIONS = DIRECTIONS;

  static key(coord: HexCoord): string {
    return `${coord.q},${coord.r}`;
  }

  static neighbors(coord: HexCoord): HexCoord[] {
    return DIRECTIONS.map((d) => ({
      q: coord.q + d.q,
      r: coord.r + d.r,
    }));
  }

  static distance(a: HexCoord, b: HexCoord): number {
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    const ds = Math.abs((-a.q - a.r) - (-b.q - b.r));
    return Math.max(dq, dr, ds);
  }

  static ring(center: HexCoord, radius: number): HexCoord[] {
    if (radius === 0) return [{ q: center.q, r: center.r }];

    const results: HexCoord[] = [];
    let hex: HexCoord = {
      q: center.q + DIRECTIONS[4].q * radius,
      r: center.r + DIRECTIONS[4].r * radius,
    };

    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < radius; step++) {
        results.push({ q: hex.q, r: hex.r });
        hex = {
          q: hex.q + DIRECTIONS[side].q,
          r: hex.r + DIRECTIONS[side].r,
        };
      }
    }
    return results;
  }

  static toPixel(coord: HexCoord): { x: number; y: number } {
    const x = HEX_SIZE * (3 / 2) * coord.q;
    const y = HEX_SIZE * (SQRT3 / 2 * coord.q + SQRT3 * coord.r);
    return { x, y };
  }

  static fromPixel(x: number, y: number): HexCoord {
    const q = (2 / 3) * x / HEX_SIZE;
    const r = (-1 / 3 * x + SQRT3 / 3 * y) / HEX_SIZE;
    return HexGrid.roundAxial(q, r);
  }

  private static roundAxial(q: number, r: number): HexCoord {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) {
      rq = -rr - rs;
    } else if (dr > ds) {
      rr = -rq - rs;
    }
    return { q: rq, r: rr };
  }

  static inBounds(coord: HexCoord, width: number, height: number): boolean {
    return coord.q >= 0 && coord.q < width && coord.r >= 0 && coord.r < height;
  }

  static edgeDirection(from: HexCoord, to: HexCoord): number | null {
    const dq = to.q - from.q;
    const dr = to.r - from.r;
    for (let i = 0; i < 6; i++) {
      if (DIRECTIONS[i].q === dq && DIRECTIONS[i].r === dr) return i;
    }
    return null;
  }

  static oppositeEdge(edge: number): number {
    return (edge + 3) % 6;
  }
}
