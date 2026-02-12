import type { SimSupplyLine, SimulationState } from '@core/simulation/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const LINE_COLOR = 0x8888aa;
const LINE_WIDTH_BY_LEVEL = [1.5, 2, 2.5, 3, 3.5];

export class PlaygroundSupplyLineLayer {
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

    for (const line of state.supplyLines.values()) {
      this.drawLine(line);
    }
  }

  private drawLine(line: SimSupplyLine): void {
    if (line.hexPath.length < 2) return;

    const width = LINE_WIDTH_BY_LEVEL[line.level - 1] ?? 1.5;
    const firstPx = HexRenderer.hexToPixel(line.hexPath[0]);
    this.graphics.moveTo(firstPx.x, firstPx.y);

    for (let i = 1; i < line.hexPath.length; i++) {
      const px = HexRenderer.hexToPixel(line.hexPath[i]);
      this.graphics.lineTo(px.x, px.y);
    }

    this.graphics.stroke({ width, color: LINE_COLOR, alpha: 0.7 });
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
