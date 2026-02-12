import type { PlacedDepot, PlacedFactory, SimulationState } from '@core/simulation/types';
import { RESOURCE_COLORS } from '@core/simulation/types';
import { ResourceType } from '@data/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const ICON_SIZE = 10;
const ICON_BG = 0xd4c8a0;
const ICON_BORDER = 0x2a2a35;
const BAR_WIDTH = 2;
const BAR_HEIGHT = 10;
const BAR_GAP = 1;
const BAR_BG = 0x333333;

export class PlaygroundFacilityLayer {
  readonly container = new Container();
  private graphics = new Graphics();
  private builtVersion = -1;

  constructor() {
    this.container.addChild(this.graphics);
  }

  build(state: SimulationState): void {
    if (this.builtVersion === state.version) return;
    this.builtVersion = state.version;
    this.graphics.clear();

    for (const factory of state.factories.values()) {
      this.drawFactory(factory);
    }
    for (const depot of state.depots.values()) {
      this.drawDepot(depot);
    }
  }

  private drawFactory(factory: PlacedFactory): void {
    const px = HexRenderer.hexToPixel(factory.hex);
    const color = RESOURCE_COLORS[factory.resourceType];
    const half = ICON_SIZE / 2;

    // Background
    this.graphics.rect(px.x - half, px.y - half, ICON_SIZE, ICON_SIZE);
    this.graphics.fill({ color: ICON_BG });
    this.graphics.rect(px.x - half, px.y - half, ICON_SIZE, ICON_SIZE);
    this.graphics.stroke({ width: 1, color: ICON_BORDER });

    // Resource color dot
    this.graphics.circle(px.x, px.y, 3);
    this.graphics.fill({ color });

    // Buffer bar above
    const barY = px.y - half - 4;
    const fillRatio = factory.bufferCapacity > 0 ? factory.buffer / factory.bufferCapacity : 0;
    this.graphics.rect(px.x - half, barY, ICON_SIZE, 2);
    this.graphics.fill({ color: BAR_BG });
    this.graphics.rect(px.x - half, barY, ICON_SIZE * fillRatio, 2);
    this.graphics.fill({ color });

    // Level indicator
    if (factory.level > 1) {
      this.drawLevelPips(px.x, px.y + half + 2, factory.level);
    }
  }

  private drawDepot(depot: PlacedDepot): void {
    const px = HexRenderer.hexToPixel(depot.hex);
    const half = ICON_SIZE / 2;

    // Background
    this.graphics.rect(px.x - half, px.y - half, ICON_SIZE, ICON_SIZE);
    this.graphics.fill({ color: ICON_BG });
    this.graphics.rect(px.x - half, px.y - half, ICON_SIZE, ICON_SIZE);
    this.graphics.stroke({ width: 1, color: ICON_BORDER });

    // Cross (+)
    this.graphics.moveTo(px.x - 3, px.y);
    this.graphics.lineTo(px.x + 3, px.y);
    this.graphics.stroke({ width: 1.5, color: 0x333333 });
    this.graphics.moveTo(px.x, px.y - 3);
    this.graphics.lineTo(px.x, px.y + 3);
    this.graphics.stroke({ width: 1.5, color: 0x333333 });

    // Resource bars above
    const resources = [ResourceType.Fuel, ResourceType.Ammo, ResourceType.Food, ResourceType.Parts];
    const totalWidth = resources.length * BAR_WIDTH + (resources.length - 1) * BAR_GAP;
    let barX = px.x - totalWidth / 2;
    const barTop = px.y - half - BAR_HEIGHT - 2;

    for (const res of resources) {
      const fillRatio =
        depot.maxStoragePerResource > 0 ? depot.storage[res] / depot.maxStoragePerResource : 0;

      // Background bar
      this.graphics.rect(barX, barTop, BAR_WIDTH, BAR_HEIGHT);
      this.graphics.fill({ color: BAR_BG });

      // Fill bar (from bottom)
      const fillHeight = BAR_HEIGHT * fillRatio;
      this.graphics.rect(barX, barTop + BAR_HEIGHT - fillHeight, BAR_WIDTH, fillHeight);
      this.graphics.fill({ color: RESOURCE_COLORS[res] });

      barX += BAR_WIDTH + BAR_GAP;
    }

    // Level indicator
    if (depot.level > 1) {
      this.drawLevelPips(px.x, px.y + half + 2, depot.level);
    }
  }

  private drawLevelPips(cx: number, y: number, level: number): void {
    const pipSize = 1.5;
    const gap = 2;
    const totalWidth = level * pipSize + (level - 1) * gap;
    let x = cx - totalWidth / 2;
    for (let i = 0; i < level; i++) {
      this.graphics.circle(x + pipSize / 2, y, pipSize / 2);
      this.graphics.fill({ color: 0xc8a040 });
      x += pipSize + gap;
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
