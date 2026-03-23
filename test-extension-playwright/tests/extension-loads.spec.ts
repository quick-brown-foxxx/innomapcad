import { test, expect } from './fixtures';

test.describe('Extension Loading', () => {
  test('extension content script injects marker element', async ({ extensionPage }) => {
    await extensionPage.goto('https://example.com');

    // Wait for content script to inject (document_idle)
    const marker = extensionPage.locator('#innomapcad-test-extension');
    await expect(marker).toBeVisible({ timeout: 5000 });
    await expect(marker).toHaveText('InnoMapCAD Extension Active');
  });

  test('extension sets window flag (via DOM proxy)', async ({ extensionPage }) => {
    await extensionPage.goto('https://example.com');

    // Content scripts run in an isolated world, so window properties they set
    // are NOT visible from Playwright's evaluate (main world). Instead, we
    // verify the extension loaded by checking the DOM marker it creates,
    // which IS shared across worlds.
    const marker = extensionPage.locator('#innomapcad-test-extension');
    await expect(marker).toBeVisible({ timeout: 5000 });

    // Confirm marker text as a proxy for the extension having fully executed
    // (the window flag is set in the same IIFE that creates the marker)
    await expect(marker).toHaveText('InnoMapCAD Extension Active');
  });

  test('extension injects on multiple navigations', async ({ extensionPage }) => {
    // First navigation
    await extensionPage.goto('https://example.com');
    await expect(extensionPage.locator('#innomapcad-test-extension')).toBeVisible({ timeout: 5000 });

    // Second navigation
    await extensionPage.goto('https://www.iana.org/');
    await expect(extensionPage.locator('#innomapcad-test-extension')).toBeVisible({ timeout: 5000 });
  });

  test('marker element has correct styling', async ({ extensionPage }) => {
    await extensionPage.goto('https://example.com');

    const marker = extensionPage.locator('#innomapcad-test-extension');
    await expect(marker).toBeVisible({ timeout: 5000 });

    const bgColor = await marker.evaluate(el => getComputedStyle(el).backgroundColor);
    // #4A90D9 = rgb(74, 144, 217)
    expect(bgColor).toBe('rgb(74, 144, 217)');
  });

  test('console log from extension is present', async ({ extensionPage }) => {
    const messages: string[] = [];
    extensionPage.on('console', msg => messages.push(msg.text()));

    await extensionPage.goto('https://example.com');

    // Wait for content script
    await extensionPage.locator('#innomapcad-test-extension').waitFor({ timeout: 5000 });

    // Check console message
    expect(messages.some(m => m.includes('[InnoMapCAD]'))).toBe(true);
  });
});
