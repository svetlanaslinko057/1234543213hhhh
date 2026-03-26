/**
 * PaginationTrigger utilities
 * 
 * Separate layer for navigation/pagination actions
 */

import { Page } from 'puppeteer';

/**
 * Scroll page to trigger lazy loading
 */
export async function scrollPage(page: Page, steps = 8, delayMs = 600): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await sleep(delayMs);
  }
}

/**
 * Scroll to bottom of page
 */
export async function scrollToBottom(page: Page, maxScrolls = 10, delayMs = 500): Promise<void> {
  let previousHeight = 0;
  let scrollCount = 0;

  while (scrollCount < maxScrolls) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    
    if (currentHeight === previousHeight) {
      break; // No more content to load
    }

    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(delayMs);
    scrollCount++;
  }
}

/**
 * Click next button if exists and not disabled
 */
export async function clickNextIfExists(page: Page, selector: string): Promise<boolean> {
  try {
    const nextButton = await page.$(selector);
    if (!nextButton) return false;

    const disabled = await page.evaluate(
      (el) => {
        return el.hasAttribute('disabled') || 
               el.getAttribute('aria-disabled') === 'true' ||
               el.classList.contains('disabled');
      },
      nextButton,
    );

    if (disabled) return false;

    // Click and wait for network
    await Promise.allSettled([
      page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }),
      nextButton.click(),
    ]);

    return true;
  } catch (error) {
    console.warn(`[PaginationUtil] Click next failed: ${error.message}`);
    return false;
  }
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, idleTime = 1000, timeout = 30000): Promise<void> {
  try {
    await page.waitForNetworkIdle({ idleTime, timeout });
  } catch {
    // Timeout is acceptable
  }
}

/**
 * Wait for selector to appear
 */
export async function waitForSelector(page: Page, selector: string, timeout = 10000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Click element by selector
 */
export async function clickElement(page: Page, selector: string): Promise<boolean> {
  try {
    await page.click(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * Navigate to URL with retry
 */
export async function navigateWithRetry(
  page: Page, 
  url: string, 
  maxRetries = 3,
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' = 'networkidle2'
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, { waitUntil, timeout: 45000 });
      return true;
    } catch (error) {
      console.warn(`[PaginationUtil] Navigate attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      if (attempt < maxRetries) {
        await sleep(2000 * attempt);
      }
    }
  }
  return false;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Random delay for anti-detection
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return sleep(delay);
}
