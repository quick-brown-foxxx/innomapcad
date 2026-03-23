/**
 * Pure function for merging existing deck.gl layers with custom layers.
 * Testable without a browser environment.
 */

import type { LayerConfig } from './deck-types';

/**
 * Merges existing layers with custom layers.
 * Custom layers with the same ID as existing layers replace them.
 * Custom layers with new IDs are appended.
 *
 * @param existingLayers - The current layers from deck.gl setProps
 * @param customLayers - Custom layers to inject
 * @returns Merged array of layers
 */
export function mergeLayers(
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

  // Replace existing layers that have matching custom layer IDs
  const merged: LayerConfig[] = existingLayers.map((existing) => {
    const replacement = customById.get(existing.id);
    if (replacement !== undefined) {
      customById.delete(existing.id);
      return replacement;
    }
    return existing;
  });

  // Append remaining custom layers that had no matching existing layer
  for (const remaining of customById.values()) {
    merged.push(remaining);
  }

  return merged;
}
