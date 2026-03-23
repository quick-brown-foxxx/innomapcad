import { test, expect } from './fixtures';

const MAP_URL = '/map/territory';

test.describe('Extension loading', () => {
  test('extension loads on 4dinno.ru/map/territory, panel visible in DOM', async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(MAP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for the extension content script to inject the shadow root host
    const host = page.locator('#innomapcad-root');
    await expect(host).toBeAttached({ timeout: 15_000 });

    // Verify the panel is rendered inside shadow DOM
    const hasPanel = await page.evaluate(() => {
      const root = document.getElementById('innomapcad-root');
      return (
        root?.shadowRoot?.querySelector('[data-testid="innomap-panel"]') !==
        null
      );
    });
    expect(hasPanel).toBe(true);
  });

  test('deck.gl instance found via React fiber walk', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(MAP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for the extension panel to appear first (signals content script is ready)
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

    // Walk the React fiber tree from deckgl-overlay to find deck instance
    const hasDeck = await page.evaluate(() => {
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
      return fiber?.ref?.current?.deck != null;
    });

    expect(hasDeck).toBe(true);
  });
});
