import { HexGrid } from '@core/map/HexGrid';
import type { MockFacility, MockUnit } from '@core/mock/types';
import { ResourceType } from '@data/types';
import { Container, Graphics, type Ticker } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const PARTICLE_RADIUS = 2.5;
const PARTICLE_COLOR = 0xddaa33;
const PARTICLE_DAMAGED_COLOR = 0xcc4433;
const PARTICLE_ALPHA = 0.75;
const MIN_ZOOM = 0.2;

const SUPPLY_RANGE: Record<string, number> = {
  depot: 12,
  railHub: 12,
  factory: 8,
};

const ARC_HEIGHT_FACTOR = 0.15;

interface SupplyArc {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  midX: number;
  midY: number;
  pixelDist: number;
  damaged: boolean;
  baseSpeed: number;
}

interface SupplyParticle {
  arcIndex: number;
  t: number;
}

function avgSupply(unit: MockUnit): number {
  const s = unit.supplies;
  return (
    (s[ResourceType.Fuel] + s[ResourceType.Ammo] + s[ResourceType.Food] + s[ResourceType.Parts]) / 4
  );
}

function demandParticles(avg: number, damaged: boolean): number {
  const cap = damaged ? 2 : 5;
  if (avg >= 1.0) return 0;
  if (avg > 0.8) return Math.min(1, cap);
  if (avg > 0.2) return Math.min(Math.round(2 + (0.8 - avg) / 0.6), cap);
  return cap;
}

function quadBezier(
  p0x: number,
  p0y: number,
  cx: number,
  cy: number,
  p1x: number,
  p1y: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * p0x + 2 * u * t * cx + t * t * p1x,
    y: u * u * p0y + 2 * u * t * cy + t * t * p1y,
  };
}

export class SupplyFlowLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private arcs: SupplyArc[] = [];
  private particles: SupplyParticle[] = [];
  private getZoom: () => number;
  private facilities: MockFacility[] = [];
  private units: MockUnit[] = [];
  private lastVersion = -1;

  constructor(getZoom: () => number) {
    this.getZoom = getZoom;
    this.container.addChild(this.graphics);
  }

  updateData(facilities: MockFacility[], units: MockUnit[]): void {
    this.facilities = facilities;
    this.units = units;
  }

  rebuild(version: number): void {
    if (this.lastVersion === version) return;
    this.lastVersion = version;
    this.buildArcs();
  }

  update(ticker: Ticker): void {
    const dt = ticker.deltaMS / 1000;
    const zoom = this.getZoom();

    if (zoom < MIN_ZOOM) {
      this.graphics.clear();
      return;
    }

    for (const p of this.particles) {
      const arc = this.arcs[p.arcIndex];
      const speed = arc.baseSpeed * (arc.damaged ? 0.5 : 1);
      p.t += (speed * dt) / arc.pixelDist;
      if (p.t > 1) p.t -= 1;
    }

    this.graphics.clear();
    for (const p of this.particles) {
      const arc = this.arcs[p.arcIndex];
      const pos = quadBezier(arc.fromX, arc.fromY, arc.midX, arc.midY, arc.toX, arc.toY, p.t);
      const color = arc.damaged ? PARTICLE_DAMAGED_COLOR : PARTICLE_COLOR;
      this.graphics.circle(pos.x, pos.y, PARTICLE_RADIUS);
      this.graphics.fill({ color, alpha: PARTICLE_ALPHA });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }

  private buildArcs(): void {
    this.arcs = [];
    this.particles = [];

    const alliedBattalions = this.units.filter((u) => u.faction === 'allied' && !u.isHq);

    for (const facility of this.facilities) {
      const range = SUPPLY_RANGE[facility.kind] ?? 8;
      const fromPx = HexRenderer.hexToPixel(facility.coord);

      for (const unit of alliedBattalions) {
        const hexDist = HexGrid.distance(facility.coord, unit.coord);
        if (hexDist > range || hexDist === 0) continue;

        const avg = avgSupply(unit);
        const count = demandParticles(avg, facility.damaged);
        if (count === 0) continue;

        const toPx = HexRenderer.hexToPixel(unit.coord);
        const dx = toPx.x - fromPx.x;
        const dy = toPx.y - fromPx.y;
        const pixelDist = Math.sqrt(dx * dx + dy * dy);
        if (pixelDist < 1) continue;

        const arcHeight = pixelDist * ARC_HEIGHT_FACTOR;
        const mx = (fromPx.x + toPx.x) / 2;
        const my = (fromPx.y + toPx.y) / 2 - arcHeight;

        const arcIdx = this.arcs.length;
        this.arcs.push({
          fromX: fromPx.x,
          fromY: fromPx.y,
          toX: toPx.x,
          toY: toPx.y,
          midX: mx,
          midY: my,
          pixelDist,
          damaged: facility.damaged,
          baseSpeed: 30 + (1 - hexDist / range) * 30,
        });

        for (let i = 0; i < count; i++) {
          this.particles.push({ arcIndex: arcIdx, t: i / count });
        }
      }
    }
  }
}
