import { TerrainType } from '@core/map/types';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { type ComponentFactory, registerComponent } from '../mountComponent';

const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Water]: 0x1a3a5c,
  [TerrainType.River]: 0x4a90b8,
  [TerrainType.Plains]: 0x8a9e5e,
  [TerrainType.Marsh]: 0x5a7a6a,
  [TerrainType.Forest]: 0x2d5a2d,
  [TerrainType.Hills]: 0x9e8a5a,
  [TerrainType.Mountain]: 0xb0aab0,
  [TerrainType.Urban]: 0x7a7a7a,
};

const TERRAIN_ORDER: TerrainType[] = [
  TerrainType.Water,
  TerrainType.River,
  TerrainType.Plains,
  TerrainType.Marsh,
  TerrainType.Forest,
  TerrainType.Hills,
  TerrainType.Mountain,
  TerrainType.Urban,
];

const HEX_SIZE = 28;
const HEX_SIZE_SINGLE = 40;
const HEX_SPACING = 72;
const CANVAS_WIDTH = 8 * HEX_SPACING + 20;
const CANVAS_HEIGHT = 100;
const CANVAS_WIDTH_SINGLE = 120;
const CANVAS_HEIGHT_SINGLE = 120;

const PATTERN_DARKEN = 0.15;
const PATTERN_STROKE = 0.5;

const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 11,
  fill: 0xd4d4d8,
});

/** Darken a hex color by a fraction (0-1). Inline to avoid importing from @ui. */
function darken(color: number, amount: number): number {
  const r = Math.max(0, Math.round(((color >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((color >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((color & 0xff) * (1 - amount)));
  return (r << 16) | (g << 8) | b;
}

function drawFlatTopHex(g: Graphics, cx: number, cy: number, size: number, color: number): void {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push(cx + size * Math.cos(angle));
    points.push(cy + size * Math.sin(angle));
  }
  g.poly(points);
  g.fill({ color });
  g.poly(points);
  g.stroke({ width: 1, color: 0x222222 });
}

function drawTreeCanopies(
  g: Graphics,
  px: { x: number; y: number },
  hash: number,
  color: number,
  size: number,
): void {
  const count = 2 + (Math.abs(hash) % 2);
  const radius = size * 0.12;
  for (let i = 0; i < count; i++) {
    const h = (hash * (i + 7)) & 0xffff;
    const ox = ((h & 0xff) / 255 - 0.5) * size * 0.6;
    const oy = (((h >> 8) & 0xff) / 255 - 0.5) * size * 0.5;
    g.circle(px.x + ox, px.y + oy, radius);
    g.stroke({ width: PATTERN_STROKE, color });
  }
}

function drawContourArcs(
  g: Graphics,
  px: { x: number; y: number },
  hash: number,
  color: number,
  size: number,
): void {
  const count = 2 + (Math.abs(hash) % 2);
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * 2 - 1;
    const cy = px.y + t * size * 0.35;
    const h = (hash * (i + 3)) & 0xffff;
    const ox = ((h & 0xff) / 255 - 0.5) * size * 0.15;
    const arcWidth = size * 0.35;
    g.moveTo(px.x - arcWidth + ox, cy);
    g.quadraticCurveTo(px.x + ox, cy - size * 0.12, px.x + arcWidth + ox, cy);
    g.stroke({ width: PATTERN_STROKE, color });
  }
}

function drawPeakTriangles(
  g: Graphics,
  px: { x: number; y: number },
  hash: number,
  color: number,
  size: number,
): void {
  const count = 1 + (Math.abs(hash) % 2);
  const triH = size * 0.3;
  const triW = size * 0.2;
  for (let i = 0; i < count; i++) {
    const h = (hash * (i + 5)) & 0xffff;
    const ox = ((h & 0xff) / 255 - 0.5) * size * 0.4;
    const oy = (((h >> 8) & 0xff) / 255 - 0.5) * size * 0.3;
    const cx = px.x + ox;
    const cy = px.y + oy;
    g.moveTo(cx, cy - triH / 2);
    g.lineTo(cx - triW / 2, cy + triH / 2);
    g.lineTo(cx + triW / 2, cy + triH / 2);
    g.closePath();
    g.stroke({ width: PATTERN_STROKE, color });
  }
}

function drawMarshDashes(
  g: Graphics,
  px: { x: number; y: number },
  hash: number,
  color: number,
  size: number,
): void {
  const count = 3 + (Math.abs(hash) % 2);
  const dashW = size * 0.25;
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * 2 - 1;
    const cy = px.y + t * size * 0.4;
    const h = (hash * (i + 11)) & 0xffff;
    const ox = ((h & 0xff) / 255 - 0.5) * size * 0.3;
    g.moveTo(px.x - dashW / 2 + ox, cy);
    g.lineTo(px.x + dashW / 2 + ox, cy);
    g.stroke({ width: PATTERN_STROKE, color });
  }
}

function drawUrbanDots(
  g: Graphics,
  px: { x: number; y: number },
  hash: number,
  baseColor: number,
  size: number,
): void {
  const dotColor = darken(baseColor, 0.25);
  const dotCount = 8 + (Math.abs(hash) % 7);
  const dotSize = 1.2;
  const spread = size * 0.65;

  for (let i = 0; i < dotCount; i++) {
    const h = (hash * (i + 1) + i * 7919) & 0xffff;
    const angle = ((h & 0xff) / 255) * Math.PI * 2;
    const dist = (((h >> 8) & 0xff) / 255) * spread;
    const r = Math.sqrt(dist / spread) * spread;
    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;
    g.rect(px.x + dx - dotSize / 2, px.y + dy - dotSize / 2, dotSize, dotSize);
    g.fill({ color: dotColor });
  }
}

function drawTerrainPattern(
  g: Graphics,
  terrain: TerrainType,
  px: { x: number; y: number },
  hash: number,
  size: number,
): void {
  const color = darken(TERRAIN_COLORS[terrain], PATTERN_DARKEN);

  switch (terrain) {
    case TerrainType.Forest:
      drawTreeCanopies(g, px, hash, color, size);
      break;
    case TerrainType.Hills:
      drawContourArcs(g, px, hash, color, size);
      break;
    case TerrainType.Mountain:
      drawPeakTriangles(g, px, hash, color, size);
      break;
    case TerrainType.Marsh:
      drawMarshDashes(g, px, hash, color, size);
      break;
    case TerrainType.Urban:
      drawUrbanDots(g, px, hash, TERRAIN_COLORS[terrain], size);
      break;
  }
}

function terrainFromString(str: string): TerrainType | undefined {
  const map: Record<string, TerrainType> = {
    water: TerrainType.Water,
    river: TerrainType.River,
    plains: TerrainType.Plains,
    marsh: TerrainType.Marsh,
    forest: TerrainType.Forest,
    hills: TerrainType.Hills,
    mountain: TerrainType.Mountain,
    urban: TerrainType.Urban,
  };
  return map[str.toLowerCase()];
}

const factory: ComponentFactory = async (container, props) => {
  const singleType = props.type ? terrainFromString(props.type) : undefined;
  const isSingle = singleType !== undefined;

  const canvasW = isSingle ? CANVAS_WIDTH_SINGLE : CANVAS_WIDTH;
  const canvasH = isSingle ? CANVAS_HEIGHT_SINGLE : CANVAS_HEIGHT;

  const app = new Application();
  await app.init({
    width: canvasW,
    height: canvasH,
    background: 0x12121e,
    antialias: true,
  });

  container.appendChild(app.canvas);

  const scene = new Container();
  app.stage.addChild(scene);

  const g = new Graphics();
  scene.addChild(g);

  if (isSingle) {
    const cx = canvasW / 2;
    const cy = canvasH / 2 - 6;
    const size = HEX_SIZE_SINGLE;
    const hash = (3 * 73856093) ^ (7 * 19349663);

    drawFlatTopHex(g, cx, cy, size, TERRAIN_COLORS[singleType]);
    drawTerrainPattern(g, singleType, { x: cx, y: cy }, hash, size);

    const label = new Text({
      text: singleType.charAt(0).toUpperCase() + singleType.slice(1),
      style: LABEL_STYLE,
    });
    label.anchor.set(0.5, 0);
    label.position.set(cx, cy + size + 6);
    scene.addChild(label);
  } else {
    for (let i = 0; i < TERRAIN_ORDER.length; i++) {
      const terrain = TERRAIN_ORDER[i];
      const cx = 10 + HEX_SPACING / 2 + i * HEX_SPACING;
      const cy = 36;
      const hash = (i * 73856093) ^ ((i + 5) * 19349663);

      drawFlatTopHex(g, cx, cy, HEX_SIZE, TERRAIN_COLORS[terrain]);
      drawTerrainPattern(g, terrain, { x: cx, y: cy }, hash, HEX_SIZE);

      const label = new Text({
        text: terrain.charAt(0).toUpperCase() + terrain.slice(1),
        style: LABEL_STYLE,
      });
      label.anchor.set(0.5, 0);
      label.position.set(cx, cy + HEX_SIZE + 6);
      scene.addChild(label);
    }
  }

  return () => {
    app.destroy(true, { children: true });
  };
};

registerComponent('terrain-preview', factory);
