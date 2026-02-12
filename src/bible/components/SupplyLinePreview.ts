import { Application, Graphics } from 'pixi.js';
import { type ComponentFactory, registerComponent } from '../mountComponent';

// Replicated constants from SupplyLineLayer
const TRAIL_COLOR = 0xc2a66c;
const TRAIL_WIDTH = 2;
const TRAIL_DASH = 6;
const TRAIL_GAP = 4;

const ROAD_BORDER_COLOR = 0x4a3f2f;
const ROAD_FILL_COLOR = 0xc2ae6c;
const ROAD_BORDER_WIDTH = 5;
const ROAD_FILL_WIDTH = 3;

const DUAL_COLOR = 0x999999;
const DUAL_WIDTH = 3;
const DUAL_OFFSET = 2;

const RAILWAY_BORDER_COLOR = 0x2a2a35;
const RAILWAY_FILL_COLOR = 0x8888a0;
const RAILWAY_BORDER_WIDTH = 5;
const RAILWAY_FILL_WIDTH = 3;
const RAILWAY_TIE_COLOR = 0x2a2a35;
const TIE_LENGTH = 6;
const TIE_SPACING = 10;

const CORRIDOR_OFFSET = 3;

const HEALTH_COLORS: Record<string, number> = {
  good: 0x4a8c3f,
  congested: 0xc8a832,
  stressed: 0xb83a3a,
  destroyed: 0x666666,
};

const CANVAS_W = 400;
const CANVAS_H = 80;

// Bezier control points
const P0 = { x: 40, y: 50 };
const CP = { x: 200, y: 15 };
const P1 = { x: 360, y: 50 };

interface Point {
  x: number;
  y: number;
}

function quadBezier(t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * P0.x + 2 * mt * t * CP.x + t * t * P1.x,
    y: mt * mt * P0.y + 2 * mt * t * CP.y + t * t * P1.y,
  };
}

function quadBezierTangent(t: number): Point {
  return {
    x: 2 * (1 - t) * (CP.x - P0.x) + 2 * t * (P1.x - CP.x),
    y: 2 * (1 - t) * (CP.y - P0.y) + 2 * t * (P1.y - CP.y),
  };
}

function normalAt(t: number): Point {
  const tan = quadBezierTangent(t);
  const len = Math.sqrt(tan.x * tan.x + tan.y * tan.y);
  return { x: -tan.y / len, y: tan.x / len };
}

function offsetPoint(t: number, offset: number): Point {
  const pt = quadBezier(t);
  const n = normalAt(t);
  return { x: pt.x + n.x * offset, y: pt.y + n.y * offset };
}

function drawCurve(g: Graphics, samples: number, offsetVal = 0): void {
  const p = offsetVal === 0 ? quadBezier(0) : offsetPoint(0, offsetVal);
  g.moveTo(p.x, p.y);
  for (let i = 1; i <= samples; i++) {
    const pt = offsetVal === 0 ? quadBezier(i / samples) : offsetPoint(i / samples, offsetVal);
    g.lineTo(pt.x, pt.y);
  }
}

function estimateLength(samples: number): number {
  let len = 0;
  let prev = quadBezier(0);
  for (let i = 1; i <= samples; i++) {
    const pt = quadBezier(i / samples);
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    len += Math.sqrt(dx * dx + dy * dy);
    prev = pt;
  }
  return len;
}

function drawLevel(g: Graphics, level: number, health: string | null): void {
  g.clear();

  const healthColor = health ? (HEALTH_COLORS[health] ?? null) : null;
  const alpha = health === 'destroyed' ? 0.5 : 1;
  const samples = 60;

  switch (level) {
    case 1: {
      // Dashed trail
      const color = healthColor ?? TRAIL_COLOR;
      let prevPt = quadBezier(0);
      let inDash = true;
      let segDist = 0;

      g.moveTo(prevPt.x, prevPt.y);
      for (let i = 1; i <= samples; i++) {
        const pt = quadBezier(i / samples);
        const dx = pt.x - prevPt.x;
        const dy = pt.y - prevPt.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        segDist += d;

        const threshold = inDash ? TRAIL_DASH : TRAIL_GAP;
        if (segDist >= threshold) {
          if (inDash) {
            g.lineTo(pt.x, pt.y);
            g.stroke({ width: TRAIL_WIDTH, color, alpha });
          }
          g.moveTo(pt.x, pt.y);
          inDash = !inDash;
          segDist = 0;
        } else if (inDash) {
          g.lineTo(pt.x, pt.y);
        }
        prevPt = pt;
      }
      if (inDash && segDist > 0) {
        g.stroke({ width: TRAIL_WIDTH, color, alpha });
      }
      break;
    }
    case 2: {
      // Bordered road
      drawCurve(g, samples);
      g.stroke({ width: ROAD_BORDER_WIDTH, color: ROAD_BORDER_COLOR, alpha });
      drawCurve(g, samples);
      g.stroke({ width: ROAD_FILL_WIDTH, color: healthColor ?? ROAD_FILL_COLOR, alpha });
      break;
    }
    case 3: {
      // Dual carriageway
      const color = healthColor ?? DUAL_COLOR;
      drawCurve(g, samples, +DUAL_OFFSET);
      g.stroke({ width: DUAL_WIDTH, color: 0x666666, alpha });
      drawCurve(g, samples, +DUAL_OFFSET);
      g.stroke({ width: DUAL_WIDTH - 2, color, alpha });
      drawCurve(g, samples, -DUAL_OFFSET);
      g.stroke({ width: DUAL_WIDTH, color: 0x666666, alpha });
      drawCurve(g, samples, -DUAL_OFFSET);
      g.stroke({ width: DUAL_WIDTH - 2, color, alpha });
      break;
    }
    case 4: {
      // Railway with crossties
      drawCurve(g, samples);
      g.stroke({ width: RAILWAY_BORDER_WIDTH, color: RAILWAY_BORDER_COLOR, alpha });
      drawCurve(g, samples);
      g.stroke({ width: RAILWAY_FILL_WIDTH, color: healthColor ?? RAILWAY_FILL_COLOR, alpha });
      // Crossties
      const totalLen = estimateLength(samples);
      const tieCount = Math.floor(totalLen / TIE_SPACING);
      for (let i = 1; i <= tieCount; i++) {
        const t = i / (tieCount + 1);
        const pt = quadBezier(t);
        const n = normalAt(t);
        const half = TIE_LENGTH / 2;
        g.moveTo(pt.x - n.x * half, pt.y - n.y * half);
        g.lineTo(pt.x + n.x * half, pt.y + n.y * half);
        g.stroke({ width: 1, color: RAILWAY_TIE_COLOR, alpha });
      }
      break;
    }
    case 5: {
      // Corridor: rail offset one side, road offset other
      // Railway side
      drawCurve(g, samples, +CORRIDOR_OFFSET);
      g.stroke({ width: RAILWAY_BORDER_WIDTH, color: RAILWAY_BORDER_COLOR, alpha });
      drawCurve(g, samples, +CORRIDOR_OFFSET);
      g.stroke({
        width: RAILWAY_FILL_WIDTH,
        color: healthColor ?? RAILWAY_FILL_COLOR,
        alpha,
      });
      // Rail crossties
      const corridorLen = estimateLength(samples);
      const corridorTieCount = Math.floor(corridorLen / TIE_SPACING);
      for (let i = 1; i <= corridorTieCount; i++) {
        const t = i / (corridorTieCount + 1);
        const pt = offsetPoint(t, +CORRIDOR_OFFSET);
        const n = normalAt(t);
        const half = TIE_LENGTH / 2;
        g.moveTo(pt.x - n.x * half, pt.y - n.y * half);
        g.lineTo(pt.x + n.x * half, pt.y + n.y * half);
        g.stroke({ width: 1, color: RAILWAY_TIE_COLOR, alpha });
      }
      // Road side
      drawCurve(g, samples, -CORRIDOR_OFFSET);
      g.stroke({ width: ROAD_BORDER_WIDTH, color: ROAD_BORDER_COLOR, alpha });
      drawCurve(g, samples, -CORRIDOR_OFFSET);
      g.stroke({ width: ROAD_FILL_WIDTH, color: healthColor ?? ROAD_FILL_COLOR, alpha });
      break;
    }
  }
}

const factory: ComponentFactory = async (container, props) => {
  const level = Number(props.level) || 1;

  const app = new Application();
  await app.init({
    width: CANVAS_W,
    height: CANVAS_H,
    background: 0x12121e,
    antialias: true,
  });

  container.appendChild(app.canvas);

  const g = new Graphics();
  app.stage.addChild(g);

  let currentHealth: string | null = null;
  drawLevel(g, level, currentHealth);

  // Health dropdown control
  const controls = document.createElement('div');
  controls.className = 'controls';

  const label = document.createElement('label');
  label.textContent = 'Health:';

  const select = document.createElement('select');
  for (const opt of ['none', 'good', 'congested', 'stressed', 'destroyed']) {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    currentHealth = select.value === 'none' ? null : select.value;
    drawLevel(g, level, currentHealth);
  });

  label.appendChild(select);
  controls.appendChild(label);
  container.appendChild(controls);

  return () => {
    app.destroy(true, { children: true });
  };
};

registerComponent('supply-line', factory);
