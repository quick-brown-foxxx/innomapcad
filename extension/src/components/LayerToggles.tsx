import React from 'react';

import { useUIStore } from '@/stores/ui-store';
import { THEME } from '@/styles/theme';

import type { LayerVisibility } from '@/stores/ui-store';

interface LayerToggleItemProps {
  readonly label: string;
  readonly color: string;
  readonly checked: boolean;
  readonly onToggle: () => void;
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 0',
};

const labelContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const dotStyle = (color: string): React.CSSProperties => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: color,
  flexShrink: 0,
});

const labelTextStyle: React.CSSProperties = {
  fontSize: '13px',
  color: THEME.text,
};

const checkboxStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  accentColor: THEME.accent,
  cursor: 'pointer',
  margin: 0,
};

function LayerToggleItem({ label, color, checked, onToggle }: LayerToggleItemProps): React.JSX.Element {
  return (
    <div style={toggleRowStyle}>
      <div style={labelContainerStyle}>
        <div style={dotStyle(color)} />
        <span style={labelTextStyle}>{label}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={checkboxStyle}
        aria-label={label}
      />
    </div>
  );
}

const LAYER_CONFIG: readonly {
  readonly key: keyof LayerVisibility;
  readonly label: string;
  readonly color: string;
}[] = [
  { key: 'cadastral', label: 'Кадастровые участки', color: THEME.accent },
  { key: 'protectionZones', label: 'Охранные зоны', color: THEME.warning },
];

export function LayerToggles(): React.JSX.Element {
  const layerVisibility = useUIStore((s) => s.layerVisibility);
  const toggleLayer = useUIStore((s) => s.toggleLayer);

  return (
    <div>
      {LAYER_CONFIG.map((layer) => (
        <LayerToggleItem
          key={layer.key}
          label={layer.label}
          color={layer.color}
          checked={layerVisibility[layer.key]}
          onToggle={() => { toggleLayer(layer.key); }}
        />
      ))}
    </div>
  );
}
