import { describe, expect, it } from 'vitest';
import { HexGrid } from '../HexGrid';
import { RiverGenerator } from '../RiverGenerator';
import { SettlementPlacer } from '../SettlementPlacer';
import { SmoothingPass } from '../SmoothingPass';
import { TerrainGenerator } from '../TerrainGenerator';
import { SettlementType, TerrainType } from '../types';

describe('SettlementPlacer', () => {
  function makeMap() {
    const cells = TerrainGenerator.generate(40, 30, 'mixed', 42);
    RiverGenerator.generate(cells, 40, 30, 42);
    SmoothingPass.apply(cells, 40, 30);
    return cells;
  }

  describe('place', () => {
    it('places 3-6 cities on a small map', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const cities = [...cells.values()].filter((c) => c.settlement === SettlementType.City);
      expect(cities.length).toBeGreaterThanOrEqual(3);
      expect(cities.length).toBeLessThanOrEqual(6);
    });

    it('places 8-15 towns on a small map', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const towns = [...cells.values()].filter((c) => c.settlement === SettlementType.Town);
      expect(towns.length).toBeGreaterThanOrEqual(8);
      expect(towns.length).toBeLessThanOrEqual(15);
    });

    it('cities are at least 8 hexes apart', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const cities = [...cells.values()].filter((c) => c.settlement === SettlementType.City);
      for (let i = 0; i < cities.length; i++) {
        for (let j = i + 1; j < cities.length; j++) {
          expect(HexGrid.distance(cities[i].coord, cities[j].coord)).toBeGreaterThanOrEqual(8);
        }
      }
    });

    it('cities are on plains or forest terrain', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const cities = [...cells.values()].filter((c) => c.settlement === SettlementType.City);
      for (const city of cities) {
        expect([TerrainType.Plains, TerrainType.Forest]).toContain(city.terrain);
      }
    });

    it('towns are on plains, forest, or hills terrain', () => {
      const cells = makeMap();
      SettlementPlacer.place(cells, 40, 30);
      const towns = [...cells.values()].filter((c) => c.settlement === SettlementType.Town);
      for (const town of towns) {
        expect([TerrainType.Plains, TerrainType.Forest, TerrainType.Hills]).toContain(town.terrain);
      }
    });
  });
});
