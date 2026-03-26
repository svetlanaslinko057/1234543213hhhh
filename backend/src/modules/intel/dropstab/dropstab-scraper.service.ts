import { Injectable } from '@nestjs/common';
import { BrowserService } from '../../../common/browser.service';

const BASE_URL = 'https://dropstab.com';

export interface CoinData {
  symbol: string;
  slug: string;
  name: string;
  image?: string;
  price_usd?: number;
  market_cap?: number;
  fully_diluted_valuation?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
  market_cap_rank?: number;
  raw?: any;
}

export interface UnlockData {
  key: string;
  slug: string;
  symbol: string;
  name: string;
  unlock_date?: string;
  unlock_percent?: number;
  unlock_usd?: number;
  tokens_amount?: number;
  allocation?: string;
  raw?: any;
}

export interface InvestorData {
  key: string;
  slug: string;
  name: string;
  tier?: number;
  type?: string;
  image?: string;
  investments_count?: number;
  portfolio_value?: number;
  website?: string;
  twitter?: string;
  linkedin?: string;
  description?: string;
  raw?: any;
}

export interface FundingData {
  key: string;
  project: string;
  symbol: string;
  round?: string;
  date?: number;
  amount?: number;
  valuation?: number;
  investors?: string[];
  lead_investor?: string;
  raw?: any;
}

@Injectable()
export class DropstabScraperService {
  private readonly maxRetries = 5;

  constructor(private readonly browserService: BrowserService) {}

  // ═══════════════════════════════════════════════════════════════
  // DYNAMIC DATASET FINDER (key feature from Python v2)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Extract data from new Dropstab structure (2025-2026)
   * Data is now in various locations depending on page type
   */
  private extractFromNewStructure(nextData: any): any[] | null {
    try {
      // Новая структура Dropstab 2025-2026
      const pageProps = nextData?.props?.pageProps;
      if (!pageProps) return null;

      // coinsBody.coins - главная страница с монетами
      if (pageProps.coinsBody?.coins) {
        const coins = pageProps.coinsBody.coins;
        if (Array.isArray(coins) && coins.length > 0) {
          console.log(`[DropstabScraper] Found ${coins.length} items in coinsBody.coins`);
          return coins;
        }
      }

      // fallbackBody.content - investors, fundraising
      if (pageProps.fallbackBody?.content) {
        const content = pageProps.fallbackBody.content;
        if (Array.isArray(content) && content.length > 0) {
          console.log(`[DropstabScraper] Found ${content.length} items in fallbackBody.content`);
          return content;
        }
      }

      // Альтернативные пути
      const altPaths = [
        'fallbackTopGainers', 'fallbackActivities',
        'fallbackCoins', 'fallbackInvestorsList', 'fallbackFundraisingList',
        'fallbackUnlocks', 'fallbackVesting', 'fallbackCategories',
        'coins', 'investors', 'fundraising', 'unlocks', 'data'
      ];

      for (const path of altPaths) {
        if (pageProps[path]) {
          const data = pageProps[path];
          if (Array.isArray(data) && data.length > 0) {
            console.log(`[DropstabScraper] Found ${data.length} items in ${path}`);
            return data;
          }
          if (data?.content && Array.isArray(data.content)) {
            console.log(`[DropstabScraper] Found ${data.content.length} items in ${path}.content`);
            return data.content;
          }
          if (data?.coins && Array.isArray(data.coins)) {
            console.log(`[DropstabScraper] Found ${data.coins.length} items in ${path}.coins`);
            return data.coins;
          }
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Dynamic dataset finder - searches recursively for lists
   * containing objects with specified keys.
   * This makes the scraper resilient to structure changes.
   */
  private findDataset(obj: any, keys: string[], maxDepth: number = 10): any[] | null {
    if (maxDepth <= 0) return null;

    // Сначала пробуем новую структуру
    const newData = this.extractFromNewStructure(obj);
    if (newData) return newData;

    // If it's a list with objects containing our keys
    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
      const firstItem = obj[0];
      if (keys.some(k => k in firstItem)) {
        return obj;
      }
    }

    // Recurse into objects
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

  private getUsd(data: any): number | null {
    if (data === null || data === undefined) return null;
    if (typeof data === 'object' && data.USD !== undefined) {
      const val = parseFloat(data.USD);
      return isNaN(val) ? null : val;
    }
    const val = parseFloat(data);
    return isNaN(val) ? null : val;
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

  private computeHash(data: any): string {
    const crypto = require('crypto');
    const str = JSON.stringify(data);
    return crypto.createHash('sha1').update(str).digest('hex').slice(0, 12);
  }

  // ═══════════════════════════════════════════════════════════════
  // COINS / MARKET DATA
  // ═══════════════════════════════════════════════════════════════

  async scrapeCoins(maxPages: number = 1): Promise<CoinData[]> {
    console.log(`[DropstabScraper] Scraping coins (up to ${maxPages} pages)...`);
    const allCoins: CoinData[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const path = page === 1 ? '/' : `/?page=${page}`;
      const url = `${BASE_URL}${path}`;

      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          const nextData = await this.browserService.extractNextData(url);
          if (!nextData) {
            console.log(`[DropstabScraper] No __NEXT_DATA__ on page ${page}, attempt ${attempt + 1}`);
            await this.sleep((attempt + 1) * 2000);
            continue;
          }

          // Dynamic search for coin dataset
          const coins = this.findDataset(nextData, ['symbol', 'price', 'rank', 'marketCap', 'name']);

          if (coins && coins.length > 0) {
            const parsed = coins.map((item: any) => this.parseCoin(item)).filter(Boolean);
            allCoins.push(...parsed);
            console.log(`[DropstabScraper] Page ${page}: found ${parsed.length} coins`);
            break;
          }

          console.log(`[DropstabScraper] No coins dataset on page ${page}`);
          break;
        } catch (error) {
          console.error(`[DropstabScraper] Error on page ${page}:`, error.message);
          await this.sleep((attempt + 1) * 2000);
        }
      }

      // Pagination complete if no new coins
      if (page > 1 && allCoins.length === (page - 1) * 100) {
        console.log(`[DropstabScraper] Pagination complete at page ${page}`);
        break;
      }

      // Rate limit between pages
      if (page < maxPages) {
        await this.sleep(1500 + Math.random() * 1000);
      }
    }

    console.log(`[DropstabScraper] Total coins scraped: ${allCoins.length}`);
    return allCoins;
  }

  // ═══════════════════════════════════════════════════════════════
  // TOKEN UNLOCKS (VESTING)
  // ═══════════════════════════════════════════════════════════════

  async scrapeUnlocks(): Promise<UnlockData[]> {
    console.log('[DropstabScraper] Scraping unlocks...');

    // Try multiple paths
    for (const path of ['/vesting', '/unlock']) {
      const url = `${BASE_URL}${path}`;

      try {
        const nextData = await this.browserService.extractNextData(url);
        if (!nextData) continue;

        // Dynamic search for unlock dataset
        const unlocks = this.findDataset(nextData, [
          'unlockDate', 'unlockAmount', 'allocation',
          'vestingEvent', 'unlock', 'nextUnlock'
        ]);

        if (unlocks && unlocks.length > 0) {
          const parsed = unlocks.map((item: any) => this.parseUnlock(item)).filter(Boolean);
          console.log(`[DropstabScraper] Found ${parsed.length} unlocks from ${path}`);
          return parsed;
        }
      } catch (error) {
        console.error(`[DropstabScraper] Error scraping ${path}:`, error.message);
      }

      await this.sleep(1500);
    }

    console.log('[DropstabScraper] No unlocks found');
    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  // INVESTORS
  // ═══════════════════════════════════════════════════════════════

  async scrapeInvestors(maxPages: number = 10): Promise<InvestorData[]> {
    console.log(`[DropstabScraper] Scraping investors (max ${maxPages} pages)...`);
    
    const allInvestors: InvestorData[] = [];
    const seenSlugs = new Set<string>();

    // Получаем первую страницу чтобы узнать общее количество
    const firstUrl = `${BASE_URL}/investors`;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const nextData = await this.browserService.extractNextData(firstUrl);
        if (!nextData) break;

        const pageProps = nextData?.props?.pageProps;
        const body = pageProps?.fallbackBody;
        
        if (body?.content && Array.isArray(body.content)) {
          const investors = body.content;
          const totalElements = body.totalElements || investors.length;
          const totalPages = body.totalPages || 1;
          
          console.log(`[DropstabScraper] Total investors on site: ${totalElements} in ${totalPages} pages`);
          
          // Парсим первую страницу
          for (const item of investors) {
            const parsed = this.parseInvestor(item);
            if (parsed && !seenSlugs.has(parsed.slug)) {
              seenSlugs.add(parsed.slug);
              allInvestors.push(parsed);
            }
          }
          console.log(`[DropstabScraper] Page 1: got ${investors.length} investors, unique: ${allInvestors.length}`);
          
          // Dropstab fallback возвращает только первые 20 (страница 0)
          // Реальная пагинация через клиентский API не доступна через SSR
          // Используем то что есть
          break;
        }
        break;
      } catch (error) {
        console.error(`[DropstabScraper] Error scraping investors:`, error.message);
        await this.sleep((attempt + 1) * 2000);
      }
    }

    console.log(`[DropstabScraper] Total unique investors scraped: ${allInvestors.length}`);
    return allInvestors;
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNDRAISING
  // ═══════════════════════════════════════════════════════════════

  async scrapeFundraising(maxPages: number = 20): Promise<FundingData[]> {
    console.log(`[DropstabScraper] Scraping fundraising (max ${maxPages} pages)...`);
    
    const allFunding: FundingData[] = [];

    // Dropstab fundraising с пагинацией
    for (let page = 1; page <= maxPages; page++) {
      const url = page === 1 
        ? `${BASE_URL}/latest-fundraising-rounds`
        : `${BASE_URL}/latest-fundraising-rounds?page=${page}`;

      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          const nextData = await this.browserService.extractNextData(url);
          if (!nextData) {
            console.log(`[DropstabScraper] No data on fundraising page ${page}`);
            break;
          }

          const funding = this.findDataset(nextData, [
            'raised', 'round', 'valuation', 'investors',
            'fundingRound', 'stage', 'amountRaised', 'fundsRaised'
          ]);

          if (funding && funding.length > 0) {
            const parsed = funding.map((item: any) => this.parseFunding(item)).filter(Boolean);
            allFunding.push(...parsed);
            console.log(`[DropstabScraper] Page ${page}: found ${parsed.length} funding rounds`);
            
            // Если меньше 50 записей - последняя страница
            if (funding.length < 50) {
              console.log(`[DropstabScraper] Last page of fundraising reached`);
              return allFunding;
            }
            break;
          } else {
            console.log(`[DropstabScraper] No funding on page ${page}`);
            return allFunding;
          }
        } catch (error) {
          console.error(`[DropstabScraper] Error on fundraising page ${page}:`, error.message);
          await this.sleep((attempt + 1) * 2000);
        }
      }

      // Rate limit between pages
      if (page < maxPages) {
        await this.sleep(1500 + Math.random() * 1000);
      }
    }

    console.log(`[DropstabScraper] Total funding rounds scraped: ${allFunding.length}`);
    return allFunding;
  }

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  async scrapeCategories(): Promise<any[]> {
    console.log('[DropstabScraper] Scraping categories...');
    const url = `${BASE_URL}/categories`;

    try {
      const nextData = await this.browserService.extractNextData(url);
      if (!nextData) return [];

      const categories = this.findDataset(nextData, ['name', 'slug', 'coinsCount', 'marketCap']);

      if (categories && categories.length > 0) {
        console.log(`[DropstabScraper] Found ${categories.length} categories`);
        return categories;
      }
    } catch (error) {
      console.error('[DropstabScraper] Error scraping categories:', error.message);
    }

    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  // TOP PERFORMANCE (GAINERS/LOSERS)
  // ═══════════════════════════════════════════════════════════════

  async scrapeTopPerformance(): Promise<{ gainers: any[]; losers: any[] }> {
    console.log('[DropstabScraper] Scraping top performance...');
    const url = `${BASE_URL}/top-performance`;

    try {
      const nextData = await this.browserService.extractNextData(url);
      if (!nextData) return { gainers: [], losers: [] };

      // Find gainers/losers - usually in separate arrays
      const pageProps = nextData?.props?.pageProps || {};
      
      const result = {
        gainers: pageProps.gainers || pageProps.topGainers || [],
        losers: pageProps.losers || pageProps.topLosers || [],
      };

      // Try dynamic search if direct props not found
      if (!result.gainers.length) {
        result.gainers = this.findDataset(nextData, ['symbol', 'change', 'price']) || [];
      }

      console.log(`[DropstabScraper] Found ${result.gainers.length} gainers, ${result.losers.length} losers`);
      return result;
    } catch (error) {
      console.error('[DropstabScraper] Error scraping top performance:', error.message);
      return { gainers: [], losers: [] };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTIVITIES
  // ═══════════════════════════════════════════════════════════════

  async scrapeActivities(): Promise<any[]> {
    console.log('[DropstabScraper] Scraping activities...');
    const url = `${BASE_URL}/activities`;

    try {
      const nextData = await this.browserService.extractNextData(url);
      if (!nextData) return [];

      const activities = this.findDataset(nextData, ['type', 'date', 'title', 'exchange', 'listing']);

      if (activities && activities.length > 0) {
        console.log(`[DropstabScraper] Found ${activities.length} activities`);
        return activities;
      }
    } catch (error) {
      console.error('[DropstabScraper] Error scraping activities:', error.message);
    }

    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  // COIN DETAIL
  // ═══════════════════════════════════════════════════════════════

  async scrapeCoinDetail(slug: string): Promise<any | null> {
    console.log(`[DropstabScraper] Scraping coin detail: ${slug}`);
    const url = `${BASE_URL}/coins/${slug}`;

    try {
      const nextData = await this.browserService.extractNextData(url);
      if (!nextData) return null;

      const pageProps = nextData?.props?.pageProps || {};
      return pageProps.coin || pageProps.currency || pageProps.data || pageProps;
    } catch (error) {
      console.error(`[DropstabScraper] Error scraping ${slug}:`, error.message);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SCRAPE ALL - Full pipeline
  // ═══════════════════════════════════════════════════════════════

  async scrapeAll(): Promise<any> {
    const start = Date.now();
    console.log('[DropstabScraper] Starting full scrape...');

    const coins = await this.scrapeCoins(1); // First page only for quick test
    await this.sleep(1500);

    const unlocks = await this.scrapeUnlocks();
    await this.sleep(1500);

    const funding = await this.scrapeFundraising();
    await this.sleep(1500);

    const investors = await this.scrapeInvestors();
    await this.sleep(1500);

    const categories = await this.scrapeCategories();

    const elapsed = (Date.now() - start) / 1000;

    const result = {
      ts: Date.now(),
      source: 'dropstab_puppeteer',
      elapsed_sec: Math.round(elapsed * 100) / 100,
      datasets: {
        coins: {
          count: coins.length,
          hash: coins.length ? this.computeHash(coins) : null,
          data: coins,
        },
        unlocks: {
          count: unlocks.length,
          hash: unlocks.length ? this.computeHash(unlocks) : null,
          data: unlocks,
        },
        funding: {
          count: funding.length,
          hash: funding.length ? this.computeHash(funding) : null,
          data: funding,
        },
        investors: {
          count: investors.length,
          hash: investors.length ? this.computeHash(investors) : null,
          data: investors,
        },
        categories: {
          count: categories.length,
          hash: categories.length ? this.computeHash(categories) : null,
          data: categories,
        },
      },
      summary: {
        coins: coins.length,
        unlocks: unlocks.length,
        funding: funding.length,
        investors: investors.length,
        categories: categories.length,
      },
    };

    console.log(`[DropstabScraper] Full scrape complete in ${elapsed.toFixed(1)}s:`, result.summary);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // PARSERS
  // ═══════════════════════════════════════════════════════════════

  private parseCoin(item: any): CoinData | null {
    if (!item) return null;

    const symbol = String(item.symbol || '').toUpperCase();
    const slug = item.slug || symbol.toLowerCase();

    if (!symbol && !slug) return null;

    // Handle nested price/volume/change
    const priceUsd = this.getUsd(item.price);
    const marketCap = this.getUsd(item.marketCap);
    const fdv = this.getUsd(item.fdvMarketCap) || this.getUsd(item.fdv);

    // Volume is nested: volume.1D.USD
    let volumeUsd: number | null = null;
    if (typeof item.volume === 'object' && item.volume?.['1D']) {
      volumeUsd = this.getUsd(item.volume['1D']);
    }

    // Change is nested: change.1D.USD
    let change24h: number | null = null;
    if (typeof item.change === 'object' && item.change?.['1D']) {
      change24h = this.getUsd(item.change['1D']);
    }

    return {
      symbol,
      slug,
      name: item.name || '',
      image: item.image,
      price_usd: priceUsd,
      market_cap: marketCap,
      fully_diluted_valuation: fdv,
      total_volume: volumeUsd,
      price_change_percentage_24h: change24h,
      market_cap_rank: item.rank,
      raw: item,
    };
  }

  private parseUnlock(item: any): UnlockData | null {
    if (!item) return null;

    const symbol = String(item.symbol || item.ticker || '').toUpperCase();
    const slug = item.slug || item.project || symbol.toLowerCase();
    const unlockDate = item.unlockDate || item.date || item.nextUnlock;

    const key = `dropstab:unlock:${slug}:${unlockDate || 'unknown'}`;

    return {
      key,
      slug,
      symbol,
      name: item.name || item.projectName || '',
      unlock_date: unlockDate,
      unlock_percent: item.unlockPercent || item.percent,
      unlock_usd: item.unlockAmount || item.unlockUsd || item.value,
      tokens_amount: item.tokensAmount || item.amount,
      allocation: item.allocation || item.type,
      raw: item,
    };
  }

  private parseInvestor(item: any): InvestorData | null {
    if (!item) return null;

    // Новая структура Dropstab 2025-2026
    const name = item.name || item.title || item.fundName || 'unknown';
    const slug = item.investorSlug || item.slug || item.id?.toString() || name.toLowerCase().replace(/\s+/g, '-');

    const key = `dropstab:investor:${slug}`;

    // Извлекаем twitter из links или напрямую
    let twitter = item.twitterUrl || item.twitter;
    if (!twitter && item.links) {
      const twitterLink = item.links.find((l: any) => l.link?.includes('twitter') || l.link?.includes('x.com'));
      twitter = twitterLink?.link;
    }

    return {
      key,
      slug,
      name,
      tier: item.rating || item.tier || item.rank,
      type: item.ventureType || item.type,
      image: item.logo || item.image || item.logoUrl,
      investments_count: item.investmentsCount || item.investments || item.totalInvestments || item.projectsCount || 0,
      portfolio_value: item.portfolioValue || item.aum,
      website: item.websiteUrl || item.website,
      twitter,
      linkedin: item.linkedinUrl || item.linkedin,
      description: item.description || item.bio,
      raw: item,
    };
  }

  private parseFunding(item: any): FundingData | null {
    if (!item) return null;

    // Новая структура - symbol может быть пустым, используем slug
    const symbol = String(item.symbol || item.ticker || '').toUpperCase();
    const slug = item.slug || item.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
    
    const project = item.name || item.projectName || item.project || slug;
    const roundName = item.stage || item.round || item.roundName || 'unknown';
    const date = this.parseTimestamp(item.date || item.fundingDate || item.announcedDate || item.saleDate);

    const key = `dropstab:funding:${slug}:${roundName}:${date || 'nodate'}`;

    // Parse investors list - новая структура
    const investors: string[] = [];
    const invData = item.investors || item.leadInvestors || [];
    if (Array.isArray(invData)) {
      for (const inv of invData) {
        if (typeof inv === 'string') {
          investors.push(inv);
        } else if (typeof inv === 'object' && inv) {
          investors.push(inv.name || inv.fundName || String(inv));
        }
      }
    }

    return {
      key,
      project,
      symbol: symbol || slug.toUpperCase(),
      round: roundName,
      date,
      amount: item.fundsRaised || item.amount || item.raised || item.fundingAmount,
      valuation: item.preValuation || item.valuation || item.postValuation,
      investors,
      lead_investor: item.leadInvestor || (investors[0] || null),
      raw: item,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
