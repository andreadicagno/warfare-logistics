import { describe, expect, it } from 'vitest';
import { TerrainType } from '../types';

describe('TerrainType', () => {
  it('includes River', () => {
    expect(TerrainType.River).toBe('river');
  });
});
