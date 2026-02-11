import type { MockUnit, UnitType } from '@core/mock/types';
import { ResourceType } from '@data/types';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

// --- NATO box dimensions ---
const BOX_W = 20;
const BOX_H = 14;
const BOX_HALF_W = BOX_W / 2;
const BOX_HALF_H = BOX_H / 2;

// --- Faction colors ---
const ALLIED_BG = 0x3366aa;
const ENEMY_BG = 0xaa3333;
const BORDER_COLOR = 0x111111;
const BORDER_WIDTH = 1.5;
const SYMBOL_COLOR = 0xdddddd;
const ENEMY_ALPHA = 0.6;

// --- Supply bar layout ---
const BAR_MAX_W = BOX_W;
const BAR_H = 2;
const BAR_GAP = 1;
const BAR_OFFSET_Y = 2; // gap below NATO box
const BAR_BG_COLOR = 0x333333;

const RESOURCE_COLORS: Record<ResourceType, number> = {
  [ResourceType.Fuel]: 0xccaa22,
  [ResourceType.Ammo]: 0x666666,
  [ResourceType.Food]: 0x44aa44,
  [ResourceType.Parts]: 0xcc8833,
};

const RESOURCE_ORDER: ResourceType[] = [
  ResourceType.Fuel,
  ResourceType.Ammo,
  ResourceType.Food,
  ResourceType.Parts,
];

// --- Text label style ---
const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 6,
  fill: 0xdddddd,
});

// --- Pulsation thresholds ---
const PULSE_LOW_THRESHOLD = 0.4;
const PULSE_CRITICAL_THRESHOLD = 0.2;
const PULSE_SLOW_PERIOD = 2;
const PULSE_FAST_PERIOD = 0.5;
const PULSE_SLOW_MIN_ALPHA = 0.6;
const PULSE_FAST_MIN_ALPHA = 0.4;

export class UnitLayer {
  readonly container = new Container();
  private boxGraphics = new Graphics();
  private barGraphics = new Graphics();
  private labelContainer = new Container();
  private units: MockUnit[] = [];
  private lastVersion = -1;
  private elapsed = 0;

  constructor() {
    this.container.addChild(this.boxGraphics);
    this.container.addChild(this.barGraphics);
    this.container.addChild(this.labelContainer);
  }

  updateData(units: MockUnit[]): void {
    this.units = units;
  }

  build(version: number): void {
    if (version === this.lastVersion) return;
    this.lastVersion = version;

    this.rebuildBoxes();
    this.rebuildLabels();
    this.rebuildBars(1.0);
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Find worst-case allied supply average for global pulse
    let worstAvg = 1.0;
    let hasAllied = false;
    for (const unit of this.units) {
      if (unit.faction !== 'allied') continue;
      hasAllied = true;
      const avg = averageSupply(unit);
      if (avg < worstAvg) worstAvg = avg;
    }

    if (!hasAllied || worstAvg >= PULSE_LOW_THRESHOLD) {
      // No pulsation needed -- draw bars at full alpha
      this.rebuildBars(1.0);
      return;
    }

    // Compute pulse alpha from sine wave
    const period = worstAvg < PULSE_CRITICAL_THRESHOLD ? PULSE_FAST_PERIOD : PULSE_SLOW_PERIOD;
    const minAlpha =
      worstAvg < PULSE_CRITICAL_THRESHOLD ? PULSE_FAST_MIN_ALPHA : PULSE_SLOW_MIN_ALPHA;
    const phase = (this.elapsed / period) * Math.PI * 2;
    const alpha = minAlpha + (1.0 - minAlpha) * ((Math.sin(phase) + 1) / 2);

    this.rebuildBars(alpha);
  }

  destroy(): void {
    this.container.removeChildren();
    this.boxGraphics.destroy();
    this.barGraphics.destroy();
    for (const child of this.labelContainer.children) {
      child.destroy();
    }
    this.labelContainer.destroy();
  }

  // ------------------------------------------------------------------
  // Private drawing helpers
  // ------------------------------------------------------------------

  private rebuildBoxes(): void {
    this.boxGraphics.clear();

    for (const unit of this.units) {
      const px = HexRenderer.hexToPixel(unit.coord);
      const x = px.x - BOX_HALF_W;
      const y = px.y - BOX_HALF_H;

      const isEnemy = unit.faction === 'enemy';
      const bgColor = isEnemy ? ENEMY_BG : ALLIED_BG;

      // Background fill
      this.boxGraphics.rect(x, y, BOX_W, BOX_H);
      this.boxGraphics.fill({ color: bgColor, alpha: isEnemy ? ENEMY_ALPHA : 1 });

      // Border
      this.boxGraphics.rect(x, y, BOX_W, BOX_H);
      this.boxGraphics.stroke({
        width: BORDER_WIDTH,
        color: BORDER_COLOR,
        alpha: isEnemy ? ENEMY_ALPHA : 1,
      });

      // Unit type symbol
      this.drawSymbol(unit.type, px.x, px.y, isEnemy ? ENEMY_ALPHA : 1);
    }
  }

  private drawSymbol(type: UnitType, cx: number, cy: number, alpha: number): void {
    switch (type) {
      case 'infantry': {
        // X: two diagonal lines inside the box
        const dx = BOX_HALF_W * 0.6;
        const dy = BOX_HALF_H * 0.6;
        this.boxGraphics.moveTo(cx - dx, cy - dy);
        this.boxGraphics.lineTo(cx + dx, cy + dy);
        this.boxGraphics.stroke({ width: 1, color: SYMBOL_COLOR, alpha });
        this.boxGraphics.moveTo(cx + dx, cy - dy);
        this.boxGraphics.lineTo(cx - dx, cy + dy);
        this.boxGraphics.stroke({ width: 1, color: SYMBOL_COLOR, alpha });
        break;
      }
      case 'armor': {
        // Circle (unfilled outline), radius ~3px
        this.boxGraphics.circle(cx, cy, 3);
        this.boxGraphics.stroke({ width: 1, color: SYMBOL_COLOR, alpha });
        break;
      }
      case 'artillery': {
        // Filled dot, radius ~2px
        this.boxGraphics.circle(cx, cy, 2);
        this.boxGraphics.fill({ color: SYMBOL_COLOR, alpha });
        break;
      }
    }
  }

  private rebuildBars(pulseAlpha: number): void {
    this.barGraphics.clear();

    for (const unit of this.units) {
      if (unit.faction !== 'allied') continue;

      const px = HexRenderer.hexToPixel(unit.coord);
      const barStartY = px.y + BOX_HALF_H + BAR_OFFSET_Y;
      const barStartX = px.x - BOX_HALF_W;

      for (let i = 0; i < RESOURCE_ORDER.length; i++) {
        const resource = RESOURCE_ORDER[i];
        const level = unit.supplies[resource];
        const y = barStartY + i * (BAR_H + BAR_GAP);

        // Background bar (max width)
        this.barGraphics.rect(barStartX, y, BAR_MAX_W, BAR_H);
        this.barGraphics.fill({ color: BAR_BG_COLOR, alpha: pulseAlpha });

        // Filled bar (proportional to supply level)
        if (level > 0) {
          const fillW = level * BAR_MAX_W;
          this.barGraphics.rect(barStartX, y, fillW, BAR_H);
          this.barGraphics.fill({ color: RESOURCE_COLORS[resource], alpha: pulseAlpha });
        }
      }
    }
  }

  private rebuildLabels(): void {
    // Destroy old labels
    for (const child of this.labelContainer.children) {
      child.destroy();
    }
    this.labelContainer.removeChildren();

    for (const unit of this.units) {
      const px = HexRenderer.hexToPixel(unit.coord);

      // Label below supply bars (or below NATO box for enemies)
      const barsHeight =
        unit.faction === 'allied'
          ? BAR_OFFSET_Y + RESOURCE_ORDER.length * (BAR_H + BAR_GAP) - BAR_GAP
          : 0;
      const labelY = px.y + BOX_HALF_H + barsHeight + 2;

      const text = new Text({ text: unit.name, style: LABEL_STYLE });
      text.anchor.set(0.5, 0);
      text.position.set(px.x, labelY);

      if (unit.faction === 'enemy') {
        text.alpha = ENEMY_ALPHA;
      }

      this.labelContainer.addChild(text);
    }
  }
}

// --- Utility ---

function averageSupply(unit: MockUnit): number {
  const s = unit.supplies;
  return (s[ResourceType.Fuel] + s[ResourceType.Ammo] + s[ResourceType.Food] + s[ResourceType.Parts]) / 4;
}
