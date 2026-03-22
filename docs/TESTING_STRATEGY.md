# Стратегия тестирования InnoMapCAD

## 1. Обзор стратегии тестирования

Проект InnoMapCAD — Chrome Extension (Manifest V3), которое инжектит deck.gl слои в 4dinno.ru/map/territory, плюс FastAPI бэкенд с Shapely для гео-валидации.

Используем два взаимодополняющих подхода:

1. **Автоматизированное тестирование (Playwright + pytest + Vitest)** — CI-ready, повторяемое, для регрессии
2. **Ручное тестирование AI-агентом (Chrome DevTools MCP)** — визуальная проверка, exploratory testing

---

## 2. Автоматизированные тесты

### 2.1 Backend (pytest)

Тестируем API контракты через `TestClient`. Реальный Shapely, реальный GeoJSON — без моков.

Каждый эндпоинт покрыт минимум 2 тестами.

**Запуск:**

```bash
cd backend && uv run pytest
```

**Пример: `tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def valid_polygon():
    """Валидный полигон внутри кадастрового участка."""
    return {
        "type": "Polygon",
        "coordinates": [[[49.11, 55.79], [49.112, 55.79], [49.112, 55.792], [49.11, 55.792], [49.11, 55.79]]]
    }


@pytest.fixture
def invalid_polygon():
    """Полигон, пересекающий охранную зону."""
    return {
        "type": "Polygon",
        "coordinates": [[[49.10, 55.78], [49.13, 55.78], [49.13, 55.80], [49.10, 55.80], [49.10, 55.78]]]
    }
```

**Пример: `tests/test_health.py`**

```python
def test_health_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_health_returns_version(client):
    resp = client.get("/health")
    assert "version" in resp.json()
```

**Пример: `tests/test_presets.py`**

```python
def test_presets_returns_list(client):
    resp = client.get("/api/presets")
    assert resp.status_code == 200
    presets = resp.json()
    assert isinstance(presets, list)
    assert len(presets) >= 1


def test_preset_has_required_fields(client):
    resp = client.get("/api/presets")
    preset = resp.json()[0]
    assert "id" in preset
    assert "name" in preset
    assert "geometry" in preset
```

**Пример: `tests/test_layers.py`**

```python
def test_cadastral_layer_is_geojson(client):
    resp = client.get("/api/layers/cadastral")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0


def test_protection_zones_layer(client):
    resp = client.get("/api/layers/protection-zones")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "FeatureCollection"
```

**Пример: `tests/test_validate.py`**

```python
def test_validate_valid_placement(client, valid_polygon):
    resp = client.post("/api/validate", json={"geometry": valid_polygon, "preset_id": "residential"})
    assert resp.status_code == 200
    result = resp.json()
    assert result["valid"] is True


def test_validate_invalid_placement(client, invalid_polygon):
    resp = client.post("/api/validate", json={"geometry": invalid_polygon, "preset_id": "residential"})
    assert resp.status_code == 200
    result = resp.json()
    assert result["valid"] is False
    assert len(result["violations"]) > 0


def test_validate_bad_geometry(client):
    resp = client.post("/api/validate", json={"geometry": {"type": "Point", "coordinates": [0, 0]}, "preset_id": "residential"})
    assert resp.status_code == 422
```

### 2.2 Unit тесты Extension (Vitest)

Тестируем Turf.js валидацию, конструирование слоёв, геометрические хелперы.

**Запуск:**

```bash
cd extension && npm test
```

**Пример: `tests/unit/validation.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { checkIntersection, validatePlacement } from '../../src/validation';
import * as turf from '@turf/turf';

describe('checkIntersection', () => {
  it('detects overlap with protection zone', () => {
    const building = turf.polygon([[[49.11, 55.79], [49.12, 55.79], [49.12, 55.80], [49.11, 55.80], [49.11, 55.79]]]);
    const zone = turf.polygon([[[49.115, 55.795], [49.13, 55.795], [49.13, 55.81], [49.115, 55.81], [49.115, 55.795]]]);

    expect(checkIntersection(building, zone)).toBe(true);
  });

  it('no overlap when building is outside zone', () => {
    const building = turf.polygon([[[49.01, 55.70], [49.02, 55.70], [49.02, 55.71], [49.01, 55.71], [49.01, 55.70]]]);
    const zone = turf.polygon([[[49.11, 55.79], [49.12, 55.79], [49.12, 55.80], [49.11, 55.80], [49.11, 55.79]]]);

    expect(checkIntersection(building, zone)).toBe(false);
  });
});

describe('validatePlacement', () => {
  it('returns valid: true for safe placement', () => {
    const result = validatePlacement(
      { type: 'Polygon', coordinates: [[[49.11, 55.79], [49.112, 55.79], [49.112, 55.792], [49.11, 55.792], [49.11, 55.79]]] },
      []  // no protection zones
    );
    expect(result.valid).toBe(true);
  });
});
```

**Пример: `tests/unit/layers.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { buildLayerConfig } from '../../src/layers';

describe('buildLayerConfig', () => {
  it('creates GeoJsonLayer config from feature collection', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: {} }],
    };

    const config = buildLayerConfig('test-layer', geojson);
    expect(config.id).toBe('test-layer');
    expect(config.data).toBe(geojson);
  });

  it('sets visibility from options', () => {
    const config = buildLayerConfig('test-layer', { type: 'FeatureCollection', features: [] }, { visible: false });
    expect(config.visible).toBe(false);
  });
});
```

### 2.3 E2E тесты (Playwright)

#### Как это работает

1. Playwright стартует бэкенд через конфиг `webServer` (FastAPI на порту 8000)
2. Запускает Chromium с загруженным расширением через `--load-extension`
3. Переходит на реальный 4dinno.ru/map/territory
4. Расширение автоматически инжектится в страницу
5. Тесты верифицируют через DOM-запросы и `page.evaluate()`

#### Ключевые технические детали

- `chromium.launchPersistentContext` с `--disable-extensions-except` и `--load-extension`
- Manifest V3: используем `context.serviceWorkers()` (не `backgroundPages()`)
- `--headless=new` поддерживает расширения в современном Chromium
- Бэкенд стартуется Playwright через `webServer` — отдельный docker-compose для тестов не нужен
- Кастомная фикстура даёт `context` и `extensionId`

#### Конфигурация Playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'https://4dinno.ru',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000',
    port: 8000,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
```

#### Кастомная фикстура

```typescript
// tests/e2e/fixtures.ts
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const extensionPath = path.join(__dirname, '../../extension/dist');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');
    await use(background.url().split('/')[2]);
  },
});

export { expect } from '@playwright/test';
```

#### Хелперы

```typescript
// tests/e2e/helpers/deck-helpers.ts
import type { Page } from '@playwright/test';

export async function getDeckLayerIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const overlay = document.getElementById('deckgl-overlay');
    if (!overlay) return [];
    const fiberKey = Object.keys(overlay).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return [];
    let fiber = (overlay as any)[fiberKey];
    while (fiber && !fiber?.ref?.current?.deck) fiber = fiber.return;
    const deck = fiber?.ref?.current?.deck;
    return deck?.props?.layers?.map((l: any) => l.id) || [];
  });
}

export async function waitForExtensionReady(page: Page) {
  await page.waitForSelector('#gis-sapr-panel', { timeout: 15000 });
  await page.waitForFunction(() => {
    return (window as any).__deckPatched === true;
  }, { timeout: 15000 });
}

export async function getDeckInstance(page: Page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('deckgl-overlay');
    if (!overlay) return null;
    const fiberKey = Object.keys(overlay).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return null;
    let fiber = (overlay as any)[fiberKey];
    while (fiber && !fiber?.ref?.current?.deck) fiber = fiber.return;
    return fiber?.ref?.current?.deck ? true : false;
  });
}
```

```typescript
// tests/e2e/helpers/panel-helpers.ts
import type { Page } from '@playwright/test';

export async function getPresetCards(page: Page) {
  return page.$$eval('#gis-sapr-panel .preset-card', cards =>
    cards.map(c => ({ id: c.getAttribute('data-preset-id'), name: c.textContent?.trim() }))
  );
}

export async function clickPreset(page: Page, presetId: string) {
  await page.click(`#gis-sapr-panel .preset-card[data-preset-id="${presetId}"]`);
}

export async function getValidationStatus(page: Page): Promise<string | null> {
  return page.$eval('#gis-sapr-panel .validation-status', el => el.textContent?.trim() ?? null);
}
```

#### Тестовые сценарии

```typescript
// tests/e2e/extension-load.spec.ts
import { test, expect } from './fixtures';
import { waitForExtensionReady, getDeckInstance } from './helpers/deck-helpers';

test('расширение загружается и панель видна в DOM', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await waitForExtensionReady(page);

  const panel = await page.$('#gis-sapr-panel');
  expect(panel).not.toBeNull();
});

test('deck.gl instance найден через React fiber walk', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await waitForExtensionReady(page);

  const hasDeck = await getDeckInstance(page);
  expect(hasDeck).toBe(true);
});
```

```typescript
// tests/e2e/layers.spec.ts
import { test, expect } from './fixtures';
import { waitForExtensionReady, getDeckLayerIds } from './helpers/deck-helpers';

test('слои загружены с бэкенда и отображаются', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await waitForExtensionReady(page);

  const layerIds = await getDeckLayerIds(page);
  expect(layerIds).toContain('cadastral-layer');
  expect(layerIds).toContain('protection-zones-layer');
});

test('переключение видимости слоёв', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await waitForExtensionReady(page);

  // Выключаем слой
  await page.click('#gis-sapr-panel .layer-toggle[data-layer="cadastral-layer"]');

  const layerIds = await getDeckLayerIds(page);
  expect(layerIds).not.toContain('cadastral-layer');

  // Включаем обратно
  await page.click('#gis-sapr-panel .layer-toggle[data-layer="cadastral-layer"]');

  const layerIdsAfter = await getDeckLayerIds(page);
  expect(layerIdsAfter).toContain('cadastral-layer');
});
```

```typescript
// tests/e2e/placement.spec.ts
import { test, expect } from './fixtures';
import { waitForExtensionReady } from './helpers/deck-helpers';
import { clickPreset } from './helpers/panel-helpers';

test('выбор пресета и размещение здания кликом', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await waitForExtensionReady(page);

  await clickPreset(page, 'residential');

  // Кликаем на карту для размещения
  const canvas = await page.$('canvas');
  expect(canvas).not.toBeNull();
  await canvas!.click({ position: { x: 400, y: 300 } });

  // Проверяем, что здание появилось
  const hasBuilding = await page.evaluate(() => {
    return (window as any).__placedBuildings?.length > 0;
  });
  expect(hasBuilding).toBe(true);
});
```

```typescript
// tests/e2e/validation.spec.ts
import { test, expect } from './fixtures';
import { waitForExtensionReady } from './helpers/deck-helpers';
import { clickPreset, getValidationStatus } from './helpers/panel-helpers';

test('клиентская валидация Turf.js — зелёный статус', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await waitForExtensionReady(page);

  await clickPreset(page, 'residential');
  const canvas = await page.$('canvas');
  await canvas!.click({ position: { x: 400, y: 300 } });

  await page.waitForSelector('#gis-sapr-panel .validation-status');
  const status = await getValidationStatus(page);
  expect(status).toMatch(/valid|валидно/i);
});

test('серверная валидация по кнопке Проверить', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await waitForExtensionReady(page);

  await clickPreset(page, 'residential');
  const canvas = await page.$('canvas');
  await canvas!.click({ position: { x: 400, y: 300 } });

  await page.click('#gis-sapr-panel button.validate-server');
  await page.waitForSelector('#gis-sapr-panel .server-validation-result', { timeout: 10000 });

  const result = await page.$eval('#gis-sapr-panel .server-validation-result', el => el.textContent);
  expect(result).toBeTruthy();
});

test('degraded mode при недоступном бэкенде', async ({ context }) => {
  const page = await context.newPage();

  // Блокируем запросы к бэкенду
  await page.route('**/localhost:8000/**', route => route.abort());

  await page.goto('https://4dinno.ru/map/territory');
  await page.waitForSelector('#gis-sapr-panel', { timeout: 15000 });

  // Turf.js валидация должна работать даже без бэкенда
  await clickPreset(page, 'residential');
  const canvas = await page.$('canvas');
  await canvas!.click({ position: { x: 400, y: 300 } });

  const hasTurfResult = await page.evaluate(() => {
    return (window as any).__lastTurfValidation !== undefined;
  });
  expect(hasTurfResult).toBe(true);
});
```

---

## 3. Ручное тестирование AI-агентом через Chrome DevTools MCP

### 3.1 Настройка

**Запуск Chrome с расширением и remote debugging:**

```bash
chrome --remote-debugging-port=9222 \
  --disable-extensions-except=/absolute/path/to/extension/dist \
  --load-extension=/absolute/path/to/extension/dist \
  --user-data-dir=/tmp/mcp-chrome-profile
```

**Конфигурация MCP сервера:**

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["@anthropic-ai/chrome-devtools-mcp"],
      "env": {
        "CHROME_FLAGS": "--disable-extensions-except=/path/to/extension/dist --load-extension=/path/to/extension/dist"
      }
    }
  }
}
```

**Предусловия:**

- Расширение собрано (`extension/dist/` с `manifest.json`)
- Бэкенд запущен (`docker-compose up backend` или `uv run uvicorn main:app`)
- Chrome/Chromium установлен

### 3.2 Workflow AI-агента

Пошаговая процедура ручного тестирования через MCP инструменты:

```
 1. navigate_page → "https://4dinno.ru/map/territory"
 2. wait_for → selector: "#gis-sapr-panel", timeout: 15000
 3. take_screenshot → проверить начальное состояние
 4. evaluate_script → проверить deck.gl слои инжектированы
 5. list_console_messages → проверить отсутствие ошибок
 6. list_network_requests → проверить вызовы к бэкенду (localhost:8000)
 7. click → пресет "Жилой дом" в панели
 8. click → canvas карты по координатам (разместить здание)
 9. take_screenshot → проверить здание + цвет валидации
10. evaluate_script → прочитать статус валидации из DOM
11. click → кнопка "Проверить"
12. wait_for → результат серверной валидации
13. evaluate_script → прочитать ответ сервера
14. take_screenshot → финальное состояние
```

**Пример скрипта для evaluate_script (проверка слоёв):**

```javascript
// Проверить наличие deck.gl instance и список слоёв
(() => {
  const overlay = document.getElementById('deckgl-overlay');
  if (!overlay) return { error: 'deckgl-overlay not found' };
  const fiberKey = Object.keys(overlay).find(k => k.startsWith('__reactFiber'));
  if (!fiberKey) return { error: 'React fiber not found' };
  let fiber = overlay[fiberKey];
  while (fiber && !fiber?.ref?.current?.deck) fiber = fiber.return;
  const deck = fiber?.ref?.current?.deck;
  if (!deck) return { error: 'deck instance not found' };
  return {
    layerCount: deck.props.layers.length,
    layerIds: deck.props.layers.map(l => l.id),
    viewState: deck.viewManager?.getViewState(),
  };
})();
```

**Пример скрипта для evaluate_script (проверка панели):**

```javascript
// Проверить состояние панели расширения
(() => {
  const panel = document.getElementById('gis-sapr-panel');
  if (!panel) return { error: 'panel not found' };
  const presets = panel.querySelectorAll('.preset-card');
  const toggles = panel.querySelectorAll('.layer-toggle');
  const validationStatus = panel.querySelector('.validation-status');
  return {
    visible: panel.offsetParent !== null,
    presetCount: presets.length,
    presetNames: [...presets].map(p => p.textContent?.trim()),
    layerToggles: [...toggles].map(t => ({
      layer: t.getAttribute('data-layer'),
      active: t.classList.contains('active'),
    })),
    validationStatus: validationStatus?.textContent?.trim() || null,
  };
})();
```

### 3.3 Checklist для ручного тестирования

| # | Проверка | MCP инструмент | Ожидание |
|---|---------|---------------|----------|
| 1 | Панель расширения видна | `wait_for` + `take_screenshot` | Плавающая панель в правом углу |
| 2 | Deck.gl instance найден | `evaluate_script` | Fiber walk возвращает deck object |
| 3 | Кадастровые участки на карте | `evaluate_script` (layer IDs) + `take_screenshot` | `cadastral-layer` в списке |
| 4 | Охранные зоны на карте | `evaluate_script` + `take_screenshot` | `protection-zones-layer` в списке |
| 5 | Переключатель слоёв работает | `click` toggle + `evaluate_script` | Слой исчезает/появляется |
| 6 | Пресеты отображаются | `evaluate_script` (DOM) | 5 карточек пресетов |
| 7 | Размещение здания | `click` preset + `click` map | Здание на карте |
| 8 | Валидация в зоне -> красный | place in zone + `evaluate_script` | `valid: false`, красная обводка |
| 9 | Валидация вне зоны -> зелёный | place outside + `evaluate_script` | `valid: true`, зелёная обводка |
| 10 | Серверная валидация | `click` "Проверить" + `wait_for` | JSON ответ в панели |
| 11 | Бэкенд недоступен -> degraded | stop backend + `evaluate_script` | Только Turf.js работает |
| 12 | Console без ошибок | `list_console_messages` | Нет error-level сообщений |

### 3.4 Ограничения MCP подхода

- `evaluate_script` работает в page context (main world), не в isolated world content script
- Нет прямого доступа к `chrome.runtime` API
- Скриншоты зависят от загрузки тайлов карты (нужно ждать)
- Одна вкладка за раз

---

## 4. Запуск тестов

```bash
# Backend unit тесты
cd backend && uv run pytest

# Extension unit тесты
cd extension && npm test

# E2E тесты (автоматически стартует бэкенд)
npx playwright test

# Все автоматизированные тесты
npm run test:all

# Линтинг
cd backend && uv run ruff check && uv run basedpyright
cd extension && npm run lint
```

---

## 5. Структура файлов тестов

```
backend/
├── tests/
│   ├── conftest.py
│   ├── test_health.py
│   ├── test_presets.py
│   ├── test_layers.py
│   └── test_validate.py

extension/
├── vitest.config.ts
├── tests/
│   └── unit/
│       ├── validation.test.ts
│       └── layers.test.ts

tests/
└── e2e/
    ├── fixtures.ts
    ├── helpers/
    │   ├── deck-helpers.ts
    │   └── panel-helpers.ts
    ├── extension-load.spec.ts
    ├── layers.spec.ts
    ├── placement.spec.ts
    └── validation.spec.ts

playwright.config.ts
```

---

## 6. Принципы

- **Real > mocked**: реальный Shapely, Turf.js, GeoJSON, HTTP. Моки — только когда нужен детерминизм (координаты клика).
- **Backend = test fixture**: один и тот же сервер для прода и тестов. Playwright стартует его через `webServer`.
- **E2E на реальном сайте**: 4dinno.ru доступен, расширение инжектится в живую страницу.
- **Тесты = контракт**: если зелёные — код работает. Каждый тест проверяет конкретное поведение.
- **Два подхода дополняют друг друга**: Playwright для автоматической регрессии, Chrome DevTools MCP для визуальной проверки и exploratory testing.
