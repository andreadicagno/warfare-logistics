import { Container, Graphics } from "pixi.js";
import type { HexCoord } from "@core/map/types";
import { HexRenderer } from "../HexRenderer";

const HOVER_COLOR = 0xc8a040;
const HOVER_FILL_ALPHA = 0.1;
const HOVER_STROKE_WIDTH = 2;

export class SelectionLayer {
	readonly container = new Container();
	private graphics = new Graphics();
	private currentHex: HexCoord | null = null;

	constructor() {
		this.container.addChild(this.graphics);
	}

	setHover(coord: HexCoord | null): boolean {
		if (coord?.q === this.currentHex?.q && coord?.r === this.currentHex?.r) {
			return false;
		}

		this.graphics.clear();
		this.currentHex = coord;

		if (!coord) return true;

		const px = HexRenderer.hexToPixel(coord);
		const verts = HexRenderer.vertices(px.x, px.y);
		const flat = verts.flatMap((v) => [v.x, v.y]);

		this.graphics.poly(flat);
		this.graphics.fill({ color: HOVER_COLOR, alpha: HOVER_FILL_ALPHA });
		this.graphics.poly(flat);
		this.graphics.stroke({ width: HOVER_STROKE_WIDTH, color: HOVER_COLOR });

		return true;
	}

	destroy(): void {
		this.container.removeChildren();
		this.graphics.destroy();
	}
}
