import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GENERATION_PARAMS,
  SUPPLY_LINE_CAPACITY,
  type SupplyLine,
  TerrainType,
} from '../types';

describe('TerrainType', () => {
  it('includes River', () => {
    expect(TerrainType.River).toBe('river');
  });
});

describe('DEFAULT_GENERATION_PARAMS', () => {
  it('has valid map dimensions', () => {
    expect(DEFAULT_GENERATION_PARAMS.width).toBe(200);
    expect(DEFAULT_GENERATION_PARAMS.height).toBe(150);
  });

  it('has all sea sides enabled by default', () => {
    expect(DEFAULT_GENERATION_PARAMS.seaSides).toEqual({
      north: true,
      south: true,
      east: true,
      west: true,
    });
  });

  it('has terrain thresholds in ascending order', () => {
    const t = DEFAULT_GENERATION_PARAMS.terrain;
    expect(t.waterThreshold).toBeLessThan(t.coastalThreshold);
    expect(t.coastalThreshold).toBeLessThan(t.lowlandThreshold);
    expect(t.lowlandThreshold).toBeLessThan(t.highlandThreshold);
  });

  it('has noise weights that sum to approximately 1', () => {
    const t = DEFAULT_GENERATION_PARAMS.terrain;
    const sum = t.noiseWeightLarge + t.noiseWeightMedium + t.noiseWeightDetail;
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('has river min sources <= max sources', () => {
    const r = DEFAULT_GENERATION_PARAMS.rivers;
    expect(r.minSources).toBeLessThanOrEqual(r.maxSources);
  });

  it('has lake min size <= max size', () => {
    const r = DEFAULT_GENERATION_PARAMS.rivers;
    expect(r.lakeMinSize).toBeLessThanOrEqual(r.lakeMaxSize);
  });
});

describe('SupplyLine types', () => {
  it('SUPPLY_LINE_CAPACITY has 5 levels with progressive scaling', () => {
    expect(SUPPLY_LINE_CAPACITY).toHaveLength(5);
    for (let i = 1; i < SUPPLY_LINE_CAPACITY.length; i++) {
      expect(SUPPLY_LINE_CAPACITY[i]).toBeGreaterThan(SUPPLY_LINE_CAPACITY[i - 1]);
    }
  });

  it('SUPPLY_LINE_CAPACITY matches design values', () => {
    expect(SUPPLY_LINE_CAPACITY).toEqual([10, 25, 60, 150, 400]);
  });

  it('SupplyLine interface supports required fields', () => {
    const line: SupplyLine = {
      hexes: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      level: 1,
      state: 'active',
      buildProgress: 1,
      flow: 0,
      capacity: 10,
    };
    expect(line.level).toBe(1);
    expect(line.state).toBe('active');
  });

  it('DEFAULT_GENERATION_PARAMS uses supplyLines key', () => {
    expect(DEFAULT_GENERATION_PARAMS.supplyLines).toBeDefined();
    expect((DEFAULT_GENERATION_PARAMS as any).roads).toBeUndefined();
  });
});
