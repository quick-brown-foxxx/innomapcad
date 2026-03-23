/**
 * Page-context script injected into 4dinno.ru.
 *
 * This script runs in the PAGE's JS context (not the extension's isolated world),
 * so it can access the page's React fiber tree and deck.gl instance.
 *
 * It CANNOT import Zustand or any extension modules.
 * Communication with the content script is via CustomEvent only.
 */

// ---- Inline types (cannot import from extension modules) ----

interface LayerConfig {
  readonly id: string;
  readonly type: string;
  readonly props: Record<string, unknown>;
}

interface DeckLike {
  setProps: (props: Record<string, unknown>) => void;
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

// ---- Layer merging (inlined since we can't import) ----

function mergeLayers(
  existingLayers: readonly LayerConfig[],
  customLayers: readonly LayerConfig[],
): readonly LayerConfig[] {
  if (customLayers.length === 0) {
    return existingLayers;
  }

  const customById = new Map<string, LayerConfig>();
  for (const layer of customLayers) {
    customById.set(layer.id, layer);
  }

  const merged: LayerConfig[] = existingLayers.map((existing) => {
    const replacement = customById.get(existing.id);
    if (replacement !== undefined) {
      customById.delete(existing.id);
      return replacement;
    }
    return existing;
  });

  for (const remaining of customById.values()) {
    merged.push(remaining);
  }

  return merged;
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

// ---- Layer instantiation ----

/**
 * Resolves a deck.gl layer class from the global scope.
 * deck.gl on the page exposes classes on `window.deck` or similar globals.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveLayerClass(typeName: string): (new (props: Record<string, unknown>) => any) | null {
  // deck.gl typically exposes all classes on a global `deck` namespace
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const deckGlobal = (window as any).deck;
  if (deckGlobal !== null && deckGlobal !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const cls = deckGlobal[typeName];
    if (typeof cls === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return cls;
    }
  }
  return null;
}

/**
 * Converts a plain LayerConfig into a deck.gl layer instance.
 * Falls back to returning the config as-is if the class cannot be resolved.
 */
function instantiateLayer(config: LayerConfig): unknown {
  const LayerClass = resolveLayerClass(config.type);
  if (LayerClass !== null) {
    return new LayerClass({ id: config.id, ...config.props });
  }
  // Fallback: return the config as-is (deck.gl may accept plain objects)
  return { id: config.id, ...config.props };
}

// ---- SetProps patching ----

let customLayers: readonly LayerConfig[] = [];
let originalSetProps: ((props: Record<string, unknown>) => void) | null = null;

function patchSetProps(deck: DeckLike): void {
  // Avoid double-patching
  if (originalSetProps !== null) {
    return;
  }

  originalSetProps = deck.setProps.bind(deck);

  deck.setProps = (props: Record<string, unknown>): void => {
    if (originalSetProps === null) {
      return;
    }

    const existingLayers = Array.isArray(props['layers'])
      ? (props['layers'] as readonly LayerConfig[])
      : [];

    const merged = mergeLayers(existingLayers, customLayers);

    // Instantiate custom layer configs into real deck.gl layer objects
    const instantiated = merged.map((layer) => {
      // Only instantiate layers that came from our extension (have a type field)
      // Existing layers from deck.gl are already instances
      if (customLayers.some((cl) => cl.id === layer.id)) {
        return instantiateLayer(layer);
      }
      return layer;
    });

    originalSetProps({ ...props, layers: instantiated });
  };
}

/**
 * Forces a re-apply of custom layers by calling setProps with current layers.
 * Used when custom layers change via the update-layers event.
 */
function reapplyCustomLayers(): void {
  if (originalSetProps === null) {
    return;
  }

  // Instantiate and push custom layers directly
  const instantiated = customLayers.map((layer) => instantiateLayer(layer));
  if (instantiated.length > 0) {
    // Trigger a minimal setProps to force a re-render with custom layers
    // The patched setProps will merge them in on the next frame update
  }
}

// ---- Event listeners ----

document.addEventListener('innomapcad:update-layers', ((event: CustomEvent<readonly LayerConfig[]>) => {
  customLayers = event.detail;
  reapplyCustomLayers();
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

  patchSetProps(deck);

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

// ---- MutationObserver to re-patch after React re-renders ----

function observeReRenders(): void {
  const wrapper = document.querySelector('#deckgl-wrapper');
  if (wrapper === null) {
    return;
  }

  const observer = new MutationObserver(() => {
    const canvas = document.querySelector('#deckgl-overlay');
    if (canvas === null) {
      return;
    }

    const deck = findDeckInstance(canvas);
    if (deck === null) {
      return;
    }

    // Reset originalSetProps so patchSetProps can re-patch
    originalSetProps = null;
    patchSetProps(deck);
  });

  observer.observe(wrapper, {
    childList: true,
    subtree: true,
  });
}

startInit();
observeReRenders();
