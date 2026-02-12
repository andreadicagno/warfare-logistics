import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import type { SimulationState } from '@core/simulation/types';
import { IMPASSABLE_TERRAIN } from '@core/simulation/types';
import { Container, Graphics } from 'pixi.js';
import { HexRenderer } from '../HexRenderer';

const VALID_COLOR = 0x44aa44;
const INVALID_COLOR = 0xcc3333;
const OVERLAY_ALPHA = 0.2;

export class PlacementOverlay {
  readonly container = new Container();
  private graphics = new Graphics();
  private lastHexKey: string | null = null;
  private lastValid: boolean | null = null;

  constructor() {
    this.container.addChild(this.graphics);
  }

  update(
    hex: HexCoord | null,
    gameMap: GameMap,
    state: SimulationState,
    isPlacementTool: boolean,
  ): void {
    if (!hex || !isPlacementTool) {
      if (this.lastHexKey !== null) {
        this.graphics.clear();
        this.lastHexKey = null;
        this.lastValid = null;
      }
      return;
    }

    const key = HexGrid.key(hex);
    const valid = this.canPlace(hex, gameMap, state);

    if (key === this.lastHexKey && valid === this.lastValid) return;

    this.lastHexKey = key;
    this.lastValid = valid;
    this.graphics.clear();

    const px = HexRenderer.hexToPixel(hex);
    const verts = HexRenderer.vertices(px.x, px.y);
    const flat = verts.flatMap((v) => [v.x, v.y]);

    const color = valid ? VALID_COLOR : INVALID_COLOR;
    this.graphics.poly(flat);
    this.graphics.fill({ color, alpha: OVERLAY_ALPHA });
  }

  private canPlace(hex: HexCoord, gameMap: GameMap, state: SimulationState): boolean {
    if (!HexGrid.inBounds(hex, gameMap.width, gameMap.height)) return false;
    const cell = gameMap.cells.get(HexGrid.key(hex));
    if (!cell || IMPASSABLE_TERRAIN.has(cell.terrain)) return false;
    if (state.occupiedHexes.has(HexGrid.key(hex))) return false;
    return true;
  }

  destroy(): void {
    this.container.removeChildren();
    this.graphics.destroy();
  }
}
