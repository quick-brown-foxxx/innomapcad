import React from 'react';

import { usePresetsStore } from '@/stores/presets-store';
import { useUIStore } from '@/stores/ui-store';
import { THEME } from '@/styles/theme';

import type { Preset } from '@/lib/schemas';

/** Hardcoded fallback presets used when backend is unavailable. */
const FALLBACK_PRESETS: readonly Preset[] = [
  { slug: 'residential', name: 'Жилой дом', width_m: 24, length_m: 60, floors: 9, height_m: 27, setback_m: 5, color: '#4A90D9' },
  { slug: 'office', name: 'Офисное здание', width_m: 30, length_m: 50, floors: 5, height_m: 18, setback_m: 5, color: '#50C878' },
  { slug: 'transformer', name: 'ТП', width_m: 6, length_m: 4, floors: 1, height_m: 3, setback_m: 2, color: '#FFD700' },
  { slug: 'parking', name: 'Парковка', width_m: 40, length_m: 20, floors: 1, height_m: 3, setback_m: 3, color: '#808080' },
  { slug: 'warehouse', name: 'Склад', width_m: 50, length_m: 30, floors: 1, height_m: 8, setback_m: 5, color: '#CD853F' },
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

const loadingStyle: React.CSSProperties = {
  fontSize: '12px',
  color: THEME.textSecondary,
  textAlign: 'center',
  padding: '12px 0',
};

export function PresetPalette(): React.JSX.Element {
  const selectedPreset = useUIStore((s) => s.selectedPreset);
  const selectPreset = useUIStore((s) => s.selectPreset);
  const storePresets = usePresetsStore((s) => s.presets);
  const loading = usePresetsStore((s) => s.loading);

  if (loading) {
    return <div style={loadingStyle}>{'Loading presets...'}</div>;
  }

  const presets = storePresets.length > 0 ? storePresets : FALLBACK_PRESETS;

  return (
    <div style={gridStyle}>
      {presets.map((preset) => (
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
          <span style={cardDimStyle}>{`${String(preset.width_m)}×${String(preset.length_m)} м`}</span>
        </div>
      ))}
    </div>
  );
}
