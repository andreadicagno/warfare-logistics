import { ResourceType } from '@data/types';
import type { NetworkGraph } from './NetworkGraph';
import type { PlacedDepot, PlacedFactory, Shipment, SimSupplyLine } from './types';
import { TICKS_PER_DAY } from './types';

let nextShipmentId = 0;

export class DemandResolver {
  static resolve(
    factories: Map<string, PlacedFactory>,
    depots: Map<string, PlacedDepot>,
    supplyLines: Map<string, SimSupplyLine>,
    network: NetworkGraph,
  ): Shipment[] {
    const shipments: Shipment[] = [];
    const resourceTypes = Object.values(ResourceType);

    for (const depot of depots.values()) {
      for (const resType of resourceTypes) {
        const demand = depot.maxStoragePerResource - depot.storage[resType];
        if (demand <= 0) continue;

        // Find sources -- factories producing this resource type with buffer > 0
        const sources: PlacedFactory[] = [];
        for (const factory of factories.values()) {
          if (factory.resourceType === resType && factory.buffer > 0) {
            sources.push(factory);
          }
        }

        if (sources.length === 0) continue;

        // Sort by distance (path length) -- closest first
        const sourcesWithPath = sources
          .map((factory) => ({
            factory,
            path: network.shortestPath(factory.id, depot.id),
          }))
          .filter((s): s is { factory: PlacedFactory; path: string[] } => s.path !== null)
          .sort((a, b) => a.path.length - b.path.length);

        let remainingDemand = demand;

        for (const { factory } of sourcesWithPath) {
          if (remainingDemand <= 0) break;
          if (factory.buffer <= 0) continue;

          // Find the supply line connecting these facilities
          const line = DemandResolver.findLine(factory.id, depot.id, supplyLines);
          if (!line) continue;

          // Check capacity
          const remainingCapacity = line.capacityPerDay - line.capacityUsedToday;
          if (remainingCapacity <= 0) continue;

          // Determine shipment amount
          const perTickCapacity = remainingCapacity / TICKS_PER_DAY;
          const amount = Math.min(factory.buffer, remainingDemand, perTickCapacity);
          if (amount <= 0.001) continue;

          // Deduct from source
          factory.buffer -= amount;

          // Build hex path from factory hex to depot hex via supply line
          const hexPath = line.hexPath;

          shipments.push({
            id: `ship-${++nextShipmentId}`,
            resourceType: resType,
            amount,
            sourceId: factory.id,
            destinationId: depot.id,
            path: hexPath,
            progress: 0,
            speedHexPerHour: line.speedHexPerHour,
          });

          line.capacityUsedToday += amount;
          remainingDemand -= amount;
        }
      }
    }

    return shipments;
  }

  private static findLine(
    sourceId: string,
    destId: string,
    supplyLines: Map<string, SimSupplyLine>,
  ): SimSupplyLine | null {
    for (const line of supplyLines.values()) {
      if (
        line.connectedFacilityIds.includes(sourceId) &&
        line.connectedFacilityIds.includes(destId)
      ) {
        return line;
      }
    }
    return null;
  }
}
