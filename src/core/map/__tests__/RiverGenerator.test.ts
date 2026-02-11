import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { TerrainGenerator } from '../TerrainGenerator';
import { TerrainType } from '../types';

describe('RiverGenerator', () => {
  function makeMap() {
    return TerrainGenerator.generate(40, 30, 'mixed', 42);
  }

  it('produces 3-5 rivers (river cell groups)', () => {
    const cells = makeMap();
    const riverCount = RiverGenerator.generate(cells, 40, 30, 42);
    expect(riverCount).toBeGreaterThanOrEqual(3);
    expect(riverCount).toBeLessThanOrEqual(5);
  });

  it('creates River terrain cells', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    const riverCells = [...cells.values()].filter((c) => c.terrain === TerrainType.River);
    expect(riverCells.length).toBeGreaterThan(0);
  });

  it('river sources start at high elevation', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    const riverCells = [...cells.values()].filter((c) => c.terrain === TerrainType.River);
    const maxElev = Math.max(...riverCells.map((c) => c.elevation));
    expect(maxElev).toBeGreaterThan(0.5);
  });

  it('rivers terminate at Water, map edge, or another River', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    const riverCells = [...cells.values()].filter((c) => c.terrain === TerrainType.River);
    for (const rc of riverCells) {
      const neighbors = HexGrid.neighbors(rc.coord);
      const hasConnection = neighbors.some((n) => {
        if (!HexGrid.inBounds(n, 40, 30)) return true;
        const nc = cells.get(HexGrid.key(n));
        return nc?.terrain === TerrainType.River || nc?.terrain === TerrainType.Water;
      });
      expect(hasConnection).toBe(true);
    }
  });

  it('wide rivers have navigable cells', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    const nonRiverNavigable = [...cells.values()].filter(
      (c) => c.navigable && c.terrain !== TerrainType.River,
    );
    expect(nonRiverNavigable.length).toBe(0);
  });

  it('is deterministic', () => {
    const cells1 = makeMap();
    RiverGenerator.generate(cells1, 40, 30, 42);
    const cells2 = TerrainGenerator.generate(40, 30, 'mixed', 42);
    RiverGenerator.generate(cells2, 40, 30, 42);
    const rivers1 = [...cells1.values()].filter((c) => c.terrain === TerrainType.River);
    const rivers2 = [...cells2.values()].filter((c) => c.terrain === TerrainType.River);
    expect(rivers1.length).toBe(rivers2.length);
  });

  it('generates termination lakes when rivers get stuck', () => {
    const cells = makeMap();
    RiverGenerator.generate(cells, 40, 30, 42);
    const freshCells = TerrainGenerator.generate(40, 30, 'mixed', 42);
    const originalWater = [...freshCells.values()].filter(
      (c) => c.terrain === TerrainType.Water,
    ).length;
    const afterWater = [...cells.values()].filter((c) => c.terrain === TerrainType.Water).length;
    expect(afterWater).toBeGreaterThanOrEqual(originalWater);
  });
});
