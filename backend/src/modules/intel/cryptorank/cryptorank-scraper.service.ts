import { Injectable } from '@nestjs/common';
import { BrowserService } from '../../../common/browser.service';

const BASE_URL = 'https://cryptorank.io';

export interface CryptoRankFunding {
  key: string;
  source: string;
  project: string;
  project_key: string;
  symbol?: string;
  round: string;
  date?: number;
  amount?: number;
  investors: any[];
  investors_count: number;
  lead_investors: string[];
}

export interface CryptoRankInvestor {
  key: string;
  source: string;
  name: string;
  slug: string;
  tier?: number;
  type?: string;
  category?: string;
  investments_count: number;
  image?: string;
}

export interface CryptoRankUnlock {
  key: string;
  source: string;
  project_key: string;
  symbol: string;
  name?: string;
  unlock_date?: string;
  unlock_usd?: number;
  tokens_percent?: number;
  allocation?: string;
}

@Injectable()
export class CryptoRankScraperService {
  private readonly maxRetries = 5;

  constructor(private readonly browserService: BrowserService) {}

  // ═══════════════════════════════════════════════════════════════
  // EXTRACT FROM NEW CRYPTORANK STRUCTURE (2025-2026)
  // ═══════════════════════════════════════════════════════════════

  private extractFromNewStructure(nextData: any, dataKey?: string): any[] | null {
    try {
      const pageProps = nextData?.props?.pageProps;
      if (!pageProps) return null;

      // Известные ключи для CryptoRank 2025-2026
      const knownKeys = [
        'fallbackRounds', 'fallbackData', 'fallbackFunds', 'fallbackInvestors',
        'fallbackUnlocks', 'fallbackCategories', 'fallbackLaunchpads',
        'data', 'rounds', 'funds', 'investors', 'unlocks'
      ];

      // Если указан конкретный ключ
      if (dataKey && pageProps[dataKey]) {
        const val = pageProps[dataKey];
        if (Array.isArray(val) && val.length > 0) return val;
        if (val?.data && Array.isArray(val.data)) {
          console.log(`[CryptoRankScraper] Found ${val.data.length} items in ${dataKey}.data`);
          return val.data;
        }
      }

      // Поиск по известным ключам
      for (const key of knownKeys) {
        if (pageProps[key]) {
          const val = pageProps[key];
          if (Array.isArray(val) && val.length > 0) {
            console.log(`[CryptoRankScraper] Found ${val.length} items in ${key}`);
            return val;
          }
          if (val?.data && Array.isArray(val.data) && val.data.length > 0) {
            console.log(`[CryptoRankScraper] Found ${val.data.length} items in ${key}.data`);
            return val.data;
          }
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DYNAMIC DATASET FINDER
  // ═══════════════════════════════════════════════════════════════

  private findDataset(obj: any, keys: string[], maxDepth: number = 10): any[] | null {
    if (maxDepth <= 0) return null;

    // Сначала пробуем новую структуру
    const newData = this.extractFromNewStructure(obj);
    if (newData) return newData;

    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
      const firstItem = obj[0];
      if (keys.some(k => k in firstItem)) {
        return obj;
      }
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        const result = this.findDataset(obj[key], keys, maxDepth - 1);
        if (result && result.length > 0) {
          return result;
        }
      }
    }

    return null;
  }

  private parseTimestamp(value: any): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
      return value < 1e12 ? value : Math.floor(value / 1000);
    }
    if (typeof value === 'string') {
      try {
        const dt = new Date(value);
        return Math.floor(dt.getTime() / 1000);
      } catch {
        return null;
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNDING ROUNDS
  // ═══════════════════════════════════════════════════════════════

  async scrapeFunding(maxPages: number = 1): Promise<CryptoRankFunding[]> {
    console.log(`[CryptoRankScraper] Scraping funding rounds (up to ${maxPages} pages)...`);
    const allFunding: CryptoRankFunding[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const url = `${BASE_URL}/funding-rounds?page=${page}`;

      try {
        const nextData = await this.browserService.extractNextData(url);
        if (!nextData) {
          console.log(`[CryptoRankScraper] No __NEXT_DATA__ on page ${page}`);
          continue;
        }

        // Find funding dataset
        const funding = this.findDataset(nextData, ['raise', 'stage', 'funds', 'date']);

        if (funding && funding.length > 0) {
          const parsed = funding.map((item: any) => this.parseFunding(item)).filter(Boolean);
          allFunding.push(...parsed);
          console.log(`[CryptoRankScraper] Page ${page}: found ${parsed.length} funding rounds`);

          if (funding.length < 20) {
            console.log(`[CryptoRankScraper] Pagination complete at page ${page}`);
            break;
          }
        } else {
          console.log(`[CryptoRankScraper] No funding dataset on page ${page}`);
          break;
        }
      } catch (error) {
        console.error(`[CryptoRankScraper] Error on page ${page}:`, error.message);
      }

      if (page < maxPages) {
        await this.sleep(2000 + Math.random() * 1000);
      }
    }

    console.log(`[CryptoRankScraper] Total funding rounds: ${allFunding.length}`);
    return allFunding;
  }

  // ═══════════════════════════════════════════════════════════════
  // INVESTORS
  // ═══════════════════════════════════════════════════════════════

  async scrapeInvestors(): Promise<CryptoRankInvestor[]> {
    console.log('[CryptoRankScraper] Scraping investors...');

    for (const path of ['/funds', '/investors', '/funds/top']) {
      const url = `${BASE_URL}${path}`;

      try {
        const nextData = await this.browserService.extractNextData(url);
        if (!nextData) continue;

        const investors = this.findDataset(nextData, [
          'slug', 'name', 'count', 'totalInvestments', 'tier', 'logo'
        ]);

        if (investors && investors.length > 0) {
          const parsed = investors.map((item: any) => this.parseInvestor(item)).filter(Boolean);
          console.log(`[CryptoRankScraper] Found ${parsed.length} investors from ${path}`);
          return parsed;
        }
      } catch (error) {
        console.error(`[CryptoRankScraper] Error scraping ${path}:`, error.message);
      }

      await this.sleep(1500);
    }

    console.log('[CryptoRankScraper] No investors found');
    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  // TOKEN UNLOCKS
  // ═══════════════════════════════════════════════════════════════

  async scrapeUnlocks(): Promise<CryptoRankUnlock[]> {
    console.log('[CryptoRankScraper] Scraping unlocks...');

    for (const path of ['/token-unlock', '/vesting']) {
      const url = `${BASE_URL}${path}`;

      try {
        const nextData = await this.browserService.extractNextData(url);
        if (!nextData) continue;

        const unlocks = this.findDataset(nextData, [
          'unlockUsd', 'unlockDate', 'tokensPercent', 'symbol', 'nextUnlock'
        ]);

        if (unlocks && unlocks.length > 0) {
          const parsed = unlocks.map((item: any) => this.parseUnlock(item)).filter(Boolean);
          console.log(`[CryptoRankScraper] Found ${parsed.length} unlocks from ${path}`);
          return parsed;
        }
      } catch (error) {
        console.error(`[CryptoRankScraper] Error scraping ${path}:`, error.message);
      }

      await this.sleep(1500);
    }

    console.log('[CryptoRankScraper] No unlocks found');
    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  async scrapeCategories(): Promise<any[]> {
    console.log('[CryptoRankScraper] Scraping categories...');
    const url = `${BASE_URL}/categories`;

    try {
      const nextData = await this.browserService.extractNextData(url);
      if (!nextData) return [];

      const categories = this.findDataset(nextData, ['id', 'name', 'slug', 'coinsCount']);

      if (categories && categories.length > 0) {
        console.log(`[CryptoRankScraper] Found ${categories.length} categories`);
        return categories.map((cat: any) => ({
          key: `cryptorank:category:${cat.slug || cat.id}`,
          source: 'cryptorank',
          category_id: cat.id,
          name: cat.name,
          slug: cat.slug,
          coins_count: cat.coinsCount || 0,
          market_cap: cat.marketCap,
        }));
      }
    } catch (error) {
      console.error('[CryptoRankScraper] Error scraping categories:', error.message);
    }

    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  // LAUNCHPADS
  // ═══════════════════════════════════════════════════════════════

  async scrapeLaunchpads(): Promise<any[]> {
    console.log('[CryptoRankScraper] Scraping launchpads...');
    const url = `${BASE_URL}/launchpads`;

    try {
      const nextData = await this.browserService.extractNextData(url);
      if (!nextData) return [];

      const launchpads = this.findDataset(nextData, ['key', 'name', 'type', 'roi', 'projectsCount']);

      if (launchpads && launchpads.length > 0) {
        console.log(`[CryptoRankScraper] Found ${launchpads.length} launchpads`);
        return launchpads.map((lp: any) => ({
          key: `cryptorank:launchpad:${lp.key || lp.id}`,
          source: 'cryptorank',
          source_key: lp.key,
          name: lp.name,
          type: lp.type,
          roi: lp.roi,
          projects_count: lp.projectsCount || lp.projects,
          image: lp.image || lp.icon,
        }));
      }
    } catch (error) {
      console.error('[CryptoRankScraper] Error scraping launchpads:', error.message);
    }

    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  // MARKET DATA
  // ═══════════════════════════════════════════════════════════════

  async scrapeMarket(): Promise<any | null> {
    console.log('[CryptoRankScraper] Scraping market data...');
    const url = BASE_URL;

    try {
      const nextData = await this.browserService.extractNextData(url);
      if (!nextData) return null;

      const pageProps = nextData?.props?.pageProps || {};

      // Look for market overview data
      const market = pageProps.market || pageProps.marketOverview || pageProps.stats;

      if (market) {
        console.log('[CryptoRankScraper] Found market data');
        return {
          key: `cryptorank:market:${Date.now()}`,
          source: 'cryptorank',
          timestamp: Date.now(),
          btc_dominance: market.btcDominance,
          eth_dominance: market.ethDominance,
          total_market_cap: market.totalMarketCap,
          total_volume_24h: market.totalVolume24h,
          gas: market.gas,
        };
      }
    } catch (error) {
      console.error('[CryptoRankScraper] Error scraping market:', error.message);
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // SCRAPE ALL
  // ═══════════════════════════════════════════════════════════════

  async scrapeAll(): Promise<any> {
    const start = Date.now();
    console.log('[CryptoRankScraper] Starting FULL scrape (all pages)...');

    // Парсим ВСЕ страницы funding rounds
    const funding = await this.scrapeFunding(50);  // 50 страниц
    await this.sleep(2000);

    // Парсим ВСЕ инвесторы
    const investors = await this.scrapeInvestorsFull();
    await this.sleep(2000);

    // Парсим ВСЕ unlocks
    const unlocks = await this.scrapeUnlocksFull();
    await this.sleep(2000);

    const categories = await this.scrapeCategories();
    await this.sleep(2000);

    const launchpads = await this.scrapeLaunchpads();
    await this.sleep(2000);

    const market = await this.scrapeMarket();

    const elapsed = (Date.now() - start) / 1000;

    const result = {
      ts: Date.now(),
      source: 'cryptorank_puppeteer',
      elapsed_sec: Math.round(elapsed * 100) / 100,
      datasets: {
        funding: { count: funding.length, data: funding },
        investors: { count: investors.length, data: investors },
        unlocks: { count: unlocks.length, data: unlocks },
        categories: { count: categories.length, data: categories },
        launchpads: { count: launchpads.length, data: launchpads },
        market: market,
      },
      summary: {
        funding: funding.length,
        investors: investors.length,
        unlocks: unlocks.length,
        categories: categories.length,
        launchpads: launchpads.length,
        market: market ? 1 : 0,
      },
    };

    console.log(`[CryptoRankScraper] Full scrape complete in ${elapsed.toFixed(1)}s:`, result.summary);
    return result;
  }

  async scrapeInvestorsFull(): Promise<CryptoRankInvestor[]> {
    console.log('[CryptoRankScraper] Scraping ALL investors (multiple pages)...');
    const allInvestors: CryptoRankInvestor[] = [];

    for (let page = 1; page <= 30; page++) {
      const url = `${BASE_URL}/funds?page=${page}`;

      try {
        const nextData = await this.browserService.extractNextData(url);
        if (!nextData) break;

        const investors = this.findDataset(nextData, [
          'slug', 'name', 'count', 'totalInvestments', 'tier', 'logo'
        ]);

        if (investors && investors.length > 0) {
          const parsed = investors.map((item: any) => this.parseInvestor(item)).filter(Boolean);
          allInvestors.push(...parsed);
          console.log(`[CryptoRankScraper] Page ${page}: found ${parsed.length} investors`);

          if (investors.length < 20) break;
        } else {
          break;
        }
      } catch (error) {
        console.error(`[CryptoRankScraper] Error on page ${page}:`, error.message);
        break;
      }

      await this.sleep(2000 + Math.random() * 1000);
    }

    console.log(`[CryptoRankScraper] Total investors: ${allInvestors.length}`);
    return allInvestors;
  }

  async scrapeUnlocksFull(): Promise<CryptoRankUnlock[]> {
    console.log('[CryptoRankScraper] Scraping ALL unlocks (multiple pages)...');
    const allUnlocks: CryptoRankUnlock[] = [];

    for (let page = 1; page <= 20; page++) {
      const url = `${BASE_URL}/token-unlock?page=${page}`;

      try {
        const nextData = await this.browserService.extractNextData(url);
        if (!nextData) break;

        const unlocks = this.findDataset(nextData, [
          'unlockUsd', 'unlockDate', 'tokensPercent', 'symbol', 'nextUnlock'
        ]);

        if (unlocks && unlocks.length > 0) {
          const parsed = unlocks.map((item: any) => this.parseUnlock(item)).filter(Boolean);
          allUnlocks.push(...parsed);
          console.log(`[CryptoRankScraper] Page ${page}: found ${parsed.length} unlocks`);

          if (unlocks.length < 20) break;
        } else {
          break;
        }
      } catch (error) {
        console.error(`[CryptoRankScraper] Error on page ${page}:`, error.message);
        break;
      }

      await this.sleep(2000 + Math.random() * 1000);
    }

    console.log(`[CryptoRankScraper] Total unlocks: ${allUnlocks.length}`);
    return allUnlocks;
  }

  // ═══════════════════════════════════════════════════════════════
  // PARSERS
  // ═══════════════════════════════════════════════════════════════

  private parseFunding(r: any): CryptoRankFunding | null {
    const projectKey = r.key;
    const projectName = r.name;

    if (!projectKey || !projectName) return null;

    const symbol = r.symbol || '';
    const stage = r.stage || 'unknown';
    const date = this.parseTimestamp(r.date);
    const dateStr = r.date || 'nodate';

    const key = `cryptorank:funding:${projectKey}-${stage}-${dateStr}`.toLowerCase();

    // Parse investors from funds array
    const investors: any[] = [];
    const leadInvestors: string[] = [];

    for (const fund of (r.funds || [])) {
      const fundName = fund.name;
      if (!fundName) continue;

      const inv = {
        name: fundName,
        key: fund.key,
        tier: fund.tier,
        type: fund.type,
        category: fund.category?.name || null,
        total_investments: fund.totalInvestments,
      };
      investors.push(inv);

      if (fund.tier === 1) {
        leadInvestors.push(fundName);
      }
    }

    return {
      key,
      source: 'cryptorank',
      project: projectName,
      project_key: projectKey,
      symbol: symbol.toUpperCase() || undefined,
      round: stage,
      date,
      amount: r.raise,
      investors,
      investors_count: investors.length,
      lead_investors: leadInvestors,
    };
  }

  private parseInvestor(inv: any): CryptoRankInvestor | null {
    const slug = inv.slug || inv.key;
    const name = inv.name;

    if (!slug || !name) return null;

    return {
      key: `cryptorank:investor:${slug}`,
      source: 'cryptorank',
      name,
      slug,
      tier: inv.tier,
      type: inv.type,
      category: inv.category?.name || null,
      investments_count: inv.count || inv.totalInvestments || 0,
      image: inv.logo || inv.image,
    };
  }

  private parseUnlock(item: any): CryptoRankUnlock | null {
    const projectKey = item.key;
    const symbol = item.symbol || '';

    if (!projectKey) return null;

    const unlockDate = item.unlockDate || item.date;
    const key = `cryptorank:unlock:${projectKey}:${unlockDate || 'unknown'}`;

    return {
      key,
      source: 'cryptorank',
      project_key: projectKey,
      symbol: symbol.toUpperCase(),
      name: item.name,
      unlock_date: unlockDate,
      unlock_usd: item.unlockUsd,
      tokens_percent: item.tokensPercent,
      allocation: item.allocation || item.type,
    };
  }
}
