import { apiFetch } from '@/lib/api-client';
import {
  featureCollectionSchema,
  presetsResponseSchema,
  validateResponseSchema,
} from '@/lib/schemas';

import type { ApiError } from '@/lib/api-client';
import type { Result } from '@/lib/result';
import type { FeatureCollection, Preset, ValidateResponse } from '@/lib/schemas';

/** Minimal GeoJSON Polygon shape accepted by the validate endpoint. */
interface PolygonGeometry {
  readonly type: 'Polygon';
  readonly coordinates: readonly (readonly [number, number])[][];
}

const BASE_URL = 'http://localhost:8000';

/** Fetch all building presets from the backend. */
export async function getPresets(): Promise<Result<Preset[], ApiError>> {
  return apiFetch(`${BASE_URL}/presets`, presetsResponseSchema);
}

/** Fetch GeoJSON layers for a given preset slug. */
export async function getLayers(
  slug: string,
): Promise<Result<FeatureCollection, ApiError>> {
  return apiFetch(`${BASE_URL}/layers/${slug}`, featureCollectionSchema);
}

/** Validate a polygon geometry against a preset's constraints. */
export async function postValidate(
  geometry: PolygonGeometry,
  presetSlug: string,
): Promise<Result<ValidateResponse, ApiError>> {
  return apiFetch(`${BASE_URL}/validate`, validateResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geometry, preset_slug: presetSlug }),
  });
}

export const backendApi = { getPresets, getLayers, postValidate };
