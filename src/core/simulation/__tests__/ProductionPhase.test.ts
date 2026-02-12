import { ResourceType } from '@data/types';
import { describe, expect, it } from 'vitest';
import { ProductionPhase } from '../ProductionPhase';
import type { PlacedFactory } from '../types';
import { TICKS_PER_DAY } from '../types';

function makeFactory(overrides: Partial<PlacedFactory> = {}): PlacedFactory {
  return {
    id: 'f1',
    resourceType: ResourceType.Fuel,
    level: 1,
    hex: { q: 0, r: 0 },
    buffer: 0,
    bufferCapacity: 20,
    productionPerDay: 10,
    connectedLineIds: [],
    ...overrides,
  };
}

describe('ProductionPhase', () => {
  it('adds per-tick production to the factory buffer', () => {
    const factory = makeFactory();
    ProductionPhase.run([factory]);
    const expectedPerTick = 10 / TICKS_PER_DAY;
    expect(factory.buffer).toBeCloseTo(expectedPerTick);
  });

  it('caps buffer at bufferCapacity', () => {
    const factory = makeFactory({ buffer: 19.999, bufferCapacity: 20 });
    ProductionPhase.run([factory]);
    expect(factory.buffer).toBe(20);
  });

  it('does not exceed bufferCapacity even with high production', () => {
    const factory = makeFactory({ buffer: 20, bufferCapacity: 20 });
    ProductionPhase.run([factory]);
    expect(factory.buffer).toBe(20);
  });

  it('processes multiple factories independently', () => {
    const f1 = makeFactory({ id: 'f1', buffer: 0, productionPerDay: 10 });
    const f2 = makeFactory({ id: 'f2', buffer: 10, productionPerDay: 25 });
    ProductionPhase.run([f1, f2]);
    expect(f1.buffer).toBeCloseTo(10 / TICKS_PER_DAY);
    expect(f2.buffer).toBeCloseTo(10 + 25 / TICKS_PER_DAY);
  });
});
