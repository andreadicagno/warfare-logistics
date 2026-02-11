import { HexGrid } from '@core/map/HexGrid';
import type { GameMap } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';
import { type BezierSegment, catmullRomToBezier, cubicBezierPoint } from '../spline';

const ROAD_COLOR = 0x6b5a40;
const ROAD_WIDTH = 2;
const RAILWAY_COLOR = 0x3a3a45;
const RAILWAY_WIDTH = 3;
const TIE_LENGTH = 6;
const TIE_SPACING = 10;
const ROAD_DASH = 6;
const ROAD_GAP = 4;
const BEZIER_SAMPLES_PER_SEGMENT = 20;
const BRIDGE_COLOR = 0x8b7355;
const BRIDGE_WIDTH = 8;
const BRIDGE_HEIGHT = 4;

/** Sample a sequence of Bezier segments into a polyline of evenly-spaced points. */
function sampleBezierPath(
  segments: BezierSegment[],
  samplesPerSegment: number,
): { x: number; y: number }[] {
  if (segments.length === 0) return [];
  const result: { x: number; y: number }[] = [{ x: segments[0].p0.x, y: segments[0].p0.y }];
  for (const seg of segments) {
    for (let i = 1; i <= samplesPerSegment; i++) {
      result.push(cubicBezierPoint(seg, i / samplesPerSegment));
    }
  }
  return result;
}

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

export class RouteLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.container.addChild(this.graphics);
  }

  build(_bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    this.graphics.clear();
    this.drawRoads();
    this.drawRailways();
  }

  private drawRoads(): void {
    for (const route of this.gameMap.roads) {
      if (route.hexes.length < 2) continue;
      const points = route.hexes.map((h) => HexRenderer.hexToPixel(h));
      const segments = catmullRomToBezier(points);

      const sampled = sampleBezierPath(segments, BEZIER_SAMPLES_PER_SEGMENT);
      this.drawDashedPolyline(sampled, ROAD_DASH, ROAD_GAP, ROAD_WIDTH, ROAD_COLOR);

      this.drawBridges(route.hexes);
    }
  }

  private drawRailways(): void {
    for (const route of this.gameMap.railways) {
      if (route.hexes.length < 2) continue;
      const points = route.hexes.map((h) => HexRenderer.hexToPixel(h));
      const segments = catmullRomToBezier(points);

      // Main track: smooth Bezier curves
      if (segments.length > 0) {
        this.graphics.moveTo(segments[0].p0.x, segments[0].p0.y);
        for (const seg of segments) {
          this.graphics.bezierCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y);
        }
        this.graphics.stroke({ width: RAILWAY_WIDTH, color: RAILWAY_COLOR });
      }

      this.drawBridges(route.hexes);

      // Crossties: sample along curve and draw perpendicular ties
      this.drawCrossties(segments);
    }
  }

  private drawBridges(hexes: { q: number; r: number }[]): void {
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

  /** Draw a dashed line along a sampled polyline of pixel coordinates. */
  private drawDashedPolyline(
    sampled: { x: number; y: number }[],
    dashLength: number,
    gapLength: number,
    width: number,
    color: number,
  ): void {
    if (sampled.length < 2) return;

    let drawing = true;
    let remaining = dashLength;
    this.graphics.moveTo(sampled[0].x, sampled[0].y);

    for (let i = 1; i < sampled.length; i++) {
      const prev = sampled[i - 1];
      const curr = sampled[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen === 0) continue;

      let consumed = 0;
      while (consumed < segLen) {
        const available = segLen - consumed;
        const step = Math.min(remaining, available);
        const frac = (consumed + step) / segLen;
        const px = prev.x + dx * frac;
        const py = prev.y + dy * frac;

        if (drawing) {
          this.graphics.lineTo(px, py);
        } else {
          this.graphics.moveTo(px, py);
        }

        remaining -= step;
        consumed += step;

        if (remaining <= 0) {
          if (drawing) {
            this.graphics.stroke({ width, color });
          }
          drawing = !drawing;
          remaining = drawing ? dashLength : gapLength;
        }
      }
    }

    // Flush any remaining dash segment
    if (drawing) {
      this.graphics.stroke({ width, color });
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

        // Tangent direction
        const tx = ptAhead.x - pt.x;
        const ty = ptAhead.y - pt.y;
        const tLen = Math.sqrt(tx * tx + ty * ty);
        if (tLen === 0) continue;

        // Normal (perpendicular)
        const nx = -ty / tLen;
        const ny = tx / tLen;

        const half = TIE_LENGTH / 2;
        this.graphics.moveTo(pt.x - nx * half, pt.y - ny * half);
        this.graphics.lineTo(pt.x + nx * half, pt.y + ny * half);
        this.graphics.stroke({ width: 1, color: RAILWAY_COLOR });
      }
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
