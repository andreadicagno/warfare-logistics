import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { SmoothingPass } from '../SmoothingPass';
import { SupplyHubPlacer } from '../SupplyHubPlacer';
import { TerrainGenerator } from '../TerrainGenerator';
import { UrbanGenerator } from '../UrbanGenerator';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';

function makeMapWithClusters() {
  const cells = TerrainGenerator.generate(
    40,
    30,
    DEFAULT_GENERATION_PARAMS.terrain,
    DEFAULT_GENERATION_PARAMS.seaSides,
    42,
  );
  RiverGenerator.generate(cells, 40, 30, 42, DEFAULT_GENERATION_PARAMS.rivers);
  SmoothingPass.apply(cells, 40, 30, DEFAULT_GENERATION_PARAMS.smoothing);
  const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
  return { cells, clusters };
}

describe('SupplyHubPlacer', () => {
  it('returns supply hubs', () => {
    const { cells, clusters } = makeMapWithClusters();
    const hubs = SupplyHubPlacer.place(cells, 40, 30, clusters, 42);
    expect(hubs.length).toBeGreaterThan(0);
  });

  it('places large hubs at metropolis centers', () => {
    const { cells, clusters } = makeMapWithClusters();
    const hubs = SupplyHubPlacer.place(cells, 40, 30, clusters, 42);
    const metros = clusters.filter((c) => c.tier === 'metropolis');
    for (const metro of metros) {
      const hub = hubs.find(
        (h) => h.coord.q === metro.center.q && h.coord.r === metro.center.r,
      );
      expect(hub).toBeDefined();
      expect(hub!.size).toBe('large');
    }
  });

  it('hubs are not on Water or Mountain', () => {
    const { cells, clusters } = makeMapWithClusters();
    const hubs = SupplyHubPlacer.place(cells, 40, 30, clusters, 42);
    for (const hub of hubs) {
      const cell = cells.get(HexGrid.key(hub.coord))!;
      expect(cell.terrain).not.toBe(TerrainType.Water);
      expect(cell.terrain).not.toBe(TerrainType.Mountain);
    }
  });

  it('has both large and small hubs', () => {
    const { cells, clusters } = makeMapWithClusters();
    const hubs = SupplyHubPlacer.place(cells, 40, 30, clusters, 42);
    expect(hubs.some((h) => h.size === 'large')).toBe(true);
    expect(hubs.some((h) => h.size === 'small')).toBe(true);
  });
});
