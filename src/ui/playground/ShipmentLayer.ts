import type { Shipment } from '@core/simulation/types';
import { RESOURCE_COLORS } from '@core/simulation/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const PARTICLE_RADIUS = 2.5;

export class ShipmentLayer {
  readonly container = new Container();
  private graphics = new Graphics();

  constructor() {
    this.container.addChild(this.graphics);
  }

  update(shipments: Shipment[]): void {
    this.graphics.clear();

    for (const shipment of shipments) {
      if (shipment.path.length < 2) continue;

      // Interpolate position along path
      const totalSegments = shipment.path.length - 1;
      const exactPos = shipment.progress * totalSegments;
      const segIndex = Math.min(Math.floor(exactPos), totalSegments - 1);
      const segProgress = exactPos - segIndex;

      const fromPx = HexRenderer.hexToPixel(shipment.path[segIndex]);
      const toPx = HexRenderer.hexToPixel(shipment.path[segIndex + 1]);

      const x = fromPx.x + (toPx.x - fromPx.x) * segProgress;
      const y = fromPx.y + (toPx.y - fromPx.y) * segProgress;

      const color = RESOURCE_COLORS[shipment.resourceType];

      this.graphics.circle(x, y, PARTICLE_RADIUS);
      this.graphics.fill({ color, alpha: 0.9 });
    }
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
