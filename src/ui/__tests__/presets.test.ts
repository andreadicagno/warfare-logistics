import { DEFAULT_GENERATION_PARAMS } from '@core/map/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUILT_IN_PRESETS,
  deleteCustomPreset,
  loadCustomPresets,
  saveCustomPreset,
} from '../presets';

// Mock localStorage for Node environment
const store = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  removeItem: vi.fn((key: string) => store.delete(key)),
  clear: vi.fn(() => store.clear()),
  get length() {
    return store.size;
  },
  key: vi.fn((_index: number) => null),
};
vi.stubGlobal('localStorage', localStorageMock);

describe('presets', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('has 6 built-in presets', () => {
    expect(Object.keys(BUILT_IN_PRESETS)).toHaveLength(6);
  });

  it('Default preset matches DEFAULT_GENERATION_PARAMS (except seed)', () => {
    const { seed: _a, ...defaultRest } = DEFAULT_GENERATION_PARAMS;
    const { seed: _b, ...presetRest } = BUILT_IN_PRESETS.Default;
    expect(presetRest).toEqual(defaultRest);
  });

  it('can save and load custom presets', () => {
    const custom = { ...DEFAULT_GENERATION_PARAMS, width: 999 };
    saveCustomPreset('My Preset', custom);
    const loaded = loadCustomPresets();
    expect(loaded['My Preset'].width).toBe(999);
  });

  it('can delete custom presets', () => {
    saveCustomPreset('Temp', DEFAULT_GENERATION_PARAMS);
    deleteCustomPreset('Temp');
    const loaded = loadCustomPresets();
    expect(loaded.Temp).toBeUndefined();
  });

  it('returns empty object when no custom presets', () => {
    expect(loadCustomPresets()).toEqual({});
  });
});
