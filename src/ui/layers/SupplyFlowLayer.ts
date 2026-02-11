import { HexGrid } from '@core/map/HexGrid';
import type { Faction, MockFacility, MockUnit } from '@core/mock/types';
import { ResourceType } from '@data/types';
import { Container, Graphics, type Ticker } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const PARTICLE_RADIUS = 2.5;
const ALLIED_PARTICLE_COLOR = 0x4488cc;
const ENEMY_PARTICLE_COLOR = 0xcc4444;
const ALLIED_PARTICLE_ALPHA = 0.75;
const ENEMY_PARTICLE_ALPHA = 0.3;
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
  faction: Faction;
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

function demandParticles(avg: number): number {
  if (avg >= 1.0) return 0;
  if (avg > 0.8) return 1;
  if (avg > 0.2) return Math.round(2 + (0.8 - avg) / 0.6);
  return 5;
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
      p.t += (arc.baseSpeed * dt) / arc.pixelDist;
      if (p.t > 1) p.t -= 1;
    }

    this.graphics.clear();
    for (const p of this.particles) {
      const arc = this.arcs[p.arcIndex];
      const pos = quadBezier(arc.fromX, arc.fromY, arc.midX, arc.midY, arc.toX, arc.toY, p.t);
      const color = arc.faction === 'allied' ? ALLIED_PARTICLE_COLOR : ENEMY_PARTICLE_COLOR;
      const alpha = arc.faction === 'allied' ? ALLIED_PARTICLE_ALPHA : ENEMY_PARTICLE_ALPHA;
      this.graphics.circle(pos.x, pos.y, PARTICLE_RADIUS);
      this.graphics.fill({ color, alpha });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }

  private buildArcs(): void {
    this.arcs = [];
    this.particles = [];

    const battalions = this.units.filter((u) => !u.isHq);

    for (const facility of this.facilities) {
      const range = SUPPLY_RANGE[facility.kind] ?? 8;
      const fromPx = HexRenderer.hexToPixel(facility.coord);

      for (const unit of battalions) {
        if (unit.faction !== facility.faction) continue;
        const hexDist = HexGrid.distance(facility.coord, unit.coord);
        if (hexDist > range || hexDist === 0) continue;

        const avg = avgSupply(unit);
        const count = demandParticles(avg);
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
          faction: facility.faction,
          baseSpeed: 30 + (1 - hexDist / range) * 30,
        });

        for (let i = 0; i < count; i++) {
          this.particles.push({ arcIndex: arcIdx, t: i / count });
        }
      }
    }
  }
}
