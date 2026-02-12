import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import type { AccessRamp, RouteHealth } from '@core/mock/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';
import { type BezierSegment, catmullRomToBezier, cubicBezierPoint } from '../spline';

// Level 1: Trail
const TRAIL_COLOR = 0xc2a66c;
const TRAIL_WIDTH = 2;
const TRAIL_DASH_LENGTH = 6;
const TRAIL_GAP_LENGTH = 4;

// Level 2: Road
const ROAD_BORDER_COLOR = 0x4a3f2f;
const ROAD_FILL_COLOR = 0xc2ae6c;
const ROAD_BORDER_WIDTH = 5;
const ROAD_FILL_WIDTH = 3;

// Level 3: Dual carriageway
const DUAL_COLOR = 0x999999;
const DUAL_WIDTH = 3;
const DUAL_OFFSET = 2;

// Level 4: Railway
const RAILWAY_BORDER_COLOR = 0x2a2a35;
const RAILWAY_FILL_COLOR = 0x8888a0;
const RAILWAY_BORDER_WIDTH = 5;
const RAILWAY_FILL_WIDTH = 3;
const RAILWAY_TIE_COLOR = 0x2a2a35;
const TIE_LENGTH = 6;
const TIE_SPACING = 10;

// Level 5: Logistics corridor (rail + road side by side)
const CORRIDOR_OFFSET = 3;

const BEZIER_SAMPLES_PER_SEGMENT = 20;
const BRIDGE_COLOR = 0x8b7355;
const BRIDGE_WIDTH = 8;
const BRIDGE_HEIGHT = 4;

const HEALTH_COLORS: Record<RouteHealth, number> = {
  good: 0x4a8c3f,
  congested: 0xc8a832,
  stressed: 0xb83a3a,
  destroyed: 0x666666,
};

/** Estimate the arc length of a single Bezier segment by summing chord distances. */
function estimateSegmentLength(seg: BezierSegment, samples: number): number {
  let length = 0;
  let prev = cubicBezierPoint(seg, 0);
  for (let i = 1; i <= samples; i++) {
    const pt = cubicBezierPoint(seg, i / samples);
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    length += Math.sqrt(dx * dx + dy * dy);
    prev = pt;
  }
  return length;
}

export class SupplyLineLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;
  private builtVersion = -1;
  private healths: Map<number, RouteHealth>;
  private accessRamps: AccessRamp[] = [];
  private splines: BezierSegment[][] = [];

  get computedSplines(): BezierSegment[][] {
    return this.splines;
  }

  constructor(gameMap: GameMap, healths: Map<number, RouteHealth>, accessRamps?: AccessRamp[]) {
    this.gameMap = gameMap;
    this.healths = healths;
    this.accessRamps = accessRamps ?? [];
    this.container.addChild(this.graphics);
  }

  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();

    this.drawSupplyLines();
    this.drawAccessRamps();
  }

  updateData(healths: Map<number, RouteHealth>, accessRamps?: AccessRamp[]): void {
    this.healths = healths;
    if (accessRamps) this.accessRamps = accessRamps;
  }

  private drawSupplyLines(): void {
    // Compute splines for all supply lines
    const allData: { segments: BezierSegment[]; hexes: HexCoord[]; level: number }[] = [];

    for (const line of this.gameMap.supplyLines) {
      if (line.hexes.length < 2) continue;
      const points = line.hexes.map((h) => HexRenderer.hexToPixel(h));
      allData.push({ segments: catmullRomToBezier(points), hexes: line.hexes, level: line.level });
    }

    this.splines = allData.map((s) => s.segments);

    // Draw each supply line based on its level
    for (let i = 0; i < allData.length; i++) {
      const { segments, hexes, level } = allData[i];
      const health = this.healths.get(i);
      const healthColor = health ? HEALTH_COLORS[health] : null;
      const alpha = health === 'destroyed' ? 0.5 : 1;

      switch (level) {
        case 1:
          this.drawTrail(segments, healthColor ?? TRAIL_COLOR, alpha);
          break;
        case 2:
          this.drawRoad(segments, healthColor, alpha);
          break;
        case 3:
          this.drawDualCarriageway(segments, healthColor ?? DUAL_COLOR, alpha);
          break;
        case 4:
          this.drawRailway(segments, healthColor, alpha);
          break;
        case 5:
          this.drawLogisticsCorridor(segments, healthColor, alpha);
          break;
      }

      this.drawBridges(hexes);
    }
  }

  /** Level 1: Dashed thin trail line. */
  private drawTrail(segments: BezierSegment[], color: number, alpha: number): void {
    for (const seg of segments) {
      const segLength = estimateSegmentLength(seg, BEZIER_SAMPLES_PER_SEGMENT);
      const totalDash = TRAIL_DASH_LENGTH + TRAIL_GAP_LENGTH;
      const dashCount = Math.ceil(segLength / totalDash);

      for (let d = 0; d < dashCount; d++) {
        const tStart = (d * totalDash) / segLength;
        const tEnd = Math.min((d * totalDash + TRAIL_DASH_LENGTH) / segLength, 1);
        if (tStart >= 1) break;

        const p0 = cubicBezierPoint(seg, tStart);
        const p1 = cubicBezierPoint(seg, tEnd);
        this.graphics.moveTo(p0.x, p0.y);
        this.graphics.lineTo(p1.x, p1.y);
        this.graphics.stroke({ width: TRAIL_WIDTH, color, alpha });
      }
    }
  }

  /** Level 2: Solid road with border. */
  private drawRoad(segments: BezierSegment[], healthColor: number | null, alpha: number): void {
    this.drawBezierPath(segments, ROAD_BORDER_WIDTH, ROAD_BORDER_COLOR, alpha);
    this.drawBezierPath(segments, ROAD_FILL_WIDTH, healthColor ?? ROAD_FILL_COLOR, alpha);
  }

  /** Level 3: Two parallel lines. */
  private drawDualCarriageway(segments: BezierSegment[], color: number, alpha: number): void {
    const offsetA = this.offsetBezierSegments(segments, +DUAL_OFFSET);
    const offsetB = this.offsetBezierSegments(segments, -DUAL_OFFSET);
    this.drawBezierPath(offsetA, DUAL_WIDTH, 0x666666, alpha);
    this.drawBezierPath(offsetA, DUAL_WIDTH - 2, color, alpha);
    this.drawBezierPath(offsetB, DUAL_WIDTH, 0x666666, alpha);
    this.drawBezierPath(offsetB, DUAL_WIDTH - 2, color, alpha);
  }

  /** Level 4: Railway with crossties. */
  private drawRailway(segments: BezierSegment[], healthColor: number | null, alpha: number): void {
    this.drawBezierPath(segments, RAILWAY_BORDER_WIDTH, RAILWAY_BORDER_COLOR, alpha);
    this.drawBezierPath(segments, RAILWAY_FILL_WIDTH, healthColor ?? RAILWAY_FILL_COLOR, alpha);
    this.drawCrossties(segments);
  }

  /** Level 5: Railway + road side by side. */
  private drawLogisticsCorridor(
    segments: BezierSegment[],
    healthColor: number | null,
    alpha: number,
  ): void {
    const railSegs = this.offsetBezierSegments(segments, +CORRIDOR_OFFSET);
    const roadSegs = this.offsetBezierSegments(segments, -CORRIDOR_OFFSET);

    // Railway side
    this.drawBezierPath(railSegs, RAILWAY_BORDER_WIDTH, RAILWAY_BORDER_COLOR, alpha);
    this.drawBezierPath(railSegs, RAILWAY_FILL_WIDTH, healthColor ?? RAILWAY_FILL_COLOR, alpha);
    this.drawCrossties(railSegs);

    // Road side
    this.drawBezierPath(roadSegs, ROAD_BORDER_WIDTH, ROAD_BORDER_COLOR, alpha);
    this.drawBezierPath(roadSegs, ROAD_FILL_WIDTH, healthColor ?? ROAD_FILL_COLOR, alpha);
  }

  /** Offset a set of bezier segments laterally by `offset` pixels. */
  private offsetBezierSegments(segments: BezierSegment[], offset: number): BezierSegment[] {
    return segments.map((seg) => {
      const offsetPoint = (t: number): { x: number; y: number } => {
        const pt = cubicBezierPoint(seg, t);
        const ptAhead = cubicBezierPoint(seg, Math.min(t + 0.001, 1));
        const dx = ptAhead.x - pt.x;
        const dy = ptAhead.y - pt.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return pt;
        const nx = -dy / len;
        const ny = dx / len;
        return { x: pt.x + nx * offset, y: pt.y + ny * offset };
      };
      return {
        p0: offsetPoint(0),
        p1: offsetPoint(1 / 3),
        p2: offsetPoint(2 / 3),
        p3: offsetPoint(1),
      };
    });
  }

  private drawBezierPath(segments: BezierSegment[], width: number, color: number, alpha = 1): void {
    if (segments.length === 0) return;
    this.graphics.moveTo(segments[0].p0.x, segments[0].p0.y);
    for (const seg of segments) {
      this.graphics.bezierCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y);
    }
    this.graphics.stroke({ width, color, alpha });
  }

  private drawBridges(hexes: HexCoord[]): void {
    for (const hex of hexes) {
      const cell = this.gameMap.cells.get(HexGrid.key(hex));
      if (cell?.terrain === TerrainType.River) {
        const px = HexRenderer.hexToPixel(hex);
        this.graphics.rect(
          px.x - BRIDGE_WIDTH / 2,
          px.y - BRIDGE_HEIGHT / 2,
          BRIDGE_WIDTH,
          BRIDGE_HEIGHT,
        );
        this.graphics.fill({ color: BRIDGE_COLOR });
      }
    }
  }

  /** Draw perpendicular crossties along Bezier segments at regular intervals. */
  private drawCrossties(segments: BezierSegment[]): void {
    const epsilon = 0.001;

    for (const seg of segments) {
      const segLength = estimateSegmentLength(seg, BEZIER_SAMPLES_PER_SEGMENT);
      const tieCount = Math.floor(segLength / TIE_SPACING);

      for (let i = 1; i <= tieCount; i++) {
        const t = Math.min(i / (tieCount + 1), 1 - epsilon);
        const pt = cubicBezierPoint(seg, t);
        const ptAhead = cubicBezierPoint(seg, t + epsilon);

        const tx = ptAhead.x - pt.x;
        const ty = ptAhead.y - pt.y;
        const tLen = Math.sqrt(tx * tx + ty * ty);
        if (tLen === 0) continue;

        const nx = -ty / tLen;
        const ny = tx / tLen;

        const half = TIE_LENGTH / 2;
        this.graphics.moveTo(pt.x - nx * half, pt.y - ny * half);
        this.graphics.lineTo(pt.x + nx * half, pt.y + ny * half);
        this.graphics.stroke({ width: 1, color: RAILWAY_TIE_COLOR });
      }
    }
  }

  private drawAccessRamps(): void {
    for (const ramp of this.accessRamps) {
      const from = HexRenderer.hexToPixel(ramp.facilityCoord);
      const to = HexRenderer.hexToPixel(ramp.routeHexCoord);

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const offset = len * 0.2;
      const cx = mx - (dy / len) * offset;
      const cy = my + (dx / len) * offset;

      // Use road styling for all ramps
      const borderWidth = Math.round(ROAD_BORDER_WIDTH * 0.7);
      const fillWidth = Math.round(ROAD_FILL_WIDTH * 0.7);

      this.graphics.moveTo(from.x, from.y);
      this.graphics.quadraticCurveTo(cx, cy, to.x, to.y);
      this.graphics.stroke({ width: borderWidth, color: ROAD_BORDER_COLOR });

      this.graphics.moveTo(from.x, from.y);
      this.graphics.quadraticCurveTo(cx, cy, to.x, to.y);
      this.graphics.stroke({ width: fillWidth, color: ROAD_FILL_COLOR });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
