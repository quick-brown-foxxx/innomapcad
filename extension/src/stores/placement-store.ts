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
  readonly rotationDeg: number;
}

export interface PlacementActions {
  startPlacing: () => void;
  stopPlacing: () => void;
  setHoverPosition: (position: readonly [number, number] | null) => void;
  placeBuilding: (building: PlacedBuilding) => void;
  removeBuilding: () => void;
  setRotationDeg: (deg: number) => void;
  rotateBy: (deltaDeg: number) => void;
}

type PlacementStore = PlacementState & PlacementActions;

export const usePlacementStore = create<PlacementStore>(
  (set): PlacementStore => ({
    isPlacing: false,
    placedBuilding: null,
    hoverPosition: null,
    rotationDeg: 0,

    startPlacing: (): void => {
      set({ isPlacing: true });
    },

    stopPlacing: (): void => {
      set({ isPlacing: false, hoverPosition: null, rotationDeg: 0 });
    },

    setHoverPosition: (position: readonly [number, number] | null): void => {
      set({ hoverPosition: position });
    },

    placeBuilding: (building: PlacedBuilding): void => {
      set({ placedBuilding: building, isPlacing: false, hoverPosition: null });
    },

    removeBuilding: (): void => {
      set({ placedBuilding: null, rotationDeg: 0 });
    },

    setRotationDeg: (deg: number): void => {
      set({ rotationDeg: ((deg % 360) + 360) % 360 });
    },

    rotateBy: (deltaDeg: number): void => {
      set((state) => ({
        rotationDeg: (((state.rotationDeg + deltaDeg) % 360) + 360) % 360,
      }));
    },
  }),
);
