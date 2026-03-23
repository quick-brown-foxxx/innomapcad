import type { Page } from '@playwright/test';

export async function getDeckLayerIds(page: Page): Promise<string[]> {
  // Stub — will be implemented when deck.gl bridge is ready
  return page.evaluate(() => {
    const overlay = document.getElementById('deckgl-overlay');
    if (!overlay) return [];
    const fiberKey = Object.keys(overlay).find((k) =>
      k.startsWith('__reactFiber'),
    );
    if (!fiberKey) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fiber = (overlay as any)[fiberKey];
    while (fiber && !fiber?.ref?.current?.deck) fiber = fiber.return;
    const deck = fiber?.ref?.current?.deck;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return deck?.props?.layers?.map((l: any) => l.id) || [];
  });
}

export async function waitForExtensionReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="innomap-panel"]', {
    timeout: 15000,
  });
}

export async function getDeckInstance(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const overlay = document.getElementById('deckgl-overlay');
    if (!overlay) return false;
    const fiberKey = Object.keys(overlay).find((k) =>
      k.startsWith('__reactFiber'),
    );
    if (!fiberKey) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fiber = (overlay as any)[fiberKey];
    while (fiber && !fiber?.ref?.current?.deck) fiber = fiber.return;
    return fiber?.ref?.current?.deck ? true : false;
  });
}
