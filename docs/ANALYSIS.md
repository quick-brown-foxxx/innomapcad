# Анализ 4dinno.ru/map/territory

## Стек

| Компонент | Технология |
|---|---|
| Фреймворк | React + SSR через Vike (vite-plugin-ssr) |
| Сборка | Vite |
| UI | Ant Design (тёмная тема) |
| Стейт | Effector |
| Карта | MapLibre GL JS (базовая карта) + deck.gl v9.0.38 (слои, 3D) |
| HTTP | ky |
| i18n | i18next (ru, en, tt) |
| API Gateway | KrakenD |
| Прокси | nginx |

## Архитектура карты

Двухслойная система:
1. **MapLibre canvas** — векторные тайлы базовой карты (`/media/basemap/{z}/{x}/{y}.mvt`)
2. **deck.gl canvas** (`#deckgl-overlay`) — GeoJSON слои, 3D здания, terrain

### deck.gl слои в использовании
- `SolidPolygonLayer`
- `LineLayer`
- `IconLayer`
- `ScatterplotLayer`
- `ScenegraphLayer` (3D модели, Draco-compressed)
- `TextLayer`
- Кастомный `InnoPolygonLayer` (extends SolidPolygonLayer)

### Структура DOM
```
body
  #react-root
    .ant-layout._layout (dark)
      .ant-layout-header._header  (навигация: логотип, About, Map, Data, тема, язык, юзер)
      .ant-splitter
        Panel 1 (376px): Левый сайдбар — дерево слоёв (_wrapperTreeLayers)
        Panel 2 (1529px): Вьюпорт карты (map-widgets-viewport)
          _wrapperMap
            _toolbarHorizontal (поиск, фильтры)
            #deckgl-wrapper
              #deckgl-overlay (canvas)
              .maplibregl-map
                .maplibregl-canvas-container > canvas.maplibregl-canvas
                .maplibregl-control-container
```

## API (анонимный доступ)

| Эндпоинт | Назначение |
|---|---|
| `GET /api/v2/layers/{lang}/layers/anonymous/` | Каталог слоёв |
| `GET /api/v2/layers/{lang}/layers/authorized/` | Каталог слоёв (авторизованные, 401) |
| `GET /api/v2/geo/{lang}/substrate/` | Подложки карты (5 вариантов: Schema, Progressive schema, Orthophotoplan, DEM, Satellite) |
| `GET /api/v2/geo/{lang}/feature-service/{slug}/export/?limit=N` | Экспорт данных в XLSX |
| `GET /media/basemap/basemap_{lang}_{theme}.json` | Стиль MapLibre (OSM Liberty) |
| `GET /media/basemap/{z}/{x}/{y}.mvt` | Векторные тайлы (maxzoom 20) |
| `GET /media/layers/{slug}.geojson` | GeoJSON данные слоёв |
| `GET /media/orthophoto/{z}/{x}/{y}.png` | Растровые тайлы ортофото |
| `GET /media/dem/{z}/{x}/{y}.png` | Heightmap тайлы DEM |
| `GET /media/dtm/{dtm.json, dtm_bld.json}` | Конфигурация Digital Terrain Model |
| `GET /media/dtm_c/{z}/{x}/{y}.png` | Цветные тайлы рельефа |

### Каталог слоёв (anonymous)
```json
[
  {"fid": 1, "slug": "buildings", "title_ru": "Объекты недвижимости"},
  {"fid": 22, "slug": "transport", "title_ru": "Транспортная инфраструктура"},
  {"fid": 27, "slug": "improvement", "title_ru": "Благоустройство города",
    "groups": [{"fid": 63, "slug": "malye-arhitekturnye-formy", "title_ru": "Малые арх. формы"}]},
  {"fid": 39, "slug": "territory", "title_ru": "Территориальное планирование"}
]
```

### Mapbox token (из бандла)
```
xxx
```

### Basemap стили
- `/media/basemap/basemap_ru_default.json` (200)
- `/media/basemap/basemap_en_default.json` (200)
- `/media/basemap/basemap_ru_dark.json` (200)
- Фолбэк: `mapbox://styles/mapbox/dark-v11`

### Basemap sources
- Векторные тайлы: `https://4dinno.ru/media/basemap/{z}/{x}/{y}.mvt`
- Спрайты: `https://maputnik.github.io/osm-liberty/sprites/osm-liberty`
- Глифы: `https://orangemug.github.io/font-glyphs/glyphs/{fontstack}/{range}.pbf`
- 47+ слоёв в стиле (здания, покрытия, дороги, парковки, коммуникации, растительность, границы, POI)

## Точки интеграции для Chrome Extension

1. **deck.gl** — глобально доступен через `window.deck`, можно добавлять слои через `deck.props.layers`
2. **MapLibre** — инстанс доступен через DOM (`.maplibregl-map`), можно добавлять source/layers
3. **React root** — `#react-root` с доступом к React fiber internals
4. **Vike page context** — `#vike_pageContext` script tag, `window._vike`
5. **Левая панель** — Ant Design Tree в `.ant-splitter-panel._panel1`, можно инжектить ноды
6. **Map container** — `.map-widgets-viewport` / `._wrapperMap`

## Стратегия MVP Chrome Extension

### Концепция: "Cities Skylines" режим размещения зданий

#### Content Script инжектится в `4dinno.ru/map/*`:
- Получает инстанс MapLibre и deck.gl из DOM/window
- Добавляет свои deck.gl слои (зоны ограничений, новые здания)
- Инжектит UI-панель поверх карты или в sidebar

#### Функционал:
1. **Свои слои** — наложение кастомных GeoJSON слоёв с данными
2. **Информация об объектах** — popup/sidebar с расширенными сведениями
3. **Режим "постройки"** — drag & drop зданий на карту
4. **Подсветка ограничений** — зоны где можно/нельзя строить (зелёный/красный)
5. **Валидация** — проверка пересечений, отступов, зонирования

#### Технологии для расширения:
- `@nebula.gl/layers` — `EditableGeoJsonLayer` для интерактивного редактирования геометрии
- `@turf/turf` — геопространственные вычисления (пересечения, буферы, площади)
- deck.gl `SolidPolygonLayer` — подсветка зон ограничений
- deck.gl `ScenegraphLayer` — 3D превью размещаемых зданий
