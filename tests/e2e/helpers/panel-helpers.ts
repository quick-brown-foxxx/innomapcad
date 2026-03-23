import type { Page } from '@playwright/test';

/**
 * Get all preset cards from the extension panel inside shadow DOM.
 */
export async function getPresetCards(
  page: Page,
): Promise<Array<{ id: string | null; name: string | undefined }>> {
  return page.evaluate(() => {
    const root = document.getElementById('innomapcad-root');
    if (!root?.shadowRoot) return [];
    const cards = root.shadowRoot.querySelectorAll('.preset-card');
    return Array.from(cards).map((c) => ({
      id: c.getAttribute('data-preset-id'),
      name: c.textContent?.trim(),
    }));
  });
}

/**
 * Click a preset card by its ID inside the shadow DOM panel.
 */
export async function clickPreset(
  page: Page,
  presetId: string,
): Promise<void> {
  await page.evaluate((id: string) => {
    const root = document.getElementById('innomapcad-root');
    const card = root?.shadowRoot?.querySelector<HTMLElement>(
      `.preset-card[data-preset-id="${id}"]`,
    );
    card?.click();
  }, presetId);
}

/**
 * Get the current validation status text from the shadow DOM panel.
 */
export async function getValidationStatus(
  page: Page,
): Promise<string | null> {
  return page.evaluate(() => {
    const root = document.getElementById('innomapcad-root');
    const status =
      root?.shadowRoot?.querySelector('.validation-status');
    return status?.textContent?.trim() ?? null;
  });
}

/**
 * Click the validation ("Проверить") button inside the shadow DOM panel.
 * Returns true if the button was found and clicked.
 */
export async function clickValidateButton(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.getElementById('innomapcad-root');
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
}
