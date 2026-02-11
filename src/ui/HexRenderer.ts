import { HexGrid } from '@core/map/HexGrid';
import type { HexCoord } from '@core/map/types';

export class HexRenderer {
	static readonly HEX_SIZE = 16;

	static vertices(cx: number, cy: number): Array<{ x: number; y: number }> {
		const verts: Array<{ x: number; y: number }> = [];
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i;
			verts.push({
				x: cx + HexRenderer.HEX_SIZE * Math.cos(angle),
				y: cy + HexRenderer.HEX_SIZE * Math.sin(angle),
			});
		}
		return verts;
	}

	static edgeMidpoint(
		cx: number,
		cy: number,
		edge: number,
	): { x: number; y: number } {
		const verts = HexRenderer.vertices(cx, cy);
		const a = verts[edge];
		const b = verts[(edge + 1) % 6];
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	static hexToPixel(coord: HexCoord): { x: number; y: number } {
		const unit = HexGrid.toPixel(coord);
		return {
			x: unit.x * HexRenderer.HEX_SIZE,
			y: unit.y * HexRenderer.HEX_SIZE,
		};
	}

	static pixelToHex(x: number, y: number): HexCoord {
		return HexGrid.fromPixel(
			x / HexRenderer.HEX_SIZE,
			y / HexRenderer.HEX_SIZE,
		);
	}
}
