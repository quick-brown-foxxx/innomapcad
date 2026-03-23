import React, { useCallback } from 'react';

import { usePlacementStore } from '@/stores/placement-store';

const ROTATION_STEP_DEG = 5;

/**
 * Rotation control tooltip shown after a building is placed.
 * Provides ◀ ▶ buttons to rotate the building ±5°.
 */
export function RotationTooltip(): React.JSX.Element {
  const rotationDeg = usePlacementStore((s) => s.rotationDeg);
  const rotateBy = usePlacementStore((s) => s.rotateBy);

  const handleLeft = useCallback((): void => {
    rotateBy(-ROTATION_STEP_DEG);
  }, [rotateBy]);

  const handleRight = useCallback((): void => {
    rotateBy(ROTATION_STEP_DEG);
  }, [rotateBy]);

  return (
    <div className="innomap-rotation-tooltip">
      <span className="innomap-rotation-label">{'↻'}</span>
      <button
        type="button"
        className="innomap-rotation-btn"
        onClick={handleLeft}
        aria-label="Повернуть влево"
      >
        {'◀'}
      </button>
      <span>{`${String(Math.round(rotationDeg))}°`}</span>
      <button
        type="button"
        className="innomap-rotation-btn"
        onClick={handleRight}
        aria-label="Повернуть вправо"
      >
        {'▶'}
      </button>
    </div>
  );
}
