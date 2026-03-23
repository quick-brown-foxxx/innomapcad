import { describe, expect, it } from 'vitest';

import { createGeoJsonLayerConfig, LAYER_COLORS, LAYER_IDS } from '@/bridge/layer-config';

import type { FeatureCollection } from '@/lib/schemas';

const MOCK_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      properties: { name: 'test' },
    },
  ],
};

describe('createGeoJsonLayerConfig', () => {
  it('creates a layer config with the correct id and type', () => {
    const config = createGeoJsonLayerConfig('test-layer', MOCK_GEOJSON, {
      fillColor: [255, 0, 0, 128],
      lineColor: [255, 0, 0, 255],
      visible: true,
    });

    expect(config.id).toBe('test-layer');
    expect(config.type).toBe('GeoJsonLayer');
  });

  it('includes GeoJSON data in props', () => {
    const config = createGeoJsonLayerConfig('test-layer', MOCK_GEOJSON, {
      fillColor: [255, 0, 0, 128],
      lineColor: [255, 0, 0, 255],
      visible: true,
    });

    expect(config.props['data']).toEqual(MOCK_GEOJSON);
  });

  it('sets fill and line colors', () => {
    const config = createGeoJsonLayerConfig('test-layer', MOCK_GEOJSON, {
      fillColor: [74, 144, 217, 77],
      lineColor: [74, 144, 217, 255],
      visible: true,
    });

    expect(config.props['getFillColor']).toEqual([74, 144, 217, 77]);
    expect(config.props['getLineColor']).toEqual([74, 144, 217, 255]);
  });

  it('sets visible flag in props', () => {
    const configVisible = createGeoJsonLayerConfig('test-layer', MOCK_GEOJSON, {
      fillColor: [255, 0, 0, 128],
      lineColor: [255, 0, 0, 255],
      visible: true,
    });

    expect(configVisible.props['visible']).toBe(true);

    const configHidden = createGeoJsonLayerConfig('test-layer', MOCK_GEOJSON, {
      fillColor: [255, 0, 0, 128],
      lineColor: [255, 0, 0, 255],
      visible: false,
    });

    expect(configHidden.props['visible']).toBe(false);
  });

  it('includes standard deck.gl GeoJsonLayer props', () => {
    const config = createGeoJsonLayerConfig('test-layer', MOCK_GEOJSON, {
      fillColor: [255, 0, 0, 128],
      lineColor: [255, 0, 0, 255],
      visible: true,
    });

    expect(config.props['filled']).toBe(true);
    expect(config.props['stroked']).toBe(true);
    expect(config.props['pickable']).toBe(true);
    expect(config.props['getLineWidth']).toBe(2);
    expect(config.props['lineWidthMinPixels']).toBe(1);
  });
});

describe('LAYER_COLORS', () => {
  it('has cadastral colors with semi-transparent fill', () => {
    expect(LAYER_COLORS.cadastral.fill[3]).toBe(77); // ~0.3 opacity
    expect(LAYER_COLORS.cadastral.line[3]).toBe(255); // full opacity
  });

  it('has protection zone colors with semi-transparent fill', () => {
    expect(LAYER_COLORS.protectionZones.fill[3]).toBe(77); // ~0.3 opacity
    expect(LAYER_COLORS.protectionZones.line[3]).toBe(255); // full opacity
  });
});

describe('LAYER_IDS', () => {
  it('has correct cadastral layer id', () => {
    expect(LAYER_IDS.cadastral).toBe('cadastral-layer');
  });

  it('has correct protection zones layer id', () => {
    expect(LAYER_IDS.protectionZones).toBe('protection-zones-layer');
  });
});
