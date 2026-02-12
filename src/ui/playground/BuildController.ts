import { HexGrid } from '@core/map/HexGrid';
import type { GameMap, HexCoord } from '@core/map/types';
import type { Simulation } from '@core/simulation/Simulation';
import type { BuildTool, FacilityEntity } from '@core/simulation/types';
import { ResourceType } from '@data/types';

const TOOL_TO_RESOURCE: Partial<Record<BuildTool, ResourceType>> = {
  'fuel-factory': ResourceType.Fuel,
  'ammo-factory': ResourceType.Ammo,
  'food-factory': ResourceType.Food,
  'parts-factory': ResourceType.Parts,
};

export class BuildController {
  private simulation: Simulation;
  private gameMap: GameMap;
  private supplyLineStart: HexCoord | null = null;
  private onSelect: (entity: FacilityEntity | null) => void;

  constructor(
    simulation: Simulation,
    gameMap: GameMap,
    onSelect: (entity: FacilityEntity | null) => void,
  ) {
    this.simulation = simulation;
    this.gameMap = gameMap;
    this.onSelect = onSelect;
  }

  handleClick(hex: HexCoord, tool: BuildTool): void {
    if (!HexGrid.inBounds(hex, this.gameMap.width, this.gameMap.height)) return;

    switch (tool) {
      case 'select':
        this.handleSelect(hex);
        break;
      case 'fuel-factory':
      case 'ammo-factory':
      case 'food-factory':
      case 'parts-factory':
        this.handlePlaceFactory(hex, TOOL_TO_RESOURCE[tool]!);
        break;
      case 'depot':
        this.handlePlaceDepot(hex);
        break;
      case 'supply-line':
        this.handleSupplyLine(hex);
        break;
      case 'demolish':
        this.handleDemolish(hex);
        break;
    }
  }

  cancelAction(): void {
    this.supplyLineStart = null;
  }

  get pendingSupplyLineStart(): HexCoord | null {
    return this.supplyLineStart;
  }

  private handleSelect(hex: HexCoord): void {
    const facility = this.simulation.getFacilityAt(hex);
    this.onSelect(facility);
  }

  private handlePlaceFactory(hex: HexCoord, resourceType: ResourceType): void {
    this.simulation.addFactory(hex, resourceType);
  }

  private handlePlaceDepot(hex: HexCoord): void {
    this.simulation.addDepot(hex);
  }

  private handleSupplyLine(hex: HexCoord): void {
    if (this.supplyLineStart === null) {
      this.supplyLineStart = hex;
    } else {
      this.simulation.addSupplyLine(this.supplyLineStart, hex);
      this.supplyLineStart = null;
    }
  }

  private handleDemolish(hex: HexCoord): void {
    const facility = this.simulation.getFacilityAt(hex);
    if (facility) {
      this.simulation.demolish(facility.id);
      this.onSelect(null);
      return;
    }
    const line = this.simulation.getSupplyLineAt(hex);
    if (line) {
      this.simulation.demolish(line.id);
    }
  }
}
