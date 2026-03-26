/**
 * CryptoRank API Service - Direct API calls for data extraction
 * 
 * Uses _next/data endpoint for server-side data without full page render
 * Fallback to __NEXT_DATA__ extraction via Puppeteer
 */

import axios, { AxiosInstance } from 'axios';
import { NormalizedFunding, NormalizedInvestor, NormalizedUnlock } from '../common/parser.types';

const BASE_URL = 'https://cryptorank.io';

export class CryptoRankApiService {
  private client: AxiosInstance;
  private buildId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Accept': 'application/json, text/html',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://cryptorank.io/',
      },
    });
  }

  /**
   * Get Next.js build ID from page (needed for _next/data endpoint)
   */
  async getBuildId(): Promise<string | null> {
    if (this.buildId) return this.buildId;

    try {
      const response = await this.client.get('/funding-rounds');
      const html = response.data;
      
      // Extract buildId from __NEXT_DATA__
      const match = html.match(/"buildId":"([^"]+)"/);
      if (match) {
        this.buildId = match[1];
        console.log(`[CryptoRankAPI] Found buildId: ${this.buildId}`);
        return this.buildId;
      }

      // Try alternative pattern
      const altMatch = html.match(/_next\/static\/([a-zA-Z0-9_-]+)\/_buildManifest/);
      if (altMatch) {
        this.buildId = altMatch[1];
        console.log(`[CryptoRankAPI] Found buildId (alt): ${this.buildId}`);
        return this.buildId;
      }

      return null;
    } catch (error) {
      console.error('[CryptoRankAPI] Failed to get buildId:', error.message);
      return null;
    }
  }

  /**
   * Fetch funding rounds via _next/data endpoint
   */
  async fetchFundingRoundsPage(page = 1): Promise<{
    items: any[];
    totalPages: number;
    totalElements: number;
    hasMore: boolean;
  }> {
    const buildId = await this.getBuildId();
    
    if (!buildId) {
      // Fallback: fetch HTML and extract __NEXT_DATA__
      return this.fetchFundingRoundsFromHtml(page);
    }

    try {
      const url = `/_next/data/${buildId}/funding-rounds.json?page=${page}`;
      const response = await this.client.get(url);
      const data = response.data;

      const pageProps = data.pageProps || data;
      let rounds = pageProps.fallbackRounds || [];
      
      // Handle if fallbackRounds is an object with data array
      if (rounds.data && Array.isArray(rounds.data)) {
        rounds = rounds.data;
      }

      // Try initData if fallbackRounds is empty
      if (!Array.isArray(rounds) || rounds.length === 0) {
        const initData = pageProps.initData || {};
        rounds = initData.data || [];
      }

      const pagination = pageProps.initData?.pagination || {};
      
      return {
        items: Array.isArray(rounds) ? rounds : [],
        totalPages: pagination.totalPages || Math.ceil((pagination.total || 10000) / 20),
        totalElements: pagination.total || 10000,
        hasMore: !pagination.last && page < (pagination.totalPages || 500),
      };
    } catch (error) {
      console.log(`[CryptoRankAPI] _next/data failed for page ${page}: ${error.message}`);
      return this.fetchFundingRoundsFromHtml(page);
    }
  }

  /**
   * Fallback: Fetch from HTML and extract __NEXT_DATA__
   */
  private async fetchFundingRoundsFromHtml(page = 1): Promise<{
    items: any[];
    totalPages: number;
    totalElements: number;
    hasMore: boolean;
  }> {
    try {
      const response = await this.client.get(`/funding-rounds?page=${page}`);
      const html = response.data;

      // Extract __NEXT_DATA__
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
      if (!match) {
        return { items: [], totalPages: 1, totalElements: 0, hasMore: false };
      }

      const data = JSON.parse(match[1]);
      const pageProps = data.props?.pageProps || {};
      
      let rounds = pageProps.fallbackRounds || [];
      if (rounds.data && Array.isArray(rounds.data)) {
        rounds = rounds.data;
      }

      return {
        items: Array.isArray(rounds) ? rounds : [],
        totalPages: 500,
        totalElements: 10000,
        hasMore: page < 500,
      };
    } catch (error) {
      console.error(`[CryptoRankAPI] HTML fetch failed for page ${page}:`, error.message);
      return { items: [], totalPages: 1, totalElements: 0, hasMore: false };
    }
  }

  /**
   * Fetch all funding rounds with pagination
   */
  async fetchAllFundingRounds(maxPages = 100): Promise<NormalizedFunding[]> {
    console.log(`[CryptoRankAPI] Fetching all funding rounds (max ${maxPages} pages)...`);
    
    const allRounds: NormalizedFunding[] = [];
    const seenIds = new Set<string>();
    let currentPage = 1;
    let consecutiveEmpty = 0;

    while (currentPage <= maxPages) {
      try {
        const data = await this.fetchFundingRoundsPage(currentPage);
        
        if (data.items.length === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) {
            console.log(`[CryptoRankAPI] 3 consecutive empty pages, stopping`);
            break;
          }
          currentPage++;
          await this.sleep(1000);
          continue;
        }

        consecutiveEmpty = 0;
        let newItems = 0;

        for (const item of data.items) {
          const normalized = this.normalizeFunding(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allRounds.push(normalized);
            newItems++;
          }
        }

        console.log(`[CryptoRankAPI] Page ${currentPage}: ${data.items.length} items, ${newItems} new, total: ${allRounds.length}`);

        if (!data.hasMore || newItems === 0) {
          console.log(`[CryptoRankAPI] No more data or no new items`);
          break;
        }

        currentPage++;
        await this.sleep(800 + Math.random() * 400);
      } catch (error) {
        console.error(`[CryptoRankAPI] Error on page ${currentPage}:`, error.message);
        currentPage++;
        await this.sleep(2000);
      }
    }

    console.log(`[CryptoRankAPI] Collected ${allRounds.length} unique funding rounds`);
    return allRounds;
  }

  /**
   * Fetch investors/funds
   */
  async fetchAllInvestors(maxPages = 50): Promise<NormalizedInvestor[]> {
    console.log(`[CryptoRankAPI] Fetching all investors (max ${maxPages} pages)...`);
    
    const allInvestors: NormalizedInvestor[] = [];
    const seenIds = new Set<string>();
    let currentPage = 1;

    while (currentPage <= maxPages) {
      try {
        const buildId = await this.getBuildId();
        let items: any[] = [];

        if (buildId) {
          try {
            const url = `/_next/data/${buildId}/funds.json?page=${currentPage}`;
            const response = await this.client.get(url);
            const pageProps = response.data.pageProps || response.data;
            let rawItems = pageProps.fallbackFunds || pageProps.funds || [];
            if ((rawItems as any).data && Array.isArray((rawItems as any).data)) {
              rawItems = (rawItems as any).data;
            }
            items = rawItems;
          } catch (e) {
            // Fallback to HTML
          }
        }

        if (items.length === 0) {
          // HTML fallback
          const response = await this.client.get(`/funds?page=${currentPage}`);
          const match = response.data.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
          if (match) {
            const data = JSON.parse(match[1]);
            const pageProps = data.props?.pageProps || {};
            let rawItems = pageProps.fallbackFunds || [];
            if ((rawItems as any).data) rawItems = (rawItems as any).data;
            items = rawItems;
          }
        }

        if (!Array.isArray(items) || items.length === 0) {
          console.log(`[CryptoRankAPI] No investors on page ${currentPage}, stopping`);
          break;
        }

        let newItems = 0;
        for (const item of items) {
          const normalized = this.normalizeInvestor(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allInvestors.push(normalized);
            newItems++;
          }
        }

        console.log(`[CryptoRankAPI] Page ${currentPage}: ${items.length} items, ${newItems} new, total: ${allInvestors.length}`);

        if (newItems === 0) break;

        currentPage++;
        await this.sleep(800 + Math.random() * 400);
      } catch (error) {
        console.error(`[CryptoRankAPI] Error on page ${currentPage}:`, error.message);
        break;
      }
    }

    console.log(`[CryptoRankAPI] Collected ${allInvestors.length} unique investors`);
    return allInvestors;
  }

  /**
   * Fetch unlocks
   */
  async fetchAllUnlocks(maxPages = 20): Promise<NormalizedUnlock[]> {
    console.log(`[CryptoRankAPI] Fetching all unlocks (max ${maxPages} pages)...`);
    
    const allUnlocks: NormalizedUnlock[] = [];
    const seenIds = new Set<string>();
    let currentPage = 1;

    while (currentPage <= maxPages) {
      try {
        const buildId = await this.getBuildId();
        let items: any[] = [];

        if (buildId) {
          try {
            const url = `/_next/data/${buildId}/token-unlock.json?page=${currentPage}`;
            const response = await this.client.get(url);
            const pageProps = response.data.pageProps || response.data;
            let rawItems = pageProps.fallbackUnlocks || pageProps.unlocks || [];
            if ((rawItems as any).data) rawItems = (rawItems as any).data;
            items = rawItems;
          } catch (e) {
            // Fallback to HTML
          }
        }

        if (items.length === 0) {
          const response = await this.client.get(`/token-unlock?page=${currentPage}`);
          const match = response.data.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
          if (match) {
            const data = JSON.parse(match[1]);
            const pageProps = data.props?.pageProps || {};
            let rawItems = pageProps.fallbackUnlocks || [];
            if ((rawItems as any).data) rawItems = (rawItems as any).data;
            items = rawItems;
          }
        }

        if (!Array.isArray(items) || items.length === 0) {
          console.log(`[CryptoRankAPI] No unlocks on page ${currentPage}, stopping`);
          break;
        }

        let newItems = 0;
        for (const item of items) {
          const normalized = this.normalizeUnlock(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allUnlocks.push(normalized);
            newItems++;
          }
        }

        console.log(`[CryptoRankAPI] Page ${currentPage}: ${items.length} items, ${newItems} new, total: ${allUnlocks.length}`);

        if (newItems === 0) break;

        currentPage++;
        await this.sleep(800 + Math.random() * 400);
      } catch (error) {
        console.error(`[CryptoRankAPI] Error on page ${currentPage}:`, error.message);
        break;
      }
    }

    console.log(`[CryptoRankAPI] Collected ${allUnlocks.length} unique unlocks`);
    return allUnlocks;
  }

  /**
   * Normalize funding round
   */
  private normalizeFunding(item: any): NormalizedFunding | null {
    if (!item) return null;

    const projectKey = item.key || item.slug;
    const project = item.name || item.projectName;
    if (!projectKey && !project) return null;

    const symbol = item.symbol || '';
    const stage = item.stage || item.round || 'unknown';
    const date = this.parseTimestamp(item.date || item.fundingDate);

    const externalId = item.id?.toString() || `${projectKey || project}-${stage}-${date || 'nodate'}`;
    const key = `cryptorank:funding:${externalId}`.toLowerCase();

    // Parse investors
    const investors: any[] = [];
    const leadInvestors: string[] = [];

    const fundSources = [item.funds, item.investors, item.leadInvestors].filter(Boolean);
    
    for (const funds of fundSources) {
      if (!Array.isArray(funds)) continue;
      
      for (const fund of funds) {
        const fundName = fund.name;
        if (!fundName || investors.find(i => i.name === fundName)) continue;

        investors.push({
          name: fundName,
          key: fund.key,
          slug: fund.slug,
          tier: fund.tier,
          type: fund.type,
        });

        if (fund.tier === 1 || fund.lead) {
          leadInvestors.push(fundName);
        }
      }
    }

    return {
      key,
      externalId,
      source: 'cryptorank',
      project: project || projectKey,
      project_key: projectKey || project?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      symbol: symbol.toUpperCase() || undefined,
      round: stage,
      date,
      amount: item.raise || item.amount,
      valuation: item.valuation,
      investors,
      investors_count: investors.length,
      lead_investors: leadInvestors,
      category: item.category?.name || item.category,
      updated_at: new Date(),
    };
  }

  /**
   * Normalize investor
   */
  private normalizeInvestor(item: any): NormalizedInvestor | null {
    if (!item) return null;

    const name = item.name;
    const slug = item.slug || item.key;
    if (!name || !slug) return null;

    const externalId = item.id?.toString() || slug;
    const key = `cryptorank:investor:${slug}`;

    return {
      key,
      externalId,
      source: 'cryptorank',
      name,
      slug,
      tier: item.tier,
      type: item.type,
      category: item.category?.name || null,
      image: item.logo || item.image,
      investments_count: item.count || item.totalInvestments || 0,
      portfolio_value: item.portfolioValue,
      website: item.website,
      twitter: item.twitter,
      description: item.description,
      updated_at: new Date(),
    };
  }

  /**
   * Normalize unlock
   */
  private normalizeUnlock(item: any): NormalizedUnlock | null {
    if (!item) return null;

    const projectKey = item.key;
    const symbol = item.symbol || '';
    if (!projectKey) return null;

    const unlockDate = item.unlockDate || item.date;
    const externalId = item.id?.toString() || `${projectKey}-${unlockDate || 'unknown'}`;
    const key = `cryptorank:unlock:${externalId}`;

    return {
      key,
      externalId,
      source: 'cryptorank',
      project_key: projectKey,
      symbol: symbol.toUpperCase(),
      name: item.name,
      unlock_date: unlockDate,
      unlock_usd: item.unlockUsd,
      tokens_percent: item.tokensPercent,
      allocation: item.allocation || item.type,
      updated_at: new Date(),
    };
  }

  private parseTimestamp(value: any): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
      return value < 1e12 ? value : Math.floor(value / 1000);
    }
    if (typeof value === 'string') {
      try {
        return Math.floor(new Date(value).getTime() / 1000);
      } catch {
        return null;
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
