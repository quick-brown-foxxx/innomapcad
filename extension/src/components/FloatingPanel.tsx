import React, { useCallback, useEffect, useRef, useState } from 'react';

import { reloadBackendData } from '@/services/data-loader';
import { usePlacementStore } from '@/stores/placement-store';
import { useUIStore } from '@/stores/ui-store';
import { THEME } from '@/styles/theme';

import { ActionButtons } from './ActionButtons';
import { LayerToggles } from './LayerToggles';
import { PresetPalette } from './PresetPalette';
import { RotationTooltip } from './RotationTooltip';
import { ValidationStatus } from './ValidationStatus';

const PANEL_WIDTH = 320;
const PANEL_MARGIN = 16;

interface DragState {
  readonly startX: number;
  readonly startY: number;
  readonly startLeft: number;
  readonly startTop: number;
}

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

const headerButtonStyle: React.CSSProperties = {
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

const reloadSpinStyle: React.CSSProperties = {
  ...headerButtonStyle,
  transition: 'transform 0.3s',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Main floating panel component rendered inside the shadow DOM. */
export function FloatingPanel(): React.JSX.Element {
  const backendWarning = useUIStore((s) => s.backendWarning);
  const panelCollapsed = useUIStore((s) => s.panelCollapsed);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const deckGlFound = useUIStore((s) => s.deckGlFound);
  const placedBuilding = usePlacementStore((s) => s.placedBuilding);

  const [position, setPosition] = useState({
    top: PANEL_MARGIN,
    left: window.innerWidth - PANEL_WIDTH - PANEL_MARGIN,
  });

  const dragRef = useRef<DragState | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (drag === null) return;

    const panelEl = panelRef.current;
    const panelHeight = panelEl?.offsetHeight ?? 0;

    const newLeft = clamp(
      drag.startLeft + (e.clientX - drag.startX),
      0,
      window.innerWidth - PANEL_WIDTH,
    );
    const newTop = clamp(
      drag.startTop + (e.clientY - drag.startY),
      0,
      window.innerHeight - panelHeight,
    );

    setPosition({ top: newTop, left: newLeft });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    // Attach to document so tracking works when mouse leaves the shadow DOM
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't start drag if clicking on a button (collapse button)
      if (e.target instanceof HTMLElement && e.target.closest('button') !== null) {
        return;
      }
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startLeft: position.left,
        startTop: position.top,
      };
    },
    [position.left, position.top],
  );

  const [isReloading, setIsReloading] = useState(false);

  const handleReload = useCallback(async (): Promise<void> => {
    setIsReloading(true);
    await reloadBackendData();
    setIsReloading(false);
  }, []);

  const isDragging = dragRef.current !== null;

  const panelStyle: React.CSSProperties = {
    top: `${String(position.top)}px`,
    left: `${String(position.left)}px`,
  };

  return (
    <div
      ref={panelRef}
      data-testid="innomap-panel"
      className="innomap-panel"
      style={panelStyle}
    >
      <div
        className={`innomap-header${isDragging ? ' dragging' : ''}`}
        onMouseDown={handleHeaderMouseDown}
      >
        <h3>{'\u0413\u0418\u0421-\u0421\u0410\u041f\u0420 \u0418\u043d\u043d\u043e\u043f\u043e\u043b\u0438\u0441'}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="innomap-badge">{'beta'}</span>
          <button
            type="button"
            style={isReloading ? { ...reloadSpinStyle, transform: 'rotate(360deg)' } : reloadSpinStyle}
            onClick={() => void handleReload()}
            disabled={isReloading}
            aria-label={'\u041f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435'}
            title={'\u041f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043b\u043e\u0438 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430'}
          >
            {'\u21BB'}
          </button>
          <button
            type="button"
            style={headerButtonStyle}
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
            {placedBuilding !== null && <RotationTooltip />}
          </div>

          <div className="innomap-section">
            <ActionButtons />
          </div>
        </>
      )}
    </div>
  );
}
