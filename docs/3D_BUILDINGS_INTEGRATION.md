# 3D Buildings Integration Guide

## Проблема
Кнопка "DSM" и "3D" на сайте 4dinno.ru/map не включают 3D здания.
**Баг в приложении:** родительский CompositeLayer `background-layerTerrain3D` остаётся `visible: false` даже после выбора подложки DSM — state management (Effector) не переключает visibility.

## Решение: Standalone 3D Buildings Layer

Вместо включения встроенного terrain (который закрывает базовую карту рельефом), создаём **отдельный SolidPolygonLayer** только со зданиями поверх MapLibre.

### Данные

| Endpoint | Описание | Кол-во |
|----------|----------|--------|
| `/media/dtm/dtm_bld.json` | Здания с высотами | 1468 features |
| `/media/dtm/dtm.json` | Полигоны рельефа | 1369 features |

#### Структура dtm_bld.json feature:
```json
{
  "id": 6061,
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat, z], ...]]  // Z-координаты (всегда 0)
  },
  "properties": {
    "fid": 6061,
    "color": "#f3634d",
    "height": 3,         // Высота здания в метрах
    "height_bottom": 0   // Высота основания
  }
}
```

### Доступ к deck.gl Instance

```javascript
// Получение Deck instance через React fiber tree
function getDeckInstance() {
  const overlay = document.querySelector('#deckgl-overlay');
  const fiberKey = Object.keys(overlay).find(k => k.startsWith('__reactFiber'));
  return overlay[fiberKey].return.return.ref.current.deck;
}
```

### Получение SolidPolygonLayer конструктора

`window.deck` содержит только `VERSION, log, _registerLoggers` (Vite бандл не экспортирует классы).
Конструктор нужно извлечь из существующего слоя:

```javascript
function getSolidPolygonLayerClass() {
  const deck = getDeckInstance();
  // Сначала нужно чтобы terrain layer был инициализирован (достаточно что данные загружены)
  const allLayers = deck.layerManager.getLayers();
  const bldLayer = allLayers.find(l => l.id === 'background-layerTerrain3D-bld');
  if (bldLayer) return bldLayer.constructor;

  // Fallback: можно также извлечь из ScatterplotLayer или IconLayer
  // но SolidPolygonLayer нужен для extruded зданий
  return null;
}
```

### Полный скрипт для Chrome DevTools Console

```javascript
// === 3D Buildings over Base Map for 4dinno.ru/map ===
(async () => {
  // 1. Get deck instance
  const overlay = document.querySelector('#deckgl-overlay');
  const fiberKey = Object.keys(overlay).find(k => k.startsWith('__reactFiber'));
  const deck = overlay[fiberKey].return.return.ref.current.deck;

  // 2. Get SolidPolygonLayer constructor from existing layers
  const allLayers = deck.layerManager.getLayers();
  const bldLayer = allLayers.find(l => l.id === 'background-layerTerrain3D-bld');
  if (!bldLayer) {
    console.error('❌ SolidPolygonLayer not found. Try clicking DSM substrate first to initialize.');
    return;
  }
  const SolidPolygonLayer = bldLayer.constructor;

  // 3. Fetch building data
  const response = await fetch('/media/dtm/dtm_bld.json');
  const buildings = await response.json();
  console.log(`📦 Loaded ${buildings.length} buildings`);

  // 4. Helper: hex color to RGBA
  const hexToRgba = (hex, alpha = 220) => {
    if (!hex || hex[0] !== '#') return [68, 136, 204, alpha];
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
      alpha,
    ];
  };

  // 5. Create standalone buildings layer
  const buildingsLayer = new SolidPolygonLayer({
    id: 'custom-3d-buildings',
    data: buildings,
    extruded: true,
    filled: true,
    wireframe: true,
    opacity: 0.85,
    pickable: true,
    elevationScale: 1,
    getPolygon: d => d.geometry?.coordinates,
    getElevation: d => (d.properties?.height ?? d.height ?? 3),
    getFillColor: d => hexToRgba(d.properties?.color ?? d.color),
    getLineColor: [40, 40, 40, 100],
    material: {
      ambient: 0.4,
      diffuse: 0.6,
      shininess: 32,
      specularColor: [60, 64, 70],
    },
  });

  // 6. Add layer WITHOUT enabling terrain (keeps base map visible)
  const existingLayers = deck.props.layers.map(layer =>
    layer.props.id === 'background-layerTerrain3D'
      ? layer.clone({ visible: false })
      : layer
  );

  deck.setProps({
    layers: [...existingLayers, buildingsLayer],
    viewState: {
      latitude: 55.7515,
      longitude: 48.7465,
      zoom: 15.5,
      pitch: 50,
      bearing: -20,
      maxPitch: 85,
      minZoom: 12,
      maxZoom: 20,
    },
  });

  // 7. Save references for extension use
  window.__deckInstance = deck;
  window.__SolidPolygonLayer = SolidPolygonLayer;
  window.__buildingData = buildings;
  window.__customBuildingsLayer = buildingsLayer;

  console.log('✅ 3D buildings enabled over base map!');
})();
```

## Архитектура для Chrome Extension

### Content Script Strategy

```
content-script.js
├── 1. Wait for deck.gl canvas (#deckgl-overlay) + React fiber
├── 2. Extract Deck instance via fiber.ref.current.deck
├── 3. Extract SolidPolygonLayer class from existing sublayer
├── 4. Fetch /media/dtm/dtm_bld.json (building geometries + heights)
├── 5. Create custom layers (buildings, zones, restrictions)
├── 6. Inject layers via deck.setProps({ layers: [...existing, ...custom] })
└── 7. Handle React re-renders (MutationObserver on #deckgl-wrapper)
```

### React Re-render Resilience

React будет перезаписывать deck.props.layers при каждом re-render. Нужен observer:

```javascript
// Watch for React re-renders and re-inject our layers
const observer = new MutationObserver(() => {
  const deck = getDeckInstance();
  const hasOurLayer = deck.layerManager.getLayers().find(l => l.id === 'custom-3d-buildings');
  if (!hasOurLayer) {
    // Re-inject our layers
    reinjectCustomLayers(deck);
  }
});

observer.observe(document.querySelector('#deckgl-wrapper'), {
  childList: true, subtree: true, attributes: true
});
```

### Ключевые точки интеграции

| Что | Как получить | Зачем |
|-----|-------------|-------|
| Deck instance | `fiber.ref.current.deck` | Управление слоями, viewState |
| SolidPolygonLayer class | `deck.layerManager.getLayers().find(bld).constructor` | Создание extruded polygon слоёв |
| Building data | `fetch('/media/dtm/dtm_bld.json')` | 1468 зданий с height, color, geometry |
| Terrain data | `fetch('/media/dtm/dtm.json')` | 1369 полигонов рельефа с elevation |
| ViewState | `deck.viewState` | pitch, bearing, zoom для 3D |

### Встроенные подслои (для справки)

| Layer ID | Type | Data | Назначение |
|----------|------|------|-----------|
| `background-layerTerrain3D-bld` | SolidPolygonLayer | 1468 | Здания, `height: 3-N метров`, color: `#f3634d` |
| `background-layerTerrain3D-evt` | SolidPolygonLayer | 1369 | Рельеф, `elevation - 185` метров |
| `background-layerTerrain3D-rct` | SolidPolygonLayer | 1 | Белый прямоугольник-подложка |
| `background-layerTerrain3D-terrain-tiles-*` | SimpleMeshLayer | tiles | 3D mesh рельефа из DEM heightmap |
