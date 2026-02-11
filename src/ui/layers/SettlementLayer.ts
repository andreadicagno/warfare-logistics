import { Container, Graphics } from "pixi.js";
import { HexGrid } from "@core/map/HexGrid";
import type { GameMap } from "@core/map/types";
import { SettlementType } from "@core/map/types";
import { HexRenderer } from "../HexRenderer";

const CITY_FILL = 0xd4c8a0;
const CITY_BORDER = 0x2a2a35;
const CITY_RADIUS = 8;
const TOWN_FILL = 0xa09880;
const TOWN_RADIUS = 4;

export class SettlementLayer {
	readonly container = new Container();
	private graphics = new Graphics();
	private gameMap: GameMap;

	constructor(gameMap: GameMap) {
		this.gameMap = gameMap;
		this.container.addChild(this.graphics);
	}

	build(bounds: {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
	}): void {
		this.graphics.clear();

		const margin = HexRenderer.HEX_SIZE * 2;
		const minQ = Math.max(
			0,
			HexRenderer.pixelToHex(bounds.minX - margin, bounds.minY).q - 1,
		);
		const maxQ = Math.min(
			this.gameMap.width - 1,
			HexRenderer.pixelToHex(bounds.maxX + margin, bounds.maxY).q + 1,
		);
		const minR = Math.max(
			0,
			HexRenderer.pixelToHex(bounds.minX, bounds.minY - margin).r - 1,
		);
		const maxR = Math.min(
			this.gameMap.height - 1,
			HexRenderer.pixelToHex(bounds.maxX, bounds.maxY + margin).r + 1,
		);

		for (let q = minQ; q <= maxQ; q++) {
			for (let r = minR; r <= maxR; r++) {
				const cell = this.gameMap.cells.get(HexGrid.key({ q, r }));
				if (!cell || cell.settlement === null) continue;

				const px = HexRenderer.hexToPixel(cell.coord);

				if (cell.settlement === SettlementType.City) {
					this.graphics.circle(px.x, px.y, CITY_RADIUS);
					this.graphics.fill({ color: CITY_FILL });
					this.graphics.circle(px.x, px.y, CITY_RADIUS);
					this.graphics.stroke({ width: 2, color: CITY_BORDER });
				} else {
					this.graphics.circle(px.x, px.y, TOWN_RADIUS);
					this.graphics.fill({ color: TOWN_FILL });
				}
			}
		}
	}

	destroy(): void {
		this.container.removeChildren();
		this.graphics.destroy();
	}
}
