import type { PlacedDepot, Shipment } from './types';

export interface TransportResult {
  active: Shipment[];
  delivered: Shipment[];
}

export class TransportPhase {
  static run(shipments: Shipment[], depots: Map<string, PlacedDepot>): TransportResult {
    const active: Shipment[] = [];
    const delivered: Shipment[] = [];

    for (const shipment of shipments) {
      const pathLength = shipment.path.length;
      const progressPerTick = shipment.speedHexPerHour / (pathLength * 60);
      shipment.progress += progressPerTick;

      if (shipment.progress >= 1.0) {
        // Deliver
        const depot = depots.get(shipment.destinationId);
        if (depot) {
          const space = depot.maxStoragePerResource - depot.storage[shipment.resourceType];
          const toDeliver = Math.min(shipment.amount, Math.max(0, space));
          depot.storage[shipment.resourceType] += toDeliver;
        }
        delivered.push(shipment);
      } else {
        active.push(shipment);
      }
    }

    return { active, delivered };
  }
}
