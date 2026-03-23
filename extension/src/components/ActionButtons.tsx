import React from 'react';

import { LAYER_IDS } from '@/bridge/layer-config';
import { useDeckStore } from '@/stores/deck-store';
import { usePlacementStore } from '@/stores/placement-store';
import { useUIStore } from '@/stores/ui-store';
import { THEME } from '@/styles/theme';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const buttonBaseStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  fontSize: '13px',
  fontWeight: 500,
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
};

const validateButtonStyle = (disabled: boolean): React.CSSProperties => ({
  ...buttonBaseStyle,
  backgroundColor: THEME.accent,
  color: '#fff',
  opacity: disabled ? 0.4 : 1,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const removeButtonStyle = (disabled: boolean): React.CSSProperties => ({
  ...buttonBaseStyle,
  backgroundColor: 'transparent',
  color: THEME.error,
  border: `1px solid ${THEME.error}`,
  opacity: disabled ? 0.4 : 1,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

export function ActionButtons(): React.JSX.Element {
  const selectedPreset = useUIStore((s) => s.selectedPreset);
  const placedBuilding = usePlacementStore((s) => s.placedBuilding);
  const removeBuilding = usePlacementStore((s) => s.removeBuilding);
  const removeLayer = useDeckStore((s) => s.removeLayer);
  const isValidateDisabled = selectedPreset === null;
  const isRemoveDisabled = placedBuilding === null;

  function handleRemoveBuilding(): void {
    removeBuilding();
    removeLayer(LAYER_IDS.placedBuilding);
  }

  return (
    <div style={containerStyle}>
      <button
        type="button"
        style={validateButtonStyle(isValidateDisabled)}
        disabled={isValidateDisabled}
        aria-label="Проверить размещение"
      >
        {'Проверить'}
      </button>
      <button
        type="button"
        style={removeButtonStyle(isRemoveDisabled)}
        disabled={isRemoveDisabled}
        onClick={handleRemoveBuilding}
        aria-label="Убрать объект"
      >
        {'Убрать объект'}
      </button>
    </div>
  );
}
