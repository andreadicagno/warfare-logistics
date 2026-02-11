import { describe, expect, it } from 'vitest';
import { createRouteParticles, updateParticles } from '../layers/RouteAnimator';
import type { BezierSegment } from '../spline';

const straightSegment: BezierSegment = {
  p0: { x: 0, y: 0 },
  p1: { x: 33, y: 0 },
  p2: { x: 66, y: 0 },
  p3: { x: 100, y: 0 },
};

describe('createRouteParticles', () => {
  it('creates one particle per road spline', () => {
    const particles = createRouteParticles([[straightSegment]], 'road');
    expect(particles.length).toBe(1);
  });

  it('creates particles for railways', () => {
    const particles = createRouteParticles([[straightSegment]], 'railway');
    expect(particles.length).toBeGreaterThanOrEqual(1);
  });

  it('initializes t values in [0, 1)', () => {
    const particles = createRouteParticles([[straightSegment]], 'road');
    for (const p of particles) {
      expect(p.t).toBeGreaterThanOrEqual(0);
      expect(p.t).toBeLessThan(1);
    }
  });
});

describe('updateParticles', () => {
  it('advances t based on delta and speed', () => {
    const particles = [{ t: 0, splineIndex: 0, totalLength: 100, speed: 30 }];
    updateParticles(particles, 1 / 60);
    expect(particles[0].t).toBeCloseTo(30 / 60 / 100, 4);
  });

  it('wraps t back to [0, 1) when exceeding 1', () => {
    const particles = [{ t: 0.99, splineIndex: 0, totalLength: 100, speed: 30 }];
    updateParticles(particles, 1);
    expect(particles[0].t).toBeGreaterThanOrEqual(0);
    expect(particles[0].t).toBeLessThan(1);
  });
});
