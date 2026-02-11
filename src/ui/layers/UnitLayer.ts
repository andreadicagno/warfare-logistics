import type { Echelon, MockFormation, MockUnit, UnitType } from '@core/mock/types';
import { ResourceType } from '@data/types';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

// --- Battalion NATO box dimensions ---
const BOX_W = 14;
const BOX_H = 10;
const BOX_HALF_W = BOX_W / 2;
const BOX_HALF_H = BOX_H / 2;

// --- Faction colors ---
const ALLIED_COLOR = 0x3366aa;
const ENEMY_COLOR = 0xaa3333;
const BORDER_COLOR = 0x111111;
const BORDER_WIDTH = 1.5;
const SYMBOL_COLOR = 0xdddddd;
const HQ_BORDER_COLOR = 0xdddddd;
const ENEMY_ALPHA = 0.6;

// --- Supply bar layout ---
const BAR_MAX_W = BOX_W;
const BAR_H = 2;
const BAR_GAP = 1;
const BAR_OFFSET_Y = 2;
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

// --- Text label styles ---
const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 6,
  fill: 0xdddddd,
});

const HQ_LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 5,
  fill: 0xdddddd,
});

// --- Pulsation thresholds ---
const PULSE_LOW_THRESHOLD = 0.4;
const PULSE_CRITICAL_THRESHOLD = 0.2;
const PULSE_SLOW_PERIOD = 2;
const PULSE_FAST_PERIOD = 0.5;
const PULSE_SLOW_MIN_ALPHA = 0.6;
const PULSE_FAST_MIN_ALPHA = 0.4;

// --- Hierarchy line style ---
const HIERARCHY_LINE_COLOR_ALLIED = 0x88aacc;
const HIERARCHY_LINE_COLOR_ENEMY = 0xcc8888;
const HIERARCHY_LINE_ALPHA = 0.5;
const DASH_LENGTH = 4;
const GAP_LENGTH = 3;

const HIERARCHY_LINE_WIDTHS: Partial<Record<Echelon, number>> = {
  army: 1.5,
  corps: 1.2,
  division: 1,
  regiment: 0.8,
};

// --- HQ half-sizes by echelon ---
const HQ_HALF_SIZES: Partial<Record<Echelon, number>> = {
  regiment: 4,
  division: 6,
  corps: 8,
  army: 10,
};

function factionColor(faction: string): number {
  return faction === 'allied' ? ALLIED_COLOR : ENEMY_COLOR;
}

function factionAlpha(faction: string): number {
  return faction === 'enemy' ? ENEMY_ALPHA : 1;
}

export class UnitLayer {
  readonly container = new Container();
  private boxGraphics = new Graphics();
  private hqGraphics = new Graphics();
  private barGraphics = new Graphics();
  private sectorGraphics = new Graphics();
  private labelContainer = new Container();
  private units: MockUnit[] = [];
  private formations: MockFormation[] = [];
  private lastVersion = -1;
  private elapsed = 0;

  constructor() {
    this.container.addChild(this.sectorGraphics);
    this.container.addChild(this.boxGraphics);
    this.container.addChild(this.hqGraphics);
    this.container.addChild(this.barGraphics);
    this.container.addChild(this.labelContainer);
  }

  updateData(units: MockUnit[]): void {
    this.units = units;
  }

  updateFormations(formations: MockFormation[]): void {
    this.formations = formations;
  }

  build(version: number): void {
    if (version === this.lastVersion) return;
    this.lastVersion = version;

    this.rebuildBattalions();
    this.rebuildHqs();
    this.rebuildLabels();
    this.rebuildBars(1.0);
    this.rebuildHierarchyLines();
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Find worst-case allied battalion supply average for global pulse
    let worstAvg = 1.0;
    let hasAlliedBattalion = false;
    for (const unit of this.units) {
      if (unit.faction !== 'allied' || unit.isHq) continue;
      hasAlliedBattalion = true;
      const avg = averageSupply(unit);
      if (avg < worstAvg) worstAvg = avg;
    }

    if (!hasAlliedBattalion || worstAvg >= PULSE_LOW_THRESHOLD) {
      this.rebuildBars(1.0);
      return;
    }

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
    this.hqGraphics.destroy();
    this.barGraphics.destroy();
    this.sectorGraphics.destroy();
    for (const child of this.labelContainer.children) {
      child.destroy();
    }
    this.labelContainer.destroy();
  }

  // ------------------------------------------------------------------
  // Battalion rendering (NATO boxes)
  // ------------------------------------------------------------------

  private rebuildBattalions(): void {
    this.boxGraphics.clear();

    for (const unit of this.units) {
      if (unit.isHq) continue;

      const px = HexRenderer.hexToPixel(unit.coord);
      const x = px.x - BOX_HALF_W;
      const y = px.y - BOX_HALF_H;
      const alpha = factionAlpha(unit.faction);
      const bgColor = factionColor(unit.faction);

      // Background fill
      this.boxGraphics.rect(x, y, BOX_W, BOX_H);
      this.boxGraphics.fill({ color: bgColor, alpha });

      // Border
      this.boxGraphics.rect(x, y, BOX_W, BOX_H);
      this.boxGraphics.stroke({ width: BORDER_WIDTH, color: BORDER_COLOR, alpha });

      // Unit type symbol
      this.drawBattalionSymbol(unit.type, px.x, px.y, alpha);
    }
  }

  private drawBattalionSymbol(type: UnitType, cx: number, cy: number, alpha: number): void {
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
        // Circle outline
        this.boxGraphics.circle(cx, cy, 3);
        this.boxGraphics.stroke({ width: 1, color: SYMBOL_COLOR, alpha });
        break;
      }
      case 'artillery': {
        // Filled dot
        this.boxGraphics.circle(cx, cy, 2);
        this.boxGraphics.fill({ color: SYMBOL_COLOR, alpha });
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // HQ rendering (diamonds and stars)
  // ------------------------------------------------------------------

  private rebuildHqs(): void {
    this.hqGraphics.clear();

    for (const unit of this.units) {
      if (!unit.isHq) continue;

      const px = HexRenderer.hexToPixel(unit.coord);
      const halfSize = HQ_HALF_SIZES[unit.echelon];
      if (halfSize === undefined) continue;

      const fillColor = factionColor(unit.faction);
      const alpha = factionAlpha(unit.faction);

      if (unit.echelon === 'regiment' || unit.echelon === 'division') {
        this.drawDiamond(px.x, px.y, halfSize, fillColor, HQ_BORDER_COLOR, alpha);
      } else {
        this.drawStar(px.x, px.y, halfSize, fillColor, HQ_BORDER_COLOR, alpha);
      }
    }
  }

  private drawDiamond(
    cx: number,
    cy: number,
    halfSize: number,
    fillColor: number,
    borderColor: number,
    alpha: number,
  ): void {
    // 4 points: top, right, bottom, left
    const points = [cx, cy - halfSize, cx + halfSize, cy, cx, cy + halfSize, cx - halfSize, cy];

    this.hqGraphics.poly(points);
    this.hqGraphics.fill({ color: fillColor, alpha });
    this.hqGraphics.poly(points);
    this.hqGraphics.stroke({ width: 1, color: borderColor, alpha });
  }

  private drawStar(
    cx: number,
    cy: number,
    halfSize: number,
    fillColor: number,
    borderColor: number,
    alpha: number,
  ): void {
    // 5-pointed star: alternate between outer radius and inner radius
    const outerR = halfSize;
    const innerR = halfSize * 0.4;
    const points: number[] = [];

    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 5) * i - Math.PI / 2; // start from top
      const r = i % 2 === 0 ? outerR : innerR;
      points.push(cx + r * Math.cos(angle));
      points.push(cy + r * Math.sin(angle));
    }

    this.hqGraphics.poly(points);
    this.hqGraphics.fill({ color: fillColor, alpha });
    this.hqGraphics.poly(points);
    this.hqGraphics.stroke({ width: 1, color: borderColor, alpha });
  }

  // ------------------------------------------------------------------
  // Supply bars (battalions only)
  // ------------------------------------------------------------------

  private rebuildBars(pulseAlpha: number): void {
    this.barGraphics.clear();

    for (const unit of this.units) {
      if (unit.faction !== 'allied' || unit.isHq) continue;

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

  // ------------------------------------------------------------------
  // Labels
  // ------------------------------------------------------------------

  private rebuildLabels(): void {
    for (const child of this.labelContainer.children) {
      child.destroy();
    }
    this.labelContainer.removeChildren();

    for (const unit of this.units) {
      const px = HexRenderer.hexToPixel(unit.coord);

      if (unit.isHq) {
        // HQ label: below the shape
        const halfSize = HQ_HALF_SIZES[unit.echelon] ?? 4;
        const labelY = px.y + halfSize + 2;

        // Use formation name if available, otherwise unit name
        const labelText = this.findFormationName(unit) ?? unit.name;
        const text = new Text({ text: labelText, style: HQ_LABEL_STYLE });
        text.anchor.set(0.5, 0);
        text.position.set(px.x, labelY);
        if (unit.faction === 'enemy') text.alpha = ENEMY_ALPHA;
        this.labelContainer.addChild(text);
      } else {
        // Battalion label: below supply bars (or below NATO box for enemies)
        const barsHeight =
          unit.faction === 'allied'
            ? BAR_OFFSET_Y + RESOURCE_ORDER.length * (BAR_H + BAR_GAP) - BAR_GAP
            : 0;
        const labelY = px.y + BOX_HALF_H + barsHeight + 2;

        const text = new Text({ text: unit.name, style: LABEL_STYLE });
        text.anchor.set(0.5, 0);
        text.position.set(px.x, labelY);
        if (unit.faction === 'enemy') text.alpha = ENEMY_ALPHA;
        this.labelContainer.addChild(text);
      }
    }
  }

  /** Look up the formation name for an HQ unit. */
  private findFormationName(hqUnit: MockUnit): string | null {
    return this.searchFormationTree(this.formations, hqUnit.parentFormationId);
  }

  private searchFormationTree(formations: MockFormation[], targetId: string): string | null {
    for (const formation of formations) {
      if (formation.id === targetId) return formation.name;
      const found = this.searchFormationTree(formation.children, targetId);
      if (found) return found;
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Command hierarchy lines (HQ → subordinate HQs/units)
  // ------------------------------------------------------------------

  private rebuildHierarchyLines(): void {
    this.sectorGraphics.clear();

    for (const armyFormation of this.formations) {
      this.drawFormationTree(armyFormation);
    }
  }

  /** Recursively draw hierarchy lines from a formation's HQ to its subordinates. */
  private drawFormationTree(formation: MockFormation): void {
    const hqPx = HexRenderer.hexToPixel(formation.hqCoord);
    const lineColor =
      formation.faction === 'allied' ? HIERARCHY_LINE_COLOR_ALLIED : HIERARCHY_LINE_COLOR_ENEMY;
    const lineWidth = HIERARCHY_LINE_WIDTHS[formation.echelon] ?? 0.8;

    // Draw lines to child formation HQs
    for (const child of formation.children) {
      const childPx = HexRenderer.hexToPixel(child.hqCoord);
      this.drawDashedLine(hqPx.x, hqPx.y, childPx.x, childPx.y, lineWidth, lineColor);
      // Recurse into child formation
      this.drawFormationTree(child);
    }

    // Draw lines from regiment HQ to its battalions
    if (formation.echelon === 'regiment') {
      for (const unit of formation.units) {
        if (unit.isHq) continue;
        const unitPx = HexRenderer.hexToPixel(unit.coord);
        this.drawDashedLine(hqPx.x, hqPx.y, unitPx.x, unitPx.y, lineWidth, lineColor);
      }
    }
  }

  /** Draw a dashed line by emitting short segments with gaps. */
  private drawDashedLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    width: number,
    color: number,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1) return;

    const nx = dx / length;
    const ny = dy / length;
    const segmentLength = DASH_LENGTH + GAP_LENGTH;
    let dist = 0;

    while (dist < length) {
      const segStart = dist;
      const segEnd = Math.min(dist + DASH_LENGTH, length);

      this.sectorGraphics.moveTo(x0 + nx * segStart, y0 + ny * segStart);
      this.sectorGraphics.lineTo(x0 + nx * segEnd, y0 + ny * segEnd);
      this.sectorGraphics.stroke({
        width,
        color,
        alpha: HIERARCHY_LINE_ALPHA,
      });

      dist += segmentLength;
    }
  }
}

// --- Utility ---

function averageSupply(unit: MockUnit): number {
  const s = unit.supplies;
  return (
    (s[ResourceType.Fuel] + s[ResourceType.Ammo] + s[ResourceType.Food] + s[ResourceType.Parts]) / 4
  );
}
