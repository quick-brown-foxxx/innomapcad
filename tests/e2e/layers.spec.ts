import { test, expect } from './fixtures';
import { getDeckLayerIds } from './helpers/deck-helpers';

const MAP_URL = '/map/territory';

/** Wait for the extension panel to be ready inside shadow DOM. */
async function waitForPanel(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const root = document.getElementById('innomapcad-root');
      return (
        root?.shadowRoot?.querySelector('[data-testid="innomap-panel"]') !==
        null
      );
    },
    { timeout: 15_000 },
  );
}

test.describe('GIS layers', () => {
  test('cadastral and protection-zone layers are loaded', async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(MAP_URL, { waitUntil: 'domcontentloaded' });
    await waitForPanel(page);

    // Give layers time to load from backend
    await page.waitForTimeout(3_000);

    const layerIds = await getDeckLayerIds(page);
    expect(layerIds.length).toBeGreaterThan(0);

    // Expect at least cadastral and protection zone layers
    const hasCadastral = layerIds.some((id) =>
      id.toLowerCase().includes('cadastral'),
    );
    const hasProtection = layerIds.some(
      (id) =>
        id.toLowerCase().includes('protection') ||
        id.toLowerCase().includes('zone'),
    );

    expect(hasCadastral).toBe(true);
    expect(hasProtection).toBe(true);
  });

  test('layer toggle hides and shows a layer', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(MAP_URL, { waitUntil: 'domcontentloaded' });
    await waitForPanel(page);

    await page.waitForTimeout(3_000);

    const layerIdsBefore = await getDeckLayerIds(page);
    expect(layerIdsBefore.length).toBeGreaterThan(0);

    // Click the first layer toggle inside the shadow DOM panel
    const toggled = await page.evaluate(() => {
      const root = document.getElementById('innomapcad-root');
      const toggle = root?.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="layer-toggle"]',
      );
      if (!toggle) return false;
      toggle.click();
      return true;
    });
    expect(toggled).toBe(true);

    // Wait for deck.gl to re-render
    await page.waitForTimeout(1_000);

    const layerIdsAfter = await getDeckLayerIds(page);

    // At least one layer should have been removed
    expect(layerIdsAfter.length).toBeLessThan(layerIdsBefore.length);

    // Toggle back on
    await page.evaluate(() => {
      const root = document.getElementById('innomapcad-root');
      const toggle = root?.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="layer-toggle"]',
      );
      toggle?.click();
    });

    await page.waitForTimeout(1_000);

    const layerIdsRestored = await getDeckLayerIds(page);
    expect(layerIdsRestored.length).toBe(layerIdsBefore.length);
  });
});
