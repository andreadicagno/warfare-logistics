import { describe, expect, it } from 'vitest';
import { DEFAULT_GENERATION_PARAMS, TerrainType } from '../types';

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
