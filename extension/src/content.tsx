import React from 'react';
import { createRoot } from 'react-dom/client';

import {
  createSolidPolygonLayerConfig,
  LAYER_IDS,
} from './bridge/layer-config';
import { FloatingPanel } from './components/FloatingPanel';
import { loadBackendData, subscribeToVisibilityChanges } from './services/data-loader';
import { useDeckStore } from './stores/deck-store';
import { useGeoDataStore } from './stores/geo-data-store';
import { usePlacementStore } from './stores/placement-store';
import { usePresetsStore } from './stores/presets-store';
import { useUIStore } from './stores/ui-store';
import { PANEL_CSS } from './styles/panel';
import { createBuildingPolygon } from './utils/building-geometry';
import { validatePlacement } from './validation/check-placement';

import type { Preset } from './lib/schemas';
import type { LayerConfig } from './bridge/deck-types';

/** Maximum time (ms) to wait for the deck.gl overlay element. */
const DECKGL_TIMEOUT_MS = 15_000;

/** Polling interval (ms) for checking if #deckgl-overlay exists. */
const POLL_INTERVAL_MS = 200;

/**
 * Waits for a DOM element matching the given selector to appear.
 * Uses MutationObserver with a polling fallback and a timeout.
 */
function waitForElement(selector: string, timeoutMs: number): Promise<Element> {
  return new Promise<Element>((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing !== null) {
      resolve(existing);
      return;
    }

    let settled = false;

    const settle = (el: Element): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeoutId);
      clearInterval(pollId);
      resolve(el);
    };

    const fail = (): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearInterval(pollId);
      reject(new Error(`Timed out waiting for "${selector}" after ${String(timeoutMs)}ms`));
    };

    // MutationObserver approach
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el !== null) {
        settle(el);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Polling fallback — MutationObserver can miss some framework-driven inserts
    const pollId: ReturnType<typeof setInterval> = setInterval(() => {
      const el = document.querySelector(selector);
      if (el !== null) {
        settle(el);
      }
    }, POLL_INTERVAL_MS);

    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(fail, timeoutMs);
  });
}

/**
 * Injects the page-context script that runs in the page's JS world.
 * This is necessary because the content script runs in an isolated world
 * and cannot access the page's React fiber tree or deck.gl instance.
 */
function injectPageScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = (): void => {
    script.remove();
  };
  document.head.appendChild(script);
}

/**
 * Listens for the deck-ready event from the injected page script,
 * updates the Zustand store, and triggers backend data loading.
 */
function listenForDeckReady(): void {
  document.addEventListener('innomapcad:deck-ready', () => {
    useDeckStore.getState().setDeckReady(true);

    // Load GIS data from backend once the bridge is ready
    void loadBackendData().then((anySuccess) => {
      if (!anySuccess) {
        useUIStore.getState().setBackendWarning(
          '\u0411\u044d\u043a\u0435\u043d\u0434 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d. \u041a\u043b\u0438\u0435\u043d\u0442\u0441\u043a\u0430\u044f \u0432\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u044f \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442.',
        );
      }
    });
  });
}

/**
 * Dispatches custom layer updates to the injected page script
 * whenever the Zustand store changes.
 */
function subscribeToLayerUpdates(): void {
  useDeckStore.subscribe((state, prevState) => {
    if (state.customLayers !== prevState.customLayers) {
      document.dispatchEvent(
        new CustomEvent<readonly LayerConfig[]>('innomapcad:update-layers', {
          detail: state.customLayers,
        }),
      );
    }
  });
}

/**
 * Creates the shadow DOM host, injects styles, and mounts the React panel.
 */
function mountPanel(): void {
  // Prevent double-mount
  if (document.getElementById('innomapcad-root') !== null) {
    return;
  }

  const host = document.createElement('div');
  host.id = 'innomapcad-root';
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject panel CSS into shadow DOM for style isolation
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  shadow.appendChild(style);

  // Create React mount point inside shadow DOM
  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  document.body.appendChild(host);

  const root = createRoot(mountPoint);
  root.render(
    <React.StrictMode>
      <FloatingPanel />
    </React.StrictMode>,
  );
}

// ---- Preset / Placement fallbacks ----

/** Hardcoded fallback presets for when backend is unavailable. */
const FALLBACK_PRESETS: readonly Preset[] = [
  { slug: 'residential', name: 'Жилой дом', width_m: 24, length_m: 60, floors: 9, height_m: 27, setback_m: 5, color: '#4A90D9' },
  { slug: 'office', name: 'Офисное здание', width_m: 30, length_m: 50, floors: 5, height_m: 18, setback_m: 5, color: '#50C878' },
  { slug: 'transformer', name: 'ТП', width_m: 6, length_m: 4, floors: 1, height_m: 3, setback_m: 2, color: '#FFD700' },
  { slug: 'parking', name: 'Парковка', width_m: 40, length_m: 20, floors: 1, height_m: 3, setback_m: 3, color: '#808080' },
  { slug: 'warehouse', name: 'Склад', width_m: 50, length_m: 30, floors: 1, height_m: 8, setback_m: 5, color: '#CD853F' },
];

/**
 * Finds a preset by slug, checking the presets store first then fallbacks.
 */
function findPreset(slug: string): Preset | undefined {
  const storePresets = usePresetsStore.getState().presets;
  const presets = storePresets.length > 0 ? storePresets : FALLBACK_PRESETS;
  return presets.find((p) => p.slug === slug);
}

/**
 * Parses a hex color string (e.g. '#4A90D9') to an RGBA tuple.
 */
function hexToRgba(hex: string, alpha: number): readonly [number, number, number, number] {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return [
    Number.isNaN(r) ? 0 : r,
    Number.isNaN(g) ? 0 : g,
    Number.isNaN(b) ? 0 : b,
    alpha,
  ] as const;
}

// ---- Placement wiring ----

/**
 * Subscribes to selectedPreset changes and dispatches start/stop placing events
 * to the page-context script.
 */
function subscribeToPresetChanges(): void {
  useUIStore.subscribe((state, prevState) => {
    if (state.selectedPreset !== prevState.selectedPreset) {
      if (state.selectedPreset !== null) {
        usePlacementStore.getState().startPlacing();
        document.dispatchEvent(new CustomEvent('innomapcad:start-placing'));
      } else {
        usePlacementStore.getState().stopPlacing();
        document.dispatchEvent(new CustomEvent('innomapcad:stop-placing'));
      }
    }
  });
}

interface MapCoordDetail {
  readonly lng: number;
  readonly lat: number;
}

/**
 * Adds the placed building as a SolidPolygonLayer to the deck store.
 */
function addBuildingLayer(
  polygon: ReadonlyArray<readonly [number, number]>,
  color: readonly [number, number, number, number],
  height: number,
): void {
  const deckStore = useDeckStore.getState();
  // Remove existing building layer if present, then add new one
  deckStore.removeLayer(LAYER_IDS.placedBuilding);
  const layerConfig = createSolidPolygonLayerConfig(
    LAYER_IDS.placedBuilding,
    polygon,
    { color, height },
  );
  deckStore.addLayer(layerConfig);
}

/** Color for valid building placement. */
const BUILDING_COLOR_VALID: readonly [number, number, number, number] = [82, 196, 26, 200] as const;

/** Color for invalid building placement. */
const BUILDING_COLOR_INVALID: readonly [number, number, number, number] = [255, 77, 79, 200] as const;

/**
 * Runs client-side validation on a placed building and updates stores + layer color.
 */
function runBuildingValidation(
  polygon: ReturnType<typeof createBuildingPolygon>,
  defaultColor: readonly [number, number, number, number],
  height: number,
): void {
  const uiStore = useUIStore.getState();
  const geoData = useGeoDataStore.getState();

  // If GeoJSON data is not loaded yet, keep the default color
  if (geoData.cadastralData === null || geoData.protectionZonesData === null) {
    uiStore.setValidationStatus('idle');
    uiStore.setValidationConflicts([]);
    addBuildingLayer(polygon.coordinates[0], defaultColor, height);
    return;
  }

  uiStore.setValidationStatus('checking');

  const result = validatePlacement(
    polygon,
    geoData.protectionZonesData,
    geoData.cadastralData,
  );

  if (result.valid) {
    uiStore.setValidationStatus('valid');
    uiStore.setValidationConflicts([]);
    addBuildingLayer(polygon.coordinates[0], BUILDING_COLOR_VALID, height);
  } else {
    uiStore.setValidationStatus('invalid');
    uiStore.setValidationConflicts(result.conflicts);
    addBuildingLayer(polygon.coordinates[0], BUILDING_COLOR_INVALID, height);
  }
}

/**
 * Listens for map-click events from the page script and places a building.
 */
function listenForMapClick(): void {
  document.addEventListener('innomapcad:map-click', ((event: CustomEvent<MapCoordDetail>) => {
    const { lng, lat } = event.detail;
    const selectedSlug = useUIStore.getState().selectedPreset;
    if (selectedSlug === null) {
      return;
    }

    const preset = findPreset(selectedSlug);
    if (preset === undefined) {
      return;
    }

    const polygon = createBuildingPolygon([lng, lat], preset.width_m, preset.length_m);
    const color = hexToRgba(preset.color, 200);

    usePlacementStore.getState().placeBuilding({
      center: [lng, lat],
      presetSlug: selectedSlug,
      polygon,
    });

    // Run validation and update building layer color accordingly
    runBuildingValidation(polygon, color, preset.height_m);

    // Stop placing mode on the page side (cursor reset)
    document.dispatchEvent(new CustomEvent('innomapcad:stop-placing'));
  }) as EventListener);
}

/**
 * Listens for map-hover events from the page script and updates hover position.
 */
function listenForMapHover(): void {
  document.addEventListener('innomapcad:map-hover', ((event: CustomEvent<MapCoordDetail>) => {
    const { lng, lat } = event.detail;
    usePlacementStore.getState().setHoverPosition([lng, lat]);
  }) as EventListener);
}

/**
 * Entry point: waits for deck.gl overlay, injects bridge, then mounts the extension panel.
 * If deck.gl is not found within the timeout, the panel is still mounted in degraded mode.
 */
async function init(): Promise<void> {
  let deckGlFound = false;

  try {
    await waitForElement('#deckgl-overlay', DECKGL_TIMEOUT_MS);
    deckGlFound = true;
  } catch {
    // deck.gl overlay not found within timeout — continue in degraded mode
  }

  if (deckGlFound) {
    // Set up bridge communication before injecting
    listenForDeckReady();
    subscribeToLayerUpdates();
    subscribeToVisibilityChanges();
    subscribeToPresetChanges();
    listenForMapClick();
    listenForMapHover();

    // Inject the page-context script for fiber walk + setProps patching
    injectPageScript();
  } else {
    useUIStore.getState().setDeckGlFound(false);

    // Even without deck.gl, try to load backend data for presets
    void loadBackendData().then((anySuccess) => {
      if (!anySuccess) {
        useUIStore.getState().setBackendWarning(
          '\u0411\u044d\u043a\u0435\u043d\u0434 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d. \u041a\u043b\u0438\u0435\u043d\u0442\u0441\u043a\u0430\u044f \u0432\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u044f \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442.',
        );
      }
    });
  }

  // Always mount the UI panel
  mountPanel();
}

void init();
