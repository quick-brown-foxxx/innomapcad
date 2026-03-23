import React from 'react';

import { useUIStore } from '@/stores/ui-store';
import { THEME } from '@/styles/theme';

import type { ValidationConflict, ValidationStatus as ValidationStatusType } from '@/stores/ui-store';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const statusRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const spinnerStyle: React.CSSProperties = {
  width: '14px',
  height: '14px',
  border: `2px solid ${THEME.border}`,
  borderTopColor: THEME.accent,
  borderRadius: '50%',
  animation: 'innomap-spin 0.8s linear infinite',
  flexShrink: 0,
};

const conflictListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const conflictItemStyle: React.CSSProperties = {
  fontSize: '12px',
  color: THEME.textSecondary,
};

function getStatusColor(status: ValidationStatusType): string {
  switch (status) {
    case 'idle':
      return THEME.textSecondary;
    case 'checking':
      return THEME.accent;
    case 'valid':
      return THEME.success;
    case 'invalid':
      return THEME.error;
  }
}

function getStatusText(status: ValidationStatusType): string {
  switch (status) {
    case 'idle':
      return 'Выберите место на карте';
    case 'checking':
      return 'Проверка...';
    case 'valid':
      return '\u2713 Размещение допустимо';
    case 'invalid':
      return '\u2717 Обнаружены конфликты';
  }
}

function ConflictList({ conflicts }: { readonly conflicts: readonly ValidationConflict[] }): React.JSX.Element {
  return (
    <ul style={conflictListStyle}>
      {conflicts.map((conflict, index) => (
        <li key={`${conflict.layer}-${conflict.type}-${String(index)}`} style={conflictItemStyle}>
          <strong>{conflict.layer}</strong>
          {`: ${conflict.description}`}
        </li>
      ))}
    </ul>
  );
}

export function ValidationStatus(): React.JSX.Element {
  const validationStatus = useUIStore((s) => s.validationStatus);
  const validationConflicts = useUIStore((s) => s.validationConflicts);

  const statusColor = getStatusColor(validationStatus);

  return (
    <div style={containerStyle}>
      <div style={statusRowStyle}>
        {validationStatus === 'checking' && <div style={spinnerStyle} />}
        <span style={{ fontSize: '13px', color: statusColor }}>
          {getStatusText(validationStatus)}
        </span>
      </div>
      {validationStatus === 'invalid' && validationConflicts.length > 0 && (
        <ConflictList conflicts={validationConflicts} />
      )}
    </div>
  );
}
