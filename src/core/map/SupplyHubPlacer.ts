import { HexGrid } from './HexGrid';
import { mulberry32 } from './rng';
import type { HexCell, HexCoord, SupplyHub, UrbanCluster } from './types';
import { TerrainType } from './types';

export class SupplyHubPlacer {
  static place(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    clusters: UrbanCluster[],
    seed: number,
  ): SupplyHub[] {
    const rng = mulberry32(seed + 6271);
    const hubs: SupplyHub[] = [];
    const usedKeys = new Set<string>();

    // 1 large hub per metropolis (at center)
    for (const cluster of clusters.filter((c) => c.tier === 'metropolis')) {
      const key = HexGrid.key(cluster.center);
      if (!usedKeys.has(key)) {
        hubs.push({ coord: cluster.center, size: 'large' });
        usedKeys.add(key);
      }
    }

    // 1 large hub per 2 cities (at center of selected cities)
    const cities = clusters.filter((c) => c.tier === 'city');
    const cityHubCount = Math.max(1, Math.floor(cities.length / 2));
    for (let i = 0; i < cityHubCount && i < cities.length; i++) {
      const key = HexGrid.key(cities[i].center);
      if (!usedKeys.has(key)) {
        hubs.push({ coord: cities[i].center, size: 'large' });
        usedKeys.add(key);
      }
    }

    // 2-4 small hubs in strategic rural positions
    const smallCount = 2 + Math.floor(rng() * 3);
    const ruralCandidates = SupplyHubPlacer.findRuralPositions(
      cells,
      width,
      height,
      usedKeys,
      clusters,
    );

    for (let i = 0; i < smallCount && i < ruralCandidates.length; i++) {
      const coord = ruralCandidates[i];
      const key = HexGrid.key(coord);
      if (!usedKeys.has(key)) {
        hubs.push({ coord, size: 'small' });
        usedKeys.add(key);
      }
    }

    return hubs;
  }

  private static findRuralPositions(
    cells: Map<string, HexCell>,
    width: number,
    height: number,
    usedKeys: Set<string>,
    clusters: UrbanCluster[],
  ): HexCoord[] {
    const forbidden = new Set([TerrainType.Water, TerrainType.Mountain, TerrainType.River]);
    const clusterCenters = clusters.map((c) => c.center);
    const candidates: Array<{ coord: HexCoord; score: number }> = [];

    for (const cell of cells.values()) {
      if (forbidden.has(cell.terrain)) continue;
      if (cell.terrain === TerrainType.Urban) continue;
      const key = HexGrid.key(cell.coord);
      if (usedKeys.has(key)) continue;

      let score = 0;

      // Edge proximity bonus
      const col = cell.coord.q;
      const row = cell.coord.r + Math.floor(cell.coord.q / 2);
      const edgeDist = Math.min(col, width - 1 - col, row, height - 1 - row);
      if (edgeDist < 5) score += 3;

      // Midway between clusters bonus
      if (clusterCenters.length >= 2) {
        let minDist = Infinity;
        for (const center of clusterCenters) {
          const d = HexGrid.distance(cell.coord, center);
          if (d < minDist) minDist = d;
        }
        if (minDist >= 5 && minDist <= 15) score += 2;
      }

      // Passable neighbors bonus
      const neighbors = HexGrid.neighbors(cell.coord)
        .filter((n) => HexGrid.inBounds(n, width, height))
        .map((n) => cells.get(HexGrid.key(n))!)
        .filter(Boolean);
      const passable = neighbors.filter((n) => !forbidden.has(n.terrain));
      if (passable.length >= 5) score += 1;

      candidates.push({ coord: cell.coord, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    // Space them out: at least 8 hexes apart
    const selected: HexCoord[] = [];
    for (const c of candidates) {
      if (selected.some((s) => HexGrid.distance(s, c.coord) < 8)) continue;
      selected.push(c.coord);
      if (selected.length >= 10) break;
    }

    return selected;
  }
}
