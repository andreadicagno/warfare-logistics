import type { PlacedFactory } from './types';
import { TICKS_PER_DAY } from './types';

export class ProductionPhase {
  static run(factories: PlacedFactory[]): void {
    for (const factory of factories) {
      if (factory.buffer >= factory.bufferCapacity) continue;
      const perTick = factory.productionPerDay / TICKS_PER_DAY;
      factory.buffer = Math.min(factory.buffer + perTick, factory.bufferCapacity);
    }
  }
}
