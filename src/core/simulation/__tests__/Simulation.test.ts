import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCell } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { ResourceType } from '@data/types';
import { describe, expect, it } from 'vitest';
import { Simulation } from '../Simulation';

function makeMap(): GameMap {
  const cells = new Map<string, HexCell>();
  // Create a 10x10 plains grid
  for (let q = 0; q < 10; q++) {
    for (let r = 0; r < 10; r++) {
      const coord = { q, r };
      cells.set(HexGrid.key(coord), {
        coord,
        terrain: TerrainType.Plains,
        elevation: 0.5,
        moisture: 0.5,
        urbanClusterId: null,
      });
    }
  }
  return {
    width: 10,
    height: 10,
    seed: 42,
    cells,
    urbanClusters: [],
    supplyHubs: [],
    supplyLines: [],
  };
}

describe('Simulation', () => {
  it('initializes at tick 0', () => {
    const sim = new Simulation(makeMap());
    expect(sim.state.tick).toBe(0);
  });

  it('adds a factory on a valid hex', () => {
    const sim = new Simulation(makeMap());
    const result = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    expect(result).not.toBeNull();
    expect(sim.state.factories.size).toBe(1);
    expect(sim.state.occupiedHexes.has(HexGrid.key({ q: 0, r: 0 }))).toBe(true);
  });

  it('rejects factory on occupied hex', () => {
    const sim = new Simulation(makeMap());
    sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    const result = sim.addFactory({ q: 0, r: 0 }, ResourceType.Ammo);
    expect(result).toBeNull();
  });

  it('rejects factory on water terrain', () => {
    const map = makeMap();
    const waterHex = { q: 5, r: 5 };
    map.cells.set(HexGrid.key(waterHex), {
      coord: waterHex,
      terrain: TerrainType.Water,
      elevation: 0,
      moisture: 1,
      urbanClusterId: null,
    });
    const sim = new Simulation(map);
    const result = sim.addFactory(waterHex, ResourceType.Fuel);
    expect(result).toBeNull();
  });

  it('adds a depot on a valid hex', () => {
    const sim = new Simulation(makeMap());
    const result = sim.addDepot({ q: 3, r: 3 });
    expect(result).not.toBeNull();
    expect(sim.state.depots.size).toBe(1);
  });

  it('adds a supply line between two hexes', () => {
    const sim = new Simulation(makeMap());
    const result = sim.addSupplyLine({ q: 0, r: 0 }, { q: 3, r: 0 });
    expect(result).not.toBeNull();
    expect(sim.state.supplyLines.size).toBe(1);
    expect(result!.hexPath.length).toBeGreaterThanOrEqual(2);
  });

  it('auto-connects facilities adjacent to supply line', () => {
    const sim = new Simulation(makeMap());
    const factory = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    const depot = sim.addDepot({ q: 3, r: 0 });
    const line = sim.addSupplyLine({ q: 0, r: 0 }, { q: 3, r: 0 });

    expect(factory!.connectedLineIds).toContain(line!.id);
    expect(depot!.connectedLineIds).toContain(line!.id);
    expect(line!.connectedFacilityIds).toContain(factory!.id);
    expect(line!.connectedFacilityIds).toContain(depot!.id);
  });

  it('advances tick and produces resources', () => {
    const sim = new Simulation(makeMap());
    sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    sim.tick();
    expect(sim.state.tick).toBe(1);
    const factory = [...sim.state.factories.values()][0];
    expect(factory.buffer).toBeGreaterThan(0);
  });

  it('removes a factory via demolish', () => {
    const sim = new Simulation(makeMap());
    const factory = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    sim.demolish(factory!.id);
    expect(sim.state.factories.size).toBe(0);
    expect(sim.state.occupiedHexes.has(HexGrid.key({ q: 0, r: 0 }))).toBe(false);
  });

  it('removes a supply line via demolish', () => {
    const sim = new Simulation(makeMap());
    const line = sim.addSupplyLine({ q: 0, r: 0 }, { q: 3, r: 0 });
    sim.demolish(line!.id);
    expect(sim.state.supplyLines.size).toBe(0);
  });

  it('upgrades a factory', () => {
    const sim = new Simulation(makeMap());
    const factory = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    sim.upgrade(factory!.id);
    const upgraded = sim.state.factories.get(factory!.id);
    expect(upgraded!.level).toBe(2);
    expect(upgraded!.productionPerDay).toBe(25);
    expect(upgraded!.bufferCapacity).toBe(50);
  });

  it('does not upgrade beyond level 5', () => {
    const sim = new Simulation(makeMap());
    const factory = sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    for (let i = 0; i < 5; i++) sim.upgrade(factory!.id);
    const f = sim.state.factories.get(factory!.id)!;
    expect(f.level).toBe(5);
  });

  it('resets daily capacities at start of new day', () => {
    const sim = new Simulation(makeMap());
    sim.addFactory({ q: 0, r: 0 }, ResourceType.Fuel);
    sim.addDepot({ q: 3, r: 0 });
    const line = sim.addSupplyLine({ q: 0, r: 0 }, { q: 3, r: 0 });

    // Simulate one full day
    for (let i = 0; i < 1440; i++) sim.tick();

    const sl = sim.state.supplyLines.get(line!.id)!;
    // capacityUsedToday should have been reset at tick 1440
    expect(sl.capacityUsedToday).toBeLessThanOrEqual(sl.capacityPerDay);
  });
});
