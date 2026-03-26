/**
 * CryptoRank Runner - Network interception based scraper
 */

import { Page } from 'puppeteer';
import { BrowserSessionManager } from '../common/browser-session.manager';
import { 
  attachJsonInterceptor, 
  discoveryMatcher, 
  cryptoRankApiMatcher,
  extractNextData 
} from '../common/network-interceptor';
import { 
  scrollPage, 
  waitForNetworkIdle, 
  navigateWithRetry, 
  sleep, 
  randomDelay 
} from '../common/pagination.util';
import { PageCollectionResult, CollectionSummary } from '../common/parser.types';
import { 
  normalizeCryptoRankInvestor, 
  normalizeCryptoRankFunding, 
  normalizeCryptoRankUnlock,
  extractCryptoRankItems 
} from './cryptorank.normalize';
import { dedupeByKey, getUniqueIds } from '../common/dedupe.util';

const BASE_URL = 'https://cryptorank.io';

export class CryptoRankRunner {
  constructor(private readonly browserManager: BrowserSessionManager) {}

  /**
   * Discovery mode - collect all XHR/Fetch URLs and payloads
   */
  async runDiscovery(url: string, scrollSteps = 10): Promise<any> {
    console.log(`[CryptoRankRunner] Discovery mode: ${url}`);
    const page = await this.browserManager.newPage();

    const intercept = await attachJsonInterceptor(page, discoveryMatcher);

    try {
      const navigated = await navigateWithRetry(page, url);
      if (!navigated) {
        return { error: 'Navigation failed', matchedUrls: [], payloads: [] };
      }

      await scrollPage(page, scrollSteps, 500);
      await sleep(2000);

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
   * Collect funding rounds - CryptoRank uses SSR with __NEXT_DATA__
   * We need to navigate to each page and extract data
   */
  async collectFundingRounds(maxPages = 50): Promise<CollectionSummary> {
    console.log(`[CryptoRankRunner] Collecting funding rounds via SSR (max ${maxPages} pages)...`);
    
    const results: PageCollectionResult[] = [];
    const allItems: any[] = [];
    const seenIds = new Set<string>();

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url = `${BASE_URL}/funding-rounds?page=${pageNum}`;
      console.log(`[CryptoRankRunner] Page ${pageNum}: ${url}`);

      const page = await this.browserManager.newPage();

      try {
        const navigated = await navigateWithRetry(page, url);
        if (!navigated) {
          console.log(`[CryptoRankRunner] Navigation failed for page ${pageNum}`);
          results.push({
            page: pageNum,
            matchedUrls: [],
            payloads: [],
            itemsFound: 0,
            uniqueIds: [],
            errors: ['Navigation failed'],
          });
          break;
        }

        await sleep(2000);

        // Extract __NEXT_DATA__
        const nextData = await extractNextData(page);
        if (!nextData) {
          console.log(`[CryptoRankRunner] No __NEXT_DATA__ on page ${pageNum}`);
          results.push({
            page: pageNum,
            matchedUrls: [],
            payloads: [],
            itemsFound: 0,
            uniqueIds: [],
            errors: ['No __NEXT_DATA__'],
          });
          break;
        }

        // Extract items
        const items = extractCryptoRankItems(nextData.props || nextData, 'funding');
        
        const pageResult: PageCollectionResult = {
          page: pageNum,
          matchedUrls: [],
          payloads: [{ data: items }],
          itemsFound: items.length,
          uniqueIds: [],
          errors: [],
        };

        // Normalize and collect items
        let newItems = 0;
        for (const item of items) {
          const normalized = normalizeCryptoRankFunding(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allItems.push(normalized);
            pageResult.uniqueIds.push(normalized.externalId);
            newItems++;
          }
        }

        results.push(pageResult);
        console.log(`[CryptoRankRunner] Page ${pageNum}: found ${items.length} items, ${newItems} new, total unique: ${allItems.length}`);

        // Check if we got no new items (reached end)
        if (newItems === 0 || items.length === 0) {
          console.log(`[CryptoRankRunner] No new items on page ${pageNum}, stopping`);
          break;
        }

      } catch (error) {
        console.error(`[CryptoRankRunner] Error on page ${pageNum}: ${error.message}`);
        results.push({
          page: pageNum,
          matchedUrls: [],
          payloads: [],
          itemsFound: 0,
          uniqueIds: [],
          errors: [error.message],
        });
        break;
      } finally {
        await this.browserManager.closePage(page);
      }

      // Rate limiting
      await randomDelay(2000, 3500);
    }

    return {
      source: 'cryptorank',
      entity: 'funding_rounds',
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
   * Collect investors/funds with network interception
   */
  async collectInvestors(maxPages = 30): Promise<CollectionSummary> {
    console.log(`[CryptoRankRunner] Collecting investors (max ${maxPages} pages)...`);
    
    const results: PageCollectionResult[] = [];
    const allItems: any[] = [];
    const seenIds = new Set<string>();

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const pageResult = await this.collectSinglePage(
        `${BASE_URL}/funds?page=${pageNum}`,
        'investors',
        pageNum
      );

      results.push(pageResult);

      for (const payload of pageResult.payloads) {
        const items = extractCryptoRankItems(payload.data || payload, 'investors');
        for (const item of items) {
          const normalized = normalizeCryptoRankInvestor(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allItems.push(normalized);
          }
        }
      }

      console.log(`[CryptoRankRunner] Page ${pageNum}: ${pageResult.itemsFound} items, total unique: ${allItems.length}`);

      if (pageResult.itemsFound === 0 || pageResult.payloads.length === 0) {
        if (pageNum === 1) {
          const fallbackItems = await this.collectWithFallback(`${BASE_URL}/funds`, 'investors');
          for (const item of fallbackItems) {
            if (!seenIds.has(item.externalId)) {
              seenIds.add(item.externalId);
              allItems.push(item);
            }
          }
        }
        break;
      }

      await randomDelay(2000, 3000);
    }

    return {
      source: 'cryptorank',
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
   * Collect unlocks with network interception
   */
  async collectUnlocks(maxPages = 20): Promise<CollectionSummary> {
    console.log(`[CryptoRankRunner] Collecting unlocks (max ${maxPages} pages)...`);
    
    const results: PageCollectionResult[] = [];
    const allItems: any[] = [];
    const seenIds = new Set<string>();

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const pageResult = await this.collectSinglePage(
        `${BASE_URL}/token-unlock?page=${pageNum}`,
        'unlocks',
        pageNum
      );

      results.push(pageResult);

      for (const payload of pageResult.payloads) {
        const items = extractCryptoRankItems(payload.data || payload, 'unlocks');
        for (const item of items) {
          const normalized = normalizeCryptoRankUnlock(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allItems.push(normalized);
          }
        }
      }

      console.log(`[CryptoRankRunner] Page ${pageNum}: ${pageResult.itemsFound} items, total unique: ${allItems.length}`);

      if (pageResult.itemsFound === 0 || pageResult.payloads.length === 0) {
        if (pageNum === 1) {
          const fallbackItems = await this.collectWithFallback(`${BASE_URL}/token-unlock`, 'unlocks');
          for (const item of fallbackItems) {
            if (!seenIds.has(item.externalId)) {
              seenIds.add(item.externalId);
              allItems.push(item);
            }
          }
        }
        break;
      }

      await randomDelay(2000, 3000);
    }

    return {
      source: 'cryptorank',
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
   * Collect categories
   */
  async collectCategories(): Promise<CollectionSummary> {
    console.log('[CryptoRankRunner] Collecting categories...');
    
    const pageResult = await this.collectSinglePage(
      `${BASE_URL}/categories`,
      'categories',
      1
    );

    const allItems: any[] = [];
    const seenIds = new Set<string>();

    for (const payload of pageResult.payloads) {
      const items = extractCryptoRankItems(payload.data || payload, 'categories');
      for (const item of items) {
        const key = item.slug || item.id?.toString();
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          allItems.push({
            key: `cryptorank:category:${key}`,
            externalId: key,
            source: 'cryptorank',
            name: item.name,
            slug: item.slug,
            coins_count: item.coinsCount || 0,
            market_cap: item.marketCap,
            updated_at: new Date(),
          });
        }
      }
    }

    // Fallback
    if (allItems.length === 0) {
      const fallbackItems = await this.collectWithFallback(`${BASE_URL}/categories`, 'categories');
      allItems.push(...fallbackItems);
    }

    return {
      source: 'cryptorank',
      entity: 'categories',
      totalPages: 1,
      totalRaw: allItems.length,
      totalUnique: allItems.length,
      items: allItems,
      debug: {
        pagesData: [{
          page: 1,
          matchedUrls: pageResult.matchedUrls,
          payloadCount: pageResult.payloads.length,
          itemsFound: allItems.length,
        }],
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
    const intercept = await attachJsonInterceptor(page, cryptoRankApiMatcher);

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
      await scrollPage(page, 10, 500);
      await sleep(2000);

      result.matchedUrls = [...intercept.matchedUrls];
      result.payloads = [...intercept.payloads];

      // Count items found
      for (const payload of result.payloads) {
        const items = extractCryptoRankItems(payload.data || payload, entity);
        result.itemsFound += items.length;
        result.uniqueIds.push(...getUniqueIds(items, (i: any) => i.key || i.id?.toString() || i.slug || ''));
      }

    } catch (error) {
      result.errors.push(error.message);
      console.error(`[CryptoRankRunner] Error on page ${pageNum}: ${error.message}`);
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
    console.log(`[CryptoRankRunner] Using __NEXT_DATA__ fallback for ${url}`);
    const page = await this.browserManager.newPage();

    try {
      const navigated = await navigateWithRetry(page, url);
      if (!navigated) return [];

      await sleep(2000);
      const nextData = await extractNextData(page);
      if (!nextData) return [];

      const items = extractCryptoRankItems(nextData.props?.pageProps || nextData, entity);
      
      const normalizers: Record<string, (item: any) => any> = {
        funding: normalizeCryptoRankFunding,
        investors: normalizeCryptoRankInvestor,
        unlocks: normalizeCryptoRankUnlock,
        categories: (item: any) => ({
          key: `cryptorank:category:${item.slug || item.id}`,
          externalId: item.slug || item.id?.toString(),
          source: 'cryptorank',
          name: item.name,
          slug: item.slug,
          coins_count: item.coinsCount || 0,
          updated_at: new Date(),
        }),
      };

      const normalizer = normalizers[entity] || normalizers.funding;
      return items.map(normalizer).filter(Boolean);

    } finally {
      await this.browserManager.closePage(page);
    }
  }

  /**
   * Run full collection for all entities
   */
  async collectAll(): Promise<Record<string, CollectionSummary>> {
    console.log('[CryptoRankRunner] Starting full collection...');
    const start = Date.now();

    const results: Record<string, CollectionSummary> = {};

    try {
      results.funding = await this.collectFundingRounds(50);
      await sleep(3000);

      results.investors = await this.collectInvestors(30);
      await sleep(3000);

      results.unlocks = await this.collectUnlocks(20);
      await sleep(3000);

      results.categories = await this.collectCategories();

    } finally {
      await this.browserManager.close();
    }

    const elapsed = (Date.now() - start) / 1000;
    console.log(`[CryptoRankRunner] Full collection complete in ${elapsed.toFixed(1)}s`);
    console.log(`  Funding: ${results.funding?.totalUnique || 0}`);
    console.log(`  Investors: ${results.investors?.totalUnique || 0}`);
    console.log(`  Unlocks: ${results.unlocks?.totalUnique || 0}`);
    console.log(`  Categories: ${results.categories?.totalUnique || 0}`);

    return results;
  }
}
