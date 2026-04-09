// tests/extension.spec.ts
/**
 * NeuroFlow Cross-Browser Extension Tests
 * Run: npx playwright test
 */
import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.resolve(__dirname, '../dist');

async function getExtensionContext(): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
  return context;
}

test.describe('NeuroFlow Extension', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await getExtensionContext();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('popup opens and shows NeuroFlow logo', async () => {
    // Find the extension popup page
    const [background] = context.serviceWorkers();
    expect(background).toBeTruthy();

    const page = await context.newPage();
    // Get extension ID from service worker URL
    const swURL = background.url();
    const extensionId = swURL.split('/')[2];

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator('.logo-text')).toContainText('NeuroFlow');
  });

  test('session cards render correctly', async () => {
    const pages = context.pages();
    const popup = pages.find(p => p.url().includes('popup.html'));
    if (!popup) return;

    const cards = await popup.locator('.session-card').count();
    expect(cards).toBe(6); // 6 session presets
  });

  test('play button toggles state', async () => {
    const pages = context.pages();
    const popup = pages.find(p => p.url().includes('popup.html'));
    if (!popup) return;

    const playBtn = popup.locator('.play-btn');
    await expect(playBtn).toContainText('Play');

    await playBtn.click();
    // After click should show Pause (audio starts)
    await expect(playBtn).toContainText('Pause', { timeout: 5000 });
  });

  test('timer buttons are visible', async () => {
    const pages = context.pages();
    const popup = pages.find(p => p.url().includes('popup.html'));
    if (!popup) return;

    await popup.locator('.tab-btn', { hasText: 'Timer' }).click();
    const timerBtns = await popup.locator('.timer-btn').count();
    expect(timerBtns).toBe(9);
  });

  test('tune tab sliders exist', async () => {
    const pages = context.pages();
    const popup = pages.find(p => p.url().includes('popup.html'));
    if (!popup) return;

    await popup.locator('.tab-btn', { hasText: 'Tune' }).click();
    const sliders = await popup.locator('.slider').count();
    expect(sliders).toBeGreaterThanOrEqual(3);
  });
});