import type { RouteHealth } from '@core/mock/types';
import { Container, Graphics, type Ticker } from 'pixi.js';
import { type BezierSegment, cubicBezierPoint } from '../spline';

const PARTICLE_COLOR = 0xffffff;
const PARTICLE_ALPHA = 0.6;
const PARTICLE_RADIUS = 1;
const MIN_ZOOM_FOR_FLOW = 0.4;

/** Speed in px/s per health level */
const SPEED_BY_HEALTH: Record<RouteHealth, number> = {
  good: 60,
  congested: 40,
  stressed: 20,
  destroyed: 0,
};

/** Particle count range [min, max] per health level */
const COUNT_BY_HEALTH: Record<RouteHealth, [number, number]> = {
  good: [6, 8],
  congested: [3, 4],
  stressed: [1, 2],
  destroyed: [0, 0],
};

/**
 * Gap between burst clusters on stressed routes.
 * Particles within a cluster are offset by a small t delta.
 */
const STRESSED_CLUSTER_SIZE = 3;
const STRESSED_CLUSTER_T_OFFSET = 0.025;
const STRESSED_CLUSTER_GAP = 0.35;

interface FlowParticle {
  t: number;
  splineIndex: number;
  totalLength: number;
  speed: number;
  routeType: 'road' | 'railway';
}

function estimateSplineLength(segments: BezierSegment[]): number {
  let total = 0;
  for (const seg of segments) {
    let prev = cubicBezierPoint(seg, 0);
    for (let i = 1; i <= 10; i++) {
      const pt = cubicBezierPoint(seg, i / 10);
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      total += Math.sqrt(dx * dx + dy * dy);
      prev = pt;
    }
  }
  return total;
}

function evaluateSplineAt(segments: BezierSegment[], globalT: number): { x: number; y: number } {
  const n = segments.length;
  const scaled = globalT * n;
  const segIdx = Math.min(Math.floor(scaled), n - 1);
  const localT = scaled - segIdx;
  return cubicBezierPoint(segments[segIdx], Math.min(localT, 1));
}

function pickCount(range: [number, number]): number {
  const [min, max] = range;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function createFlowParticles(
  splines: BezierSegment[][],
  healths: Map<number, RouteHealth>,
  routeType: 'road' | 'railway',
): FlowParticle[] {
  const particles: FlowParticle[] = [];

  for (let i = 0; i < splines.length; i++) {
    const segs = splines[i];
    if (segs.length === 0) continue;

    const health = healths.get(i) ?? 'good';
    if (health === 'destroyed') continue;

    const totalLength = estimateSplineLength(segs);
    const speed = SPEED_BY_HEALTH[health];
    const count = pickCount(COUNT_BY_HEALTH[health]);

    if (health === 'stressed') {
      // Spawn particles in burst clusters with gaps between them
      let cursor = 0;
      let spawned = 0;
      while (spawned < count) {
        const clusterCount = Math.min(STRESSED_CLUSTER_SIZE, count - spawned);
        for (let c = 0; c < clusterCount; c++) {
          particles.push({
            t: (cursor + c * STRESSED_CLUSTER_T_OFFSET) % 1,
            splineIndex: i,
            totalLength,
            speed,
            routeType,
          });
          spawned++;
        }
        cursor += STRESSED_CLUSTER_SIZE * STRESSED_CLUSTER_T_OFFSET + STRESSED_CLUSTER_GAP;
      }
    } else {
      // Evenly distribute particles along the spline
      for (let j = 0; j < count; j++) {
        particles.push({
          t: j / count,
          splineIndex: i,
          totalLength,
          speed,
          routeType,
        });
      }
    }
  }

  return particles;
}

export class FlowLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private particles: FlowParticle[] = [];
  private roadSplines: BezierSegment[][] = [];
  private railwaySplines: BezierSegment[][] = [];
  private getZoom: () => number;

  constructor(getZoom: () => number) {
    this.getZoom = getZoom;
    this.container.addChild(this.graphics);
  }

  init(
    roadSplines: BezierSegment[][],
    railwaySplines: BezierSegment[][],
    roadHealths: Map<number, RouteHealth>,
    railwayHealths: Map<number, RouteHealth>,
  ): void {
    this.roadSplines = roadSplines;
    this.railwaySplines = railwaySplines;
    this.particles = [
      ...createFlowParticles(roadSplines, roadHealths, 'road'),
      ...createFlowParticles(railwaySplines, railwayHealths, 'railway'),
    ];
  }

  update(ticker: Ticker): void {
    const deltaSec = ticker.deltaMS / 1000;
    const zoom = this.getZoom();

    if (zoom < MIN_ZOOM_FOR_FLOW) {
      this.graphics.clear();
      return;
    }

    // Advance all particles
    for (const p of this.particles) {
      p.t += (p.speed * deltaSec) / p.totalLength;
      p.t %= 1;
      if (p.t < 0) p.t += 1;
    }

    // Redraw
    this.graphics.clear();

    for (const p of this.particles) {
      const splines = p.routeType === 'road' ? this.roadSplines : this.railwaySplines;
      const segs = splines[p.splineIndex];
      if (!segs || segs.length === 0) continue;

      const pos = evaluateSplineAt(segs, p.t);
      this.graphics.circle(pos.x, pos.y, PARTICLE_RADIUS);
      this.graphics.fill({ color: PARTICLE_COLOR, alpha: PARTICLE_ALPHA });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
