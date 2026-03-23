import { describe, expect, it, beforeEach } from 'vitest';

import { useUIStore } from '@/stores/ui-store';

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useUIStore.setState({
      selectedPreset: null,
      layerVisibility: { cadastral: true, protectionZones: true },
      validationStatus: 'idle',
      validationConflicts: [],
      backendWarning: null,
      panelCollapsed: false,
      deckGlFound: true,
    });
  });

  describe('selectPreset', () => {
    it('selects a preset when none is selected', () => {
      useUIStore.getState().selectPreset('residential');
      expect(useUIStore.getState().selectedPreset).toBe('residential');
    });

    it('deselects preset when clicking the same one', () => {
      useUIStore.getState().selectPreset('residential');
      useUIStore.getState().selectPreset('residential');
      expect(useUIStore.getState().selectedPreset).toBeNull();
    });

    it('switches to a different preset', () => {
      useUIStore.getState().selectPreset('residential');
      useUIStore.getState().selectPreset('office');
      expect(useUIStore.getState().selectedPreset).toBe('office');
    });

    it('deselects when called with null', () => {
      useUIStore.getState().selectPreset('residential');
      useUIStore.getState().selectPreset(null);
      expect(useUIStore.getState().selectedPreset).toBeNull();
    });
  });

  describe('toggleLayer', () => {
    it('toggles cadastral layer off', () => {
      useUIStore.getState().toggleLayer('cadastral');
      expect(useUIStore.getState().layerVisibility.cadastral).toBe(false);
      expect(useUIStore.getState().layerVisibility.protectionZones).toBe(true);
    });

    it('toggles cadastral layer back on', () => {
      useUIStore.getState().toggleLayer('cadastral');
      useUIStore.getState().toggleLayer('cadastral');
      expect(useUIStore.getState().layerVisibility.cadastral).toBe(true);
    });

    it('toggles protectionZones layer independently', () => {
      useUIStore.getState().toggleLayer('protectionZones');
      expect(useUIStore.getState().layerVisibility.cadastral).toBe(true);
      expect(useUIStore.getState().layerVisibility.protectionZones).toBe(false);
    });
  });

  describe('setValidationStatus', () => {
    it('sets validation status to checking', () => {
      useUIStore.getState().setValidationStatus('checking');
      expect(useUIStore.getState().validationStatus).toBe('checking');
    });

    it('sets validation status to valid', () => {
      useUIStore.getState().setValidationStatus('valid');
      expect(useUIStore.getState().validationStatus).toBe('valid');
    });

    it('sets validation status to invalid', () => {
      useUIStore.getState().setValidationStatus('invalid');
      expect(useUIStore.getState().validationStatus).toBe('invalid');
    });
  });

  describe('setValidationConflicts', () => {
    it('sets validation conflicts', () => {
      const conflicts = [
        { layer: 'cadastral', type: 'overlap', description: 'Пересечение с участком' },
      ];
      useUIStore.getState().setValidationConflicts(conflicts);
      expect(useUIStore.getState().validationConflicts).toEqual(conflicts);
    });
  });

  describe('resetValidation', () => {
    it('resets status and conflicts to initial state', () => {
      useUIStore.getState().setValidationStatus('invalid');
      useUIStore.getState().setValidationConflicts([
        { layer: 'cadastral', type: 'overlap', description: 'Conflict' },
      ]);

      useUIStore.getState().resetValidation();

      expect(useUIStore.getState().validationStatus).toBe('idle');
      expect(useUIStore.getState().validationConflicts).toEqual([]);
    });
  });

  describe('togglePanel', () => {
    it('collapses the panel when expanded', () => {
      useUIStore.getState().togglePanel();
      expect(useUIStore.getState().panelCollapsed).toBe(true);
    });

    it('expands the panel when collapsed', () => {
      useUIStore.getState().togglePanel();
      useUIStore.getState().togglePanel();
      expect(useUIStore.getState().panelCollapsed).toBe(false);
    });
  });

  describe('setDeckGlFound', () => {
    it('sets deckGlFound to false', () => {
      useUIStore.getState().setDeckGlFound(false);
      expect(useUIStore.getState().deckGlFound).toBe(false);
    });

    it('sets deckGlFound to true', () => {
      useUIStore.getState().setDeckGlFound(false);
      useUIStore.getState().setDeckGlFound(true);
      expect(useUIStore.getState().deckGlFound).toBe(true);
    });
  });

  describe('setBackendWarning', () => {
    it('sets a warning message', () => {
      useUIStore.getState().setBackendWarning('Test warning');
      expect(useUIStore.getState().backendWarning).toBe('Test warning');
    });

    it('clears the warning when set to null', () => {
      useUIStore.getState().setBackendWarning('Test warning');
      useUIStore.getState().setBackendWarning(null);
      expect(useUIStore.getState().backendWarning).toBeNull();
    });
  });
});
