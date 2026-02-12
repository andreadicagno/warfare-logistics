import { Application, Container, Graphics } from 'pixi.js';
import { type ComponentFactory, registerComponent } from '../mountComponent';

const GRID_COLS = 8;
const GRID_ROWS = 6;
const HEX_SIZE = 20;
const ALLIED_COLOR = 0x4488cc;
const ENEMY_COLOR = 0xcc4444;
const PLAINS_BG = 0x8a9e5e;
const FRONT_COL = 4;
const FRONT_LINE_COLOR = 0xffffff;
const FRONT_BORDER_COLOR = 0x222222;
const FRONT_LINE_WIDTH = 3;
const FRONT_BORDER_WIDTH = 5;
const ALPHA_MAX = 0.6;
const ALPHA_STEP = 0.07;
const ALPHA_MIN = 0.1;

const CANVAS_W = 400;
const CANVAS_H = 200;

interface HexPos {
  col: number;
  row: number;
  px: number;
  py: number;
}

function hexToPixel(col: number, row: number): { px: number; py: number } {
  const w = HEX_SIZE * 2;
  const h = HEX_SIZE * Math.sqrt(3);
  const px = 40 + col * w * 0.75;
  const py = 20 + row * h + (col % 2 === 1 ? h / 2 : 0);
  return { px, py };
}

function hexVertices(cx: number, cy: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push(cx + HEX_SIZE * Math.cos(angle));
    points.push(cy + HEX_SIZE * Math.sin(angle));
  }
  return points;
}

function buildGrid(): HexPos[] {
  const hexes: HexPos[] = [];
  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const { px, py } = hexToPixel(col, row);
      hexes.push({ col, row, px, py });
    }
  }
  return hexes;
}

function drawScene(
  g: Graphics,
  hexes: HexPos[],
  showTerritory: boolean,
  showFrontLine: boolean,
): void {
  g.clear();

  // Draw terrain base
  for (const hex of hexes) {
    const verts = hexVertices(hex.px, hex.py);
    g.poly(verts);
    g.fill({ color: PLAINS_BG });
    g.poly(verts);
    g.stroke({ width: 0.5, color: 0x6a7e4e });
  }

  // Territory overlay
  if (showTerritory) {
    for (const hex of hexes) {
      const isAllied = hex.col < FRONT_COL;
      const color = isAllied ? ALLIED_COLOR : ENEMY_COLOR;
      const distFromFront = isAllied ? FRONT_COL - 1 - hex.col : hex.col - FRONT_COL;
      const alpha = Math.max(ALPHA_MAX - distFromFront * ALPHA_STEP, ALPHA_MIN);

      const verts = hexVertices(hex.px, hex.py);
      g.poly(verts);
      g.fill({ color, alpha });
    }
  }

  // Front line
  if (showFrontLine) {
    // Collect edge segments along the E edge of each hex in column FRONT_COL-1
    const segments: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      const { px: lx, py: ly } = hexToPixel(FRONT_COL - 1, row);

      // E edge: vertex 0 (angle 0) to vertex 1 (angle 60deg)
      const x0 = lx + HEX_SIZE * Math.cos(0);
      const y0 = ly + HEX_SIZE * Math.sin(0);
      const x1 = lx + HEX_SIZE * Math.cos(Math.PI / 3);
      const y1 = ly + HEX_SIZE * Math.sin(Math.PI / 3);
      segments.push({ x0, y0, x1, y1 });

      // SE edge: vertex 5 (angle -60deg) to vertex 0 (angle 0)
      // This connects the E edges vertically
      const sx0 = lx + HEX_SIZE * Math.cos(-Math.PI / 3);
      const sy0 = ly + HEX_SIZE * Math.sin(-Math.PI / 3);
      const sx1 = lx + HEX_SIZE * Math.cos(0);
      const sy1 = ly + HEX_SIZE * Math.sin(0);
      segments.push({ x0: sx0, y0: sy0, x1: sx1, y1: sy1 });
    }

    // Draw border pass (wider)
    for (const seg of segments) {
      g.moveTo(seg.x0, seg.y0);
      g.lineTo(seg.x1, seg.y1);
    }
    g.stroke({ width: FRONT_BORDER_WIDTH, color: FRONT_BORDER_COLOR });

    // Draw line pass (thinner)
    for (const seg of segments) {
      g.moveTo(seg.x0, seg.y0);
      g.lineTo(seg.x1, seg.y1);
    }
    g.stroke({ width: FRONT_LINE_WIDTH, color: FRONT_LINE_COLOR });
  }
}

const factory: ComponentFactory = async (container) => {
  const app = new Application();
  await app.init({
    width: CANVAS_W,
    height: CANVAS_H,
    background: 0x12121e,
    antialias: true,
  });

  container.appendChild(app.canvas);

  const scene = new Container();
  app.stage.addChild(scene);

  const g = new Graphics();
  scene.addChild(g);

  const hexes = buildGrid();
  let showTerritory = true;
  let showFrontLine = true;

  drawScene(g, hexes, showTerritory, showFrontLine);

  // Controls
  const controls = document.createElement('div');
  controls.className = 'controls';

  // Territory checkbox
  const territoryLabel = document.createElement('label');
  const territoryCheck = document.createElement('input');
  territoryCheck.type = 'checkbox';
  territoryCheck.checked = true;
  territoryCheck.addEventListener('change', () => {
    showTerritory = territoryCheck.checked;
    drawScene(g, hexes, showTerritory, showFrontLine);
  });
  territoryLabel.appendChild(territoryCheck);
  territoryLabel.append(' Territory Overlay');
  controls.appendChild(territoryLabel);

  // Front line checkbox
  const frontLineLabel = document.createElement('label');
  const frontLineCheck = document.createElement('input');
  frontLineCheck.type = 'checkbox';
  frontLineCheck.checked = true;
  frontLineCheck.addEventListener('change', () => {
    showFrontLine = frontLineCheck.checked;
    drawScene(g, hexes, showTerritory, showFrontLine);
  });
  frontLineLabel.appendChild(frontLineCheck);
  frontLineLabel.append(' Front Line');
  controls.appendChild(frontLineLabel);

  container.appendChild(controls);

  return () => {
    app.destroy(true, { children: true });
  };
};

registerComponent('faction-preview', factory);
