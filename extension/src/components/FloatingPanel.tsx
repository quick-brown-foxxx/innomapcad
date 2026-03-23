import React from 'react';

import { ActionButtons } from './ActionButtons';
import { LayerToggles } from './LayerToggles';
import { PresetPalette } from './PresetPalette';
import { ValidationStatus } from './ValidationStatus';

/** Main floating panel component rendered inside the shadow DOM. */
export function FloatingPanel(): React.JSX.Element {
  return (
    <div data-testid="innomap-panel" className="innomap-panel">
      <div className="innomap-header">
        <h3>{'ГИС-САПР Иннополис'}</h3>
        <span className="innomap-badge">{'beta'}</span>
      </div>

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
