import { HexGrid } from '@core/map/HexGrid';
import type { GameMap } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import { describe, expect, it } from 'vitest';
import { MockSimulation } from '../MockSimulation';

function createMiniMap(): GameMap {
  const cells = new Map<string, any>();
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 10; row++) {
      const q = col;
      const r = row - Math.floor(col / 2);
      const key = HexGrid.key({ q, r });
      cells.set(key, {
        coord: { q, r },
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
    supplyHubs: [
      { coord: { q: 2, r: 2 }, size: 'large' },
      { coord: { q: 7, r: 2 }, size: 'large' },
      { coord: { q: 1, r: 5 }, size: 'small' },
    ],
    roads: [
      {
        hexes: [
          { q: 2, r: 2 },
          { q: 3, r: 2 },
          { q: 4, r: 2 },
        ],
        type: 'road' as const,
      },
    ],
    railways: [
      {
        hexes: [
          { q: 2, r: 2 },
          { q: 3, r: 1 },
          { q: 4, r: 1 },
        ],
        type: 'railway' as const,
      },
    ],
  };
}

describe('MockSimulation', () => {
  describe('init', () => {
    it('assigns territory to all land hexes', () => {
      const sim = new MockSimulation(createMiniMap());
      const state = sim.state;
      for (const [key, cell] of createMiniMap().cells) {
        if (cell.terrain !== TerrainType.Water && cell.terrain !== TerrainType.Mountain) {
          expect(state.territory.has(key)).toBe(true);
        }
      }
    });

    it('creates both allied and enemy territory', () => {
      const sim = new MockSimulation(createMiniMap());
      const factions = new Set(sim.state.territory.values());
      expect(factions.has('allied')).toBe(true);
      expect(factions.has('enemy')).toBe(true);
    });

    it('generates front line edges between factions', () => {
      const sim = new MockSimulation(createMiniMap());
      expect(sim.state.frontLineEdges.length).toBeGreaterThan(0);
    });

    it('creates military units for both factions', () => {
      const sim = new MockSimulation(createMiniMap());
      const allied = sim.state.units.filter((u) => u.faction === 'allied');
      const enemy = sim.state.units.filter((u) => u.faction === 'enemy');
      expect(allied.length).toBeGreaterThan(0);
      expect(enemy.length).toBeGreaterThan(0);
    });

    it('creates facilities from supply hubs', () => {
      const sim = new MockSimulation(createMiniMap());
      expect(sim.state.facilities.length).toBe(3);
    });

    it('assigns route health to all routes', () => {
      const sim = new MockSimulation(createMiniMap());
      expect(sim.state.routeStates.length).toBe(2);
    });

    it('creates vehicles on active routes', () => {
      const sim = new MockSimulation(createMiniMap());
      expect(sim.state.vehicles.length).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('advances vehicle positions', () => {
      const sim = new MockSimulation(createMiniMap());
      const v = sim.state.vehicles[0];
      if (!v) return;
      const oldT = v.t;
      sim.update(1 / 60);
      expect(v.t).not.toBe(oldT);
    });

    it('increments version when front moves', () => {
      const sim = new MockSimulation(createMiniMap());
      const oldVersion = sim.state.version;
      // Advance past 30s threshold
      for (let i = 0; i < 31 * 60; i++) {
        sim.update(1 / 60);
      }
      expect(sim.state.version).toBeGreaterThan(oldVersion);
    });

    it('clamps vehicle t between 0 and 1', () => {
      const sim = new MockSimulation(createMiniMap());
      // Run many updates
      for (let i = 0; i < 600; i++) {
        sim.update(1 / 60);
      }
      for (const v of sim.state.vehicles) {
        expect(v.t).toBeGreaterThanOrEqual(0);
        expect(v.t).toBeLessThanOrEqual(1);
      }
    });
  });
});
