import { create } from 'zustand';

export interface ValidationConflict {
  readonly layer: string;
  readonly type: string;
  readonly description: string;
}

export type ValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export interface LayerVisibility {
  readonly cadastral: boolean;
  readonly protectionZones: boolean;
}

export interface UIState {
  readonly selectedPreset: string | null;
  readonly layerVisibility: LayerVisibility;
  readonly validationStatus: ValidationStatus;
  readonly validationConflicts: readonly ValidationConflict[];
  readonly backendWarning: string | null;
  readonly panelCollapsed: boolean;
  readonly deckGlFound: boolean;
}

export interface UIActions {
  selectPreset: (preset: string | null) => void;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  setValidationStatus: (status: ValidationStatus) => void;
  setValidationConflicts: (conflicts: readonly ValidationConflict[]) => void;
  resetValidation: () => void;
  setBackendWarning: (warning: string | null) => void;
  togglePanel: () => void;
  setDeckGlFound: (found: boolean) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>(
  (set): UIStore => ({
    selectedPreset: null,
    layerVisibility: {
      cadastral: true,
      protectionZones: true,
    },
    validationStatus: 'idle',
    validationConflicts: [],
    backendWarning: null,
    panelCollapsed: false,
    deckGlFound: true,

    selectPreset: (preset: string | null): void => {
      set((state) => ({
        selectedPreset: state.selectedPreset === preset ? null : preset,
      }));
    },

    toggleLayer: (layer: keyof LayerVisibility): void => {
      set((state) => ({
        layerVisibility: {
          ...state.layerVisibility,
          [layer]: !state.layerVisibility[layer],
        },
      }));
    },

    setValidationStatus: (status: ValidationStatus): void => {
      set({ validationStatus: status });
    },

    setValidationConflicts: (conflicts: readonly ValidationConflict[]): void => {
      set({ validationConflicts: conflicts });
    },

    resetValidation: (): void => {
      set({
        validationStatus: 'idle',
        validationConflicts: [],
      });
    },

    setBackendWarning: (warning: string | null): void => {
      set({ backendWarning: warning });
    },

    togglePanel: (): void => {
      set((state) => ({ panelCollapsed: !state.panelCollapsed }));
    },

    setDeckGlFound: (found: boolean): void => {
      set({ deckGlFound: found });
    },
  }),
);
