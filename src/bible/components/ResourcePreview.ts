import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { type ComponentFactory, registerComponent } from '../mountComponent';

const RESOURCE_KEYS = ['fuel', 'ammo', 'food', 'parts'] as const;
const RESOURCE_COLORS: Record<string, number> = {
  fuel: 0xccaa22,
  ammo: 0x666666,
  food: 0x44aa44,
  parts: 0xcc8833,
};

const BAR_W = 200;
const BAR_H = 24;
const BAR_GAP = 12;
const BAR_BG = 0x333333;
const PADDING = 10;

const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 12,
  fill: 0xd4d4d8,
});

const PCT_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 11,
  fill: 0xa0a0b0,
});

const CANVAS_W = 360;
const CANVAS_H = RESOURCE_KEYS.length * (BAR_H + BAR_GAP) + PADDING * 2 - BAR_GAP;

function drawBars(scene: Container, g: Graphics, quantities: Record<string, number>): void {
  g.clear();

  // Remove old text children (keep graphics at index 0)
  while (scene.children.length > 1) {
    const child = scene.children[scene.children.length - 1];
    child.destroy();
    scene.removeChildAt(scene.children.length - 1);
  }

  const labelOffset = 50;
  const barX = PADDING + labelOffset;
  const pctX = barX + BAR_W + 8;

  for (let i = 0; i < RESOURCE_KEYS.length; i++) {
    const key = RESOURCE_KEYS[i];
    const level = quantities[key] ?? 0;
    const y = PADDING + i * (BAR_H + BAR_GAP);

    // Label
    const label = new Text({
      text: key.charAt(0).toUpperCase() + key.slice(1),
      style: LABEL_STYLE,
    });
    label.anchor.set(0, 0.5);
    label.position.set(PADDING, y + BAR_H / 2);
    scene.addChild(label);

    // Background bar
    g.rect(barX, y, BAR_W, BAR_H);
    g.fill({ color: BAR_BG });

    // Filled bar
    if (level > 0) {
      g.rect(barX, y, level * BAR_W, BAR_H);
      g.fill({ color: RESOURCE_COLORS[key] });
    }

    // Percentage label
    const pct = new Text({
      text: `${Math.round(level * 100)}%`,
      style: PCT_STYLE,
    });
    pct.anchor.set(0, 0.5);
    pct.position.set(pctX, y + BAR_H / 2);
    scene.addChild(pct);
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

  const quantities: Record<string, number> = {
    fuel: 0.75,
    ammo: 0.5,
    food: 0.9,
    parts: 0.3,
  };

  drawBars(scene, g, quantities);

  // Controls
  const controls = document.createElement('div');
  controls.className = 'controls';

  for (const key of RESOURCE_KEYS) {
    const sliderLabel = document.createElement('label');
    sliderLabel.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}: `;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(quantities[key] * 100));
    slider.addEventListener('input', () => {
      quantities[key] = Number(slider.value) / 100;
      drawBars(scene, g, quantities);
    });
    sliderLabel.appendChild(slider);
    controls.appendChild(sliderLabel);
  }

  container.appendChild(controls);

  return () => {
    app.destroy(true, { children: true });
  };
};

registerComponent('resource-preview', factory);
