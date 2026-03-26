/**
 * Dropstab Runner - Network interception based scraper
 * 
 * Main scraper for Dropstab using network interception instead of __NEXT_DATA__
 */

import { Page } from 'puppeteer';
import { BrowserSessionManager } from '../common/browser-session.manager';
import { 
  attachJsonInterceptor, 
  discoveryMatcher, 
  dropstabApiMatcher,
  extractNextData 
} from '../common/network-interceptor';
import { 
  scrollPage, 
  scrollToBottom,
  waitForNetworkIdle, 
  navigateWithRetry, 
  sleep, 
  randomDelay 
} from '../common/pagination.util';
import { PageCollectionResult, CollectionSummary } from '../common/parser.types';
import { 
  normalizeDropstabInvestor, 
  normalizeDropstabFunding, 
  normalizeDropstabUnlock,
  extractDropstabItems 
} from './dropstab.normalize';
import { dedupeByKey, getUniqueIds } from '../common/dedupe.util';

const BASE_URL = 'https://dropstab.com';

export class DropstabRunner {
  constructor(private readonly browserManager: BrowserSessionManager) {}

  /**
   * Discovery mode - collect all XHR/Fetch URLs and payloads for analysis
   */
  async runDiscovery(url: string, scrollSteps = 10): Promise<any> {
    console.log(`[DropstabRunner] Discovery mode: ${url}`);
    const page = await this.browserManager.newPage();

    const intercept = await attachJsonInterceptor(page, discoveryMatcher);

    try {
      const navigated = await navigateWithRetry(page, url);
      if (!navigated) {
        return { error: 'Navigation failed', matchedUrls: [], payloads: [] };
      }

      await scrollPage(page, scrollSteps, 500);
      await sleep(2000);

      // Also get __NEXT_DATA__ for comparison
      const nextData = await extractNextData(page);

      return {
        url,
        matchedUrls: [...intercept.matchedUrls],
        payloads: [...intercept.payloads],
        payloadCount: intercept.payloads.length,
        nextDataAvailable: !!nextData,
        nextDataKeys: nextData ? Object.keys(nextData.props?.pageProps || {}) : [],
      };
    } finally {
      intercept.detach();
      await this.browserManager.closePage(page);
    }
  }

  /**
   * Collect investors with network interception
   */
  async collectInvestors(maxPages = 20): Promise<CollectionSummary> {
    console.log(`[DropstabRunner] Collecting investors (max ${maxPages} pages)...`);
    
    const results: PageCollectionResult[] = [];
    const allItems: any[] = [];
    const seenIds = new Set<string>();

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const pageResult = await this.collectSinglePage(
        `${BASE_URL}/investors?page=${pageNum}`,
        'investors',
        pageNum
      );

      results.push(pageResult);

      // Normalize and collect items
      for (const payload of pageResult.payloads) {
        const items = extractDropstabItems(payload.data || payload, 'investors');
        for (const item of items) {
          const normalized = normalizeDropstabInvestor(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allItems.push(normalized);
          }
        }
      }

      console.log(`[DropstabRunner] Page ${pageNum}: ${pageResult.itemsFound} items, total unique: ${allItems.length}`);

      // Check if we should continue
      if (pageResult.itemsFound === 0 || pageResult.payloads.length === 0) {
        // Try fallback from __NEXT_DATA__
        if (pageNum === 1) {
          console.log('[DropstabRunner] No API data, trying __NEXT_DATA__ fallback...');
          const fallbackItems = await this.collectWithFallback(`${BASE_URL}/investors`, 'investors');
          if (fallbackItems.length > 0) {
            for (const item of fallbackItems) {
              if (!seenIds.has(item.externalId)) {
                seenIds.add(item.externalId);
                allItems.push(item);
              }
            }
          }
        }
        break;
      }

      // Rate limiting
      await randomDelay(1500, 2500);
    }

    return {
      source: 'dropstab',
      entity: 'investors',
      totalPages: results.length,
      totalRaw: results.reduce((sum, r) => sum + r.itemsFound, 0),
      totalUnique: allItems.length,
      items: allItems,
      debug: {
        pagesData: results.map(r => ({
          page: r.page,
          matchedUrls: r.matchedUrls,
          payloadCount: r.payloads.length,
          itemsFound: r.itemsFound,
        })),
      },
    };
  }

  /**
   * Collect fundraising rounds with network interception
   */
  async collectFundraising(maxPages = 50): Promise<CollectionSummary> {
    console.log(`[DropstabRunner] Collecting fundraising (max ${maxPages} pages)...`);
    
    const results: PageCollectionResult[] = [];
    const allItems: any[] = [];
    const seenIds = new Set<string>();

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const pageResult = await this.collectSinglePage(
        `${BASE_URL}/latest-fundraising-rounds?page=${pageNum}`,
        'fundraising',
        pageNum
      );

      results.push(pageResult);

      // Normalize and collect items
      for (const payload of pageResult.payloads) {
        const items = extractDropstabItems(payload.data || payload, 'fundraising');
        for (const item of items) {
          const normalized = normalizeDropstabFunding(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allItems.push(normalized);
          }
        }
      }

      console.log(`[DropstabRunner] Page ${pageNum}: ${pageResult.itemsFound} items, total unique: ${allItems.length}`);

      if (pageResult.itemsFound === 0 || pageResult.payloads.length === 0) {
        if (pageNum === 1) {
          const fallbackItems = await this.collectWithFallback(`${BASE_URL}/latest-fundraising-rounds`, 'fundraising');
          for (const item of fallbackItems) {
            if (!seenIds.has(item.externalId)) {
              seenIds.add(item.externalId);
              allItems.push(item);
            }
          }
        }
        break;
      }

      await randomDelay(1500, 2500);
    }

    return {
      source: 'dropstab',
      entity: 'fundraising',
      totalPages: results.length,
      totalRaw: results.reduce((sum, r) => sum + r.itemsFound, 0),
      totalUnique: allItems.length,
      items: allItems,
      debug: {
        pagesData: results.map(r => ({
          page: r.page,
          matchedUrls: r.matchedUrls,
          payloadCount: r.payloads.length,
          itemsFound: r.itemsFound,
        })),
      },
    };
  }

  /**
   * Collect unlocks with network interception
   */
  async collectUnlocks(): Promise<CollectionSummary> {
    console.log('[DropstabRunner] Collecting unlocks...');
    
    const results: PageCollectionResult[] = [];
    const allItems: any[] = [];
    const seenIds = new Set<string>();

    for (const path of ['/vesting', '/unlock']) {
      const pageResult = await this.collectSinglePage(
        `${BASE_URL}${path}`,
        'unlocks',
        1
      );

      results.push(pageResult);

      for (const payload of pageResult.payloads) {
        const items = extractDropstabItems(payload.data || payload, 'unlocks');
        for (const item of items) {
          const normalized = normalizeDropstabUnlock(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allItems.push(normalized);
          }
        }
      }

      if (allItems.length > 0) break;
      await randomDelay(1500, 2500);
    }

    // Fallback
    if (allItems.length === 0) {
      const fallbackItems = await this.collectWithFallback(`${BASE_URL}/vesting`, 'unlocks');
      for (const item of fallbackItems) {
        if (!seenIds.has(item.externalId)) {
          seenIds.add(item.externalId);
          allItems.push(item);
        }
      }
    }

    return {
      source: 'dropstab',
      entity: 'unlocks',
      totalPages: results.length,
      totalRaw: results.reduce((sum, r) => sum + r.itemsFound, 0),
      totalUnique: allItems.length,
      items: allItems,
      debug: {
        pagesData: results.map(r => ({
          page: r.page,
          matchedUrls: r.matchedUrls,
          payloadCount: r.payloads.length,
          itemsFound: r.itemsFound,
        })),
      },
    };
  }

  /**
   * Collect single page with network interception
   */
  private async collectSinglePage(
    url: string, 
    entity: string,
    pageNum: number
  ): Promise<PageCollectionResult> {
    const page = await this.browserManager.newPage();
    const intercept = await attachJsonInterceptor(page, dropstabApiMatcher);

    const result: PageCollectionResult = {
      page: pageNum,
      matchedUrls: [],
      payloads: [],
      itemsFound: 0,
      uniqueIds: [],
      errors: [],
    };

    try {
      const navigated = await navigateWithRetry(page, url);
      if (!navigated) {
        result.errors.push('Navigation failed');
        return result;
      }

      // Scroll to trigger data loading
      await scrollPage(page, 12, 400);
      await sleep(2000);

      result.matchedUrls = [...intercept.matchedUrls];
      result.payloads = [...intercept.payloads];

      // Count items found
      for (const payload of result.payloads) {
        const items = extractDropstabItems(payload.data || payload, entity);
        result.itemsFound += items.length;
        result.uniqueIds.push(...getUniqueIds(items, (i: any) => i.id?.toString() || i.slug || ''));
      }

    } catch (error) {
      result.errors.push(error.message);
      console.error(`[DropstabRunner] Error on page ${pageNum}: ${error.message}`);
    } finally {
      intercept.detach();
      await this.browserManager.closePage(page);
    }

    return result;
  }

  /**
   * Fallback to __NEXT_DATA__ extraction
   */
  private async collectWithFallback(url: string, entity: string): Promise<any[]> {
    console.log(`[DropstabRunner] Using __NEXT_DATA__ fallback for ${url}`);
    const page = await this.browserManager.newPage();

    try {
      const navigated = await navigateWithRetry(page, url);
      if (!navigated) return [];

      await sleep(2000);
      const nextData = await extractNextData(page);
      if (!nextData) return [];

      const items = extractDropstabItems(nextData.props?.pageProps || nextData, entity);
      
      const normalizers: Record<string, (item: any) => any> = {
        investors: normalizeDropstabInvestor,
        fundraising: normalizeDropstabFunding,
        unlocks: normalizeDropstabUnlock,
      };

      const normalizer = normalizers[entity] || normalizers.investors;
      return items.map(normalizer).filter(Boolean);

    } finally {
      await this.browserManager.closePage(page);
    }
  }

  /**
   * Run full collection for all entities
   */
  async collectAll(): Promise<Record<string, CollectionSummary>> {
    console.log('[DropstabRunner] Starting full collection...');
    const start = Date.now();

    const results: Record<string, CollectionSummary> = {};

    try {
      results.investors = await this.collectInvestors(30);
      await sleep(3000);

      results.fundraising = await this.collectFundraising(50);
      await sleep(3000);

      results.unlocks = await this.collectUnlocks();

    } finally {
      await this.browserManager.close();
    }

    const elapsed = (Date.now() - start) / 1000;
    console.log(`[DropstabRunner] Full collection complete in ${elapsed.toFixed(1)}s`);
    console.log(`  Investors: ${results.investors?.totalUnique || 0}`);
    console.log(`  Fundraising: ${results.fundraising?.totalUnique || 0}`);
    console.log(`  Unlocks: ${results.unlocks?.totalUnique || 0}`);

    return results;
  }
}
