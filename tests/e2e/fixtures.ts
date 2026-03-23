import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const extensionPath = path.join(__dirname, '../../extension/dist');
    const CHROME_BIN =
      '/home/lord/.cache/puppeteer-browsers/chrome/linux-146.0.7680.153/chrome-linux64/chrome';
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      executablePath: CHROME_BIN,
      args: [
        '--headless=new',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');
    await use(background.url().split('/')[2]);
  },
});

export { expect } from '@playwright/test';
