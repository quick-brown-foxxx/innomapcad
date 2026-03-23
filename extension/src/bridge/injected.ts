/**
 * Page-context script injected into 4dinno.ru.
 *
 * This script runs in the PAGE's JS context (not the extension's isolated world),
 * so it can access the page's React fiber tree and deck.gl instance.
 *
 * It CANNOT import Zustand or any extension modules.
 * Communication with the content script is via CustomEvent only.
 *
 * Strategy: direct injection + heartbeat (no setProps patching).
 * Layer instances are created ONCE when configs change, cached, and reused.
 * A low-frequency heartbeat re-injects if React wipes our layers.
 */

// ---- Inline types (cannot import from extension modules) ----

interface LayerConfig {
  readonly id: string;
  readonly type: string;
  readonly props: Record<string, unknown>;
}

interface DeckLike {
  setProps: (props: Record<string, unknown>) => void;
  props?: { layers?: readonly unknown[] };
}

// ---- TypeIs guard (inlined since we can't import) ----

function isDeckInstance(value: unknown): value is DeckLike {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value !== 'object') {
    return false;
  }
  return 'setProps' in value && typeof (value as DeckLike).setProps === 'function';
}

// ---- Fiber walk ----

/** Maximum depth to walk up the React fiber `.return` chain. */
const MAX_FIBER_DEPTH = 50;

/**
 * Walks the React fiber tree starting from the #deckgl-overlay element
 * to find the deck.gl instance.
 */
function findDeckInstance(canvas: Element): DeckLike | null {
  // Find the React fiber key on the canvas element
  const fiberKey = Object.keys(canvas).find((key) => key.startsWith('__reactFiber'));
  if (fiberKey === undefined) {
    return null;
  }

  // This is the SINGLE any-point: React fiber internals are untyped
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  let fiber: any = (canvas as any)[fiberKey];

  for (let i = 0; i < MAX_FIBER_DEPTH; i++) {
    if (fiber === null || fiber === undefined) {
      break;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const candidate: unknown = fiber.ref?.current?.deck;
    if (isDeckInstance(candidate)) {
      return candidate;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    fiber = fiber.return;
  }

  return null;
}

// ---- Layer class extraction ----

/**
 * SolidPolygonLayer constructor extracted from existing deck.gl sublayers.
 * This is the ONLY reliable way to create layers — window.deck has no classes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SolidPolygonLayerClass: (new (props: Record<string, unknown>) => any) | null = null;

/**
 * Walks `deck.layerManager.layers` to find a SolidPolygonLayer constructor.
 * Identified by having `getPolygon` + `extruded` in its props.
 */
function extractLayerClasses(deck: DeckLike): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const lm = (deck as any).layerManager;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (!lm?.layers) return;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  for (const layer of lm.layers) {
    if (SolidPolygonLayerClass !== null) break;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const props = layer.props;
    if (props && 'getPolygon' in props && 'extruded' in props) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      SolidPolygonLayerClass = layer.constructor;
    }
  }
}

// ---- GeoJSON to polygon conversion ----

/**
 * Converts a GeoJSON FeatureCollection into an array of polygon data objects
 * suitable for SolidPolygonLayer.
 */
function geoJsonToPolygonData(data: unknown): unknown[] {
  if (!data || typeof data !== 'object' || !('features' in data)) return [];
  const fc = data as { features: Array<{ geometry: { type: string; coordinates: unknown }; properties?: Record<string, unknown> }> };
  const polygons: unknown[] = [];
  for (const feature of fc.features) {
    const geom = feature.geometry;
    if (geom.type === 'Polygon') {
      const coords = geom.coordinates as number[][][];
      const ring = coords[0];
      if (ring !== undefined) {
        polygons.push({ polygon: ring.map((c) => [c[0], c[1], 0]), properties: feature.properties });
      }
    } else if (geom.type === 'MultiPolygon') {
      const multiCoords = geom.coordinates as number[][][][];
      for (const poly of multiCoords) {
        const ring = poly[0];
        if (ring !== undefined) {
          polygons.push({ polygon: ring.map((c) => [c[0], c[1], 0]), properties: feature.properties });
        }
      }
    }
  }
  return polygons;
}

// ---- Layer instantiation ----

/**
 * Converts a plain LayerConfig into a real deck.gl layer instance.
 * Returns null if the constructor is not available — never returns plain objects.
 */
function instantiateLayer(config: LayerConfig): unknown {
  if (SolidPolygonLayerClass === null) {
    // Can't create proper layers — skip (don't inject plain objects!)
    return null;
  }

  if (config.type === 'GeoJsonLayer') {
    const polygonData = geoJsonToPolygonData(config.props.data);
    const fillColor = config.props.getFillColor !== undefined ? config.props.getFillColor : [200, 200, 200, 100];
    const lineColor = config.props.getLineColor !== undefined ? config.props.getLineColor : [200, 200, 200, 255];
    const pickable = config.props.pickable !== undefined ? config.props.pickable : false;
    const visible = config.props.visible !== undefined ? config.props.visible : true;
    return new SolidPolygonLayerClass({
      id: config.id,
      data: polygonData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      getPolygon: (d: any) => d.polygon,
      getElevation: 0,
      getFillColor: fillColor,
      getLineColor: lineColor,
      filled: true,
      pickable,
      visible,
    } as Record<string, unknown>);
  }

  if (config.type === 'SolidPolygonLayer') {
    return new SolidPolygonLayerClass({
      id: config.id,
      ...config.props,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      getPolygon: (d: any) => d.polygon,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      getElevation: (d: any) => d.height ?? 0,
    } as Record<string, unknown>);
  }

  // Unknown type — skip, don't inject plain objects
  return null;
}

// ---- Direct injection + heartbeat ----

let deckRef: DeckLike | null = null;
let customLayers: readonly LayerConfig[] = [];
let cachedInstances: readonly unknown[] = [];

/**
 * Tracks ALL layer IDs we have ever injected, so we can remove them
 * even after they are toggled off (no longer in customLayers).
 */
const allKnownIds: Set<string> = new Set();

/**
 * Syncs the deck.gl instance with our current custom layers.
 * Removes ALL known custom layer IDs from deck, then appends current ones.
 * Works correctly even when cachedInstances is empty (all layers toggled off).
 */
function syncLayers(): void {
  if (deckRef === null) return;

  const rawLayers: unknown = deckRef.props?.layers;
  const currentLayers: readonly unknown[] = Array.isArray(rawLayers) ? (rawLayers as unknown[]) : [];

  // Filter out ALL known custom IDs — not just current ones
  const baseLayers = currentLayers.filter(
    (l) => !(l !== null && typeof l === 'object' && 'id' in l && allKnownIds.has((l as LayerConfig).id)),
  );

  if (cachedInstances.length === 0) {
    // All custom layers toggled off — just set base layers (cleanup)
    deckRef.setProps({ layers: [...baseLayers] });
  } else {
    deckRef.setProps({ layers: [...baseLayers, ...cachedInstances] });
  }
}

// Heartbeat: re-sync if React wiped our layers
const HEARTBEAT_MS = 500;
let heartbeatId: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(): void {
  if (heartbeatId !== null) return;
  heartbeatId = setInterval(() => {
    if (deckRef === null || cachedInstances.length === 0) return;

    const rawLayers: unknown = deckRef.props?.layers;
    const currentLayers: readonly unknown[] = Array.isArray(rawLayers) ? (rawLayers as unknown[]) : [];
    const activeIds = new Set(customLayers.map((l) => l.id));
    const hasOurLayers = currentLayers.some(
      (l) => l !== null && typeof l === 'object' && 'id' in l && activeIds.has((l as LayerConfig).id),
    );

    if (!hasOurLayers) {
      syncLayers();
    }
  }, HEARTBEAT_MS);
}

// ---- Map click / hover handling for placement mode ----

let placingActive = false;
let deckCanvas: HTMLCanvasElement | null = null;

interface MapCoordEvent {
  readonly lng: number;
  readonly lat: number;
}

/**
 * Resolves [lng, lat] from a mouse event by unprojecting pixel coordinates
 * using the deck.gl viewState found on the fiber tree.
 */
function getMapCoordinates(event: MouseEvent): MapCoordEvent | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const deckGlobal = (window as any).deck;
  if (deckGlobal === null || deckGlobal === undefined) {
    return null;
  }

  const canvas = document.querySelector('#deckgl-overlay');
  if (canvas === null) {
    return null;
  }

  const deck = findDeckInstance(canvas);
  if (deck === null) {
    return null;
  }

  // Try to use deck.pickObject to get coordinates
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
  const viewports = (deck as any).getViewports?.();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const viewport = Array.isArray(viewports) ? viewports[0] : undefined;

  if (viewport !== undefined) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const lngLat = viewport.unproject([x, y]);
    if (Array.isArray(lngLat) && lngLat.length >= 2) {
      return { lng: Number(lngLat[0]), lat: Number(lngLat[1]) };
    }
  }

  return null;
}

function handleMapClick(event: MouseEvent): void {
  if (!placingActive) {
    return;
  }
  const coords = getMapCoordinates(event);
  if (coords === null) {
    return;
  }
  document.dispatchEvent(
    new CustomEvent<MapCoordEvent>('innomapcad:map-click', { detail: coords }),
  );
}

function handleMapHover(event: MouseEvent): void {
  if (!placingActive) {
    return;
  }
  const coords = getMapCoordinates(event);
  if (coords === null) {
    return;
  }
  document.dispatchEvent(
    new CustomEvent<MapCoordEvent>('innomapcad:map-hover', { detail: coords }),
  );
}

function enablePlacementListeners(): void {
  placingActive = true;
  if (deckCanvas !== null) {
    return;
  }
  const canvas = document.querySelector('#deckgl-overlay');
  if (canvas instanceof HTMLCanvasElement) {
    deckCanvas = canvas;
    deckCanvas.addEventListener('click', handleMapClick);
    deckCanvas.addEventListener('mousemove', handleMapHover);
    deckCanvas.style.cursor = 'crosshair';
  }
}

function disablePlacementListeners(): void {
  placingActive = false;
  if (deckCanvas !== null) {
    deckCanvas.style.cursor = '';
    // Keep listeners attached but inactive via placingActive flag
  }
}

// ---- Event listeners ----

document.addEventListener('innomapcad:start-placing', () => {
  enablePlacementListeners();
});

document.addEventListener('innomapcad:stop-placing', () => {
  disablePlacementListeners();
});

document.addEventListener('innomapcad:update-layers', ((event: CustomEvent<readonly LayerConfig[]>) => {
  customLayers = event.detail;
  // Track all IDs we've ever seen so we can remove them even after toggle-off
  for (const layer of customLayers) {
    allKnownIds.add(layer.id);
  }
  // Instantiate ONCE, cache for reuse. Filter nulls (unknown types or missing constructor).
  cachedInstances = customLayers.map((layer) => instantiateLayer(layer)).filter(Boolean);
  syncLayers();
}) as EventListener);

// ---- Initialization ----

const INIT_POLL_INTERVAL_MS = 300;
const INIT_TIMEOUT_MS = 15_000;

function tryInit(): boolean {
  const canvas = document.querySelector('#deckgl-overlay');
  if (canvas === null) {
    return false;
  }

  const deck = findDeckInstance(canvas);
  if (deck === null) {
    return false;
  }

  deckRef = deck;

  // Extract layer constructors from existing sublayers
  extractLayerClasses(deck);

  startHeartbeat();

  document.dispatchEvent(
    new CustomEvent('innomapcad:deck-ready'),
  );

  return true;
}

function startInit(): void {
  if (tryInit()) {
    return;
  }

  const startTime = Date.now();

  const intervalId: ReturnType<typeof setInterval> = setInterval(() => {
    if (tryInit()) {
      clearInterval(intervalId);
      return;
    }

    if (Date.now() - startTime > INIT_TIMEOUT_MS) {
      clearInterval(intervalId);
    }
  }, INIT_POLL_INTERVAL_MS);
}

// ---- MutationObserver to re-acquire deck ref if canvas is replaced ----

function observeReRenders(): void {
  const wrapper = document.querySelector('#deckgl-wrapper');
  if (wrapper === null) {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    // Only react to actual child additions (canvas replaced by React).
    // Ignore attribute changes, text changes, or subtree updates.
    const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (!hasAddedNodes) {
      return;
    }

    const canvas = document.querySelector('#deckgl-overlay');
    if (canvas === null) {
      return;
    }

    const deck = findDeckInstance(canvas);
    if (deck === null) {
      return;
    }

    // Re-acquire the deck reference (canvas was replaced by React)
    deckRef = deck;
    // Re-extract layer constructors from the new deck instance
    extractLayerClasses(deck);
    // Re-inject cached layers into the new deck instance
    syncLayers();
  });

  // Only watch direct children of wrapper — NOT subtree
  observer.observe(wrapper, {
    childList: true,
    subtree: false,
  });
}

startInit();
observeReRenders();
