import type { Page } from '@playwright/test';

export async function getPresetCards(
  page: Page,
): Promise<Array<{ id: string | null; name: string | undefined }>> {
  return page.$$eval(
    '[data-testid="innomap-panel"] .preset-card',
    (cards) =>
      cards.map((c) => ({
        id: c.getAttribute('data-preset-id'),
        name: c.textContent?.trim(),
      })),
  );
}

export async function clickPreset(
  page: Page,
  presetId: string,
): Promise<void> {
  await page.click(
    `[data-testid="innomap-panel"] .preset-card[data-preset-id="${presetId}"]`,
  );
}

export async function getValidationStatus(
  page: Page,
): Promise<string | null> {
  return page.$eval(
    '[data-testid="innomap-panel"] .validation-status',
    (el) => el.textContent?.trim() ?? null,
  );
}
