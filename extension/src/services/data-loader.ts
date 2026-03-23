/**
 * Orchestrates loading GIS data from the backend and pushing it to stores.
 * Called once after the deck.gl bridge is ready.
 */

import { backendApi } from '@/api/backend-api';
import {
  createGeoJsonLayerConfig,
  LAYER_COLORS,
  LAYER_IDS,
} from '@/bridge/layer-config';
import { useDeckStore } from '@/stores/deck-store';
import { useGeoDataStore } from '@/stores/geo-data-store';
import { usePresetsStore } from '@/stores/presets-store';
import { useUIStore } from '@/stores/ui-store';

import type { LayerConfig } from '@/bridge/deck-types';
import type { FeatureCollection } from '@/lib/schemas';

/** Stored GeoJSON data for rebuilding layers on visibility changes. */
let cadastralData: FeatureCollection | null = null;
let protectionZonesData: FeatureCollection | null = null;

/**
 * Builds the customLayers array based on current GeoJSON data and visibility state.
 * Returns only visible layers.
 */
function buildVisibleLayers(): readonly LayerConfig[] {
  const { layerVisibility } = useUIStore.getState();
  const layers: LayerConfig[] = [];

  if (cadastralData !== null && layerVisibility.cadastral) {
    layers.push(
      createGeoJsonLayerConfig(LAYER_IDS.cadastral, cadastralData, {
        fillColor: LAYER_COLORS.cadastral.fill,
        lineColor: LAYER_COLORS.cadastral.line,
        visible: true,
      }),
    );
  }

  if (protectionZonesData !== null && layerVisibility.protectionZones) {
    layers.push(
      createGeoJsonLayerConfig(LAYER_IDS.protectionZones, protectionZonesData, {
        fillColor: LAYER_COLORS.protectionZones.fill,
        lineColor: LAYER_COLORS.protectionZones.line,
        visible: true,
      }),
    );
  }

  return layers;
}

/**
 * Subscribes to ui-store layerVisibility changes and updates deck-store
 * customLayers whenever the user toggles a layer.
 */
export function subscribeToVisibilityChanges(): void {
  useUIStore.subscribe((state, prevState) => {
    if (state.layerVisibility !== prevState.layerVisibility) {
      useDeckStore.getState().updateLayers(buildVisibleLayers());
    }
  });
}

/**
 * Fetches all GIS data from the backend and populates stores.
 * Returns true if at least one data source was loaded, false if backend is unavailable.
 */
export async function loadBackendData(): Promise<boolean> {
  const presetsStore = usePresetsStore.getState();
  presetsStore.setLoading(true);

  let anySuccess = false;

  // Fetch presets
  const presetsResult = await backendApi.getPresets();
  if (presetsResult.ok) {
    presetsStore.setPresets(presetsResult.value);
    anySuccess = true;
  } else {
    presetsStore.setError('Failed to load presets');
  }

  // Fetch cadastral layer
  const cadastralResult = await backendApi.getLayers('cadastral');
  if (cadastralResult.ok) {
    cadastralData = cadastralResult.value;
    useGeoDataStore.getState().setCadastralData(cadastralResult.value);
    anySuccess = true;
  }

  // Fetch protection zones layer
  const zonesResult = await backendApi.getLayers('protection_zones');
  if (zonesResult.ok) {
    protectionZonesData = zonesResult.value;
    useGeoDataStore.getState().setProtectionZonesData(zonesResult.value);
    anySuccess = true;
  }

  // Build and push layers to deck-store
  useDeckStore.getState().updateLayers(buildVisibleLayers());

  return anySuccess;
}

/**
 * Re-fetches all GIS data from the backend and rebuilds layers.
 * Unlike the initial load, this clears cached data first so layers
 * are fully replaced. Returns true if at least one source loaded.
 */
export async function reloadBackendData(): Promise<boolean> {
  cadastralData = null;
  protectionZonesData = null;
  useUIStore.getState().setBackendWarning(null);
  return loadBackendData();
}

/**
 * Resets module-level state. Used in tests.
 */
export function resetDataLoader(): void {
  cadastralData = null;
  protectionZonesData = null;
}
