import type { GenerationParams } from '@core/map/types';
import { DEFAULT_GENERATION_PARAMS } from '@core/map/types';

const STORAGE_KEY = 'supplyline-custom-presets';

export const BUILT_IN_PRESETS: Record<string, GenerationParams> = {
  Default: { ...DEFAULT_GENERATION_PARAMS },
  Archipelago: {
    ...DEFAULT_GENERATION_PARAMS,
    terrain: {
      ...DEFAULT_GENERATION_PARAMS.terrain,
      waterThreshold: 0.35,
      coastalThreshold: 0.45,
      moistureScale: 0.12,
    },
    rivers: {
      ...DEFAULT_GENERATION_PARAMS.rivers,
      minSources: 5,
      maxSources: 10,
    },
    seaSides: { north: true, south: true, east: true, west: true },
  },
  Continental: {
    ...DEFAULT_GENERATION_PARAMS,
    terrain: {
      ...DEFAULT_GENERATION_PARAMS.terrain,
      waterThreshold: 0.1,
      coastalThreshold: 0.2,
    },
    rivers: {
      ...DEFAULT_GENERATION_PARAMS.rivers,
      minSources: 2,
      maxSources: 3,
    },
    seaSides: { north: false, south: false, east: false, west: true },
  },
  Peninsula: {
    ...DEFAULT_GENERATION_PARAMS,
    supplyLines: { ...DEFAULT_GENERATION_PARAMS.supplyLines, infrastructure: 'basic' },
    seaSides: { north: true, south: true, east: true, west: false },
  },
  'Mountain Fortress': {
    ...DEFAULT_GENERATION_PARAMS,
    terrain: {
      ...DEFAULT_GENERATION_PARAMS.terrain,
      geography: 'mountainous',
      highlandThreshold: 0.55,
    },
    urban: {
      ...DEFAULT_GENERATION_PARAMS.urban,
      metropolisDensity: 1,
      cityDensity: 2,
      townDensity: 4,
      minMetropolisSpacing: 15,
    },
  },
  'River Delta': {
    ...DEFAULT_GENERATION_PARAMS,
    terrain: {
      ...DEFAULT_GENERATION_PARAMS.terrain,
      waterThreshold: 0.25,
      lowlandThreshold: 0.6,
      lakeMoistureThreshold: 0.55,
      moistureScale: 0.12,
    },
    rivers: {
      ...DEFAULT_GENERATION_PARAMS.rivers,
      minSources: 6,
      maxSources: 12,
      wideRiverMinLength: 5,
      wideRiverFraction: 0.7,
      lakeMinSize: 4,
      lakeMaxSize: 10,
    },
  },
};

export function loadCustomPresets(): Record<string, GenerationParams> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCustomPreset(name: string, params: GenerationParams): void {
  const existing = loadCustomPresets();
  existing[name] = { ...params };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function deleteCustomPreset(name: string): void {
  const existing = loadCustomPresets();
  delete existing[name];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}
