import { ResourceType } from '@data/types';
import { describe, expect, it } from 'vitest';
import { DemandResolver } from '../DemandResolver';
import { NetworkGraph } from '../NetworkGraph';
import type { PlacedDepot, PlacedFactory, SimSupplyLine } from '../types';
import { emptyStorage } from '../types';

function makeFactory(overrides: Partial<PlacedFactory> = {}): PlacedFactory {
  return {
    id: 'f1',
    resourceType: ResourceType.Fuel,
    level: 1,
    hex: { q: 0, r: 0 },
    buffer: 10,
    bufferCapacity: 20,
    productionPerDay: 10,
    connectedLineIds: ['sl1'],
    ...overrides,
  };
}

function makeDepot(overrides: Partial<PlacedDepot> = {}): PlacedDepot {
  return {
    id: 'd1',
    level: 1,
    hex: { q: 3, r: 0 },
    storage: emptyStorage(),
    maxStoragePerResource: 50,
    throughputPerDay: 60,
    throughputUsedToday: 0,
    connectedLineIds: ['sl1'],
    ...overrides,
  };
}

function makeSupplyLine(overrides: Partial<SimSupplyLine> = {}): SimSupplyLine {
  return {
    id: 'sl1',
    level: 1,
    hexPath: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 3, r: 0 },
    ],
    capacityPerDay: 30,
    speedHexPerHour: 5,
    capacityUsedToday: 0,
    connectedFacilityIds: ['f1', 'd1'],
    ...overrides,
  };
}

function buildGraph(
  _factories: PlacedFactory[],
  _depots: PlacedDepot[],
  lines: SimSupplyLine[],
): NetworkGraph {
  const graph = new NetworkGraph();
  for (const line of lines) {
    for (const facId of line.connectedFacilityIds) {
      for (const otherId of line.connectedFacilityIds) {
        if (facId !== otherId) {
          graph.addEdge(facId, otherId, 1 / line.speedHexPerHour);
        }
      }
    }
  }
  return graph;
}

describe('DemandResolver', () => {
  it('creates a shipment from factory to demanding depot', () => {
    const factory = makeFactory({ buffer: 10 });
    const depot = makeDepot({ storage: emptyStorage() });
    const line = makeSupplyLine();
    const graph = buildGraph([factory], [depot], [line]);

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map([['sl1', line]]),
      graph,
    );

    expect(shipments.length).toBeGreaterThan(0);
    expect(shipments[0].sourceId).toBe('f1');
    expect(shipments[0].destinationId).toBe('d1');
    expect(shipments[0].resourceType).toBe(ResourceType.Fuel);
    expect(factory.buffer).toBeLessThan(10);
  });

  it('does not create shipment when depot is full', () => {
    const depot = makeDepot({
      storage: {
        [ResourceType.Fuel]: 50,
        [ResourceType.Ammo]: 50,
        [ResourceType.Food]: 50,
        [ResourceType.Parts]: 50,
      },
    });
    const factory = makeFactory({ buffer: 10 });
    const line = makeSupplyLine();
    const graph = buildGraph([factory], [depot], [line]);

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map([['sl1', line]]),
      graph,
    );

    expect(shipments).toHaveLength(0);
  });

  it('does not create shipment when factory buffer is empty', () => {
    const factory = makeFactory({ buffer: 0 });
    const depot = makeDepot();
    const line = makeSupplyLine();
    const graph = buildGraph([factory], [depot], [line]);

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map([['sl1', line]]),
      graph,
    );

    expect(shipments).toHaveLength(0);
  });

  it('respects supply line capacity per day', () => {
    const factory = makeFactory({ buffer: 20 });
    const depot = makeDepot();
    const line = makeSupplyLine({ capacityPerDay: 5, capacityUsedToday: 5 });
    const graph = buildGraph([factory], [depot], [line]);

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map([['sl1', line]]),
      graph,
    );

    expect(shipments).toHaveLength(0);
  });

  it('does not create shipment when no path exists', () => {
    const factory = makeFactory({ connectedLineIds: [] });
    const depot = makeDepot({ connectedLineIds: [] });
    const graph = new NetworkGraph(); // empty graph

    const shipments = DemandResolver.resolve(
      new Map([['f1', factory]]),
      new Map([['d1', depot]]),
      new Map(),
      graph,
    );

    expect(shipments).toHaveLength(0);
  });
});
