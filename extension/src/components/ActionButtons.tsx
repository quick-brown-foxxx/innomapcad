import React, { useCallback, useState } from 'react';

import { postValidate } from '@/api/backend-api';
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
  const placedBuilding = usePlacementStore((s) => s.placedBuilding);
  const removeBuilding = usePlacementStore((s) => s.removeBuilding);
  const removeLayer = useDeckStore((s) => s.removeLayer);
  const validationStatus = useUIStore((s) => s.validationStatus);
  const setValidationStatus = useUIStore((s) => s.setValidationStatus);
  const setValidationConflicts = useUIStore((s) => s.setValidationConflicts);
  const setBackendWarning = useUIStore((s) => s.setBackendWarning);

  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  const isValidateDisabled =
    placedBuilding === null || isRequesting || validationStatus === 'checking';
  const isRemoveDisabled = placedBuilding === null;

  const handleValidate = useCallback(async (): Promise<void> => {
    const building = usePlacementStore.getState().placedBuilding;
    if (building === null) {
      return;
    }

    setIsRequesting(true);
    setValidationStatus('checking');
    setBackendWarning(null);

    const result = await postValidate(building.polygon, building.presetSlug);

    if (result.ok) {
      setValidationConflicts(
        result.value.conflicts.map((c) => ({
          layer: c.layer,
          type: c.type,
          description: c.description,
        })),
      );
      setValidationStatus(result.value.valid ? 'valid' : 'invalid');
    } else {
      setValidationStatus('idle');
      setBackendWarning('Сервер недоступен');
    }

    setIsRequesting(false);
  }, [setValidationStatus, setValidationConflicts, setBackendWarning]);

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
        onClick={() => void handleValidate()}
        aria-label="Проверить размещение"
      >
        {isRequesting ? 'Проверка...' : 'Проверить'}
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
