import { beforeEach, describe, expect, it } from 'vitest';

import { usePresetsStore } from '@/stores/presets-store';

import type { Preset } from '@/lib/schemas';

const MOCK_PRESET: Preset = {
  slug: 'test',
  name: 'Test Preset',
  width_m: 10,
  length_m: 20,
  floors: 3,
  height_m: 9,
  setback_m: 5,
  color: '#FF0000',
};

describe('presets-store', () => {
  beforeEach(() => {
    // Reset store to initial state
    usePresetsStore.setState({
      presets: [],
      loading: false,
      error: null,
    });
  });

  it('starts with empty presets', () => {
    const state = usePresetsStore.getState();
    expect(state.presets).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setPresets updates presets and clears loading/error', () => {
    usePresetsStore.getState().setLoading(true);
    usePresetsStore.getState().setPresets([MOCK_PRESET]);

    const state = usePresetsStore.getState();
    expect(state.presets).toEqual([MOCK_PRESET]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setLoading updates loading flag', () => {
    usePresetsStore.getState().setLoading(true);
    expect(usePresetsStore.getState().loading).toBe(true);

    usePresetsStore.getState().setLoading(false);
    expect(usePresetsStore.getState().loading).toBe(false);
  });

  it('setError updates error and clears loading', () => {
    usePresetsStore.getState().setLoading(true);
    usePresetsStore.getState().setError('Something went wrong');

    const state = usePresetsStore.getState();
    expect(state.error).toBe('Something went wrong');
    expect(state.loading).toBe(false);
  });

  it('setError with null clears error', () => {
    usePresetsStore.getState().setError('Something went wrong');
    usePresetsStore.getState().setError(null);

    expect(usePresetsStore.getState().error).toBeNull();
  });
});
