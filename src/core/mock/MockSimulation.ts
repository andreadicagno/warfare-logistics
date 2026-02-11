import { HexGrid } from '@core/map/HexGrid';
import { mulberry32 } from '@core/map/rng';
import type { GameMap, HexCoord, RoutePath } from '@core/map/types';
import { TerrainType } from '@core/map/types';
import type { ResourceStorage } from '@data/types';
import type {
  Faction,
  MockFacility,
  MockFormation,
  MockState,
  MockUnit,
  RouteHealth,
  UnitType,
} from './types';

const UNIT_TYPES: UnitType[] = ['infantry', 'armor', 'artillery'];

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

  private depotTimer = 0;
  private unitTimer = 0;
  private frontTimer = 0;

  constructor(map: GameMap) {
    this.map = map;
    this.rng = mulberry32(map.seed);
    this.state = {
      territory: new Map(),
      frontLineEdges: [],
      units: [],
      formations: [],
      facilities: [],
      routeStates: [],
      vehicles: [],
      accessRamps: [],
      version: 1,
    };
    this.generateTerritory();
    this.detectFrontLine();
    this.generateFacilities();
    this.computeAccessRamps();
    this.placeUnits();
    this.assignRouteHealth();
    this.spawnVehicles();
  }

  // ---------------------------------------------------------------------------
  // Update loop
  // ---------------------------------------------------------------------------

  update(deltaSec: number): void {
    this.advanceVehicles(deltaSec);

    this.depotTimer += deltaSec;
    this.unitTimer += deltaSec;
    this.frontTimer += deltaSec;

    if (this.depotTimer >= 2) {
      this.depotTimer -= 2;
      this.tickDepots();
    }

    if (this.unitTimer >= 10) {
      this.unitTimer -= 10;
      this.tickUnits();
    }

    if (this.frontTimer >= 30) {
      this.frontTimer -= 30;
      this.tickFrontLine();
    }
  }

  private advanceVehicles(deltaSec: number): void {
    for (const vehicle of this.state.vehicles) {
      const route =
        vehicle.type === 'truck'
          ? this.map.roads[vehicle.routeIndex]
          : this.map.railways[vehicle.routeIndex];
      if (!route) continue;

      const estimatedLength = route.hexes.length * 24;
      const dt = (vehicle.speed * deltaSec) / estimatedLength;
      vehicle.t += dt * vehicle.direction;

      if (vehicle.t > 1) {
        vehicle.t = 1;
        vehicle.direction = -1;
      } else if (vehicle.t < 0) {
        vehicle.t = 0;
        vehicle.direction = 1;
      }
    }
  }

  private tickDepots(): void {
    const frontAvgQ = this.computeFrontLineAvgQ();
    const threshold = this.map.width * 0.3;

    for (const facility of this.state.facilities) {
      if (facility.damaged) continue;

      const faction = this.state.territory.get(HexGrid.key(facility.coord));
      if (faction !== 'allied') continue;

      const dist = Math.abs(facility.coord.q - frontAvgQ);
      if (dist > threshold) continue;

      facility.storage.fuel = Math.max(0, facility.storage.fuel - this.randomFloat(0.01, 0.03));
      facility.storage.ammo = Math.max(0, facility.storage.ammo - this.randomFloat(0.01, 0.03));
      facility.storage.food = Math.max(0, facility.storage.food - this.randomFloat(0.01, 0.03));
      facility.storage.parts = Math.max(0, facility.storage.parts - this.randomFloat(0.01, 0.03));
    }
  }

  private tickUnits(): void {
    for (const unit of this.state.units) {
      if (unit.faction !== 'allied') continue;

      unit.supplies.fuel = Math.min(
        1,
        Math.max(0, unit.supplies.fuel + this.randomFloat(-0.05, 0.02)),
      );
      unit.supplies.ammo = Math.min(
        1,
        Math.max(0, unit.supplies.ammo + this.randomFloat(-0.05, 0.02)),
      );
      unit.supplies.food = Math.min(
        1,
        Math.max(0, unit.supplies.food + this.randomFloat(-0.05, 0.02)),
      );
      unit.supplies.parts = Math.min(
        1,
        Math.max(0, unit.supplies.parts + this.randomFloat(-0.05, 0.02)),
      );
    }
  }

  private tickFrontLine(): void {
    // Pick 2-3 random front line hexes and flip them
    const frontHexKeys = new Set<string>();
    for (const edge of this.state.frontLineEdges) {
      frontHexKeys.add(HexGrid.key(edge.a));
      frontHexKeys.add(HexGrid.key(edge.b));
    }

    const frontHexArray = [...frontHexKeys];
    if (frontHexArray.length === 0) return;

    const flipCount = this.randomInt(2, 3);
    this.shuffle(frontHexArray);

    const flippedKeys = new Set<string>();
    for (let i = 0; i < Math.min(flipCount, frontHexArray.length); i++) {
      const key = frontHexArray[i];
      const current = this.state.territory.get(key);
      if (current) {
        this.state.territory.set(key, current === 'allied' ? 'enemy' : 'allied');
        flippedKeys.add(key);
      }
    }

    // Recompute front line
    this.state.frontLineEdges.length = 0;
    this.detectFrontLine();

    // Only reposition units whose hex was flipped or is now enemy territory
    for (const unit of this.state.units) {
      const unitKey = HexGrid.key(unit.coord);
      if (!flippedKeys.has(unitKey)) continue;

      const territory = this.state.territory.get(unitKey);
      if (territory && territory !== unit.faction) {
        // Find a nearby hex of the correct faction
        const neighbors = HexGrid.neighbors(unit.coord);
        for (const nb of neighbors) {
          const nbKey = HexGrid.key(nb);
          const nbFaction = this.state.territory.get(nbKey);
          if (nbFaction === unit.faction) {
            unit.coord = nb;
            break;
          }
        }
      }
    }

    this.state.version++;
  }

  // ---------------------------------------------------------------------------
  // Territory
  // ---------------------------------------------------------------------------

  private generateTerritory(): void {
    const landHexes = this.collectLandHexes();
    if (landHexes.length === 0) return;

    const qValues = landHexes.map((h) => h.q).sort((a, b) => a - b);
    const medianQ = qValues[Math.floor(qValues.length / 2)];

    // Use pixel-Y for smooth spatial wave (avoids axial r discontinuities)
    const pixelYs = landHexes.map((h) => HexGrid.toPixel(h).y);
    const minY = Math.min(...pixelYs);
    const maxY = Math.max(...pixelYs);
    const yRange = Math.max(maxY - minY, 1);

    // Generate smooth wave parameters using RNG
    const amplitude = 3 + this.rng() * 5; // 3-8 columns of wave
    const frequency = 1 + this.rng() * 1.5; // 1-2.5 wave cycles
    const phase = this.rng() * Math.PI * 2;
    // Second harmonic for organic feel
    const amp2 = amplitude * (0.15 + this.rng() * 0.2);
    const freq2 = frequency * (2 + this.rng() * 0.5);
    const phase2 = this.rng() * Math.PI * 2;

    for (let i = 0; i < landHexes.length; i++) {
      const { q, key } = landHexes[i];
      const t = (pixelYs[i] - minY) / yRange; // 0-1 along the front
      const wave =
        amplitude * Math.sin(t * Math.PI * 2 * frequency + phase) +
        amp2 * Math.sin(t * Math.PI * 2 * freq2 + phase2);
      const boundary = medianQ + wave;
      const faction: Faction = q < boundary ? 'allied' : 'enemy';
      this.state.territory.set(key, faction);
    }

    // Smoothing pass: flip isolated hexes that are surrounded by the opposite faction
    for (let pass = 0; pass < 2; pass++) {
      for (const { q: _q, key } of landHexes) {
        const parts = key.split(',');
        const coord: HexCoord = { q: Number(parts[0]), r: Number(parts[1]) };
        const myFaction = this.state.territory.get(key);
        if (!myFaction) continue;

        const neighbors = HexGrid.neighbors(coord);
        let sameCount = 0;
        let otherCount = 0;
        for (const nb of neighbors) {
          const nbFaction = this.state.territory.get(HexGrid.key(nb));
          if (nbFaction === myFaction) sameCount++;
          else if (nbFaction) otherCount++;
        }

        // Flip if 4+ of 6 neighbors are the opposite faction
        if (otherCount >= 4 && sameCount <= 2) {
          this.state.territory.set(key, myFaction === 'allied' ? 'enemy' : 'allied');
        }
      }
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

    // Collect front-line hex keys for quick lookup
    const frontHexKeySet = new Set<string>();
    for (const edge of this.state.frontLineEdges) {
      frontHexKeySet.add(HexGrid.key(edge.a));
      frontHexKeySet.add(HexGrid.key(edge.b));
    }

    // Find hexes at distance exactly 1 from the front line, separated by faction
    const alliedFrontHexes: HexCoord[] = [];
    const enemyFrontHexes: HexCoord[] = [];

    const visited = new Set<string>();
    for (const [key, faction] of this.state.territory) {
      if (frontHexKeySet.has(key)) continue; // skip hexes ON the front line
      if (visited.has(key)) continue;
      visited.add(key);

      const parts = key.split(',');
      const coord: HexCoord = { q: Number(parts[0]), r: Number(parts[1]) };

      // Check if any neighbor is on the front line
      const neighbors = HexGrid.neighbors(coord);
      let adjacentToFront = false;
      for (const nb of neighbors) {
        if (frontHexKeySet.has(HexGrid.key(nb))) {
          adjacentToFront = true;
          break;
        }
      }

      if (adjacentToFront) {
        if (faction === 'allied') {
          alliedFrontHexes.push(coord);
        } else if (faction === 'enemy') {
          enemyFrontHexes.push(coord);
        }
      }
    }

    // Also include hexes ON the front line that belong to each faction
    for (const key of frontHexKeySet) {
      const faction = this.state.territory.get(key);
      if (!faction) continue;
      const parts = key.split(',');
      const coord: HexCoord = { q: Number(parts[0]), r: Number(parts[1]) };
      if (faction === 'allied') {
        alliedFrontHexes.push(coord);
      } else {
        enemyFrontHexes.push(coord);
      }
    }

    // Sort by pixel-Y for consistent ordering along the front
    const sortByPixelY = (hexes: HexCoord[]): void => {
      hexes.sort((a, b) => {
        const pa = HexGrid.toPixel(a);
        const pb = HexGrid.toPixel(b);
        return pa.y - pb.y;
      });
    };
    sortByPixelY(alliedFrontHexes);
    sortByPixelY(enemyFrontHexes);

    // Build hierarchy for each faction
    let unitIndex = 1;
    const allUnits: MockUnit[] = [];
    const allFormations: MockFormation[] = [];

    for (const faction of ['allied', 'enemy'] as Faction[]) {
      const frontHexes = faction === 'allied' ? alliedFrontHexes : enemyFrontHexes;
      if (frontHexes.length === 0) continue;

      const result = this.buildFactionHierarchy(faction, frontHexes, frontHexKeySet, unitIndex);
      unitIndex = result.nextUnitIndex;
      allUnits.push(...result.units);
      allFormations.push(result.armyFormation);
    }

    this.state.units = allUnits;
    this.state.formations = allFormations;
  }

  /** Build the full Army -> Corps -> Division -> Regiment -> Battalion tree for one faction. */
  private buildFactionHierarchy(
    faction: Faction,
    frontHexes: HexCoord[],
    frontHexKeySet: Set<string>,
    startUnitIndex: number,
  ): { units: MockUnit[]; armyFormation: MockFormation; nextUnitIndex: number } {
    const units: MockUnit[] = [];
    let unitIdx = startUnitIndex;
    let formationIdx = 1;

    const factionLabel = faction === 'allied' ? 'Allied' : 'Axis';

    // Determine how many corps (2-3)
    const numCorps = this.randomInt(2, 3);

    // Divide front hexes among corps
    const corpsHexSlices = this.divideEvenly(frontHexes, numCorps);

    const corpsFormations: MockFormation[] = [];
    let globalDivNum = 1;
    let globalRgtNum = 1;

    for (let ci = 0; ci < corpsHexSlices.length; ci++) {
      const corpsHexes = corpsHexSlices[ci];
      if (corpsHexes.length === 0) continue;

      const numDivisions = this.randomInt(2, 3);
      const divHexSlices = this.divideEvenly(corpsHexes, numDivisions);

      const divFormations: MockFormation[] = [];

      for (let di = 0; di < divHexSlices.length; di++) {
        const divHexes = divHexSlices[di];
        if (divHexes.length === 0) continue;

        const numRegiments = this.randomInt(2, 3);
        const rgtHexSlices = this.divideEvenly(divHexes, numRegiments);

        const rgtFormations: MockFormation[] = [];

        for (let ri = 0; ri < rgtHexSlices.length; ri++) {
          const rgtHexes = rgtHexSlices[ri];
          if (rgtHexes.length === 0) continue;

          const numBattalions = this.randomInt(2, Math.min(4, rgtHexes.length + 1));
          const btnHexSlices = this.divideEvenly(rgtHexes, numBattalions);

          const rgtFormationId = `formation-${faction}-${formationIdx++}`;
          const rgtBattalionUnits: MockUnit[] = [];

          // Determine reserve count: ~20% of battalions, at least 1 if 3+
          const reserveCount =
            numBattalions >= 3 ? Math.max(1, Math.round(numBattalions * 0.2)) : 0;
          const reserveIndices = new Set<number>();
          if (reserveCount > 0) {
            // Pick the last N battalions as reserves
            for (let k = numBattalions - reserveCount; k < numBattalions; k++) {
              reserveIndices.add(k);
            }
          }

          for (let bi = 0; bi < btnHexSlices.length; bi++) {
            const btnHexes = btnHexSlices[bi];
            if (btnHexes.length === 0) continue;

            const isReserve = reserveIndices.has(bi);
            let coord: HexCoord;

            if (isReserve) {
              // Place 3-5 hexes behind front
              const centerHex = btnHexes[Math.floor(btnHexes.length / 2)];
              coord = this.findHexBehindFront(
                centerHex,
                faction,
                this.randomInt(3, 5),
                frontHexKeySet,
              );
            } else {
              // Place on a front hex
              coord = btnHexes[Math.floor(btnHexes.length / 2)];
            }

            const type = UNIT_TYPES[this.randomInt(0, UNIT_TYPES.length - 1)];
            const supplies = this.computeSupplyLevel(coord, faction, isReserve);

            const unit: MockUnit = {
              id: `unit-${unitIdx++}`,
              name: `${this.ordinal(bi + 1)} Btn`,
              faction,
              type,
              coord,
              supplies,
              echelon: 'battalion',
              parentFormationId: rgtFormationId,
              isHq: false,
            };
            rgtBattalionUnits.push(unit);
            units.push(unit);
          }

          // Regiment HQ: 2-3 hexes behind sector center
          const rgtCenter = rgtHexes[Math.floor(rgtHexes.length / 2)];
          const rgtHqCoord = this.findHexBehindFront(
            rgtCenter,
            faction,
            this.randomInt(2, 3),
            frontHexKeySet,
          );
          const rgtHqUnit: MockUnit = {
            id: `unit-${unitIdx++}`,
            name: `${this.ordinal(globalRgtNum)} Rgt HQ`,
            faction,
            type: 'infantry',
            coord: rgtHqCoord,
            supplies: this.computeSupplyLevel(rgtHqCoord, faction, false),
            echelon: 'regiment',
            parentFormationId: rgtFormationId,
            isHq: true,
          };
          units.push(rgtHqUnit);

          const rgtFormation: MockFormation = {
            id: rgtFormationId,
            name: `${this.ordinal(globalRgtNum)} Rgt`,
            echelon: 'regiment',
            faction,
            hqCoord: rgtHqCoord,
            children: [],
            units: [...rgtBattalionUnits, rgtHqUnit],
          };
          rgtFormations.push(rgtFormation);
          globalRgtNum++;
        }

        // Division HQ: 4-6 hexes behind front
        const divFormationId = `formation-${faction}-${formationIdx++}`;
        const divCenter = divHexes[Math.floor(divHexes.length / 2)];
        const divHqCoord = this.findHexBehindFront(
          divCenter,
          faction,
          this.randomInt(4, 6),
          frontHexKeySet,
        );
        const divHqUnit: MockUnit = {
          id: `unit-${unitIdx++}`,
          name: `${this.ordinal(globalDivNum)} Div HQ`,
          faction,
          type: 'infantry',
          coord: divHqCoord,
          supplies: this.computeSupplyLevel(divHqCoord, faction, false),
          echelon: 'division',
          parentFormationId: divFormationId,
          isHq: true,
        };
        units.push(divHqUnit);

        const divFormation: MockFormation = {
          id: divFormationId,
          name: `${this.ordinal(globalDivNum)} Div`,
          echelon: 'division',
          faction,
          hqCoord: divHqCoord,
          children: rgtFormations,
          units: [divHqUnit],
        };
        divFormations.push(divFormation);
        globalDivNum++;
      }

      // Corps HQ: 8-10 hexes behind front
      const corpsFormationId = `formation-${faction}-${formationIdx++}`;
      const corpsCenter = corpsHexes[Math.floor(corpsHexes.length / 2)];
      const corpsHqCoord = this.findHexBehindFront(
        corpsCenter,
        faction,
        this.randomInt(8, 10),
        frontHexKeySet,
      );
      const corpsHqUnit: MockUnit = {
        id: `unit-${unitIdx++}`,
        name: `${this.romanNumeral(ci + 1)} Corps HQ`,
        faction,
        type: 'infantry',
        coord: corpsHqCoord,
        supplies: this.computeSupplyLevel(corpsHqCoord, faction, false),
        echelon: 'corps',
        parentFormationId: corpsFormationId,
        isHq: true,
      };
      units.push(corpsHqUnit);

      const corpsFormation: MockFormation = {
        id: corpsFormationId,
        name: `${this.romanNumeral(ci + 1)} Corps`,
        echelon: 'corps',
        faction,
        hqCoord: corpsHqCoord,
        children: divFormations,
        units: [corpsHqUnit],
      };
      corpsFormations.push(corpsFormation);
    }

    // Army
    const armyFormationId = `formation-${faction}-${formationIdx++}`;
    const armyCenter = frontHexes[Math.floor(frontHexes.length / 2)];
    const armyHqCoord = this.findHexBehindFront(
      armyCenter,
      faction,
      this.randomInt(12, 15),
      frontHexKeySet,
    );
    const armyHqUnit: MockUnit = {
      id: `unit-${unitIdx++}`,
      name: `${factionLabel} Army HQ`,
      faction,
      type: 'infantry',
      coord: armyHqCoord,
      supplies: this.computeSupplyLevel(armyHqCoord, faction, false),
      echelon: 'army',
      parentFormationId: armyFormationId,
      isHq: true,
    };
    units.push(armyHqUnit);

    const armyFormation: MockFormation = {
      id: armyFormationId,
      name: `${factionLabel} Army`,
      echelon: 'army',
      faction,
      hqCoord: armyHqCoord,
      children: corpsFormations,
      units: [armyHqUnit],
    };

    return { units, armyFormation, nextUnitIndex: unitIdx };
  }

  /** Divide an array into N roughly equal slices. */
  private divideEvenly<T>(arr: T[], n: number): T[][] {
    const result: T[][] = [];
    const count = Math.max(1, n);
    const baseSize = Math.floor(arr.length / count);
    let remainder = arr.length % count;
    let offset = 0;

    for (let i = 0; i < count; i++) {
      const size = baseSize + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      result.push(arr.slice(offset, offset + size));
      offset += size;
    }
    return result;
  }

  /**
   * Walk a hex behind the front line by `depth` steps in the faction's rear direction.
   * Allied rear is decreasing q; enemy rear is increasing q.
   * Falls back to the starting coord if no valid hex is found.
   */
  private findHexBehindFront(
    from: HexCoord,
    faction: Faction,
    depth: number,
    _frontHexKeySet: Set<string>,
  ): HexCoord {
    // Rear direction: allied goes west (q-1), enemy goes east (q+1)
    const dq = faction === 'allied' ? -1 : 1;
    let current = from;

    for (let step = 0; step < depth; step++) {
      // Try moving straight back (q ± 1, same r)
      const candidate: HexCoord = { q: current.q + dq, r: current.r };
      const candidateKey = HexGrid.key(candidate);
      const candidateFaction = this.state.territory.get(candidateKey);

      if (candidateFaction === faction) {
        current = candidate;
      } else {
        // Try diagonal options (q ± 1, r ± 1) that stay in friendly territory
        const diag1: HexCoord = { q: current.q + dq, r: current.r - 1 };
        const diag2: HexCoord = { q: current.q + dq, r: current.r + 1 };
        const d1Faction = this.state.territory.get(HexGrid.key(diag1));
        const d2Faction = this.state.territory.get(HexGrid.key(diag2));

        if (d1Faction === faction) {
          current = diag1;
        } else if (d2Faction === faction) {
          current = diag2;
        } else {
          // Can't go further back, stay here
          break;
        }
      }
    }
    return current;
  }

  /** Compute supply level based on distance from nearest non-damaged facility. */
  private computeSupplyLevel(
    coord: HexCoord,
    faction: Faction,
    isReserve: boolean,
  ): ResourceStorage {
    if (faction === 'enemy') {
      return makeStorage(0.7, 0.7, 0.7, 0.7);
    }

    // Find distance to nearest non-damaged allied facility
    let minDist = Infinity;
    for (const facility of this.state.facilities) {
      if (facility.damaged) continue;
      const facilityFaction = this.state.territory.get(HexGrid.key(facility.coord));
      if (facilityFaction !== 'allied') continue;
      const d = HexGrid.distance(coord, facility.coord);
      if (d < minDist) minDist = d;
    }

    let min: number;
    let max: number;

    if (minDist < 5) {
      // Well supplied
      min = 0.7;
      max = 1.0;
    } else if (minDist <= 10) {
      // Medium
      min = 0.4;
      max = 0.7;
    } else {
      // Low or no facility
      min = 0.1;
      max = 0.3;
    }

    const storage = this.randomStorageRange(min, max);

    if (isReserve) {
      // Reserve bonus: +0.2, capped at 1.0
      storage.fuel = Math.min(1.0, storage.fuel + 0.2);
      storage.ammo = Math.min(1.0, storage.ammo + 0.2);
      storage.food = Math.min(1.0, storage.food + 0.2);
      storage.parts = Math.min(1.0, storage.parts + 0.2);
    }

    return storage;
  }

  /** Convert number to Roman numeral (1-20 range). */
  private romanNumeral(n: number): string {
    const numerals: Array<[number, string]> = [
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I'],
    ];
    let result = '';
    let remaining = n;
    for (const [value, symbol] of numerals) {
      while (remaining >= value) {
        result += symbol;
        remaining -= value;
      }
    }
    return result;
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

    // Build sets of coords that routes touch
    const routeHexKeys = new Set<string>();
    for (const road of this.map.roads) {
      for (const hex of road.hexes) {
        routeHexKeys.add(HexGrid.key(hex));
      }
    }
    const railwayCoords = new Set<string>();
    for (const rw of this.map.railways) {
      for (const hex of rw.hexes) {
        railwayCoords.add(HexGrid.key(hex));
        routeHexKeys.add(HexGrid.key(hex));
      }
    }

    // Compute distances from front line for each hub
    const hubDistances: Array<{ index: number; distance: number }> = [];

    const forbidden = new Set([TerrainType.Water, TerrainType.Mountain, TerrainType.River]);

    for (let i = 0; i < this.map.supplyHubs.length; i++) {
      const hub = this.map.supplyHubs[i];
      // Nudge facility off road/railway hex if needed
      let coord = hub.coord;
      if (routeHexKeys.has(HexGrid.key(coord))) {
        const neighbors = HexGrid.neighbors(coord);
        for (const nb of neighbors) {
          const nbKey = HexGrid.key(nb);
          const nbCell = this.map.cells.get(nbKey);
          if (nbCell && !forbidden.has(nbCell.terrain) && !routeHexKeys.has(nbKey)) {
            coord = nb;
            break;
          }
        }
      }
      const hubKey = HexGrid.key(coord);
      const cell = this.map.cells.get(hubKey);

      // Determine kind (check original hub coord for railway proximity)
      const origKey = HexGrid.key(hub.coord);
      let kind: MockFacility['kind'] = 'depot';
      if (railwayCoords.has(origKey)) {
        kind = 'railHub';
      } else if (cell?.urbanClusterId) {
        kind = 'factory';
      }

      // Distance from front line (by q)
      const dist = Math.abs(coord.q - frontAvgQ);
      hubDistances.push({ index: i, distance: dist });

      // Storage based on distance
      const maxDist = Math.max(this.map.width / 2, 1);
      const normalizedDist = Math.min(dist / maxDist, 1);
      const storageBase = 0.3 + normalizedDist * 0.7; // 0.3-1.0
      const storageLevel = Math.min(storageBase, 1.0);

      this.state.facilities.push({
        id: `facility-${i + 1}`,
        kind,
        faction: this.state.territory.get(hubKey) ?? 'allied',
        coord,
        size: hub.size,
        storage: makeStorage(storageLevel, storageLevel, storageLevel, storageLevel),
        damaged: false,
      });
    }

    // Add forward depots near the front line (2-3 per faction)
    this.placeForwardDepots(frontAvgQ, routeHexKeys, forbidden);

    // Mark 1-2 closest to front as damaged
    hubDistances.sort((a, b) => a.distance - b.distance);
    const damagedCount = Math.min(this.randomInt(1, 2), hubDistances.length);
    for (let i = 0; i < damagedCount; i++) {
      this.state.facilities[hubDistances[i].index].damaged = true;
    }
  }

  /** Place 2-3 small forward depots near the front for each faction. */
  private placeForwardDepots(
    frontAvgQ: number,
    routeHexKeys: Set<string>,
    forbidden: Set<TerrainType>,
  ): void {
    // Collect front-adjacent hexes by faction
    const frontHexKeys = new Set<string>();
    for (const edge of this.state.frontLineEdges) {
      frontHexKeys.add(HexGrid.key(edge.a));
      frontHexKeys.add(HexGrid.key(edge.b));
    }

    const usedKeys = new Set<string>();
    for (const f of this.state.facilities) {
      usedKeys.add(HexGrid.key(f.coord));
    }

    for (const faction of ['allied', 'enemy'] as Faction[]) {
      // Find hexes 2-4 behind the front in friendly territory
      const candidates: HexCoord[] = [];
      for (const [key, cell] of this.map.cells) {
        if (forbidden.has(cell.terrain)) continue;
        if (usedKeys.has(key)) continue;
        if (routeHexKeys.has(key)) continue;

        const cellFaction = this.state.territory.get(key);
        if (cellFaction !== faction) continue;

        // Check distance to front (by q relative to front avg)
        const behindDist =
          faction === 'allied' ? frontAvgQ - cell.coord.q : cell.coord.q - frontAvgQ;
        if (behindDist < 2 || behindDist > 5) continue;

        // Must have passable neighbors
        const passable = HexGrid.neighbors(cell.coord).filter((nb) => {
          const c = this.map.cells.get(HexGrid.key(nb));
          return c && !forbidden.has(c.terrain);
        });
        if (passable.length < 4) continue;

        candidates.push(cell.coord);
      }

      this.shuffle(candidates);

      const count = this.randomInt(2, 3);
      let placed = 0;
      for (const coord of candidates) {
        if (placed >= count) break;

        // Ensure spacing from existing facilities (at least 6 hexes)
        const tooClose = this.state.facilities.some((f) => HexGrid.distance(f.coord, coord) < 6);
        if (tooClose) continue;

        const id = `facility-fwd-${faction}-${placed + 1}`;
        this.state.facilities.push({
          id,
          kind: 'depot',
          faction,
          coord,
          size: 'small',
          storage: makeStorage(0.5, 0.5, 0.5, 0.5),
          damaged: false,
        });
        usedKeys.add(HexGrid.key(coord));
        placed++;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Access ramps
  // ---------------------------------------------------------------------------

  private computeAccessRamps(): void {
    // Build maps of route hex keys for fast lookup
    const roadHexes = new Map<string, HexCoord>();
    for (const road of this.map.roads) {
      for (const hex of road.hexes) {
        roadHexes.set(HexGrid.key(hex), hex);
      }
    }
    const railHexes = new Map<string, HexCoord>();
    for (const rw of this.map.railways) {
      for (const hex of rw.hexes) {
        railHexes.set(HexGrid.key(hex), hex);
      }
    }

    for (const facility of this.state.facilities) {
      const fKey = HexGrid.key(facility.coord);

      // Skip if already on a route
      if (roadHexes.has(fKey) || railHexes.has(fKey)) continue;

      // railHub prefers railway; depot/factory prefer road
      const preferRailway = facility.kind === 'railHub';
      const primarySet = preferRailway ? railHexes : roadHexes;
      const fallbackSet = preferRailway ? roadHexes : railHexes;
      const primaryType: 'road' | 'railway' = preferRailway ? 'railway' : 'road';
      const fallbackType: 'road' | 'railway' = preferRailway ? 'road' : 'railway';

      let bestCoord: HexCoord | null = null;
      let bestType: 'road' | 'railway' = primaryType;
      let bestDist = Infinity;

      for (const [, coord] of primarySet) {
        const d = HexGrid.distance(facility.coord, coord);
        if (d <= 2 && d < bestDist) {
          bestDist = d;
          bestCoord = coord;
          bestType = primaryType;
        }
      }

      if (!bestCoord) {
        for (const [, coord] of fallbackSet) {
          const d = HexGrid.distance(facility.coord, coord);
          if (d <= 2 && d < bestDist) {
            bestDist = d;
            bestCoord = coord;
            bestType = fallbackType;
          }
        }
      }

      if (bestCoord) {
        this.state.accessRamps.push({
          facilityCoord: facility.coord,
          routeHexCoord: bestCoord,
          routeType: bestType,
        });
      }
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
