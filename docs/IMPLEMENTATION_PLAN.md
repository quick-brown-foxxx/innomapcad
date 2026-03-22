# План реализации: Chrome Extension ГИС-САПР

> Статус: черновик, будет дополняться

## Обзор

Chrome Extension (Manifest V3), инжектируемый в цифровой двойник Иннополиса (4dinno.ru/map/territory). Два компонента: расширение для Chrome + лёгкий бэкенд FastAPI + Shapely.

## Структура проекта

```
extension/
├── manifest.json
├── content.js                  # Оркестратор, ждёт карту, инжектирует скрипты
├── injected.js                 # Page-context: доступ к deck.gl, размещение, валидация
├── ui/
│   ├── panel.js                # Плавающая панель (content script context)
│   └── panel.css
├── layers/
│   ├── deck-bridge.js          # Патч deck.setProps для инжекции слоёв
│   ├── cadastral-layer.js      # Кадастровые участки
│   ├── zones-layer.js          # Охранные зоны
│   └── placement-layer.js      # Размещаемый объект + буфер
├── validation/
│   ├── client-validator.js     # Turf.js
│   └── server-validator.js     # Запросы к бэкенду
├── data/
│   ├── cadastral.geojson
│   └── protection_zones.geojson
└── lib/
    └── turf.min.js

backend/
├── main.py                     # FastAPI, CORS, загрузка данных
├── routers/
│   ├── presets.py              # GET /api/v1/presets
│   ├── layers.py               # GET /api/v1/layers/{slug}
│   └── validate.py             # POST /api/v1/validate
├── services/
│   ├── data_store.py           # In-memory GeoJSON хранилище
│   └── validator.py            # Shapely валидация
├── models.py                   # Pydantic схемы
├── data/
│   ├── cadastral.geojson
│   └── protection_zones.geojson
├── tests/
├── requirements.txt
└── Dockerfile

docker-compose.yml
data/                           # Исходные данные
scripts/
└── fetch_nspd_data.py
```

## Этапы

### Этап 0: Подготовка данных
- Выгрузка кадастровых участков и охранных зон из НСПД (nspd.gov.ru) по bbox Иннополиса
- Сохранение как GeoJSON в data/
- Если API недоступен — мок-данные для демо (3 охранные зоны: газопровод, ЛЭП, водоохранная)

### Этап 1: Бэкенд (FastAPI + Shapely)
- Скелет: main.py, CORS, lifespan загрузка данных, GET /health
- GET /api/v1/presets — каталог 5 пресетов
- GET /api/v1/layers/{slug} — отдача GeoJSON (cadastral, protection_zones)
- POST /api/v1/validate — Shapely проверки: intersects, within, buffer+intersects
- Dockerfile, docker-compose.yml
- Тесты pytest для каждого эндпоинта

### Этап 2: Chrome Extension — скелет
- manifest.json (Manifest V3, content_scripts на 4dinno.ru/map/*)
- content.js — ждёт #deckgl-overlay, инжектирует page-context скрипты
- injected.js — получает Deck instance через React fiber, извлекает SolidPolygonLayer
- deck-bridge.js — патч setProps, управление кастомными слоями
- Скрипты инжектируются последовательно (chained onload)

### Этап 3: Слои на карте
- Загрузка GeoJSON с бэкенда (GET /api/v1/layers/*)
- GeoJsonLayer кадастровых участков (синяя полупрозрачная заливка + обводка)
- GeoJsonLayer охранных зон (красная полупрозрачная заливка)
- Переключение видимости через UI

### Этап 4: UI панель
- panel.js в content_scripts контексте (не page context!)
- panel.css — тёмная тема, гармонирует с двойником
- Переключатели слоёв (2 тогла)
- Палитра из 5 пресетов (карточки с цветом и размером)
- Статус валидации: idle / valid / invalid + список конфликтов
- Кнопки: «Проверить на сервере», «Убрать объект»

### Этап 5: Размещение объектов + валидация
- Выбор пресета → клик по карте → прямоугольник по размерам пресета
- Turf.js intersect — мгновенная проверка пересечений с зонами
- Визуальный фидбек: зелёный (ОК) / красный (конфликт)
- Буфер отступа — оранжевая линия вокруг объекта
- Кнопка «Проверить» → POST /api/v1/validate → серверный результат
- Повторный клик — перемещение объекта

### Этап 6: Интеграция и полировка
- End-to-end тест полного флоу на реальном сайте
- Обработка ошибок: бэкенд недоступен → degraded mode (только Turf.js)
- Обработка ошибок: deck.gl не найден → сообщение пользователю
- MutationObserver для устойчивости к React re-render

## Технические решения

- **CORS:** allow_origins=["https://4dinno.ru"], allow_origin_regex=r"http://localhost:\d+"
- **Инжекция скриптов:** последовательная загрузка через chained onload (гарантия порядка)
- **Panel контекст:** panel.js в content_scripts (изолированный мир), общение с page через postMessage
- **Shapely буферы:** через pyproj UTM (EPSG:32639) для точных метрических вычислений
- **Пресеты:** единый источник правды на бэкенде, Extension загружает при старте
- **Deck instance:** через React fiber: overlay[fiberKey].return.return.ref.current.deck
- **Re-render resilience:** патч deck.setProps автоматически добавляет наши слои

## Пресеты объектов

| Slug | Название | Размер | Этажи | Высота | Отступ | Цвет |
|---|---|---|---|---|---|---|
| residential | Жилое здание | 30x15 м | 5 | 15 м | 10 м | #4A90D9 |
| office | Офисное здание | 40x20 м | 3 | 12 м | 8 м | #5BC0DE |
| transformer | ТП | 6x4 м | 1 | 3 м | 15 м | #F0AD4E |
| parking | Парковка | 25x15 м | 1 | 0 м | 3 м | #999999 |
| warehouse | Склад | 30x20 м | 1 | 6 м | 5 м | #8B6914 |

## API-контракт

### GET /health
Ответ: `{ "status": "ok", "layers_loaded": 2 }`

### GET /api/v1/presets
Ответ: массив пресетов (slug, name, width_m, length_m, floors, height_m, setback_m, color)

### GET /api/v1/layers/{slug}
slug: cadastral | protection_zones
Ответ: GeoJSON FeatureCollection

### POST /api/v1/validate
Запрос: `{ "geometry": GeoJSON Polygon, "preset_slug": "residential" }`
Ответ: `{ "valid": bool, "conflicts": [{ "layer", "type", "description" }] }`

Типы проверок:
- **intersects** — пересечение с охранными зонами
- **within** — объект внутри кадастрового участка
- **setback_violation** — нарушение отступа (buffer + intersects)

## Оценка времени

| Этап | Оценка |
|------|--------|
| 0. Данные | 30-60 мин |
| 1. Бэкенд | 1 час |
| 2. Extension скелет | 20 мин |
| 3. Слои | 20 мин |
| 4. UI панель | 20 мин |
| 5. Размещение | 30 мин |
| 6. Полировка | 30 мин |
| **Итого** | **~3.5 часа** |
