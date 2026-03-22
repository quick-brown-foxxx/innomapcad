---
name: testing-react-ts
description: "React/TypeScript testing with Vitest and Playwright: philosophy, component tests, integration tests, e2e tests, test infrastructure. Use when writing tests or setting up test infrastructure. ALWAYS load this for working with tests in react."
globs:
  - "extension/**/*.test.ts"
  - "extension/**/*.test.tsx"
  - "extension/**/*.spec.ts"
  - "extension/**/*.spec.tsx"
  - "extension/vitest.config.*"
  - "extension/playwright.config.*"
  - "tests/e2e/**/*.spec.ts"
---

# Chrome Extension + FastAPI Testing

## 1. Philosophy

### Core Principles

- **Trustworthiness > coverage** — A small suite you trust beats a large suite full of false confidence. Every test should catch a real bug if one existed.
- **5 good Playwright e2e tests > 100 unit tests with heavy mocking** — End-to-end tests exercise the real extension on the real site with the real backend. Unit tests with mocked-out everything prove very little.
- **Pareto principle** — Write the fewest tests that cover 80% of what matters. Focus on critical user paths: layer rendering, placement, validation.
- **Real over mocked** — Real GeoJSON files, real Turf.js, real backend. The closer a test is to production, the more it proves.
- **Test behavior, not implementation** — Assert on what the user sees (panel visible, layers rendered, validation status) not internal state.
- **Never mock Turf.js** — Test geometry operations with real coordinates and real GeoJSON.
- **Never mock GeoJSON** — Use real fixture files from `backend/data/`.
- **Backend is real in e2e** — FastAPI serves real data. No MSW, no network mocking.

---

## 2. Testing Pyramid

| Level | Tool | Location | Purpose |
|---|---|---|---|
| Unit tests | Vitest | `extension/tests/unit/*.test.ts` | Pure logic: Turf.js validation, geometry helpers, layer construction, data parsing |
| E2e tests | Playwright | `tests/e2e/*.spec.ts` | Extension loaded on real 4dinno.ru with backend running |

There are only two levels. No component tests (no React). No integration tests with MSW (backend is real).

### Commands

```bash
# Unit tests
cd extension && npm test

# E2e tests (auto-starts backend via webServer config)
npx playwright test

# All tests
npm run test:all
```

---

## 3. Test Planning

Before writing any test code, plan first.

1. **List all potential test cases** for the feature
2. **Categorize each case** as critical, medium, or small importance
3. **Discard small-importance cases**
4. **Write remaining cases in plain text first**
5. **Then write test code**

Example:

```
Feature: Building placement validation

Critical:
- Building placed inside cadastral zone → green status, valid
- Building placed overlapping protection zone → red status, invalid
- Server validation via "Проверить" button returns detailed result

Medium:
- Layer toggle hides/shows cadastral layer
- Preset selection changes visible layers

Discarded (small):
- Panel animation timing
- Tooltip hover text
```

---

## 4. Unit Tests (Vitest)

Unit tests cover pure logic only. No DOM, no browser APIs, no jsdom.

### Vitest Configuration

```ts
// extension/vitest.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',        // No jsdom — pure logic only
    globals: true,               // vi, describe, it, expect available globally
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### What to Unit Test

- **Turf.js validation logic** — intersection checks, within checks, buffer calculations
- **Layer construction** — GeoJSON data → deck.gl layer props (verify correct layer type, colors, coordinates)
- **Data parsing** — Backend response → internal data structures
- **Utility functions** — Coordinate transforms, format conversions

### Example: Validation Logic

```ts
// extension/tests/unit/validation.test.ts
import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import { checkIntersection, checkWithinZone } from '@/validation';

// Use REAL GeoJSON fixtures from backend
import cadastralData from '../../../backend/data/cadastral.geojson';
import protectionZones from '../../../backend/data/protection_zones.geojson';

describe('checkIntersection', () => {
  it('detects building overlapping protection zone', () => {
    const building = turf.polygon([[
      [37.6173, 55.7558],
      [37.6183, 55.7558],
      [37.6183, 55.7568],
      [37.6173, 55.7568],
      [37.6173, 55.7558],
    ]]);

    const result = checkIntersection(building, protectionZones);
    expect(result.intersects).toBe(true);
    expect(result.zones).toHaveLength(1);
  });

  it('returns clean result for building outside all zones', () => {
    const building = turf.polygon([[
      [37.0, 55.0],
      [37.001, 55.0],
      [37.001, 55.001],
      [37.0, 55.001],
      [37.0, 55.0],
    ]]);

    const result = checkIntersection(building, protectionZones);
    expect(result.intersects).toBe(false);
    expect(result.zones).toHaveLength(0);
  });
});
```

### Example: Layer Construction

```ts
// extension/tests/unit/layers.test.ts
import { describe, it, expect } from 'vitest';
import { buildCadastralLayer, buildProtectionLayer } from '@/layers';
import cadastralData from '../../../backend/data/cadastral.geojson';

describe('buildCadastralLayer', () => {
  it('creates GeoJsonLayer with correct props', () => {
    const layer = buildCadastralLayer(cadastralData);

    expect(layer.id).toBe('cadastral-layer');
    expect(layer.data).toBe(cadastralData);
    expect(layer.getFillColor).toBeDefined();
  });

  it('handles empty feature collection', () => {
    const empty = { type: 'FeatureCollection', features: [] };
    const layer = buildCadastralLayer(empty);

    expect(layer.id).toBe('cadastral-layer');
    expect(layer.data.features).toHaveLength(0);
  });
});
```

### Key Rules for Unit Tests

- **Environment: `node`** — no jsdom, no browser polyfills
- **Real GeoJSON fixtures** — import directly from `backend/data/`
- **Real Turf.js** — never mock geometry operations
- **No mocking of internal modules** — if you need to mock, the function is not pure enough for a unit test

---

## 5. E2E Tests (Playwright) — Main Focus

E2E tests load the built extension into Chromium and navigate to the real 4dinno.ru site with the real backend running.

### Custom Fixture

```ts
// tests/e2e/fixtures.ts
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const extensionPath = path.join(__dirname, '../../extension/dist');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // Manifest V3: use serviceWorkers(), NOT backgroundPages()
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

export const expect = base.expect;
```

### Playwright Config

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  webServer: {
    command: 'cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000',
    port: 8000,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
```

The `webServer` config starts the FastAPI backend automatically before tests run. This is the same backend as production — it serves real GeoJSON data. No mocking needed.

### Headless Mode

`--headless=new` works with extensions on modern Chromium. For CI, update the fixture:

```ts
context: async ({}, use) => {
  const extensionPath = path.join(__dirname, '../../extension/dist');
  const context = await chromium.launchPersistentContext('', {
    headless: false, // Set to true + use --headless=new for CI
    args: [
      `--headless=new`, // Add for CI headless mode
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  await use(context);
  await context.close();
},
```

### Example: Extension Loading

```ts
// tests/e2e/extension-load.spec.ts
import { test, expect } from './fixtures';

test('extension loads on 4dinno.ru and panel appears', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');

  // Wait for content script to inject the panel
  const panel = page.waitForSelector('[data-testid="innomap-panel"]', {
    timeout: 10000,
  });
  await expect(panel).resolves.toBeTruthy();
});

test('service worker is active', async ({ extensionId }) => {
  expect(extensionId).toBeTruthy();
  expect(extensionId).toMatch(/^[a-z]{32}$/);
});
```

### Example: Layer Rendering

```ts
// tests/e2e/layers.spec.ts
import { test, expect } from './fixtures';

test('GIS layers render on map', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');

  // Wait for extension to initialize and layers to load
  await page.waitForTimeout(3000); // Allow extension + data fetch

  // Check deck.gl layer IDs via page.evaluate
  const layerIds = await page.evaluate(() => {
    // Walk React fiber to find deck.gl instance
    const canvas = document.querySelector('canvas');
    if (!canvas) return [];
    const fiberKey = Object.keys(canvas).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return [];

    // Traverse fiber tree to find deck instance
    let fiber = (canvas as any)[fiberKey];
    let deckInstance = null;
    while (fiber) {
      if (fiber.memoizedProps?.layers) {
        deckInstance = fiber.memoizedProps;
        break;
      }
      fiber = fiber.return;
    }

    if (!deckInstance?.layers) return [];
    return deckInstance.layers.map((l: any) => l.id);
  });

  expect(layerIds).toContain('cadastral-layer');
  expect(layerIds).toContain('protection-zones-layer');
});

test('layer toggle hides cadastral layer', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await page.waitForSelector('[data-testid="innomap-panel"]');

  // Toggle cadastral layer off
  await page.click('text=Кадастровые участки');

  const layerIds = await page.evaluate(() => {
    // Same fiber walk as above — extract to helper
    // Returns visible layer IDs
    return []; // Implement via deck-helpers.ts
  });

  expect(layerIds).not.toContain('cadastral-layer');
});
```

### Example: Building Placement + Validation

```ts
// tests/e2e/placement.spec.ts
import { test, expect } from './fixtures';

test('building placement via map click shows validation', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await page.waitForSelector('[data-testid="innomap-panel"]');

  // Click on the map to place a building
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 400, y: 300 } });

  // Check that validation status appears in the panel
  await expect(page.locator('[data-testid="validation-status"]')).toBeVisible();
});

test('server validation via Проверить button', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await page.waitForSelector('[data-testid="innomap-panel"]');

  // Place a building first
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 400, y: 300 } });

  // Click the validate button — sends POST /api/v1/validate to real backend
  await page.click('text=Проверить');

  // Wait for server response
  await expect(page.locator('[data-testid="validation-result"]')).toBeVisible({
    timeout: 10000,
  });
});
```

### Example: Validation States

```ts
// tests/e2e/validation.spec.ts
import { test, expect } from './fixtures';

test('client validation shows green for valid placement', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://4dinno.ru/map/territory');
  await page.waitForSelector('[data-testid="innomap-panel"]');

  // Place building in a valid location (outside protection zones)
  // Coordinates depend on actual map viewport
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 300, y: 250 } });

  const status = page.locator('[data-testid="validation-status"]');
  await expect(status).toHaveClass(/valid|green/);
});

test('backend unavailable degrades to Turf.js only', async ({ context }) => {
  const page = await context.newPage();

  // Block backend requests to simulate unavailability
  await page.route('**/api/v1/**', route => route.abort());

  await page.goto('https://4dinno.ru/map/territory');
  await page.waitForSelector('[data-testid="innomap-panel"]');

  // Place a building — should still get client-side validation
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 400, y: 300 } });

  // Client validation (Turf.js) still works
  await expect(page.locator('[data-testid="validation-status"]')).toBeVisible();

  // Server validation button shows degraded state
  await page.click('text=Проверить');
  await expect(page.getByText(/сервер недоступен|offline/i)).toBeVisible();
});
```

### Deck.gl Helpers

Extract common `page.evaluate()` patterns into helpers:

```ts
// tests/e2e/helpers/deck-helpers.ts
import { Page } from '@playwright/test';

export async function getDeckLayerIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return [];
    const fiberKey = Object.keys(canvas).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return [];

    let fiber = (canvas as any)[fiberKey];
    while (fiber) {
      if (fiber.memoizedProps?.layers) {
        return fiber.memoizedProps.layers.map((l: any) => l.id);
      }
      fiber = fiber.return;
    }
    return [];
  });
}

export async function getDeckLayerProps(page: Page, layerId: string): Promise<any> {
  return page.evaluate((id) => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const fiberKey = Object.keys(canvas).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return null;

    let fiber = (canvas as any)[fiberKey];
    while (fiber) {
      if (fiber.memoizedProps?.layers) {
        const layer = fiber.memoizedProps.layers.find((l: any) => l.id === id);
        return layer ? { id: layer.id, visible: layer.props?.visible } : null;
      }
      fiber = fiber.return;
    }
    return null;
  }, layerId);
}

export async function waitForDeckLayers(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const fiberKey = Object.keys(canvas).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return false;

    let fiber = (canvas as any)[fiberKey];
    while (fiber) {
      if (fiber.memoizedProps?.layers?.length > 0) return true;
      fiber = fiber.return;
    }
    return false;
  }, { timeout });
}
```

### Panel Interaction Helpers

```ts
// tests/e2e/helpers/panel-helpers.ts
import { Page } from '@playwright/test';

export async function waitForPanel(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="innomap-panel"]', { timeout: 10000 });
}

export async function selectPreset(page: Page, presetName: string): Promise<void> {
  await page.click(`text=${presetName}`);
}

export async function toggleLayer(page: Page, layerName: string): Promise<void> {
  await page.click(`text=${layerName}`);
}
```

---

## 6. What to E2E Test

| Test | What to Check |
|---|---|
| Extension loads | Panel appears in DOM on 4dinno.ru/map/territory |
| Deck.gl instance found | React fiber walk finds canvas with layers |
| setProps patch works | Custom layers added to existing deck.gl instance |
| GIS layers render | `cadastral-layer` and `protection-zones-layer` IDs present via `page.evaluate` |
| Layer toggle | Click toggle → layer ID disappears from deck.gl |
| Preset selection | Select preset in panel → correct layer set visible |
| Building placement | Click on map → building polygon appears |
| Client validation | Turf.js check → green/red status in panel |
| Server validation | Click "Проверить" → POST /api/v1/validate → result displayed |
| Backend unavailable | Block API routes → degraded mode with Turf.js only |

---

## 7. Backend as Test Server

The FastAPI backend is BOTH the production server AND the e2e test fixture. It serves real GeoJSON from `backend/data/`. No mocking needed.

Playwright's `webServer` config starts it automatically:

```ts
webServer: {
  command: 'cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000',
  port: 8000,
  reuseExistingServer: !process.env.CI,
  timeout: 15000,
},
```

In CI, the backend starts fresh every time. Locally, if you already have it running, Playwright reuses it (`reuseExistingServer`).

---

## 8. File Organization

```
extension/
├── vitest.config.ts
├── tests/
│   └── unit/
│       ├── validation.test.ts     # Turf.js logic
│       └── layers.test.ts         # Layer construction
tests/
└── e2e/
    ├── fixtures.ts                # Extension context fixture
    ├── helpers/
    │   ├── deck-helpers.ts        # page.evaluate helpers for deck.gl
    │   └── panel-helpers.ts       # Panel interaction helpers
    ├── extension-load.spec.ts     # Extension loads, panel visible
    ├── layers.spec.ts             # GIS layers render on map
    ├── placement.spec.ts          # Building placement + validation
    └── validation.spec.ts         # Client + server validation
playwright.config.ts
```

### Naming Conventions

| File type | Pattern | Example |
|---|---|---|
| Unit test | `*.test.ts` | `validation.test.ts` |
| E2e test | `*.spec.ts` | `layers.spec.ts` |
| Fixture | `fixtures.ts` | `tests/e2e/fixtures.ts` |
| Helper | `*-helpers.ts` | `deck-helpers.ts` |

---

## 9. E2E Best Practices

- **Use locators, not selectors** — `page.getByRole('button', { name: 'Проверить' })` over `page.locator('.validate-btn')`
- **Auto-waiting** — Playwright waits for elements automatically. Avoid `waitForTimeout` except for deck.gl initialization.
- **Assertions with `expect`** — Use Playwright's `expect` (not Vitest's). It has built-in retrying: `await expect(page.getByText('Done')).toBeVisible()`.
- **Isolate tests** — Each test gets a fresh page. Do not rely on state from a previous test.
- **Wait for extension init** — The content script takes time to inject. Always `waitForSelector` or `waitForFunction` before asserting on extension state.
- **`page.evaluate()` for deck.gl** — The only way to inspect deck.gl layer state. Use the helpers from `deck-helpers.ts`.
- **`context.serviceWorkers()`** — For Manifest V3. Never use `backgroundPages()` (that is Manifest V2 only).
- **Use `data-testid` sparingly** — Prefer visible text and ARIA roles. Use `data-testid` only for elements without semantic alternatives (like the extension panel container).

---

## 10. Test Validation Checklist

Before committing tests, verify:

- [ ] **Tests are meaningful** — each test would catch a real bug
- [ ] **No mocked Turf.js** — geometry tests use real operations
- [ ] **No mocked GeoJSON** — tests use real fixture files from `backend/data/`
- [ ] **No mocked backend in e2e** — backend is a real FastAPI server
- [ ] **Extension init awaited** — tests wait for panel/layers before asserting
- [ ] **Async operations properly awaited** — no floating promises
- [ ] **Tests are independent** — each test can run in isolation
- [ ] **No test-only code in production** — no `if (process.env.NODE_ENV === 'test')` in extension source
- [ ] **Manifest V3 patterns** — using `serviceWorkers()`, not `backgroundPages()`
