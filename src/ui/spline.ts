export interface Point {
  x: number;
  y: number;
}

export interface BezierSegment {
  p0: Point; // start
  p1: Point; // control 1
  p2: Point; // control 2
  p3: Point; // end
}

/**
 * Convert a polyline to cubic Bezier segments via Catmull-Rom interpolation.
 * The curve passes through all input points.
 */
export function catmullRomToBezier(points: Point[]): BezierSegment[] {
  if (points.length < 2) return [];

  const segments: BezierSegment[] = [];

  // Extend with virtual endpoints for open curve
  const extended = [
    { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y },
    ...points,
    {
      x: 2 * points[points.length - 1].x - points[points.length - 2].x,
      y: 2 * points[points.length - 1].y - points[points.length - 2].y,
    },
  ];

  for (let i = 0; i < extended.length - 3; i++) {
    const p0 = extended[i];
    const p1 = extended[i + 1];
    const p2 = extended[i + 2];
    const p3 = extended[i + 3];

    segments.push({
      p0: { x: p1.x, y: p1.y },
      p1: {
        x: p1.x + (p2.x - p0.x) / 6,
        y: p1.y + (p2.y - p0.y) / 6,
      },
      p2: {
        x: p2.x - (p3.x - p1.x) / 6,
        y: p2.y - (p3.y - p1.y) / 6,
      },
      p3: { x: p2.x, y: p2.y },
    });
  }

  return segments;
}

/** Evaluate a cubic Bezier at parameter t in [0, 1] */
export function cubicBezierPoint(seg: BezierSegment, t: number): Point {
  const u = 1 - t;
  const uu = u * u;
  const uuu = uu * u;
  const tt = t * t;
  const ttt = tt * t;
  return {
    x: uuu * seg.p0.x + 3 * uu * t * seg.p1.x + 3 * u * tt * seg.p2.x + ttt * seg.p3.x,
    y: uuu * seg.p0.y + 3 * uu * t * seg.p1.y + 3 * u * tt * seg.p2.y + ttt * seg.p3.y,
  };
}
