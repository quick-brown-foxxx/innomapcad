import React from 'react';

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
        <div className="innomap-placeholder">
          {'Переключатели слоёв появятся здесь'}
        </div>
      </div>

      <div className="innomap-section">
        <h4>{'Каталог'}</h4>
        <div className="innomap-placeholder">
          {'Палитра пресетов появится здесь'}
        </div>
      </div>

      <div className="innomap-section">
        <h4>{'Статус'}</h4>
        <div className="innomap-status-row">
          <div className="innomap-status-dot" />
          <span className="innomap-status-text">{'Подключено'}</span>
        </div>
      </div>
    </div>
  );
}
