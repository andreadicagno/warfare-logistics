import { FacilityType, ResourceType, RouteStatus } from '@data/types';
import { describe, expect, it } from 'vitest';

describe('ResourceType enum', () => {
  it('should define all four resource types', () => {
    expect(Object.values(ResourceType)).toHaveLength(4);
    expect(ResourceType.Fuel).toBe('fuel');
  });
});

describe('FacilityType enum', () => {
  it('should define all facility types', () => {
    expect(Object.values(FacilityType)).toHaveLength(4);
  });
});

describe('RouteStatus enum', () => {
  it('should include operational and destroyed states', () => {
    expect(RouteStatus.Operational).toBe('operational');
    expect(RouteStatus.Destroyed).toBe('destroyed');
  });
});
