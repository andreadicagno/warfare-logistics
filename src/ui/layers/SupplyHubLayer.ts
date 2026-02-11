import type { MockFacility } from '@core/mock/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const LARGE_SIZE = 10; // half-width of large icon box
const SMALL_SIZE = 6;
const ICON_BG = 0xd4c8a0;
const ICON_BORDER = 0x2a2a35;
const DAMAGE_COLOR = 0xcc3333;

const BAR_W = 2;
const BAR_H = 10;
const BAR_GAP = 1;
const BAR_BG = 0x333333;
const BAR_COLORS: Record<string, number> = {
  fuel: 0xccaa22,
  ammo: 0x666666,
  food: 0x44aa44,
  parts: 0xcc8833,
};
const RESOURCE_KEYS = ['fuel', 'ammo', 'food', 'parts'] as const;

export class SupplyHubLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private facilities: MockFacility[] = [];
  private builtVersion = -1;

  constructor(facilities: MockFacility[]) {
    this.facilities = facilities;
    this.container.addChild(this.graphics);
  }

  build(version: number): void {
    if (this.builtVersion === version) return;
    this.builtVersion = version;
    this.graphics.clear();

    for (const facility of this.facilities) {
      const px = HexRenderer.hexToPixel(facility.coord);
      const size = facility.size === 'large' ? LARGE_SIZE : SMALL_SIZE;

      // 1. Square background
      this.graphics.rect(px.x - size, px.y - size, size * 2, size * 2);
      this.graphics.fill({ color: ICON_BG });
      this.graphics.rect(px.x - size, px.y - size, size * 2, size * 2);
      this.graphics.stroke({ width: 1, color: ICON_BORDER });

      // 2. Facility icon
      this.drawFacilityIcon(px.x, px.y, size, facility.kind);

      // 3. Resource bars above the icon
      this.drawResourceBars(px.x, px.y - size - 2, facility.storage);

      // 4. Damage overlay
      if (facility.damaged) {
        this.drawDamageOverlay(px.x, px.y, size);
      }
    }
  }

  updateData(facilities: MockFacility[]): void {
    this.facilities = facilities;
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }

  // ---------------------------------------------------------------------------
  // Private drawing helpers
  // ---------------------------------------------------------------------------

  private drawFacilityIcon(cx: number, cy: number, size: number, kind: MockFacility['kind']): void {
    const inner = size * 0.6;

    switch (kind) {
      case 'depot': {
        // Cross: two perpendicular lines
        this.graphics.moveTo(cx - inner, cy);
        this.graphics.lineTo(cx + inner, cy);
        this.graphics.moveTo(cx, cy - inner);
        this.graphics.lineTo(cx, cy + inner);
        this.graphics.stroke({ width: 1.5, color: ICON_BORDER });
        break;
      }
      case 'factory': {
        // Gear: circle with 4 radial ticks at 45-degree angles
        const r = inner * 0.5;
        this.graphics.circle(cx, cy, r);
        this.graphics.stroke({ width: 1, color: ICON_BORDER });
        const tickInner = r * 0.8;
        const tickOuter = inner;
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI / 4) * (2 * i + 1); // 45, 135, 225, 315 degrees
          this.graphics.moveTo(cx + Math.cos(angle) * tickInner, cy + Math.sin(angle) * tickInner);
          this.graphics.lineTo(cx + Math.cos(angle) * tickOuter, cy + Math.sin(angle) * tickOuter);
        }
        this.graphics.stroke({ width: 1, color: ICON_BORDER });
        break;
      }
      case 'railHub': {
        // Two parallel horizontal lines with short perpendicular ticks
        const lineY1 = cy - inner * 0.3;
        const lineY2 = cy + inner * 0.3;
        this.graphics.moveTo(cx - inner, lineY1);
        this.graphics.lineTo(cx + inner, lineY1);
        this.graphics.moveTo(cx - inner, lineY2);
        this.graphics.lineTo(cx + inner, lineY2);
        // Perpendicular tick marks
        const tickLen = inner * 0.35;
        for (let t = -1; t <= 1; t++) {
          const tx = cx + t * inner * 0.6;
          this.graphics.moveTo(tx, lineY1 - tickLen);
          this.graphics.lineTo(tx, lineY2 + tickLen);
        }
        this.graphics.stroke({ width: 1, color: ICON_BORDER });
        break;
      }
    }
  }

  private drawResourceBars(cx: number, bottomY: number, storage: MockFacility['storage']): void {
    const totalBarWidth = RESOURCE_KEYS.length * BAR_W + (RESOURCE_KEYS.length - 1) * BAR_GAP;
    let barX = cx - totalBarWidth / 2;

    for (const key of RESOURCE_KEYS) {
      const level = storage[key];
      const topY = bottomY - BAR_H;

      // Background (full height)
      this.graphics.rect(barX, topY, BAR_W, BAR_H);
      this.graphics.fill({ color: BAR_BG });

      // Foreground (level portion, drawn from bottom)
      const filledH = level * BAR_H;
      if (filledH > 0) {
        this.graphics.rect(barX, topY + BAR_H - filledH, BAR_W, filledH);
        this.graphics.fill({ color: BAR_COLORS[key] });
      }

      barX += BAR_W + BAR_GAP;
    }
  }

  private drawDamageOverlay(cx: number, cy: number, size: number): void {
    // Semi-transparent red fill over the square
    this.graphics.rect(cx - size, cy - size, size * 2, size * 2);
    this.graphics.fill({ color: DAMAGE_COLOR, alpha: 0.3 });

    // Small "X" mark drawn in red
    const xSize = size * 0.4;
    this.graphics.moveTo(cx - xSize, cy - xSize);
    this.graphics.lineTo(cx + xSize, cy + xSize);
    this.graphics.moveTo(cx + xSize, cy - xSize);
    this.graphics.lineTo(cx - xSize, cy + xSize);
    this.graphics.stroke({ width: 1.5, color: DAMAGE_COLOR });
  }
}
