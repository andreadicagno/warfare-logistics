import { Container, Graphics, type Ticker } from 'pixi.js';
import { type BezierSegment, cubicBezierPoint } from '../spline';

const ROAD_PARTICLE_COLOR = 0x4a3f2f;
const ROAD_PARTICLE_SIZE = 2;
const ROAD_SPEED = 20;
const RAILWAY_PARTICLE_COLOR = 0x3a3a4a;
const RAILWAY_PARTICLE_W = 3;
const RAILWAY_PARTICLE_H = 2;
const RAILWAY_SPEED = 30;
const MIN_ZOOM_FOR_PARTICLES = 0.5;

export interface RouteParticle {
  t: number;
  splineIndex: number;
  totalLength: number;
  speed: number;
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

export function createRouteParticles(
  splines: BezierSegment[][],
  type: 'road' | 'railway',
): RouteParticle[] {
  const particles: RouteParticle[] = [];
  const speed = type === 'railway' ? RAILWAY_SPEED : ROAD_SPEED;

  for (let i = 0; i < splines.length; i++) {
    const segs = splines[i];
    if (segs.length === 0) continue;
    const totalLength = estimateSplineLength(segs);
    const count = type === 'railway' ? Math.min(2, Math.max(1, Math.round(totalLength / 150))) : 1;

    for (let j = 0; j < count; j++) {
      particles.push({ t: j / count, splineIndex: i, totalLength, speed });
    }
  }
  return particles;
}

export function updateParticles(particles: RouteParticle[], deltaSec: number): void {
  for (const p of particles) {
    p.t += (p.speed * deltaSec) / p.totalLength;
    p.t = p.t % 1;
    if (p.t < 0) p.t += 1;
  }
}

export class RouteAnimator {
  readonly container = new Container();
  private graphics = new Graphics();
  private roadParticles: RouteParticle[] = [];
  private railwayParticles: RouteParticle[] = [];
  private roadSplines: BezierSegment[][] = [];
  private railwaySplines: BezierSegment[][] = [];
  private getZoom: () => number;

  constructor(getZoom: () => number) {
    this.getZoom = getZoom;
    this.container.addChild(this.graphics);
  }

  init(roadSplines: BezierSegment[][], railwaySplines: BezierSegment[][]): void {
    this.roadSplines = roadSplines;
    this.railwaySplines = railwaySplines;
    this.roadParticles = createRouteParticles(roadSplines, 'road');
    this.railwayParticles = createRouteParticles(railwaySplines, 'railway');
  }

  update(ticker: Ticker): void {
    const deltaSec = ticker.deltaMS / 1000;
    const zoom = this.getZoom();

    if (zoom < MIN_ZOOM_FOR_PARTICLES) {
      this.graphics.clear();
      return;
    }

    updateParticles(this.roadParticles, deltaSec);
    updateParticles(this.railwayParticles, deltaSec);

    this.graphics.clear();

    for (const p of this.roadParticles) {
      const segs = this.roadSplines[p.splineIndex];
      if (!segs || segs.length === 0) continue;
      const pos = evaluateSplineAt(segs, p.t);
      const half = ROAD_PARTICLE_SIZE / 2;
      this.graphics.rect(pos.x - half, pos.y - half, ROAD_PARTICLE_SIZE, ROAD_PARTICLE_SIZE);
      this.graphics.fill({ color: ROAD_PARTICLE_COLOR });
    }

    for (const p of this.railwayParticles) {
      const segs = this.railwaySplines[p.splineIndex];
      if (!segs || segs.length === 0) continue;
      const pos = evaluateSplineAt(segs, p.t);
      this.graphics.rect(
        pos.x - RAILWAY_PARTICLE_W / 2,
        pos.y - RAILWAY_PARTICLE_H / 2,
        RAILWAY_PARTICLE_W,
        RAILWAY_PARTICLE_H,
      );
      this.graphics.fill({ color: RAILWAY_PARTICLE_COLOR });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
