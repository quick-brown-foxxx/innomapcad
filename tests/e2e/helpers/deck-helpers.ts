import type { Page } from '@playwright/test';

/**
 * Get all deck.gl layer IDs by walking the React fiber tree
 * from the deckgl-overlay canvas element.
 */
export async function getDeckLayerIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const overlay = document.getElementById('deckgl-overlay');
    if (!overlay) return [];
    const fiberKey = Object.keys(overlay).find((k) =>
      k.startsWith('__reactFiber'),
    );
    if (!fiberKey) return [];
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
    return layers.map((l) => l.id);
  });
}

/**
 * Check whether a deck.gl instance exists by walking the React fiber tree.
 */
export async function getDeckInstance(page: Page): Promise<boolean> {
  return page.evaluate(() => {
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
}

/**
 * Wait for the extension panel to appear inside the shadow DOM.
 */
export async function waitForExtensionReady(page: Page): Promise<void> {
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
