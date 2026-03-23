/** CSS string constants for shadow DOM injection. */

const COLORS = {
  bg: '#1f1f1f',
  bgHeader: '#141414',
  text: '#ffffffd9',
  textSecondary: '#ffffff73',
  border: '#434343',
  accent: '#1890ff',
} as const;

/** Raw CSS injected into the shadow DOM <style> element. */
export const PANEL_CSS = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  .innomap-panel {
    position: fixed;
    top: 16px;
    left: calc(100vw - 320px - 16px);
    width: 320px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    background: ${COLORS.bg};
    color: ${COLORS.text};
    border: 1px solid ${COLORS.border};
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    font-size: 14px;
    line-height: 1.5;
  }

  .innomap-header {
    background: ${COLORS.bgHeader};
    padding: 12px 16px;
    border-bottom: 1px solid ${COLORS.border};
    border-radius: 8px 8px 0 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: grab;
    user-select: none;
  }

  .innomap-header.dragging {
    cursor: grabbing;
  }

  .innomap-panel:not(:has(.innomap-section)) .innomap-header {
    border-bottom: none;
    border-radius: 8px;
  }

  .innomap-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: ${COLORS.text};
    letter-spacing: 0.02em;
  }

  .innomap-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: ${COLORS.accent};
    color: #fff;
    border-radius: 4px;
    font-weight: 500;
    text-transform: uppercase;
  }

  .innomap-section {
    padding: 12px 16px;
    border-bottom: 1px solid ${COLORS.border};
  }

  .innomap-section:last-child {
    border-bottom: none;
  }

  .innomap-section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    color: ${COLORS.textSecondary};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .innomap-placeholder {
    padding: 8px 12px;
    background: #2a2a2a;
    border-radius: 4px;
    color: ${COLORS.textSecondary};
    font-size: 13px;
  }

  .innomap-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .innomap-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #52c41a;
    flex-shrink: 0;
  }

  .innomap-status-text {
    font-size: 13px;
    color: ${COLORS.text};
  }

  @keyframes innomap-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .innomap-rotation-tooltip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: #2a2a2a;
    border-radius: 6px;
    margin-top: 8px;
  }

  .innomap-rotation-tooltip span {
    font-size: 13px;
    color: #ffffffd9;
    min-width: 36px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .innomap-rotation-btn {
    background: none;
    border: 1px solid #434343;
    color: #ffffffd9;
    cursor: pointer;
    font-size: 14px;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .innomap-rotation-btn:hover {
    background: #333333;
  }

  .innomap-rotation-btn:active {
    background: #444444;
  }

  .innomap-rotation-label {
    font-size: 11px;
    color: #ffffff73;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-right: 4px;
  }
` as const;
