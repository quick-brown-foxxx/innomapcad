import { z } from 'zod';

// ---------------------------------------------------------------------------
// Preset
// ---------------------------------------------------------------------------

export const presetSchema = z.object({
  slug: z.string(),
  name: z.string(),
  width_m: z.number(),
  length_m: z.number(),
  floors: z.number().int(),
  height_m: z.number(),
  setback_m: z.number(),
  color: z.string(),
});

export type Preset = z.infer<typeof presetSchema>;

export const presetsResponseSchema = z.array(presetSchema);

// ---------------------------------------------------------------------------
// GeoJSON Feature / FeatureCollection
// ---------------------------------------------------------------------------

const geometrySchema = z.object({
  type: z.string(),
  coordinates: z.unknown(),
});

export const featureSchema = z.object({
  type: z.literal('Feature'),
  geometry: geometrySchema,
  properties: z.record(z.string(), z.unknown()).nullable(),
  id: z.union([z.string(), z.number()]).optional(),
});

export type Feature = z.infer<typeof featureSchema>;

export const featureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(featureSchema),
});

export type FeatureCollection = z.infer<typeof featureCollectionSchema>;

// ---------------------------------------------------------------------------
// Validate response
// ---------------------------------------------------------------------------

export const conflictSchema = z.object({
  layer: z.string(),
  type: z.string(),
  description: z.string(),
  overlap_area_m2: z.number().nullable(),
});

export type Conflict = z.infer<typeof conflictSchema>;

export const validateResponseSchema = z.object({
  valid: z.boolean(),
  conflicts: z.array(conflictSchema),
});

export type ValidateResponse = z.infer<typeof validateResponseSchema>;
