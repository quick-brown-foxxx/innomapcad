import { test, expect } from './fixtures';
import { getPresetCards, clickPreset } from './helpers/panel-helpers';

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

test.describe('Building placement', () => {
  test('preset selection and building placement on map click', async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(MAP_URL, { waitUntil: 'domcontentloaded' });
    await waitForPanel(page);

    // Verify preset cards are available
    const presets = await getPresetCards(page);
    expect(presets.length).toBeGreaterThan(0);

    // Select the first preset
    const firstPreset = presets[0];
    expect(firstPreset).toBeDefined();
    expect(firstPreset!.id).toBeTruthy();
    await clickPreset(page, firstPreset!.id!);

    // Verify the preset is selected (active class or aria attribute in shadow DOM)
    const isSelected = await page.evaluate((presetId: string) => {
      const root = document.getElementById('innomapcad-root');
      const card = root?.shadowRoot?.querySelector(
        `.preset-card[data-preset-id="${presetId}"]`,
      );
      return (
        card?.classList.contains('active') ||
        card?.getAttribute('aria-selected') === 'true'
      );
    }, firstPreset!.id!);
    expect(isSelected).toBe(true);

    // Click on the map canvas to place the building
    const canvas = page.locator('#deckgl-overlay');
    await expect(canvas).toBeAttached({ timeout: 10_000 });
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Click near center of the map
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    // Wait for the building footprint to appear as a new deck layer
    await page.waitForTimeout(2_000);

    const hasPlacement = await page.evaluate(() => {
      const overlay = document.getElementById('deckgl-overlay');
      if (!overlay) return false;
      const fiberKey = Object.keys(overlay).find((k) =>
        k.startsWith('__reactFiber'),
      );
      if (!fiberKey) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fiber = (overlay as any)[fiberKey] as
        | { return: unknown; ref?: { current?: { deck?: unknown } } }
        | undefined;
      while (fiber && !fiber?.ref?.current?.deck) {
        fiber = fiber.return as typeof fiber;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deck = fiber?.ref?.current?.deck as any;
      const layers: Array<{ id: string }> = deck?.props?.layers ?? [];
      return layers.some(
        (l) =>
          l.id.includes('placement') || l.id.includes('building-footprint'),
      );
    });
    expect(hasPlacement).toBe(true);
  });

  test('server validation via check button returns result', async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(MAP_URL, { waitUntil: 'domcontentloaded' });
    await waitForPanel(page);

    // Select a preset and place a building first
    const presets = await getPresetCards(page);
    expect(presets.length).toBeGreaterThan(0);
    await clickPreset(page, presets[0]!.id!);

    const canvas = page.locator('#deckgl-overlay');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    await page.waitForTimeout(2_000);

    // Click the validation button inside shadow DOM
    const clickedValidate = await page.evaluate(() => {
      const root = document.getElementById('innomapcad-root');
      // Find the button by text content (Russian: "Проверить")
      const buttons = root?.shadowRoot?.querySelectorAll('button');
      if (!buttons) return false;
      for (const btn of Array.from(buttons)) {
        if (btn.textContent?.includes('Проверить')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    expect(clickedValidate).toBe(true);

    // Wait for validation response from the backend
    const validationResult = await page.waitForFunction(
      () => {
        const root = document.getElementById('innomapcad-root');
        const status = root?.shadowRoot?.querySelector('.validation-status');
        // Status should contain either a success or violation message
        return status?.textContent?.trim() !== '' ? status?.textContent : null;
      },
      { timeout: 15_000 },
    );

    const resultText = await validationResult.jsonValue();
    expect(resultText).toBeTruthy();
  });
});
