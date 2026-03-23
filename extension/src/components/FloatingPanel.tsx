import React from 'react';

import { useUIStore } from '@/stores/ui-store';
import { THEME } from '@/styles/theme';

import { ActionButtons } from './ActionButtons';
import { LayerToggles } from './LayerToggles';
import { PresetPalette } from './PresetPalette';
import { ValidationStatus } from './ValidationStatus';

const warningStyle: React.CSSProperties = {
  padding: '8px 10px',
  backgroundColor: '#3d2e00',
  border: `1px solid ${THEME.warning}`,
  borderRadius: '6px',
  color: THEME.warning,
  fontSize: '12px',
  lineHeight: '1.4',
};

/** Main floating panel component rendered inside the shadow DOM. */
export function FloatingPanel(): React.JSX.Element {
  const backendWarning = useUIStore((s) => s.backendWarning);

  return (
    <div data-testid="innomap-panel" className="innomap-panel">
      <div className="innomap-header">
        <h3>{'ГИС-САПР Иннополис'}</h3>
        <span className="innomap-badge">{'beta'}</span>
      </div>

      {backendWarning !== null && (
        <div className="innomap-section">
          <div style={warningStyle}>{backendWarning}</div>
        </div>
      )}

      <div className="innomap-section">
        <h4>{'Слои'}</h4>
        <LayerToggles />
      </div>

      <div className="innomap-section">
        <h4>{'Каталог'}</h4>
        <PresetPalette />
      </div>

      <div className="innomap-section">
        <h4>{'Статус'}</h4>
        <ValidationStatus />
      </div>

      <div className="innomap-section">
        <ActionButtons />
      </div>
    </div>
  );
}
