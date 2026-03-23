/**
 * Helper to build plain-JSON deck.gl GeoJsonLayer config objects.
 * These configs are serialized via CustomEvent to the page script,
 * which creates actual deck.gl GeoJsonLayer instances.
 */

import type { LayerConfig } from './deck-types';
import type { FeatureCollection } from '@/lib/schemas';

interface GeoJsonLayerOptions {
  readonly fillColor: readonly [number, number, number, number];
  readonly lineColor: readonly [number, number, number, number];
  readonly visible: boolean;
}

/**
 * Creates a plain-JSON config for a deck.gl GeoJsonLayer.
 * The page script (injected.ts) uses this config to instantiate the actual layer.
 */
export function createGeoJsonLayerConfig(
  id: string,
  data: FeatureCollection,
  options: GeoJsonLayerOptions,
): LayerConfig {
  return {
    id,
    type: 'GeoJsonLayer',
    props: {
      data,
      getFillColor: [...options.fillColor],
      getLineColor: [...options.lineColor],
      getLineWidth: 2,
      lineWidthMinPixels: 1,
      filled: true,
      stroked: true,
      pickable: true,
      visible: options.visible,
    },
  };
}

/** Layer color constants for cadastral and protection zone layers. */
export const LAYER_COLORS = {
  cadastral: {
    fill: [74, 144, 217, 77] as const, // #4A90D9, opacity 0.3
    line: [74, 144, 217, 255] as const, // #4A90D9
  },
  protectionZones: {
    fill: [255, 68, 68, 77] as const, // #FF4444, opacity 0.3
    line: [255, 68, 68, 255] as const, // #FF4444
  },
} as const;

/** Well-known layer IDs used throughout the extension. */
export const LAYER_IDS = {
  cadastral: 'cadastral-layer',
  protectionZones: 'protection-zones-layer',
  placedBuilding: 'placed-building-layer',
  ghostBuilding: 'ghost-building-layer',
} as const;

interface SolidPolygonLayerOptions {
  readonly color: readonly [number, number, number, number];
  readonly height: number;
}

/**
 * Creates a plain-JSON config for a deck.gl SolidPolygonLayer (extruded 3D).
 * Used for building placement.
 */
export function createSolidPolygonLayerConfig(
  id: string,
  polygon: ReadonlyArray<readonly [number, number]>,
  options: SolidPolygonLayerOptions,
): LayerConfig {
  return {
    id,
    type: 'SolidPolygonLayer',
    props: {
      data: [
        {
          polygon: polygon.map((coord) => [...coord, 0]),
          height: options.height,
        },
      ],
      getPolygon: 'polygon',
      getElevation: 'height',
      getFillColor: [...options.color],
      extruded: true,
      pickable: true,
    },
  };
}
