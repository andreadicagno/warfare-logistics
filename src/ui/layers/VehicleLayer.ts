import type { MockVehicle } from '@core/mock/types';
import { Container, Graphics, type Ticker } from 'pixi.js';
import { type BezierSegment, cubicBezierPoint } from '../spline';

const TRUCK_W = 6;
const TRUCK_H = 4;
const TRUCK_CAB_W = 2;
const TRUCK_COLOR = 0x8b7355;
const TRUCK_CAB_COLOR = 0x6b5335;
const TRUCK_BORDER = 0x333333;

const TRAIN_W = 10;
const TRAIN_H = 4;
const WAGON_W = 7;
const WAGON_GAP = 0.03;
const TRAIN_COLOR = 0x555566;
const WAGON_COLOR = 0x666677;
const TRAIN_BORDER = 0x333333;

const MIN_ZOOM_FOR_VEHICLES = 0.5;
const TANGENT_EPSILON = 0.001;

/** Compute the 4 corners of a rectangle rotated around (cx, cy). */
function rotatedRect(cx: number, cy: number, w: number, h: number, angle: number): number[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = w / 2;
  const hh = h / 2;
  return [
    cx + cos * -hw - sin * -hh,
    cy + sin * -hw + cos * -hh,
    cx + cos * hw - sin * -hh,
    cy + sin * hw + cos * -hh,
    cx + cos * hw - sin * hh,
    cy + sin * hw + cos * hh,
    cx + cos * -hw - sin * hh,
    cy + sin * -hw + cos * hh,
  ];
}

/** Evaluate a position on a multi-segment spline at global t in [0, 1]. */
function evaluateSplineAt(
  segments: BezierSegment[],
  globalT: number,
): { x: number; y: number } {
  const n = segments.length;
  const scaled = globalT * n;
  const segIdx = Math.min(Math.floor(scaled), n - 1);
  const localT = scaled - segIdx;
  return cubicBezierPoint(segments[segIdx], Math.min(localT, 1));
}

/** Compute the tangent angle at a position on the spline. */
function computeAngle(
  segments: BezierSegment[],
  t: number,
  direction: 1 | -1,
): number {
  const pos = evaluateSplineAt(segments, t);
  const posAhead = evaluateSplineAt(segments, Math.min(t + TANGENT_EPSILON, 1));
  let angle = Math.atan2(posAhead.y - pos.y, posAhead.x - pos.x);
  if (direction === -1) {
    angle += Math.PI;
  }
  return angle;
}

export class VehicleLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private getZoom: () => number;
  private roadSplines: BezierSegment[][] = [];
  private railwaySplines: BezierSegment[][] = [];

  constructor(getZoom: () => number) {
    this.getZoom = getZoom;
    this.container.addChild(this.graphics);
  }

  init(roadSplines: BezierSegment[][], railwaySplines: BezierSegment[][]): void {
    this.roadSplines = roadSplines;
    this.railwaySplines = railwaySplines;
  }

  update(_ticker: Ticker, vehicles: MockVehicle[]): void {
    this.graphics.clear();

    if (this.getZoom() < MIN_ZOOM_FOR_VEHICLES) {
      return;
    }

    for (const vehicle of vehicles) {
      const splines =
        vehicle.type === 'truck'
          ? this.roadSplines[vehicle.routeIndex]
          : this.railwaySplines[vehicle.routeIndex];

      if (!splines || splines.length === 0) continue;

      if (vehicle.type === 'truck') {
        this.drawTruck(splines, vehicle.t, vehicle.direction);
      } else {
        this.drawTrain(splines, vehicle.t, vehicle.direction);
      }
    }
  }

  private drawTruck(
    splines: BezierSegment[],
    t: number,
    direction: 1 | -1,
  ): void {
    const pos = evaluateSplineAt(splines, t);
    const angle = computeAngle(splines, t, direction);

    // Body rectangle
    const body = rotatedRect(pos.x, pos.y, TRUCK_W, TRUCK_H, angle);
    this.graphics.poly(body);
    this.graphics.fill({ color: TRUCK_COLOR });
    this.graphics.poly(body);
    this.graphics.stroke({ width: 0.5, color: TRUCK_BORDER });

    // Cab at front: offset forward by half body + half cab
    const cabOffset = (TRUCK_W + TRUCK_CAB_W) / 2;
    const cabX = pos.x + Math.cos(angle) * cabOffset;
    const cabY = pos.y + Math.sin(angle) * cabOffset;
    const cab = rotatedRect(cabX, cabY, TRUCK_CAB_W, TRUCK_H, angle);
    this.graphics.poly(cab);
    this.graphics.fill({ color: TRUCK_CAB_COLOR });
    this.graphics.poly(cab);
    this.graphics.stroke({ width: 0.5, color: TRUCK_BORDER });
  }

  private drawTrain(
    splines: BezierSegment[],
    t: number,
    direction: 1 | -1,
  ): void {
    // Engine
    const enginePos = evaluateSplineAt(splines, t);
    const engineAngle = computeAngle(splines, t, direction);
    this.drawRotatedBox(enginePos.x, enginePos.y, TRAIN_W, TRAIN_H, engineAngle, TRAIN_COLOR);

    // Wagons trailing behind (opposite to direction of travel)
    const wagonCount = 2;
    for (let i = 1; i <= wagonCount; i++) {
      const wagonT = t - direction * WAGON_GAP * i;
      if (wagonT < 0 || wagonT > 1) continue;

      const wagonPos = evaluateSplineAt(splines, wagonT);
      const wagonAngle = computeAngle(splines, wagonT, direction);
      this.drawRotatedBox(
        wagonPos.x,
        wagonPos.y,
        WAGON_W,
        TRAIN_H,
        wagonAngle,
        WAGON_COLOR,
      );
    }
  }

  private drawRotatedBox(
    cx: number,
    cy: number,
    w: number,
    h: number,
    angle: number,
    color: number,
  ): void {
    const corners = rotatedRect(cx, cy, w, h, angle);
    this.graphics.poly(corners);
    this.graphics.fill({ color });
    this.graphics.poly(corners);
    this.graphics.stroke({ width: 0.5, color: TRAIN_BORDER });
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
