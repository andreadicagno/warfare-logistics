import { describe, expect, it } from 'vitest';
import { catmullRomToBezier, cubicBezierPoint } from '../spline';

describe('catmullRomToBezier', () => {
  it('returns empty array for fewer than 2 points', () => {
    expect(catmullRomToBezier([{ x: 0, y: 0 }])).toEqual([]);
  });

  it('returns one segment for 2 points', () => {
    const segments = catmullRomToBezier([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0].p0).toEqual({ x: 0, y: 0 });
    expect(segments[0].p3).toEqual({ x: 10, y: 0 });
  });

  it('returns N-1 segments for N points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: -5 },
      { x: 30, y: 0 },
    ];
    const segments = catmullRomToBezier(points);
    expect(segments).toHaveLength(3);
  });

  it('segments connect end-to-end', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: -5 },
    ];
    const segments = catmullRomToBezier(points);
    expect(segments[0].p3.x).toBeCloseTo(segments[1].p0.x);
    expect(segments[0].p3.y).toBeCloseTo(segments[1].p0.y);
  });

  it('first segment starts at first point', () => {
    const points = [
      { x: 5, y: 10 },
      { x: 15, y: 20 },
      { x: 25, y: 10 },
    ];
    const segments = catmullRomToBezier(points);
    expect(segments[0].p0).toEqual({ x: 5, y: 10 });
  });

  it('last segment ends at last point', () => {
    const points = [
      { x: 5, y: 10 },
      { x: 15, y: 20 },
      { x: 25, y: 10 },
    ];
    const segments = catmullRomToBezier(points);
    expect(segments[segments.length - 1].p3).toEqual({ x: 25, y: 10 });
  });
});

describe('cubicBezierPoint', () => {
  it('returns start point at t=0', () => {
    const seg = {
      p0: { x: 0, y: 0 },
      p1: { x: 5, y: 10 },
      p2: { x: 15, y: 10 },
      p3: { x: 20, y: 0 },
    };
    const pt = cubicBezierPoint(seg, 0);
    expect(pt.x).toBeCloseTo(0);
    expect(pt.y).toBeCloseTo(0);
  });

  it('returns end point at t=1', () => {
    const seg = {
      p0: { x: 0, y: 0 },
      p1: { x: 5, y: 10 },
      p2: { x: 15, y: 10 },
      p3: { x: 20, y: 0 },
    };
    const pt = cubicBezierPoint(seg, 1);
    expect(pt.x).toBeCloseTo(20);
    expect(pt.y).toBeCloseTo(0);
  });

  it('returns midpoint approximately between controls at t=0.5', () => {
    const seg = {
      p0: { x: 0, y: 0 },
      p1: { x: 0, y: 10 },
      p2: { x: 10, y: 10 },
      p3: { x: 10, y: 0 },
    };
    const pt = cubicBezierPoint(seg, 0.5);
    expect(pt.x).toBeCloseTo(5);
    expect(pt.y).toBeCloseTo(7.5);
  });
});
