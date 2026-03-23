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

const infoStyle: React.CSSProperties = {
  padding: '8px 10px',
  backgroundColor: '#1a2733',
  border: `1px solid ${THEME.accent}`,
  borderRadius: '6px',
  color: THEME.accent,
  fontSize: '12px',
  lineHeight: '1.4',
};

const collapseButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: THEME.textSecondary,
  cursor: 'pointer',
  fontSize: '16px',
  padding: '0 4px',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
};

/** Main floating panel component rendered inside the shadow DOM. */
export function FloatingPanel(): React.JSX.Element {
  const backendWarning = useUIStore((s) => s.backendWarning);
  const panelCollapsed = useUIStore((s) => s.panelCollapsed);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const deckGlFound = useUIStore((s) => s.deckGlFound);

  return (
    <div data-testid="innomap-panel" className="innomap-panel">
      <div className="innomap-header">
        <h3>{'\u0413\u0418\u0421-\u0421\u0410\u041f\u0420 \u0418\u043d\u043d\u043e\u043f\u043e\u043b\u0438\u0441'}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="innomap-badge">{'beta'}</span>
          <button
            type="button"
            style={collapseButtonStyle}
            onClick={togglePanel}
            aria-label={panelCollapsed ? '\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c' : '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c'}
          >
            {panelCollapsed ? '\u25BC' : '\u25B2'}
          </button>
        </div>
      </div>

      {!panelCollapsed && (
        <>
          {!deckGlFound && (
            <div className="innomap-section">
              <div style={infoStyle}>{'deck.gl \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d'}</div>
            </div>
          )}

          {backendWarning !== null && (
            <div className="innomap-section">
              <div style={warningStyle}>{backendWarning}</div>
            </div>
          )}

          <div className="innomap-section">
            <h4>{'\u0421\u043b\u043e\u0438'}</h4>
            <LayerToggles />
          </div>

          <div className="innomap-section">
            <h4>{'\u041a\u0430\u0442\u0430\u043b\u043e\u0433'}</h4>
            <PresetPalette />
          </div>

          <div className="innomap-section">
            <h4>{'\u0421\u0442\u0430\u0442\u0443\u0441'}</h4>
            <ValidationStatus />
          </div>

          <div className="innomap-section">
            <ActionButtons />
          </div>
        </>
      )}
    </div>
  );
}
