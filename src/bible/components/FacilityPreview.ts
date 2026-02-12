import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { type ComponentFactory, registerComponent } from '../mountComponent';

const SIZE = 20; // half-width of icon box
const SPACING = 120;
const ICON_BG = 0xd4c8a0;
const ICON_BORDER = 0x2a2a35;
const DAMAGE_COLOR = 0xcc3333;

const BAR_W = 4;
const BAR_H = 20;
const BAR_GAP = 2;
const BAR_BG = 0x333333;

const RESOURCE_KEYS = ['fuel', 'ammo', 'food', 'parts'] as const;
const RESOURCE_COLORS: Record<string, number> = {
  fuel: 0xccaa22,
  ammo: 0x666666,
  food: 0x44aa44,
  parts: 0xcc8833,
};

const FACILITY_KINDS = ['depot', 'factory', 'railHub', 'port'] as const;
type FacilityKind = (typeof FACILITY_KINDS)[number];

const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 11,
  fill: 0xd4d4d8,
});

const CANVAS_W = FACILITY_KINDS.length * SPACING + 20;
const CANVAS_H = 120;
const CANVAS_W_SINGLE = 140;
const CANVAS_H_SINGLE = 120;

function resetScene(scene: Container): Graphics {
  const children = scene.removeChildren();
  for (const child of children) {
    child.destroy();
  }
  const g = new Graphics();
  scene.addChild(g);
  return g;
}

function drawFacilityIcon(g: Graphics, cx: number, cy: number, kind: FacilityKind): void {
  const inner = SIZE * 0.6;

  switch (kind) {
    case 'depot': {
      // Cross
      g.moveTo(cx - inner, cy);
      g.lineTo(cx + inner, cy);
      g.moveTo(cx, cy - inner);
      g.lineTo(cx, cy + inner);
      g.stroke({ width: 2, color: ICON_BORDER });
      break;
    }
    case 'factory': {
      // Gear: circle + spokes
      const r = inner * 0.5;
      g.circle(cx, cy, r);
      g.stroke({ width: 1.5, color: ICON_BORDER });
      const tickInner = r * 0.8;
      const tickOuter = inner;
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 4) * (2 * i + 1);
        g.moveTo(cx + Math.cos(angle) * tickInner, cy + Math.sin(angle) * tickInner);
        g.lineTo(cx + Math.cos(angle) * tickOuter, cy + Math.sin(angle) * tickOuter);
      }
      g.stroke({ width: 1.5, color: ICON_BORDER });
      break;
    }
    case 'railHub': {
      // Parallel tracks + crossties
      const lineY1 = cy - inner * 0.3;
      const lineY2 = cy + inner * 0.3;
      g.moveTo(cx - inner, lineY1);
      g.lineTo(cx + inner, lineY1);
      g.moveTo(cx - inner, lineY2);
      g.lineTo(cx + inner, lineY2);
      const tickLen = inner * 0.35;
      for (let t = -1; t <= 1; t++) {
        const tx = cx + t * inner * 0.6;
        g.moveTo(tx, lineY1 - tickLen);
        g.lineTo(tx, lineY2 + tickLen);
      }
      g.stroke({ width: 1.5, color: ICON_BORDER });
      break;
    }
    case 'port': {
      // Anchor shape
      // Vertical stem
      g.moveTo(cx, cy - inner * 0.7);
      g.lineTo(cx, cy + inner * 0.5);
      g.stroke({ width: 2, color: ICON_BORDER });
      // Horizontal bar near top
      g.moveTo(cx - inner * 0.4, cy - inner * 0.4);
      g.lineTo(cx + inner * 0.4, cy - inner * 0.4);
      g.stroke({ width: 2, color: ICON_BORDER });
      // Circle at top
      g.circle(cx, cy - inner * 0.7, inner * 0.15);
      g.stroke({ width: 1.5, color: ICON_BORDER });
      // Curved flukes at bottom
      g.moveTo(cx - inner * 0.5, cy);
      g.quadraticCurveTo(cx - inner * 0.5, cy + inner * 0.5, cx, cy + inner * 0.5);
      g.moveTo(cx + inner * 0.5, cy);
      g.quadraticCurveTo(cx + inner * 0.5, cy + inner * 0.5, cx, cy + inner * 0.5);
      g.stroke({ width: 1.5, color: ICON_BORDER });
      break;
    }
  }
}

function drawResourceBars(
  g: Graphics,
  cx: number,
  topY: number,
  storage: Record<string, number>,
): void {
  const totalW = RESOURCE_KEYS.length * BAR_W + (RESOURCE_KEYS.length - 1) * BAR_GAP;
  let barX = cx - totalW / 2;

  for (const key of RESOURCE_KEYS) {
    const level = storage[key] ?? 0;

    // Background
    g.rect(barX, topY, BAR_W, BAR_H);
    g.fill({ color: BAR_BG });

    // Fill from bottom
    const filledH = level * BAR_H;
    if (filledH > 0) {
      g.rect(barX, topY + BAR_H - filledH, BAR_W, filledH);
      g.fill({ color: RESOURCE_COLORS[key] });
    }

    barX += BAR_W + BAR_GAP;
  }
}

function drawDamageOverlay(g: Graphics, cx: number, cy: number): void {
  // Semi-transparent red fill
  g.rect(cx - SIZE, cy - SIZE, SIZE * 2, SIZE * 2);
  g.fill({ color: DAMAGE_COLOR, alpha: 0.3 });

  // Red X
  const xSize = SIZE * 0.5;
  g.moveTo(cx - xSize, cy - xSize);
  g.lineTo(cx + xSize, cy + xSize);
  g.moveTo(cx + xSize, cy - xSize);
  g.lineTo(cx - xSize, cy + xSize);
  g.stroke({ width: 2, color: DAMAGE_COLOR, alpha: 0.7 });
}

function redraw(scene: Container, damaged: boolean, storage: Record<string, number>): void {
  const g = resetScene(scene);

  for (let i = 0; i < FACILITY_KINDS.length; i++) {
    const kind = FACILITY_KINDS[i];
    const cx = 10 + SPACING / 2 + i * SPACING;
    const cy = 55;

    // Resource bars above
    drawResourceBars(g, cx, cy - SIZE - BAR_H - 4, storage);

    // Square background
    g.rect(cx - SIZE, cy - SIZE, SIZE * 2, SIZE * 2);
    g.fill({ color: ICON_BG });
    g.rect(cx - SIZE, cy - SIZE, SIZE * 2, SIZE * 2);
    g.stroke({ width: 1, color: ICON_BORDER });

    // Icon
    drawFacilityIcon(g, cx, cy, kind);

    // Damage overlay
    if (damaged) {
      drawDamageOverlay(g, cx, cy);
    }

    // Label
    const label = new Text({
      text: kind.charAt(0).toUpperCase() + kind.slice(1).replace('Hub', ' Hub'),
      style: LABEL_STYLE,
    });
    label.anchor.set(0.5, 0);
    label.position.set(cx, cy + SIZE + 6);
    scene.addChild(label);
  }
}

function redrawSingle(
  scene: Container,
  kind: FacilityKind,
  damaged: boolean,
  storage: Record<string, number>,
): void {
  const g = resetScene(scene);

  const cx = CANVAS_W_SINGLE / 2;
  const cy = 55;

  drawResourceBars(g, cx, cy - SIZE - BAR_H - 4, storage);

  g.rect(cx - SIZE, cy - SIZE, SIZE * 2, SIZE * 2);
  g.fill({ color: ICON_BG });
  g.rect(cx - SIZE, cy - SIZE, SIZE * 2, SIZE * 2);
  g.stroke({ width: 1, color: ICON_BORDER });

  drawFacilityIcon(g, cx, cy, kind);

  if (damaged) {
    drawDamageOverlay(g, cx, cy);
  }

  const label = new Text({
    text: kind.charAt(0).toUpperCase() + kind.slice(1).replace('Hub', ' Hub'),
    style: LABEL_STYLE,
  });
  label.anchor.set(0.5, 0);
  label.position.set(cx, cy + SIZE + 6);
  scene.addChild(label);
}

function kindFromString(str: string): FacilityKind | undefined {
  const normalized = str.toLowerCase();
  // Accept both "railHub" and "railhub"
  const map: Record<string, FacilityKind> = {
    depot: 'depot',
    factory: 'factory',
    railhub: 'railHub',
    port: 'port',
  };
  return map[normalized];
}

const factory: ComponentFactory = async (container, props) => {
  const singleKind = props.type ? kindFromString(props.type) : undefined;
  const isSingle = singleKind !== undefined;

  const canvasW = isSingle ? CANVAS_W_SINGLE : CANVAS_W;
  const canvasH = isSingle ? CANVAS_H_SINGLE : CANVAS_H;

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

  let damaged = false;
  const storage: Record<string, number> = { fuel: 0.8, ammo: 0.6, food: 0.9, parts: 0.4 };

  if (isSingle) {
    redrawSingle(scene, singleKind, damaged, storage);
  } else {
    redraw(scene, damaged, storage);
  }

  // Controls
  const controls = document.createElement('div');
  controls.className = 'controls';

  // Damage checkbox
  const damageLabel = document.createElement('label');
  const damageCheck = document.createElement('input');
  damageCheck.type = 'checkbox';
  damageCheck.addEventListener('change', () => {
    damaged = damageCheck.checked;
    if (isSingle) {
      redrawSingle(scene, singleKind, damaged, storage);
    } else {
      redraw(scene, damaged, storage);
    }
  });
  damageLabel.appendChild(damageCheck);
  damageLabel.append(' Damaged');
  controls.appendChild(damageLabel);

  // Resource sliders
  for (const key of RESOURCE_KEYS) {
    const sliderLabel = document.createElement('label');
    sliderLabel.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}: `;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(storage[key] * 100));
    slider.addEventListener('input', () => {
      storage[key] = Number(slider.value) / 100;
      if (isSingle) {
        redrawSingle(scene, singleKind, damaged, storage);
      } else {
        redraw(scene, damaged, storage);
      }
    });
    sliderLabel.appendChild(slider);
    controls.appendChild(sliderLabel);
  }

  container.appendChild(controls);

  return () => {
    app.destroy(true, { children: true });
  };
};

registerComponent('facility-preview', factory);
