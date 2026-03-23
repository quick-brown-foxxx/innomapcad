import React from 'react';

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
  const isDisabled = selectedPreset === null;

  return (
    <div style={containerStyle}>
      <button
        type="button"
        style={validateButtonStyle(isDisabled)}
        disabled={isDisabled}
        aria-label="Проверить размещение"
      >
        {'Проверить'}
      </button>
      <button
        type="button"
        style={removeButtonStyle(isDisabled)}
        disabled={isDisabled}
        aria-label="Убрать объект"
      >
        {'Убрать объект'}
      </button>
    </div>
  );
}
