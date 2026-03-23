import { create } from 'zustand';

import type { Preset } from '@/lib/schemas';

export interface PresetsState {
  readonly presets: readonly Preset[];
  readonly loading: boolean;
  readonly error: string | null;
}

export interface PresetsActions {
  setPresets: (presets: readonly Preset[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type PresetsStore = PresetsState & PresetsActions;

export const usePresetsStore = create<PresetsStore>(
  (set): PresetsStore => ({
    presets: [],
    loading: false,
    error: null,

    setPresets: (presets: readonly Preset[]): void => {
      set({ presets, loading: false, error: null });
    },

    setLoading: (loading: boolean): void => {
      set({ loading });
    },

    setError: (error: string | null): void => {
      set({ error, loading: false });
    },
  }),
);
