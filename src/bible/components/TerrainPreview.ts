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
const HEX_SPACING = 72;
const CANVAS_WIDTH = 8 * HEX_SPACING + 20;
const CANVAS_HEIGHT = 100;

const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 11,
  fill: 0xd4d4d8,
});

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

const factory: ComponentFactory = async (container) => {
  const app = new Application();
  await app.init({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: 0x12121e,
    antialias: true,
  });

  container.appendChild(app.canvas);

  const scene = new Container();
  app.stage.addChild(scene);

  const g = new Graphics();
  scene.addChild(g);

  for (let i = 0; i < TERRAIN_ORDER.length; i++) {
    const terrain = TERRAIN_ORDER[i];
    const cx = 10 + HEX_SPACING / 2 + i * HEX_SPACING;
    const cy = 36;

    drawFlatTopHex(g, cx, cy, HEX_SIZE, TERRAIN_COLORS[terrain]);

    const label = new Text({
      text: terrain.charAt(0).toUpperCase() + terrain.slice(1),
      style: LABEL_STYLE,
    });
    label.anchor.set(0.5, 0);
    label.position.set(cx, cy + HEX_SIZE + 6);
    scene.addChild(label);
  }

  return () => {
    app.destroy(true, { children: true });
  };
};

registerComponent('terrain-preview', factory);
