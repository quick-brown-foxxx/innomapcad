import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadBackendData, resetDataLoader } from '@/services/data-loader';
import { useDeckStore } from '@/stores/deck-store';
import { usePresetsStore } from '@/stores/presets-store';
import { useUIStore } from '@/stores/ui-store';

import type { FeatureCollection, Preset } from '@/lib/schemas';
import type { Result } from '@/lib/result';
import type { ApiError } from '@/lib/api-client';

const MOCK_PRESET: Preset = {
  slug: 'test',
  name: 'Test',
  width_m: 10,
  length_m: 20,
  floors: 3,
  height_m: 9,
  setback_m: 5,
  color: '#FF0000',
};

const MOCK_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      properties: null,
    },
  ],
};

const SUCCESS_PRESETS: Result<Preset[], ApiError> = { ok: true, value: [MOCK_PRESET] };
const SUCCESS_GEOJSON: Result<FeatureCollection, ApiError> = { ok: true, value: MOCK_GEOJSON };
const FAILURE: Result<never, ApiError> = { ok: false, error: { message: 'Network error' } };

vi.mock('@/api/backend-api', () => ({
  backendApi: {
    getPresets: vi.fn(),
    getLayers: vi.fn(),
    postValidate: vi.fn(),
  },
}));

async function getBackendApi(): Promise<typeof import('@/api/backend-api')['backendApi']> {
  const mod = await import('@/api/backend-api');
  return mod.backendApi;
}

describe('loadBackendData', () => {
  beforeEach(() => {
    resetDataLoader();
    useDeckStore.setState({ customLayers: [], deckReady: true });
    usePresetsStore.setState({ presets: [], loading: false, error: null });
    useUIStore.setState({
      layerVisibility: { cadastral: true, protectionZones: true },
      selectedPreset: null,
      validationStatus: 'idle',
      validationConflicts: [],
      backendWarning: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true and populates stores when all API calls succeed', async () => {
    const api = await getBackendApi();
    vi.mocked(api.getPresets).mockResolvedValue(SUCCESS_PRESETS);
    vi.mocked(api.getLayers).mockImplementation((slug: string) => {
      if (slug === 'cadastral' || slug === 'protection_zones') {
        return Promise.resolve(SUCCESS_GEOJSON);
      }
      return Promise.resolve(FAILURE as Result<FeatureCollection, ApiError>);
    });

    const result = await loadBackendData();

    expect(result).toBe(true);
    expect(usePresetsStore.getState().presets).toEqual([MOCK_PRESET]);
    expect(useDeckStore.getState().customLayers).toHaveLength(2);
  });

  it('returns false when all API calls fail', async () => {
    const api = await getBackendApi();
    vi.mocked(api.getPresets).mockResolvedValue(FAILURE as Result<Preset[], ApiError>);
    vi.mocked(api.getLayers).mockResolvedValue(FAILURE as Result<FeatureCollection, ApiError>);

    const result = await loadBackendData();

    expect(result).toBe(false);
    expect(usePresetsStore.getState().error).toBe('Failed to load presets');
    expect(useDeckStore.getState().customLayers).toHaveLength(0);
  });

  it('builds layers only for visible layers', async () => {
    useUIStore.setState({
      layerVisibility: { cadastral: true, protectionZones: false },
      selectedPreset: null,
      validationStatus: 'idle',
      validationConflicts: [],
      backendWarning: null,
    });

    const api = await getBackendApi();
    vi.mocked(api.getPresets).mockResolvedValue(SUCCESS_PRESETS);
    vi.mocked(api.getLayers).mockResolvedValue(SUCCESS_GEOJSON);

    await loadBackendData();

    const layers = useDeckStore.getState().customLayers;
    expect(layers).toHaveLength(1);
    expect(layers[0]?.id).toBe('cadastral-layer');
  });

  it('creates layer configs with correct ids', async () => {
    const api = await getBackendApi();
    vi.mocked(api.getPresets).mockResolvedValue(SUCCESS_PRESETS);
    vi.mocked(api.getLayers).mockResolvedValue(SUCCESS_GEOJSON);

    await loadBackendData();

    const layers = useDeckStore.getState().customLayers;
    const ids = layers.map((l) => l.id);
    expect(ids).toContain('cadastral-layer');
    expect(ids).toContain('protection-zones-layer');
  });
});
