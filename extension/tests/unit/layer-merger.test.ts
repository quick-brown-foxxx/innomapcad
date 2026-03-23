import { describe, expect, it } from 'vitest';

import { mergeLayers } from '@/bridge/layer-merger';

import type { LayerConfig } from '@/bridge/deck-types';

function makeLayer(id: string, type: string = 'ScatterplotLayer'): LayerConfig {
  return { id, type, props: { opacity: 0.8 } };
}

describe('mergeLayers', () => {
  it('returns existing layers when custom layers is empty', () => {
    const existing: readonly LayerConfig[] = [makeLayer('a'), makeLayer('b')];
    const result = mergeLayers(existing, []);

    expect(result).toBe(existing);
  });

  it('appends custom layers alongside existing layers', () => {
    const existing: readonly LayerConfig[] = [makeLayer('a')];
    const custom: readonly LayerConfig[] = [makeLayer('b'), makeLayer('c')];
    const result = mergeLayers(existing, custom);

    expect(result).toHaveLength(3);
    expect(result.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('replaces existing layers with same ID', () => {
    const existing: readonly LayerConfig[] = [
      makeLayer('a', 'ScatterplotLayer'),
      makeLayer('b', 'PathLayer'),
    ];
    const custom: readonly LayerConfig[] = [
      { id: 'a', type: 'GeoJsonLayer', props: { filled: true } },
    ];
    const result = mergeLayers(existing, custom);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'a', type: 'GeoJsonLayer', props: { filled: true } });
    expect(result[1]).toEqual(makeLayer('b', 'PathLayer'));
  });

  it('handles mix of replacements and new layers', () => {
    const existing: readonly LayerConfig[] = [makeLayer('a'), makeLayer('b')];
    const custom: readonly LayerConfig[] = [
      { id: 'b', type: 'Replaced', props: {} },
      makeLayer('c'),
    ];
    const result = mergeLayers(existing, custom);

    expect(result).toHaveLength(3);
    expect(result.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(result[1]?.type).toBe('Replaced');
  });

  it('works with both arrays empty', () => {
    const result = mergeLayers([], []);

    expect(result).toHaveLength(0);
  });

  it('works with empty existing and non-empty custom', () => {
    const custom: readonly LayerConfig[] = [makeLayer('x')];
    const result = mergeLayers([], custom);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('x');
  });
});
