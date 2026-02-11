import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import type { RouteHealth } from '@core/mock/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';
import { type BezierSegment, catmullRomToBezier, cubicBezierPoint } from '../spline';

const ROAD_BORDER_COLOR = 0x4a3f2f;
const ROAD_FILL_COLOR = 0xc2ae6c;
const ROAD_BORDER_WIDTH = 5;
const ROAD_FILL_WIDTH = 3;
const RAILWAY_BORDER_COLOR = 0x2a2a35;
const RAILWAY_FILL_COLOR = 0x8888a0;
const RAILWAY_BORDER_WIDTH = 5;
const RAILWAY_FILL_WIDTH = 3;
const RAILWAY_TIE_COLOR = 0x2a2a35;
const TIE_LENGTH = 6;
const TIE_SPACING = 10;
const BEZIER_SAMPLES_PER_SEGMENT = 20;
const SHARED_EDGE_OFFSET = 3;
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

/** Canonical string key for a hex edge (order-independent). */
function canonicalEdgeKey(a: HexCoord, b: HexCoord): string {
  if (a.q < b.q || (a.q === b.q && a.r <= b.r)) {
    return `${a.q},${a.r}|${b.q},${b.r}`;
  }
  return `${b.q},${b.r}|${a.q},${a.r}`;
}

export class RouteLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private gameMap: GameMap;
  private builtVersion = -1;
  private roadHealths: Map<number, RouteHealth>;
  private railwayHealths: Map<number, RouteHealth>;
  private roadSplines: BezierSegment[][] = [];
  private railwaySplines: BezierSegment[][] = [];

  get computedRoadSplines(): BezierSegment[][] {
    return this.roadSplines;
  }

  get computedRailwaySplines(): BezierSegment[][] {
    return this.railwaySplines;
  }

  constructor(
    gameMap: GameMap,
    roadHealths?: Map<number, RouteHealth>,
    railwayHealths?: Map<number, RouteHealth>,
  ) {
    this.gameMap = gameMap;
    this.roadHealths = roadHealths ?? new Map();
    this.railwayHealths = railwayHealths ?? new Map();
    this.container.addChild(this.graphics);
  }

  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();

    const sharedEdges = this.computeSharedEdges();
    this.drawRoads(sharedEdges);
    this.drawRailways(sharedEdges);
  }

  updateData(
    roadHealths: Map<number, RouteHealth>,
    railwayHealths: Map<number, RouteHealth>,
  ): void {
    this.roadHealths = roadHealths;
    this.railwayHealths = railwayHealths;
  }

  /** Find hex edges that both a road and a railway traverse. */
  private computeSharedEdges(): Set<string> {
    const roadEdges = new Set<string>();
    for (const route of this.gameMap.roads) {
      for (let i = 0; i < route.hexes.length - 1; i++) {
        roadEdges.add(canonicalEdgeKey(route.hexes[i], route.hexes[i + 1]));
      }
    }
    const shared = new Set<string>();
    for (const route of this.gameMap.railways) {
      for (let i = 0; i < route.hexes.length - 1; i++) {
        const key = canonicalEdgeKey(route.hexes[i], route.hexes[i + 1]);
        if (roadEdges.has(key)) shared.add(key);
      }
    }
    return shared;
  }

  /**
   * Convert hex path to pixel points, offsetting laterally on shared edges.
   * `side` is +1 (offset right of travel direction) or -1 (offset left).
   */
  private offsetPathPoints(
    hexes: HexCoord[],
    sharedEdges: Set<string>,
    side: number,
  ): { x: number; y: number }[] {
    const centers = hexes.map((h) => HexRenderer.hexToPixel(h));
    const result: { x: number; y: number }[] = [];

    for (let i = 0; i < centers.length; i++) {
      // Check if the edge before or after this point is shared
      const prevShared = i > 0 && sharedEdges.has(canonicalEdgeKey(hexes[i - 1], hexes[i]));
      const nextShared =
        i < hexes.length - 1 && sharedEdges.has(canonicalEdgeKey(hexes[i], hexes[i + 1]));

      if (!prevShared && !nextShared) {
        result.push(centers[i]);
        continue;
      }

      // Compute tangent as average of incoming and outgoing directions
      let tx = 0;
      let ty = 0;
      if (i > 0) {
        tx += centers[i].x - centers[i - 1].x;
        ty += centers[i].y - centers[i - 1].y;
      }
      if (i < centers.length - 1) {
        tx += centers[i + 1].x - centers[i].x;
        ty += centers[i + 1].y - centers[i].y;
      }
      const tLen = Math.sqrt(tx * tx + ty * ty);
      if (tLen === 0) {
        result.push(centers[i]);
        continue;
      }

      // Normal (perpendicular to tangent, pointing right of travel when side=+1)
      const nx = -ty / tLen;
      const ny = tx / tLen;

      result.push({
        x: centers[i].x + nx * side * SHARED_EDGE_OFFSET,
        y: centers[i].y + ny * side * SHARED_EDGE_OFFSET,
      });
    }
    return result;
  }

  private drawRoads(sharedEdges: Set<string>): void {
    // Draw all road borders first, then all fills on top,
    // so fills aren't interrupted by borders of adjacent roads
    const allSegments: { segments: BezierSegment[]; hexes: HexCoord[] }[] = [];

    for (const route of this.gameMap.roads) {
      if (route.hexes.length < 2) continue;
      const points = this.offsetPathPoints(route.hexes, sharedEdges, +1);
      allSegments.push({ segments: catmullRomToBezier(points), hexes: route.hexes });
    }

    this.roadSplines = allSegments.map((s) => s.segments);

    // Pass 1: dark border
    for (const { segments } of allSegments) {
      this.drawBezierPath(segments, ROAD_BORDER_WIDTH, ROAD_BORDER_COLOR);
    }

    // Pass 2: health-colored fill (per route)
    for (let i = 0; i < allSegments.length; i++) {
      const health = this.roadHealths.get(i);
      const fillColor = health ? HEALTH_COLORS[health] : ROAD_FILL_COLOR;
      const alpha = health === 'destroyed' ? 0.5 : 1;
      this.drawBezierPath(allSegments[i].segments, ROAD_FILL_WIDTH, fillColor, alpha);
    }

    // Bridges
    for (const { hexes } of allSegments) {
      this.drawBridges(hexes);
    }
  }

  private drawBezierPath(segments: BezierSegment[], width: number, color: number, alpha = 1): void {
    if (segments.length === 0) return;
    this.graphics.moveTo(segments[0].p0.x, segments[0].p0.y);
    for (const seg of segments) {
      this.graphics.bezierCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y);
    }
    this.graphics.stroke({ width, color, alpha });
  }

  private drawRailways(sharedEdges: Set<string>): void {
    const allSegments: { segments: BezierSegment[]; hexes: HexCoord[] }[] = [];

    for (const route of this.gameMap.railways) {
      if (route.hexes.length < 2) continue;
      const points = this.offsetPathPoints(route.hexes, sharedEdges, -1);
      allSegments.push({ segments: catmullRomToBezier(points), hexes: route.hexes });
    }

    this.railwaySplines = allSegments.map((s) => s.segments);

    // Pass 1: dark border
    for (const { segments } of allSegments) {
      this.drawBezierPath(segments, RAILWAY_BORDER_WIDTH, RAILWAY_BORDER_COLOR);
    }

    // Pass 2: health-colored fill (per route)
    for (let i = 0; i < allSegments.length; i++) {
      const health = this.railwayHealths.get(i);
      const fillColor = health ? HEALTH_COLORS[health] : RAILWAY_FILL_COLOR;
      const alpha = health === 'destroyed' ? 0.5 : 1;
      this.drawBezierPath(allSegments[i].segments, RAILWAY_FILL_WIDTH, fillColor, alpha);
    }

    // Bridges
    for (const { hexes } of allSegments) {
      this.drawBridges(hexes);
    }

    // Crossties on top
    for (const { segments } of allSegments) {
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
        this.graphics.stroke({ width: 1, color: RAILWAY_TIE_COLOR });
      }
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
