import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { type ComponentFactory, registerComponent } from '../mountComponent';

const BOX_W = 42;
const BOX_H = 30;
const BOX_HALF_W = BOX_W / 2;
const BOX_HALF_H = BOX_H / 2;

const ALLIED_COLOR = 0x3366aa;
const ENEMY_COLOR = 0xaa3333;
const BORDER_COLOR = 0x111111;
const BORDER_WIDTH = 2;
const SYMBOL_COLOR = 0xdddddd;
const ENEMY_ALPHA = 0.6;

const BAR_MAX_W = BOX_W;
const BAR_H = 4;
const BAR_GAP = 2;
const BAR_OFFSET_Y = 4;
const BAR_BG_COLOR = 0x333333;

const RESOURCE_KEYS = ['fuel', 'ammo', 'food', 'parts'] as const;
const RESOURCE_COLORS: Record<string, number> = {
  fuel: 0xccaa22,
  ammo: 0x666666,
  food: 0x44aa44,
  parts: 0xcc8833,
};

type UnitType = 'infantry' | 'armor' | 'artillery';
type Faction = 'allied' | 'enemy';
type Echelon = 'battalion' | 'regiment' | 'division' | 'corps' | 'army';

const ECHELON_PIPS: Record<Echelon, string> = {
  battalion: '',
  regiment: 'I',
  division: 'II',
  corps: 'III',
  army: 'IIII',
};

const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 11,
  fill: 0xd4d4d8,
});

const PIP_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 12,
  fill: 0xdddddd,
  fontWeight: 'bold',
});

const CANVAS_W = 260;
const CANVAS_H = 140;
const CANVAS_W_SINGLE = 140;
const CANVAS_H_SINGLE = 130;

function resetScene(scene: Container): Graphics {
  const children = scene.removeChildren();
  for (const child of children) {
    child.destroy();
  }
  const g = new Graphics();
  scene.addChild(g);
  return g;
}

function drawUnit(
  scene: Container,
  unitType: UnitType,
  faction: Faction,
  echelon: Echelon,
  supplies: Record<string, number>,
  canvasWidth = CANVAS_W,
): void {
  const g = resetScene(scene);

  const cx = canvasWidth / 2;
  const cy = 50;
  const bgColor = faction === 'allied' ? ALLIED_COLOR : ENEMY_COLOR;
  const alpha = faction === 'enemy' ? ENEMY_ALPHA : 1;

  // Box background
  g.rect(cx - BOX_HALF_W, cy - BOX_HALF_H, BOX_W, BOX_H);
  g.fill({ color: bgColor, alpha });

  // Box border
  g.rect(cx - BOX_HALF_W, cy - BOX_HALF_H, BOX_W, BOX_H);
  g.stroke({ width: BORDER_WIDTH, color: BORDER_COLOR, alpha });

  // Unit type symbol
  switch (unitType) {
    case 'infantry': {
      // X: two diagonal lines
      const dx = BOX_HALF_W * 0.6;
      const dy = BOX_HALF_H * 0.6;
      g.moveTo(cx - dx, cy - dy);
      g.lineTo(cx + dx, cy + dy);
      g.stroke({ width: 1.5, color: SYMBOL_COLOR, alpha });
      g.moveTo(cx + dx, cy - dy);
      g.lineTo(cx - dx, cy + dy);
      g.stroke({ width: 1.5, color: SYMBOL_COLOR, alpha });
      break;
    }
    case 'armor': {
      // Single diagonal slash
      const dx = BOX_HALF_W * 0.5;
      const dy = BOX_HALF_H * 0.5;
      g.moveTo(cx - dx, cy + dy);
      g.lineTo(cx + dx, cy - dy);
      g.stroke({ width: 2, color: SYMBOL_COLOR, alpha });
      break;
    }
    case 'artillery': {
      // Filled circle
      g.circle(cx, cy, 6);
      g.fill({ color: SYMBOL_COLOR, alpha });
      break;
    }
  }

  // Echelon pips above box
  const pips = ECHELON_PIPS[echelon];
  if (pips) {
    const pipText = new Text({ text: pips, style: PIP_STYLE });
    pipText.anchor.set(0.5, 1);
    pipText.position.set(cx, cy - BOX_HALF_H - 2);
    pipText.alpha = alpha;
    scene.addChild(pipText);
  }

  // Supply bars below box (allied only)
  if (faction === 'allied') {
    const barStartY = cy + BOX_HALF_H + BAR_OFFSET_Y;
    const barStartX = cx - BOX_HALF_W;

    for (let i = 0; i < RESOURCE_KEYS.length; i++) {
      const key = RESOURCE_KEYS[i];
      const level = supplies[key] ?? 0;
      const y = barStartY + i * (BAR_H + BAR_GAP);

      // Background
      g.rect(barStartX, y, BAR_MAX_W, BAR_H);
      g.fill({ color: BAR_BG_COLOR });

      // Fill
      if (level > 0) {
        g.rect(barStartX, y, level * BAR_MAX_W, BAR_H);
        g.fill({ color: RESOURCE_COLORS[key] });
      }
    }
  }

  // Label
  const labelText = `${echelon.charAt(0).toUpperCase() + echelon.slice(1)} / ${unitType.charAt(0).toUpperCase() + unitType.slice(1)}`;
  const label = new Text({ text: labelText, style: LABEL_STYLE });
  label.anchor.set(0.5, 0);
  const labelY =
    faction === 'allied'
      ? cy + BOX_HALF_H + BAR_OFFSET_Y + RESOURCE_KEYS.length * (BAR_H + BAR_GAP) + 4
      : cy + BOX_HALF_H + 6;
  label.position.set(cx, labelY);
  scene.addChild(label);
}

function unitTypeFromString(str: string): UnitType | undefined {
  const map: Record<string, UnitType> = {
    infantry: 'infantry',
    armor: 'armor',
    artillery: 'artillery',
  };
  return map[str.toLowerCase()];
}

const factory: ComponentFactory = async (container, props) => {
  const singleType = props.type ? unitTypeFromString(props.type) : undefined;
  const isSingle = singleType !== undefined;

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

  let unitType: UnitType = singleType ?? 'infantry';
  let faction: Faction = 'allied';
  let echelon: Echelon = 'battalion';
  const supplies: Record<string, number> = { fuel: 0.8, ammo: 0.6, food: 0.9, parts: 0.4 };

  const redraw = () => drawUnit(scene, unitType, faction, echelon, supplies, canvasW);
  redraw();

  // Controls
  const controls = document.createElement('div');
  controls.className = 'controls';

  // Type dropdown (only in overview mode)
  if (!isSingle) {
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Type: ';
    const typeSelect = document.createElement('select');
    for (const t of ['infantry', 'armor', 'artillery'] as const) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener('change', () => {
      unitType = typeSelect.value as UnitType;
      redraw();
    });
    typeLabel.appendChild(typeSelect);
    controls.appendChild(typeLabel);
  }

  // Faction dropdown
  const factionLabel = document.createElement('label');
  factionLabel.textContent = 'Faction: ';
  const factionSelect = document.createElement('select');
  for (const f of ['allied', 'enemy'] as const) {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f.charAt(0).toUpperCase() + f.slice(1);
    factionSelect.appendChild(opt);
  }
  factionSelect.addEventListener('change', () => {
    faction = factionSelect.value as Faction;
    redraw();
  });
  factionLabel.appendChild(factionSelect);
  controls.appendChild(factionLabel);

  // Echelon dropdown
  const echelonLabel = document.createElement('label');
  echelonLabel.textContent = 'Echelon: ';
  const echelonSelect = document.createElement('select');
  for (const e of ['battalion', 'regiment', 'division', 'corps', 'army'] as const) {
    const opt = document.createElement('option');
    opt.value = e;
    opt.textContent = e.charAt(0).toUpperCase() + e.slice(1);
    echelonSelect.appendChild(opt);
  }
  echelonSelect.addEventListener('change', () => {
    echelon = echelonSelect.value as Echelon;
    redraw();
  });
  echelonLabel.appendChild(echelonSelect);
  controls.appendChild(echelonLabel);

  // Supply sliders
  for (const key of RESOURCE_KEYS) {
    const sliderLabel = document.createElement('label');
    sliderLabel.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}: `;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(supplies[key] * 100));
    slider.addEventListener('input', () => {
      supplies[key] = Number(slider.value) / 100;
      redraw();
    });
    sliderLabel.appendChild(slider);
    controls.appendChild(sliderLabel);
  }

  container.appendChild(controls);

  return () => {
    app.destroy(true, { children: true });
  };
};

registerComponent('unit-preview', factory);
