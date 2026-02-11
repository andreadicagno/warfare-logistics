// Re-exported from MapGenerator for sidebar use
import { MAP_SIZE_PRESETS } from '@core/map/MapGenerator';
import type { GenerationParams, SeaSides } from '@core/map/types';
import { DEFAULT_GENERATION_PARAMS } from '@core/map/types';
import {
  BUILT_IN_PRESETS,
  deleteCustomPreset,
  loadCustomPresets,
  saveCustomPreset,
} from './presets';

const INPUT_STYLE: Partial<CSSStyleDeclaration> = {
  background: '#1e1e2e',
  color: '#eee',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '3px',
  padding: '3px 6px',
  fontSize: '11px',
  fontFamily: 'inherit',
};

interface SliderRow {
  container: HTMLDivElement;
  slider: HTMLInputElement;
  input: HTMLInputElement;
  getValue: () => number;
  setValue: (v: number) => void;
}

interface SelectRow {
  container: HTMLDivElement;
  select: HTMLSelectElement;
}

export class Sidebar {
  private wrapper: HTMLDivElement;
  private toggleBtn: HTMLButtonElement;
  private collapsed = false;
  private onGenerate: (params: GenerationParams) => void;

  // Preset controls
  private presetSelect!: HTMLSelectElement;
  private deletePresetBtn!: HTMLButtonElement;
  private ignorePresetChange = false;

  // Map size controls
  private sizePresetSelect!: HTMLSelectElement;
  private widthSlider!: SliderRow;
  private heightSlider!: SliderRow;
  private seedInput!: HTMLInputElement;

  // Coastline control
  private seaSideElements!: Record<keyof SeaSides, HTMLDivElement>;

  // Terrain controls
  private geographySelect!: HTMLSelectElement;
  private elevationScaleLarge!: SliderRow;
  private elevationScaleMedium!: SliderRow;
  private elevationScaleDetail!: SliderRow;
  private noiseWeightLarge!: SliderRow;
  private noiseWeightMedium!: SliderRow;
  private noiseWeightDetail!: SliderRow;
  private falloffStrength!: SliderRow;
  private moistureScale!: SliderRow;
  private waterThreshold!: SliderRow;
  private coastalThreshold!: SliderRow;
  private lowlandThreshold!: SliderRow;
  private highlandThreshold!: SliderRow;
  private lakeMoistureThreshold!: SliderRow;

  // Smoothing controls
  private groupTolerance!: SliderRow;
  private minGroupDifference!: SliderRow;

  // River controls
  private minSources!: SliderRow;
  private maxSources!: SliderRow;
  private sourceMinElevation!: SliderRow;
  private sourceMinSpacing!: SliderRow;
  private minRiverLength!: SliderRow;
  private wideRiverMinLength!: SliderRow;
  private wideRiverFraction!: SliderRow;
  private lakeMinSize!: SliderRow;
  private lakeMaxSize!: SliderRow;

  // Settlement controls
  private cityDensity!: SliderRow;
  private townDensity!: SliderRow;
  private minCityDistance!: SliderRow;
  private minTownDistance!: SliderRow;
  private riverBonusCity!: SliderRow;
  private waterBonusCity!: SliderRow;
  private plainsBonusCity!: SliderRow;

  // Road controls
  private infrastructureSelect!: HTMLSelectElement;
  private plainsCost!: SliderRow;
  private forestCost!: SliderRow;
  private hillsCost!: SliderRow;
  private marshCost!: SliderRow;
  private riverCost!: SliderRow;
  private cityConnectionDistance!: SliderRow;

  constructor(
    parent: HTMLElement,
    initialParams: GenerationParams,
    onGenerate: (params: GenerationParams) => void,
  ) {
    this.onGenerate = onGenerate;

    // Outer wrapper
    this.wrapper = document.createElement('div');
    Object.assign(this.wrapper.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      bottom: '0',
      width: '300px',
      background: 'rgba(15, 15, 25, 0.92)',
      color: '#ccc',
      fontSize: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      zIndex: '20',
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'auto',
      userSelect: 'none',
      transition: 'transform 0.25s ease',
      boxShadow: '2px 0 12px rgba(0,0,0,0.4)',
    });

    // Toggle button
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.textContent = '\u25C0';
    Object.assign(this.toggleBtn.style, {
      position: 'absolute',
      right: '-28px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '28px',
      height: '48px',
      background: 'rgba(15, 15, 25, 0.92)',
      color: '#ccc',
      border: 'none',
      borderRadius: '0 4px 4px 0',
      cursor: 'pointer',
      fontSize: '14px',
      padding: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '2px 0 6px rgba(0,0,0,0.3)',
    });
    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.wrapper.appendChild(this.toggleBtn);

    // Header with Generate + Reset
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      flexShrink: '0',
    });

    const generateBtn = this.createButton('Generate', '#4a7a9a', '#5a8aaa');
    Object.assign(generateBtn.style, {
      flex: '1',
      padding: '7px 12px',
      fontSize: '13px',
      fontWeight: '600',
      letterSpacing: '0.5px',
    });
    generateBtn.addEventListener('click', () => this.onGenerate(this.getParams()));
    header.appendChild(generateBtn);

    const resetBtn = this.createButton('Reset', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.14)');
    Object.assign(resetBtn.style, { padding: '7px 12px', fontSize: '12px' });
    resetBtn.addEventListener('click', () => this.setParams(DEFAULT_GENERATION_PARAMS));
    header.appendChild(resetBtn);

    this.wrapper.appendChild(header);

    // Scroll area
    const scrollArea = document.createElement('div');
    Object.assign(scrollArea.style, {
      flex: '1',
      overflowY: 'auto',
      overflowX: 'hidden',
    });

    this.buildPresetsSection(scrollArea);
    this.buildMapSizeSection(scrollArea);
    this.buildCoastlineSection(scrollArea);
    this.buildTerrainSection(scrollArea);
    this.buildSmoothingSection(scrollArea);
    this.buildRiversSection(scrollArea);
    this.buildSettlementsSection(scrollArea);
    this.buildRoadsSection(scrollArea);

    this.wrapper.appendChild(scrollArea);
    parent.appendChild(this.wrapper);

    this.setParams(initialParams);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getParams(): GenerationParams {
    return {
      width: this.widthSlider.getValue(),
      height: this.heightSlider.getValue(),
      seed: Number(this.seedInput.value) || Date.now(),
      seaSides: {
        north: this.seaSideElements.north.dataset.active === 'true',
        south: this.seaSideElements.south.dataset.active === 'true',
        east: this.seaSideElements.east.dataset.active === 'true',
        west: this.seaSideElements.west.dataset.active === 'true',
      },
      terrain: {
        geography: this.geographySelect.value as GenerationParams['terrain']['geography'],
        elevationScaleLarge: this.elevationScaleLarge.getValue(),
        elevationScaleMedium: this.elevationScaleMedium.getValue(),
        elevationScaleDetail: this.elevationScaleDetail.getValue(),
        noiseWeightLarge: this.noiseWeightLarge.getValue(),
        noiseWeightMedium: this.noiseWeightMedium.getValue(),
        noiseWeightDetail: this.noiseWeightDetail.getValue(),
        falloffStrength: this.falloffStrength.getValue(),
        moistureScale: this.moistureScale.getValue(),
        waterThreshold: this.waterThreshold.getValue(),
        coastalThreshold: this.coastalThreshold.getValue(),
        lowlandThreshold: this.lowlandThreshold.getValue(),
        highlandThreshold: this.highlandThreshold.getValue(),
        lakeMoistureThreshold: this.lakeMoistureThreshold.getValue(),
      },
      smoothing: {
        groupTolerance: this.groupTolerance.getValue(),
        minGroupDifference: this.minGroupDifference.getValue(),
      },
      rivers: {
        minSources: this.minSources.getValue(),
        maxSources: this.maxSources.getValue(),
        sourceMinElevation: this.sourceMinElevation.getValue(),
        sourceMinSpacing: this.sourceMinSpacing.getValue(),
        minRiverLength: this.minRiverLength.getValue(),
        wideRiverMinLength: this.wideRiverMinLength.getValue(),
        wideRiverFraction: this.wideRiverFraction.getValue(),
        lakeMinSize: this.lakeMinSize.getValue(),
        lakeMaxSize: this.lakeMaxSize.getValue(),
      },
      settlements: {
        cityDensity: this.cityDensity.getValue(),
        townDensity: this.townDensity.getValue(),
        minCityDistance: this.minCityDistance.getValue(),
        minTownDistance: this.minTownDistance.getValue(),
        riverBonusCity: this.riverBonusCity.getValue(),
        waterBonusCity: this.waterBonusCity.getValue(),
        plainsBonusCity: this.plainsBonusCity.getValue(),
      },
      roads: {
        infrastructure: this.infrastructureSelect
          .value as GenerationParams['roads']['infrastructure'],
        plainsCost: this.plainsCost.getValue(),
        forestCost: this.forestCost.getValue(),
        hillsCost: this.hillsCost.getValue(),
        marshCost: this.marshCost.getValue(),
        riverCost: this.riverCost.getValue(),
        cityConnectionDistance: this.cityConnectionDistance.getValue(),
      },
    };
  }

  setParams(params: GenerationParams): void {
    this.ignorePresetChange = true;

    this.widthSlider.setValue(params.width);
    this.heightSlider.setValue(params.height);
    this.seedInput.value = String(params.seed);
    this.syncSizePreset(params.width, params.height);

    this.setSeaSide('north', params.seaSides.north);
    this.setSeaSide('south', params.seaSides.south);
    this.setSeaSide('east', params.seaSides.east);
    this.setSeaSide('west', params.seaSides.west);

    this.geographySelect.value = params.terrain.geography;
    this.elevationScaleLarge.setValue(params.terrain.elevationScaleLarge);
    this.elevationScaleMedium.setValue(params.terrain.elevationScaleMedium);
    this.elevationScaleDetail.setValue(params.terrain.elevationScaleDetail);
    this.noiseWeightLarge.setValue(params.terrain.noiseWeightLarge);
    this.noiseWeightMedium.setValue(params.terrain.noiseWeightMedium);
    this.noiseWeightDetail.setValue(params.terrain.noiseWeightDetail);
    this.falloffStrength.setValue(params.terrain.falloffStrength);
    this.moistureScale.setValue(params.terrain.moistureScale);
    this.waterThreshold.setValue(params.terrain.waterThreshold);
    this.coastalThreshold.setValue(params.terrain.coastalThreshold);
    this.lowlandThreshold.setValue(params.terrain.lowlandThreshold);
    this.highlandThreshold.setValue(params.terrain.highlandThreshold);
    this.lakeMoistureThreshold.setValue(params.terrain.lakeMoistureThreshold);

    this.groupTolerance.setValue(params.smoothing.groupTolerance);
    this.minGroupDifference.setValue(params.smoothing.minGroupDifference);

    this.minSources.setValue(params.rivers.minSources);
    this.maxSources.setValue(params.rivers.maxSources);
    this.sourceMinElevation.setValue(params.rivers.sourceMinElevation);
    this.sourceMinSpacing.setValue(params.rivers.sourceMinSpacing);
    this.minRiverLength.setValue(params.rivers.minRiverLength);
    this.wideRiverMinLength.setValue(params.rivers.wideRiverMinLength);
    this.wideRiverFraction.setValue(params.rivers.wideRiverFraction);
    this.lakeMinSize.setValue(params.rivers.lakeMinSize);
    this.lakeMaxSize.setValue(params.rivers.lakeMaxSize);

    this.cityDensity.setValue(params.settlements.cityDensity);
    this.townDensity.setValue(params.settlements.townDensity);
    this.minCityDistance.setValue(params.settlements.minCityDistance);
    this.minTownDistance.setValue(params.settlements.minTownDistance);
    this.riverBonusCity.setValue(params.settlements.riverBonusCity);
    this.waterBonusCity.setValue(params.settlements.waterBonusCity);
    this.plainsBonusCity.setValue(params.settlements.plainsBonusCity);

    this.infrastructureSelect.value = params.roads.infrastructure;
    this.plainsCost.setValue(params.roads.plainsCost);
    this.forestCost.setValue(params.roads.forestCost);
    this.hillsCost.setValue(params.roads.hillsCost);
    this.marshCost.setValue(params.roads.marshCost);
    this.riverCost.setValue(params.roads.riverCost);
    this.cityConnectionDistance.setValue(params.roads.cityConnectionDistance);

    this.ignorePresetChange = false;
    this.detectPreset();
  }

  destroy(): void {
    this.wrapper.remove();
  }

  // ---------------------------------------------------------------------------
  // Section builders
  // ---------------------------------------------------------------------------

  private buildPresetsSection(parent: HTMLElement): void {
    const { content } = this.createSection('Presets', parent, true);

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '6px', alignItems: 'center' });

    this.presetSelect = document.createElement('select');
    Object.assign(this.presetSelect.style, {
      ...INPUT_STYLE,
      flex: '1',
      cursor: 'pointer',
    });
    this.presetSelect.addEventListener('change', () => this.handlePresetChange());
    row.appendChild(this.presetSelect);

    const saveBtn = this.createButton('Save', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.14)');
    Object.assign(saveBtn.style, { padding: '3px 8px', fontSize: '11px' });
    saveBtn.addEventListener('click', () => this.handleSavePreset());
    row.appendChild(saveBtn);

    this.deletePresetBtn = this.createButton(
      'Delete',
      'rgba(255,255,255,0.08)',
      'rgba(255,255,255,0.14)',
    );
    Object.assign(this.deletePresetBtn.style, {
      padding: '3px 8px',
      fontSize: '11px',
      display: 'none',
    });
    this.deletePresetBtn.addEventListener('click', () => this.handleDeletePreset());
    row.appendChild(this.deletePresetBtn);

    content.appendChild(row);
    this.refreshPresetDropdown();
  }

  private buildMapSizeSection(parent: HTMLElement): void {
    const { content } = this.createSection('Map Size', parent, true);

    const sizeRow = this.createSelectRow('Size Preset', ['small', 'medium', 'large'], 'medium');
    this.sizePresetSelect = sizeRow.select;
    this.sizePresetSelect.addEventListener('change', () => {
      const preset = MAP_SIZE_PRESETS[this.sizePresetSelect.value as keyof typeof MAP_SIZE_PRESETS];
      if (preset) {
        this.widthSlider.setValue(preset.width);
        this.heightSlider.setValue(preset.height);
        this.markCustomPreset();
      }
    });
    content.appendChild(sizeRow.container);

    this.widthSlider = this.createSliderRow('Width', 50, 500, 10, 200);
    this.widthSlider.slider.addEventListener('input', () => this.onSliderChanged());
    this.widthSlider.input.addEventListener('change', () => this.onSliderChanged());
    content.appendChild(this.widthSlider.container);

    this.heightSlider = this.createSliderRow('Height', 50, 500, 10, 150);
    this.heightSlider.slider.addEventListener('input', () => this.onSliderChanged());
    this.heightSlider.input.addEventListener('change', () => this.onSliderChanged());
    content.appendChild(this.heightSlider.container);

    // Seed row
    const seedRow = document.createElement('div');
    Object.assign(seedRow.style, { marginTop: '6px' });

    const seedLabel = document.createElement('div');
    seedLabel.textContent = 'Seed';
    Object.assign(seedLabel.style, { fontSize: '11px', color: '#999', marginBottom: '3px' });
    seedRow.appendChild(seedLabel);

    const seedInner = document.createElement('div');
    Object.assign(seedInner.style, { display: 'flex', gap: '4px', alignItems: 'center' });

    this.seedInput = document.createElement('input');
    this.seedInput.type = 'number';
    Object.assign(this.seedInput.style, {
      ...INPUT_STYLE,
      flex: '1',
      fontFamily: 'monospace',
    });
    this.seedInput.addEventListener('change', () => this.markCustomPreset());
    seedInner.appendChild(this.seedInput);

    const randomBtn = document.createElement('button');
    randomBtn.textContent = '\u{1F3B2}';
    randomBtn.title = 'Random seed';
    Object.assign(randomBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '16px',
      padding: '2px 4px',
    });
    randomBtn.addEventListener('click', () => {
      this.seedInput.value = String(Date.now());
      this.markCustomPreset();
    });
    seedInner.appendChild(randomBtn);

    seedRow.appendChild(seedInner);
    content.appendChild(seedRow);
  }

  private buildCoastlineSection(parent: HTMLElement): void {
    const { content } = this.createSection('Coastline', parent, false);

    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'relative',
      width: '120px',
      height: '80px',
      margin: '8px auto',
      background: '#1a1a2a',
      borderRadius: '4px',
    });

    this.seaSideElements = {} as Record<keyof SeaSides, HTMLDivElement>;

    const sides: { key: keyof SeaSides; style: Partial<CSSStyleDeclaration> }[] = [
      {
        key: 'north',
        style: { top: '0', left: '10px', right: '10px', height: '10px', cursor: 'pointer' },
      },
      {
        key: 'south',
        style: { bottom: '0', left: '10px', right: '10px', height: '10px', cursor: 'pointer' },
      },
      {
        key: 'west',
        style: { top: '10px', left: '0', bottom: '10px', width: '10px', cursor: 'pointer' },
      },
      {
        key: 'east',
        style: { top: '10px', right: '0', bottom: '10px', width: '10px', cursor: 'pointer' },
      },
    ];

    for (const side of sides) {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute',
        borderRadius: '2px',
        transition: 'background 0.15s',
        ...side.style,
      });
      el.dataset.active = 'true';
      el.style.background = '#4a90b8';
      el.title = `${side.key} coast (click to toggle)`;
      el.addEventListener('click', () => {
        const isActive = el.dataset.active === 'true';
        this.setSeaSide(side.key, !isActive);
        this.markCustomPreset();
      });
      this.seaSideElements[side.key] = el;
      box.appendChild(el);
    }

    // Center label
    const label = document.createElement('div');
    label.textContent = 'LAND';
    Object.assign(label.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: '10px',
      color: '#666',
      letterSpacing: '2px',
      fontWeight: '600',
    });
    box.appendChild(label);

    content.appendChild(box);
  }

  private buildTerrainSection(parent: HTMLElement): void {
    const { content } = this.createSection('Terrain', parent, false);

    const geoRow = this.createSelectRow('Geography', ['plains', 'mixed', 'mountainous'], 'mixed');
    this.geographySelect = geoRow.select;
    this.geographySelect.addEventListener('change', () => this.markCustomPreset());
    content.appendChild(geoRow.container);

    this.elevationScaleLarge = this.createSliderRow('Elevation Scale Large', 0.01, 0.2, 0.01, 0.05);
    content.appendChild(this.elevationScaleLarge.container);
    this.elevationScaleMedium = this.createSliderRow(
      'Elevation Scale Medium',
      0.02,
      0.4,
      0.01,
      0.1,
    );
    content.appendChild(this.elevationScaleMedium.container);
    this.elevationScaleDetail = this.createSliderRow(
      'Elevation Scale Detail',
      0.04,
      0.8,
      0.01,
      0.2,
    );
    content.appendChild(this.elevationScaleDetail.container);
    this.noiseWeightLarge = this.createSliderRow('Noise Weight Large', 0, 1, 0.05, 0.6);
    content.appendChild(this.noiseWeightLarge.container);
    this.noiseWeightMedium = this.createSliderRow('Noise Weight Medium', 0, 1, 0.05, 0.3);
    content.appendChild(this.noiseWeightMedium.container);
    this.noiseWeightDetail = this.createSliderRow('Noise Weight Detail', 0, 1, 0.05, 0.1);
    content.appendChild(this.noiseWeightDetail.container);
    this.falloffStrength = this.createSliderRow('Falloff Strength', 0.5, 5, 0.1, 2.0);
    content.appendChild(this.falloffStrength.container);
    this.moistureScale = this.createSliderRow('Moisture Scale', 0.01, 0.3, 0.01, 0.08);
    content.appendChild(this.moistureScale.container);
    this.waterThreshold = this.createSliderRow('Water Threshold', 0.05, 0.5, 0.01, 0.2);
    content.appendChild(this.waterThreshold.container);
    this.coastalThreshold = this.createSliderRow('Coastal Threshold', 0.1, 0.6, 0.01, 0.35);
    content.appendChild(this.coastalThreshold.container);
    this.lowlandThreshold = this.createSliderRow('Lowland Threshold', 0.3, 0.8, 0.01, 0.55);
    content.appendChild(this.lowlandThreshold.container);
    this.highlandThreshold = this.createSliderRow('Highland Threshold', 0.5, 0.95, 0.01, 0.75);
    content.appendChild(this.highlandThreshold.container);
    this.lakeMoistureThreshold = this.createSliderRow('Lake Moisture', 0.3, 0.95, 0.01, 0.7);
    content.appendChild(this.lakeMoistureThreshold.container);
  }

  private buildSmoothingSection(parent: HTMLElement): void {
    const { content } = this.createSection('Smoothing', parent, false);

    this.groupTolerance = this.createSliderRow('Group Tolerance', 0, 3, 1, 1);
    content.appendChild(this.groupTolerance.container);
    this.minGroupDifference = this.createSliderRow('Min Group Difference', 1, 5, 1, 2);
    content.appendChild(this.minGroupDifference.container);
  }

  private buildRiversSection(parent: HTMLElement): void {
    const { content } = this.createSection('Rivers', parent, false);

    this.minSources = this.createSliderRow('Min Sources', 1, 20, 1, 3);
    content.appendChild(this.minSources.container);
    this.maxSources = this.createSliderRow('Max Sources', 1, 30, 1, 5);
    content.appendChild(this.maxSources.container);
    this.sourceMinElevation = this.createSliderRow('Source Min Elevation', 0.3, 0.9, 0.05, 0.55);
    content.appendChild(this.sourceMinElevation.container);
    this.sourceMinSpacing = this.createSliderRow('Source Min Spacing', 1, 15, 1, 5);
    content.appendChild(this.sourceMinSpacing.container);
    this.minRiverLength = this.createSliderRow('Min River Length', 1, 10, 1, 3);
    content.appendChild(this.minRiverLength.container);
    this.wideRiverMinLength = this.createSliderRow('Wide River Min Length', 3, 20, 1, 8);
    content.appendChild(this.wideRiverMinLength.container);
    this.wideRiverFraction = this.createSliderRow('Wide River Fraction', 0, 1, 0.05, 0.6);
    content.appendChild(this.wideRiverFraction.container);
    this.lakeMinSize = this.createSliderRow('Lake Min Size', 1, 10, 1, 3);
    content.appendChild(this.lakeMinSize.container);
    this.lakeMaxSize = this.createSliderRow('Lake Max Size', 2, 20, 1, 6);
    content.appendChild(this.lakeMaxSize.container);
  }

  private buildSettlementsSection(parent: HTMLElement): void {
    const { content } = this.createSection('Settlements', parent, false);

    this.cityDensity = this.createSliderRow(
      'City Density (per 1k hexes)',
      0.001,
      0.01,
      0.0005,
      0.0025,
    );
    content.appendChild(this.cityDensity.container);
    this.townDensity = this.createSliderRow(
      'Town Density (per 1k hexes)',
      0.002,
      0.02,
      0.001,
      0.00667,
    );
    content.appendChild(this.townDensity.container);
    this.minCityDistance = this.createSliderRow('Min City Distance', 3, 20, 1, 8);
    content.appendChild(this.minCityDistance.container);
    this.minTownDistance = this.createSliderRow('Min Town Distance', 1, 10, 1, 3);
    content.appendChild(this.minTownDistance.container);
    this.riverBonusCity = this.createSliderRow('River Bonus City', 0, 10, 1, 3);
    content.appendChild(this.riverBonusCity.container);
    this.waterBonusCity = this.createSliderRow('Water Bonus City', 0, 10, 1, 2);
    content.appendChild(this.waterBonusCity.container);
    this.plainsBonusCity = this.createSliderRow('Plains Bonus City', 0, 10, 1, 1);
    content.appendChild(this.plainsBonusCity.container);
  }

  private buildRoadsSection(parent: HTMLElement): void {
    const { content } = this.createSection('Roads', parent, false);

    const infraRow = this.createSelectRow('Infrastructure', ['none', 'basic', 'developed'], 'none');
    this.infrastructureSelect = infraRow.select;
    this.infrastructureSelect.addEventListener('change', () => this.markCustomPreset());
    content.appendChild(infraRow.container);

    this.plainsCost = this.createSliderRow('Plains Cost', 1, 10, 1, 1);
    content.appendChild(this.plainsCost.container);
    this.forestCost = this.createSliderRow('Forest Cost', 1, 10, 1, 2);
    content.appendChild(this.forestCost.container);
    this.hillsCost = this.createSliderRow('Hills Cost', 1, 10, 1, 3);
    content.appendChild(this.hillsCost.container);
    this.marshCost = this.createSliderRow('Marsh Cost', 1, 10, 1, 3);
    content.appendChild(this.marshCost.container);
    this.riverCost = this.createSliderRow('River Cost', 1, 20, 1, 6);
    content.appendChild(this.riverCost.container);
    this.cityConnectionDistance = this.createSliderRow('City Connection Dist', 5, 50, 1, 20);
    content.appendChild(this.cityConnectionDistance.container);
  }

  // ---------------------------------------------------------------------------
  // Helpers — UI builders
  // ---------------------------------------------------------------------------

  private createSection(
    title: string,
    parent: HTMLElement,
    initiallyExpanded = false,
  ): { header: HTMLDivElement; content: HTMLDivElement } {
    const section = document.createElement('div');
    section.style.borderBottom = '1px solid rgba(255,255,255,0.06)';

    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '8px 12px',
      cursor: 'pointer',
      fontWeight: '600',
      color: '#ddd',
      background: 'rgba(255,255,255,0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
    });

    const icon = document.createElement('span');
    icon.textContent = initiallyExpanded ? '\u25BE' : '\u25B8';
    icon.style.fontSize = '10px';
    icon.style.width = '10px';
    header.appendChild(icon);

    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    header.appendChild(titleSpan);

    const content = document.createElement('div');
    Object.assign(content.style, {
      padding: '8px 12px 12px',
      display: initiallyExpanded ? 'block' : 'none',
    });

    header.addEventListener('click', () => {
      const isOpen = content.style.display !== 'none';
      content.style.display = isOpen ? 'none' : 'block';
      icon.textContent = isOpen ? '\u25B8' : '\u25BE';
    });

    section.appendChild(header);
    section.appendChild(content);
    parent.appendChild(section);

    return { header, content };
  }

  private createSliderRow(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
  ): SliderRow {
    const container = document.createElement('div');
    container.style.marginTop = '6px';

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    Object.assign(labelEl.style, { fontSize: '11px', color: '#999', marginBottom: '3px' });
    container.appendChild(labelEl);

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '6px', alignItems: 'center' });

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    Object.assign(slider.style, {
      flex: '1',
      height: '4px',
      cursor: 'pointer',
      accentColor: '#4a7a9a',
    });

    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    Object.assign(input.style, {
      ...INPUT_STYLE,
      width: '55px',
      textAlign: 'right',
    });

    slider.addEventListener('input', () => {
      input.value = slider.value;
      this.markCustomPreset();
    });

    input.addEventListener('change', () => {
      const n = Number(input.value);
      const clamped = Math.min(max, Math.max(min, n));
      input.value = String(clamped);
      slider.value = String(clamped);
      this.markCustomPreset();
    });

    row.appendChild(slider);
    row.appendChild(input);
    container.appendChild(row);

    const getValue = (): number => Number(slider.value);
    const setValue = (v: number): void => {
      const s = String(v);
      slider.value = s;
      input.value = s;
    };

    return { container, slider, input, getValue, setValue };
  }

  private createSelectRow(label: string, options: string[], value: string): SelectRow {
    const container = document.createElement('div');
    container.style.marginTop = '6px';

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    Object.assign(labelEl.style, { fontSize: '11px', color: '#999', marginBottom: '3px' });
    container.appendChild(labelEl);

    const select = document.createElement('select');
    Object.assign(select.style, {
      ...INPUT_STYLE,
      width: '100%',
      cursor: 'pointer',
      padding: '4px 6px',
    });

    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt;
      el.textContent = opt;
      if (opt === value) el.selected = true;
      select.appendChild(el);
    }

    container.appendChild(select);
    return { container, select };
  }

  private createButton(text: string, bg: string, hoverBg: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      background: bg,
      color: '#eee',
      border: 'none',
      borderRadius: '3px',
      padding: '5px 10px',
      fontSize: '12px',
      cursor: 'pointer',
      fontFamily: 'inherit',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = hoverBg;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = bg;
    });
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Preset logic
  // ---------------------------------------------------------------------------

  private refreshPresetDropdown(): void {
    const select = this.presetSelect;
    select.innerHTML = '';

    // Built-in presets
    for (const name of Object.keys(BUILT_IN_PRESETS)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }

    // Custom presets
    const custom = loadCustomPresets();
    const customNames = Object.keys(custom);
    if (customNames.length > 0) {
      const divider = document.createElement('option');
      divider.disabled = true;
      divider.textContent = '\u2500\u2500 Custom \u2500\u2500';
      select.appendChild(divider);

      for (const name of customNames) {
        const opt = document.createElement('option');
        opt.value = `custom:${name}`;
        opt.textContent = name;
        select.appendChild(opt);
      }
    }

    // "Custom" fallback entry
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '(Custom)';
    select.appendChild(customOpt);
  }

  private handlePresetChange(): void {
    const val = this.presetSelect.value;

    if (val === '__custom__') return;

    if (val.startsWith('custom:')) {
      const name = val.slice(7);
      const custom = loadCustomPresets();
      if (custom[name]) {
        const params = { ...custom[name], seed: Date.now() };
        this.setParams(params);
        this.presetSelect.value = val;
        this.deletePresetBtn.style.display = 'inline-block';
      }
      return;
    }

    // Built-in preset
    const preset = BUILT_IN_PRESETS[val];
    if (preset) {
      const params = { ...preset, seed: Date.now() };
      this.setParams(params);
      this.presetSelect.value = val;
      this.deletePresetBtn.style.display = 'none';
    }
  }

  private handleSavePreset(): void {
    const name = prompt('Preset name:');
    if (!name || !name.trim()) return;
    saveCustomPreset(name.trim(), this.getParams());
    this.refreshPresetDropdown();
    this.presetSelect.value = `custom:${name.trim()}`;
    this.deletePresetBtn.style.display = 'inline-block';
  }

  private handleDeletePreset(): void {
    const val = this.presetSelect.value;
    if (!val.startsWith('custom:')) return;
    const name = val.slice(7);
    deleteCustomPreset(name);
    this.refreshPresetDropdown();
    this.presetSelect.value = '__custom__';
    this.deletePresetBtn.style.display = 'none';
  }

  private markCustomPreset(): void {
    if (this.ignorePresetChange) return;
    this.presetSelect.value = '__custom__';
    this.deletePresetBtn.style.display = 'none';
  }

  private detectPreset(): void {
    const current = this.getParams();

    // Check built-in presets (ignoring seed)
    for (const [name, preset] of Object.entries(BUILT_IN_PRESETS)) {
      if (this.paramsMatch(current, preset)) {
        this.presetSelect.value = name;
        this.deletePresetBtn.style.display = 'none';
        return;
      }
    }

    // Check custom presets
    const custom = loadCustomPresets();
    for (const [name, preset] of Object.entries(custom)) {
      if (this.paramsMatch(current, preset)) {
        this.presetSelect.value = `custom:${name}`;
        this.deletePresetBtn.style.display = 'inline-block';
        return;
      }
    }

    this.presetSelect.value = '__custom__';
    this.deletePresetBtn.style.display = 'none';
  }

  private paramsMatch(a: GenerationParams, b: GenerationParams): boolean {
    // Compare everything except seed
    const normalize = (p: GenerationParams) => ({ ...p, seed: 0 });
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
  }

  // ---------------------------------------------------------------------------
  // Coastline helpers
  // ---------------------------------------------------------------------------

  private setSeaSide(side: keyof SeaSides, active: boolean): void {
    const el = this.seaSideElements[side];
    el.dataset.active = String(active);
    el.style.background = active ? '#4a90b8' : '#2a2a3e';
  }

  // ---------------------------------------------------------------------------
  // Size preset sync
  // ---------------------------------------------------------------------------

  private syncSizePreset(width: number, height: number): void {
    for (const [name, size] of Object.entries(MAP_SIZE_PRESETS)) {
      if (size.width === width && size.height === height) {
        this.sizePresetSelect.value = name;
        return;
      }
    }
    // No match — if we had a "custom" option in the size dropdown we could use it,
    // but since we only have the three presets, just leave whatever is selected.
  }

  private onSliderChanged(): void {
    this.syncSizePreset(this.widthSlider.getValue(), this.heightSlider.getValue());
    this.markCustomPreset();
  }

  // ---------------------------------------------------------------------------
  // Toggle sidebar
  // ---------------------------------------------------------------------------

  private toggle(): void {
    this.collapsed = !this.collapsed;
    this.wrapper.style.transform = this.collapsed ? 'translateX(-300px)' : 'translateX(0)';
    this.toggleBtn.textContent = this.collapsed ? '\u25B6' : '\u25C0';
  }
}
