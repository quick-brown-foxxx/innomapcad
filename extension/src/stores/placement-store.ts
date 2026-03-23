import { create } from 'zustand';

import type { GeoJsonPolygon } from '@/utils/building-geometry';

export interface PlacedBuilding {
  readonly center: readonly [number, number]; // [lng, lat]
  readonly presetSlug: string;
  readonly polygon: GeoJsonPolygon;
}

export interface PlacementState {
  readonly isPlacing: boolean;
  readonly placedBuilding: PlacedBuilding | null;
  readonly hoverPosition: readonly [number, number] | null; // [lng, lat]
}

export interface PlacementActions {
  startPlacing: () => void;
  stopPlacing: () => void;
  setHoverPosition: (position: readonly [number, number] | null) => void;
  placeBuilding: (building: PlacedBuilding) => void;
  removeBuilding: () => void;
}

type PlacementStore = PlacementState & PlacementActions;

export const usePlacementStore = create<PlacementStore>(
  (set): PlacementStore => ({
    isPlacing: false,
    placedBuilding: null,
    hoverPosition: null,

    startPlacing: (): void => {
      set({ isPlacing: true });
    },

    stopPlacing: (): void => {
      set({ isPlacing: false, hoverPosition: null });
    },

    setHoverPosition: (position: readonly [number, number] | null): void => {
      set({ hoverPosition: position });
    },

    placeBuilding: (building: PlacedBuilding): void => {
      set({ placedBuilding: building, isPlacing: false, hoverPosition: null });
    },

    removeBuilding: (): void => {
      set({ placedBuilding: null });
    },
  }),
);
