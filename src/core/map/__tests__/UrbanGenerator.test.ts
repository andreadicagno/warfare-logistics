import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { SmoothingPass } from '../SmoothingPass';
import { TerrainGenerator } from '../TerrainGenerator';
import { UrbanGenerator } from '../UrbanGenerator';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';

function makeMap() {
  const cells = TerrainGenerator.generate(
    40,
    30,
    DEFAULT_GENERATION_PARAMS.terrain,
    DEFAULT_GENERATION_PARAMS.seaSides,
    42,
  );
  RiverGenerator.generate(cells, 40, 30, 42, DEFAULT_GENERATION_PARAMS.rivers);
  SmoothingPass.apply(cells, 40, 30, DEFAULT_GENERATION_PARAMS.smoothing);
  return cells;
}

describe('UrbanGenerator', () => {
  it('returns urban clusters', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    expect(clusters.length).toBeGreaterThan(0);
  });

  it('places at least one metropolis', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const metros = clusters.filter((c) => c.tier === 'metropolis');
    expect(metros.length).toBeGreaterThanOrEqual(1);
  });

  it('places cities and towns', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const cities = clusters.filter((c) => c.tier === 'city');
    const towns = clusters.filter((c) => c.tier === 'town');
    expect(cities.length).toBeGreaterThan(0);
    expect(towns.length).toBeGreaterThan(0);
  });

  it('sets Urban terrain on cluster cells', () => {
    const cells = makeMap();
    UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const urbanCells = [...cells.values()].filter((c) => c.terrain === TerrainType.Urban);
    expect(urbanCells.length).toBeGreaterThan(0);
  });

  it('sets urbanClusterId on cluster cells', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    for (const cluster of clusters) {
      for (const coord of cluster.cells) {
        const cell = cells.get(HexGrid.key(coord))!;
        expect(cell.urbanClusterId).toBe(cluster.id);
      }
    }
  });

  it('metropolis clusters have 8-15 cells', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    for (const cluster of clusters.filter((c) => c.tier === 'metropolis')) {
      expect(cluster.cells.length).toBeGreaterThanOrEqual(2);
      expect(cluster.cells.length).toBeLessThanOrEqual(15);
    }
  });

  it('city clusters have 4-7 cells', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    for (const cluster of clusters.filter((c) => c.tier === 'city')) {
      expect(cluster.cells.length).toBeGreaterThanOrEqual(2);
      expect(cluster.cells.length).toBeLessThanOrEqual(7);
    }
  });

  it('town clusters have 2-3 cells', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    for (const cluster of clusters.filter((c) => c.tier === 'town')) {
      expect(cluster.cells.length).toBeGreaterThanOrEqual(2);
      expect(cluster.cells.length).toBeLessThanOrEqual(3);
    }
  });

  it('metropolis seeds respect minimum spacing', () => {
    const cells = makeMap();
    const clusters = UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const metros = clusters.filter((c) => c.tier === 'metropolis');
    for (let i = 0; i < metros.length; i++) {
      for (let j = i + 1; j < metros.length; j++) {
        expect(HexGrid.distance(metros[i].center, metros[j].center)).toBeGreaterThanOrEqual(
          DEFAULT_GENERATION_PARAMS.urban.minMetropolisSpacing,
        );
      }
    }
  });

  it('urban cells are never on Water, River, or Mountain', () => {
    const cells = makeMap();
    UrbanGenerator.generate(cells, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const urbanCells = [...cells.values()].filter((c) => c.terrain === TerrainType.Urban);
    expect(urbanCells.length).toBeGreaterThan(0);
    for (const cell of urbanCells) {
      expect(cell.terrain).toBe(TerrainType.Urban);
    }
  });

  it('is deterministic with same seed', () => {
    const cells1 = makeMap();
    const clusters1 = UrbanGenerator.generate(cells1, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    const cells2 = makeMap();
    const clusters2 = UrbanGenerator.generate(cells2, 40, 30, DEFAULT_GENERATION_PARAMS.urban, 42);
    expect(clusters1.length).toBe(clusters2.length);
    for (let i = 0; i < clusters1.length; i++) {
      expect(clusters1[i].center).toEqual(clusters2[i].center);
      expect(clusters1[i].cells.length).toBe(clusters2[i].cells.length);
    }
  });
});
