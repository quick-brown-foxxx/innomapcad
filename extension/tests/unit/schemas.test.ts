import { describe, expect, it } from 'vitest';

import {
  featureCollectionSchema,
  presetSchema,
  presetsResponseSchema,
  validateResponseSchema,
} from '@/lib/schemas';

describe('presetSchema', () => {
  const validPreset = {
    slug: 'residential-9',
    name: 'Жилой 9-этажный',
    width_m: 18,
    length_m: 60,
    floors: 9,
    height_m: 27,
    setback_m: 5,
    color: '#4A90D9',
  };

  it('parses a valid preset', () => {
    const result = presetSchema.safeParse(validPreset);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe('residential-9');
      expect(result.data.floors).toBe(9);
    }
  });

  it('rejects a preset with missing field', () => {
    const { color: _unusedColor, ...incomplete } = validPreset;
    void _unusedColor;
    const result = presetSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it('rejects a preset with wrong field type', () => {
    const result = presetSchema.safeParse({ ...validPreset, floors: 'nine' });
    expect(result.success).toBe(false);
  });
});

describe('presetsResponseSchema', () => {
  it('parses an array of presets', () => {
    const payload = [
      {
        slug: 'office-5',
        name: 'Офисное 5-этажное',
        width_m: 20,
        length_m: 40,
        floors: 5,
        height_m: 15,
        setback_m: 3,
        color: '#D94A4A',
      },
    ];
    const result = presetsResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });
});

describe('featureCollectionSchema', () => {
  it('parses a valid FeatureCollection', () => {
    const payload = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [37.6, 55.7],
                [37.7, 55.7],
                [37.7, 55.8],
                [37.6, 55.8],
                [37.6, 55.7],
              ],
            ],
          },
          properties: { name: 'parcel-1' },
        },
      ],
    };
    const result = featureCollectionSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.features).toHaveLength(1);
    }
  });

  it('rejects a FeatureCollection with wrong type literal', () => {
    const result = featureCollectionSchema.safeParse({
      type: 'Feature',
      features: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('validateResponseSchema', () => {
  it('parses a valid validate response with no conflicts', () => {
    const payload = { valid: true, conflicts: [] };
    const result = validateResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.valid).toBe(true);
      expect(result.data.conflicts).toHaveLength(0);
    }
  });

  it('parses a validate response with conflicts', () => {
    const payload = {
      valid: false,
      conflicts: [
        {
          layer: 'cadastral',
          type: 'overlap',
          description: 'Пересечение с кадастровым участком',
          overlap_area_m2: 42.5,
        },
        {
          layer: 'protection_zones',
          type: 'inside',
          description: 'Попадание в охранную зону',
          overlap_area_m2: null,
        },
      ],
    };
    const result = validateResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.valid).toBe(false);
      expect(result.data.conflicts).toHaveLength(2);
      expect(result.data.conflicts[0]?.overlap_area_m2).toBe(42.5);
      expect(result.data.conflicts[1]?.overlap_area_m2).toBeNull();
    }
  });

  it('rejects a validate response missing valid field', () => {
    const result = validateResponseSchema.safeParse({ conflicts: [] });
    expect(result.success).toBe(false);
  });
});
