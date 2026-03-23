import React from 'react';

import { useUIStore } from '@/stores/ui-store';
import { THEME } from '@/styles/theme';

interface PresetData {
  readonly slug: string;
  readonly name: string;
  readonly width: number;
  readonly length: number;
  readonly color: string;
}

const PRESETS: readonly PresetData[] = [
  { slug: 'residential', name: 'Жилой дом', width: 24, length: 60, color: '#4A90D9' },
  { slug: 'office', name: 'Офисное здание', width: 30, length: 50, color: '#50C878' },
  { slug: 'transformer', name: 'ТП', width: 6, length: 4, color: '#FFD700' },
  { slug: 'parking', name: 'Парковка', width: 40, length: 20, color: '#808080' },
  { slug: 'warehouse', name: 'Склад', width: 50, length: 30, color: '#CD853F' },
];

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
};

const cardStyle = (isSelected: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '8px 10px',
  backgroundColor: THEME.bgCard,
  border: `1px solid ${isSelected ? THEME.accent : THEME.border}`,
  borderRadius: '6px',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
});

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const swatchStyle = (color: string): React.CSSProperties => ({
  width: '12px',
  height: '12px',
  borderRadius: '3px',
  backgroundColor: color,
  flexShrink: 0,
});

const cardNameStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: THEME.text,
};

const cardDimStyle: React.CSSProperties = {
  fontSize: '11px',
  color: THEME.textSecondary,
};

export function PresetPalette(): React.JSX.Element {
  const selectedPreset = useUIStore((s) => s.selectedPreset);
  const selectPreset = useUIStore((s) => s.selectPreset);

  return (
    <div style={gridStyle}>
      {PRESETS.map((preset) => (
        <div
          key={preset.slug}
          style={cardStyle(selectedPreset === preset.slug)}
          onClick={() => { selectPreset(preset.slug); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectPreset(preset.slug);
            }
          }}
          aria-pressed={selectedPreset === preset.slug}
          aria-label={preset.name}
        >
          <div style={cardHeaderStyle}>
            <div style={swatchStyle(preset.color)} />
            <span style={cardNameStyle}>{preset.name}</span>
          </div>
          <span style={cardDimStyle}>{`${String(preset.width)}×${String(preset.length)} м`}</span>
        </div>
      ))}
    </div>
  );
}
