import { test, expect } from './fixtures';

test.describe('Page Evaluation (MCP pattern)', () => {
  test('can detect extension via DOM query in evaluate', async ({ extensionPage }) => {
    await extensionPage.goto('https://example.com');

    // Wait for extension
    await extensionPage.locator('#innomapcad-test-extension').waitFor({ timeout: 5000 });

    // Simulate evaluate_script MCP call
    const result = await extensionPage.evaluate(() => {
      const marker = document.getElementById('innomapcad-test-extension');
      return {
        found: marker !== null,
        text: marker?.textContent || null,
        hasDisplay: marker ? getComputedStyle(marker).display !== 'none' : false,
      };
    });

    expect(result.found).toBe(true);
    expect(result.text).toBe('InnoMapCAD Extension Active');
    expect(result.hasDisplay).toBe(true);
  });

  test('can read extension state via DOM evaluate', async ({ extensionPage }) => {
    await extensionPage.goto('https://example.com');

    // Wait for the extension marker in DOM (shared across worlds)
    await extensionPage.locator('#innomapcad-test-extension').waitFor({ timeout: 5000 });

    // Note: window.__innomapcadExtensionLoaded is set in the content script's
    // isolated world and is NOT visible from Playwright's evaluate (main world).
    // We verify extension state through the shared DOM instead.
    const flags = await extensionPage.evaluate(() => {
      const marker = document.getElementById('innomapcad-test-extension');
      return {
        markerExists: marker !== null,
        markerText: marker?.textContent || null,
        markerVisible: marker ? getComputedStyle(marker).display !== 'none' : false,
      };
    });

    expect(flags.markerExists).toBe(true);
    expect(flags.markerText).toBe('InnoMapCAD Extension Active');
    expect(flags.markerVisible).toBe(true);
  });
});
