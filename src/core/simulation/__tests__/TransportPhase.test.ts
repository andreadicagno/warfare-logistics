import { ResourceType } from '@data/types';
import { describe, expect, it } from 'vitest';
import { TransportPhase } from '../TransportPhase';
import type { PlacedDepot, Shipment } from '../types';
import { emptyStorage } from '../types';

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 's1',
    resourceType: ResourceType.Fuel,
    amount: 5,
    sourceId: 'f1',
    destinationId: 'd1',
    path: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ],
    progress: 0,
    speedHexPerHour: 60, // 1 hex/min = 60 hex/hr -> crosses 3-hex path in 3 ticks
    ...overrides,
  };
}

function makeDepot(overrides: Partial<PlacedDepot> = {}): PlacedDepot {
  return {
    id: 'd1',
    level: 1,
    hex: { q: 2, r: 0 },
    storage: emptyStorage(),
    maxStoragePerResource: 50,
    throughputPerDay: 60,
    throughputUsedToday: 0,
    connectedLineIds: [],
    ...overrides,
  };
}

describe('TransportPhase', () => {
  it('advances shipment progress based on speed and path length', () => {
    const shipment = makeShipment({ speedHexPerHour: 6 }); // 0.1 hex/min
    const depots = new Map<string, PlacedDepot>();
    const result = TransportPhase.run([shipment], depots);
    // progress increment = speedHexPerHour / (pathLength * 60) = 6 / (3 * 60) = 0.0333...
    expect(shipment.progress).toBeCloseTo(1 / 30);
    expect(result.delivered).toHaveLength(0);
    expect(result.active).toHaveLength(1);
  });

  it('delivers shipment when progress >= 1.0', () => {
    const shipment = makeShipment({ progress: 0.99, speedHexPerHour: 60 });
    const depot = makeDepot();
    const depots = new Map([['d1', depot]]);
    const result = TransportPhase.run([shipment], depots);
    expect(result.delivered).toHaveLength(1);
    expect(result.active).toHaveLength(0);
    expect(depot.storage[ResourceType.Fuel]).toBe(5);
  });

  it('caps delivered resources at depot max storage', () => {
    const shipment = makeShipment({ progress: 0.99, speedHexPerHour: 60, amount: 100 });
    const depot = makeDepot({ storage: { ...emptyStorage(), [ResourceType.Fuel]: 40 } });
    const depots = new Map([['d1', depot]]);
    TransportPhase.run([shipment], depots);
    expect(depot.storage[ResourceType.Fuel]).toBe(50);
  });

  it('drops shipment if destination depot no longer exists', () => {
    const shipment = makeShipment({ progress: 0.99, speedHexPerHour: 60 });
    const depots = new Map<string, PlacedDepot>();
    const result = TransportPhase.run([shipment], depots);
    expect(result.delivered).toHaveLength(1);
    expect(result.active).toHaveLength(0);
  });
});
