import { create } from 'zustand';

import type { LayerConfig } from '@/bridge/deck-types';

export interface DeckState {
  readonly deckReady: boolean;
  readonly customLayers: readonly LayerConfig[];
}

export interface DeckActions {
  setDeckReady: (ready: boolean) => void;
  addLayer: (layer: LayerConfig) => void;
  removeLayer: (layerId: string) => void;
  updateLayers: (layers: readonly LayerConfig[]) => void;
}

type DeckStore = DeckState & DeckActions;

export const useDeckStore = create<DeckStore>(
  (set): DeckStore => ({
    deckReady: false,
    customLayers: [],

    setDeckReady: (ready: boolean): void => {
      set({ deckReady: ready });
    },

    addLayer: (layer: LayerConfig): void => {
      set((state) => ({
        customLayers: [...state.customLayers, layer],
      }));
    },

    removeLayer: (layerId: string): void => {
      set((state) => ({
        customLayers: state.customLayers.filter((l) => l.id !== layerId),
      }));
    },

    updateLayers: (layers: readonly LayerConfig[]): void => {
      set({ customLayers: layers });
    },
  }),
);
