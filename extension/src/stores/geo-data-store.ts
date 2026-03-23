/**
 * Store for loaded GeoJSON data, making it accessible to validation logic.
 */

import { create } from 'zustand';

import type { FeatureCollection } from '@/lib/schemas';

export interface GeoDataState {
  readonly cadastralData: FeatureCollection | null;
  readonly protectionZonesData: FeatureCollection | null;
}

export interface GeoDataActions {
  setCadastralData: (data: FeatureCollection) => void;
  setProtectionZonesData: (data: FeatureCollection) => void;
  resetGeoData: () => void;
}

type GeoDataStore = GeoDataState & GeoDataActions;

export const useGeoDataStore = create<GeoDataStore>(
  (set): GeoDataStore => ({
    cadastralData: null,
    protectionZonesData: null,

    setCadastralData: (data: FeatureCollection): void => {
      set({ cadastralData: data });
    },

    setProtectionZonesData: (data: FeatureCollection): void => {
      set({ protectionZonesData: data });
    },

    resetGeoData: (): void => {
      set({ cadastralData: null, protectionZonesData: null });
    },
  }),
);
