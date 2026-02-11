import { HexGrid } from '@core/map/HexGrid';
import { mulberry32 } from '@core/map/rng';
import type { GameMap, HexCoord, RoutePath } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import type { ResourceStorage } from '@data/types';
import type { Faction, MockFacility, MockState, RouteHealth, UnitType } from './types';

const UNIT_TYPES: UnitType[] = ['infantry', 'armor', 'artillery'];
const UNIT_TYPE_ABBREV: Record<UnitType, string> = {
  infantry: 'Inf',
  armor: 'Arm',
  artillery: 'Art',
};

function makeStorage(fuel: number, ammo: number, food: number, parts: number): ResourceStorage {
  return { fuel, ammo, food, parts };
}

function canonicalEdgeKey(a: HexCoord, b: HexCoord): string {
  if (a.q < b.q || (a.q === b.q && a.r < b.r)) {
    return `${a.q},${a.r}|${b.q},${b.r}`;
  }
  return `${b.q},${b.r}|${a.q},${a.r}`;
}

export class MockSimulation {
  readonly state: MockState;

  private readonly rng: () => number;
  private readonly map: GameMap;

  constructor(map: GameMap) {
    this.map = map;
    this.rng = mulberry32(map.seed);
    this.state = {
      territory: new Map(),
      frontLineEdges: [],
      units: [],
      facilities: [],
      routeStates: [],
      vehicles: [],
      version: 1,
    };
    this.generateTerritory();
    this.detectFrontLine();
    this.placeUnits();
    this.generateFacilities();
    this.assignRouteHealth();
    this.spawnVehicles();
  }

  // ---------------------------------------------------------------------------
  // Territory
  // ---------------------------------------------------------------------------

  private generateTerritory(): void {
    const landHexes = this.collectLandHexes();
    if (landHexes.length === 0) return;

    const qValues = landHexes.map((h) => h.q).sort((a, b) => a - b);
    const medianQ = qValues[Math.floor(qValues.length / 2)];

    // Build a noise-based wavy boundary
    for (const { q, key } of landHexes) {
      const noise = (this.rng() - 0.5) * 4; // +/- 2 columns of wave
      const boundary = medianQ + noise;
      const faction: Faction = q < boundary ? 'allied' : 'enemy';
      this.state.territory.set(key, faction);
    }
  }

  private collectLandHexes(): Array<{ q: number; r: number; key: string }> {
    const result: Array<{ q: number; r: number; key: string }> = [];
    for (const [key, cell] of this.map.cells) {
      if (cell.terrain !== TerrainType.Water && cell.terrain !== TerrainType.Mountain) {
        result.push({ q: cell.coord.q, r: cell.coord.r, key });
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Front line
  // ---------------------------------------------------------------------------

  private detectFrontLine(): void {
    const seen = new Set<string>();

    for (const [key, faction] of this.state.territory) {
      const parts = key.split(',');
      const coord: HexCoord = { q: Number(parts[0]), r: Number(parts[1]) };
      const neighbors = HexGrid.neighbors(coord);

      for (const nb of neighbors) {
        const nbKey = HexGrid.key(nb);
        const nbFaction = this.state.territory.get(nbKey);
        if (nbFaction !== undefined && nbFaction !== faction) {
          const edgeKey = canonicalEdgeKey(coord, nb);
          if (!seen.has(edgeKey)) {
            seen.add(edgeKey);
            this.state.frontLineEdges.push({ a: coord, b: nb });
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Units
  // ---------------------------------------------------------------------------

  private placeUnits(): void {
    if (this.state.frontLineEdges.length === 0) return;

    // Collect all front line hex coords
    const frontHexKeys = new Set<string>();
    for (const edge of this.state.frontLineEdges) {
      frontHexKeys.add(HexGrid.key(edge.a));
      frontHexKeys.add(HexGrid.key(edge.b));
    }

    // Find hexes within distance 1-3 of any front line hex
    const alliedCandidates: HexCoord[] = [];
    const enemyCandidates: HexCoord[] = [];

    for (const [key, faction] of this.state.territory) {
      const parts = key.split(',');
      const coord: HexCoord = { q: Number(parts[0]), r: Number(parts[1]) };

      let minDist = Infinity;
      for (const fKey of frontHexKeys) {
        const fParts = fKey.split(',');
        const fCoord: HexCoord = { q: Number(fParts[0]), r: Number(fParts[1]) };
        const d = HexGrid.distance(coord, fCoord);
        if (d < minDist) minDist = d;
        if (minDist === 1) break; // can't get closer
      }

      if (minDist >= 1 && minDist <= 3) {
        if (faction === 'allied') {
          alliedCandidates.push(coord);
        } else {
          enemyCandidates.push(coord);
        }
      }
    }

    // Shuffle and pick
    this.shuffle(alliedCandidates);
    this.shuffle(enemyCandidates);

    const alliedCount = Math.min(this.randomInt(8, 12), alliedCandidates.length);
    const enemyCount = Math.min(this.randomInt(6, 8), enemyCandidates.length);

    let unitIndex = 1;

    for (let i = 0; i < alliedCount; i++) {
      const type = UNIT_TYPES[this.randomInt(0, UNIT_TYPES.length - 1)];
      const supplies = this.alliedSupplyLevel();
      this.state.units.push({
        id: `unit-${unitIndex}`,
        name: `${this.ordinal(unitIndex)} ${UNIT_TYPE_ABBREV[type]}`,
        faction: 'allied',
        type,
        coord: alliedCandidates[i],
        supplies,
      });
      unitIndex++;
    }

    for (let i = 0; i < enemyCount; i++) {
      const type = UNIT_TYPES[this.randomInt(0, UNIT_TYPES.length - 1)];
      this.state.units.push({
        id: `unit-${unitIndex}`,
        name: `${this.ordinal(unitIndex)} ${UNIT_TYPE_ABBREV[type]}`,
        faction: 'enemy',
        type,
        coord: enemyCandidates[i],
        supplies: makeStorage(0.7, 0.7, 0.7, 0.7),
      });
      unitIndex++;
    }
  }

  private alliedSupplyLevel(): ResourceStorage {
    const roll = this.rng();
    if (roll < 0.6) {
      // Well supplied: 0.8 - 1.0
      return this.randomStorageRange(0.8, 1.0);
    } else if (roll < 0.85) {
      // Medium: 0.4 - 0.6
      return this.randomStorageRange(0.4, 0.6);
    }
    // Low: 0.0 - 0.2
    return this.randomStorageRange(0.0, 0.2);
  }

  private randomStorageRange(min: number, max: number): ResourceStorage {
    return makeStorage(
      this.randomFloat(min, max),
      this.randomFloat(min, max),
      this.randomFloat(min, max),
      this.randomFloat(min, max),
    );
  }

  // ---------------------------------------------------------------------------
  // Facilities
  // ---------------------------------------------------------------------------

  private generateFacilities(): void {
    // Compute average front line q for distance calculation
    const frontAvgQ = this.computeFrontLineAvgQ();

    // Build a set of coords that railways touch
    const railwayCoords = new Set<string>();
    for (const rw of this.map.railways) {
      for (const hex of rw.hexes) {
        railwayCoords.add(HexGrid.key(hex));
      }
    }

    // Compute distances from front line for each hub
    const hubDistances: Array<{ index: number; distance: number }> = [];

    for (let i = 0; i < this.map.supplyHubs.length; i++) {
      const hub = this.map.supplyHubs[i];
      const hubKey = HexGrid.key(hub.coord);
      const cell = this.map.cells.get(hubKey);

      // Determine kind
      let kind: MockFacility['kind'] = 'depot';
      if (railwayCoords.has(hubKey)) {
        kind = 'railHub';
      } else if (cell?.urbanClusterId) {
        kind = 'factory';
      }

      // Distance from front line (by q)
      const dist = Math.abs(hub.coord.q - frontAvgQ);
      hubDistances.push({ index: i, distance: dist });

      // Storage based on distance
      const maxDist = Math.max(this.map.width / 2, 1);
      const normalizedDist = Math.min(dist / maxDist, 1);
      const storageBase = 0.3 + normalizedDist * 0.7; // 0.3-1.0
      const storageLevel = Math.min(storageBase, 1.0);

      this.state.facilities.push({
        id: `facility-${i + 1}`,
        kind,
        coord: hub.coord,
        size: hub.size,
        storage: makeStorage(storageLevel, storageLevel, storageLevel, storageLevel),
        damaged: false,
      });
    }

    // Mark 1-2 closest to front as damaged
    hubDistances.sort((a, b) => a.distance - b.distance);
    const damagedCount = Math.min(this.randomInt(1, 2), hubDistances.length);
    for (let i = 0; i < damagedCount; i++) {
      this.state.facilities[hubDistances[i].index].damaged = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Route health
  // ---------------------------------------------------------------------------

  private assignRouteHealth(): void {
    const frontAvgQ = this.computeFrontLineAvgQ();
    const allRoutes: RoutePath[] = [...this.map.roads, ...this.map.railways];

    const routeInfos: Array<{ route: RoutePath; avgQ: number }> = [];

    for (const route of allRoutes) {
      const avgQ =
        route.hexes.length > 0
          ? route.hexes.reduce((sum, h) => sum + h.q, 0) / route.hexes.length
          : 0;
      routeInfos.push({ route, avgQ });
    }

    // Determine health based on distance from front
    for (const info of routeInfos) {
      const dist = Math.abs(info.avgQ - frontAvgQ);
      let health: RouteHealth;
      if (dist > this.map.width * 0.3) {
        health = 'good';
      } else if (dist > this.map.width * 0.15) {
        health = 'congested';
      } else {
        health = 'stressed';
      }
      this.state.routeStates.push({ route: info.route, health });
    }

    // Pick 1-2 routes and mark destroyed (keep at least one active)
    if (this.state.routeStates.length > 1) {
      const destroyCount = Math.min(this.randomInt(1, 2), this.state.routeStates.length - 1);
      const indices = Array.from({ length: this.state.routeStates.length }, (_, i) => i);
      this.shuffle(indices);
      for (let i = 0; i < destroyCount; i++) {
        this.state.routeStates[indices[i]].health = 'destroyed';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Vehicles
  // ---------------------------------------------------------------------------

  private spawnVehicles(): void {
    let vehicleIndex = 1;

    for (let i = 0; i < this.state.routeStates.length; i++) {
      const rs = this.state.routeStates[i];
      if (rs.health === 'destroyed') continue;

      const vehicleCount = this.randomInt(2, 4);
      const vehicleType = rs.route.type === 'railway' ? 'train' : 'truck';
      const speed = vehicleType === 'truck' ? 40 : 25;

      // Determine the route index within roads or railways
      let routeIndex: number;
      if (rs.route.type === 'road') {
        routeIndex = this.map.roads.indexOf(rs.route);
      } else {
        routeIndex = this.map.railways.indexOf(rs.route);
      }

      for (let v = 0; v < vehicleCount; v++) {
        this.state.vehicles.push({
          id: `vehicle-${vehicleIndex}`,
          type: vehicleType,
          routeIndex,
          t: this.rng(),
          speed,
          direction: this.rng() < 0.5 ? 1 : -1,
        });
        vehicleIndex++;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private computeFrontLineAvgQ(): number {
    if (this.state.frontLineEdges.length === 0) {
      // Fallback: median q of all territory
      const qs: number[] = [];
      for (const key of this.state.territory.keys()) {
        const parts = key.split(',');
        qs.push(Number(parts[0]));
      }
      if (qs.length === 0) return 0;
      qs.sort((a, b) => a - b);
      return qs[Math.floor(qs.length / 2)];
    }

    let sum = 0;
    let count = 0;
    for (const edge of this.state.frontLineEdges) {
      sum += edge.a.q + edge.b.q;
      count += 2;
    }
    return sum / count;
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  private randomFloat(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  private ordinal(n: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const mod100 = n % 100;
    const suffix = suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0];
    return `${n}${suffix}`;
  }
}
