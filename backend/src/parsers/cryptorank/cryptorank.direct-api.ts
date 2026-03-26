/**
 * CryptoRank Direct API Service - Using discovered v0 API endpoints
 * 
 * WORKING ENDPOINTS:
 * POST https://api.cryptorank.io/v0/funding-rounds-v2
 *   Body: { "limit": 20, "skip": N }
 *   Returns: { "total": 10937, "data": [...] }
 */

import axios, { AxiosInstance } from 'axios';
import { NormalizedFunding, NormalizedInvestor, NormalizedUnlock } from '../common/parser.types';

const API_BASE = 'https://api.cryptorank.io/v0';

export class CryptoRankDirectApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://cryptorank.io/',
        'Origin': 'https://cryptorank.io',
      },
    });
  }

  /**
   * Fetch funding rounds with pagination
   * Uses POST /funding-rounds-v2 with { limit, skip }
   */
  async fetchFundingRounds(skip = 0, limit = 20): Promise<{
    total: number;
    data: any[];
  }> {
    try {
      const response = await this.client.post('/funding-rounds-v2', {
        limit,
        skip,
      });
      
      return {
        total: response.data.total || 0,
        data: response.data.data || [],
      };
    } catch (error) {
      console.error(`[CryptoRankDirectAPI] Error fetching funding rounds (skip=${skip}):`, error.message);
      throw error;
    }
  }

  /**
   * Fetch ALL funding rounds with pagination
   */
  async fetchAllFundingRounds(maxRecords = 5000): Promise<NormalizedFunding[]> {
    console.log(`[CryptoRankDirectAPI] Fetching all funding rounds (max ${maxRecords})...`);
    
    const allRounds: NormalizedFunding[] = [];
    const seenIds = new Set<string>();
    let skip = 0;
    const limit = 50;
    let total = 0;
    let consecutiveEmpty = 0;

    while (allRounds.length < maxRecords) {
      try {
        const result = await this.fetchFundingRounds(skip, limit);
        
        if (skip === 0) {
          total = result.total;
          console.log(`[CryptoRankDirectAPI] Total available: ${total}`);
        }

        if (result.data.length === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) {
            console.log(`[CryptoRankDirectAPI] 3 consecutive empty responses, stopping`);
            break;
          }
          skip += limit;
          await this.sleep(1000);
          continue;
        }

        consecutiveEmpty = 0;
        let newItems = 0;

        for (const item of result.data) {
          const normalized = this.normalizeFunding(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allRounds.push(normalized);
            newItems++;
          }
        }

        const progress = Math.round((skip / total) * 100);
        console.log(`[CryptoRankDirectAPI] Skip ${skip}: ${result.data.length} items, ${newItems} new, total: ${allRounds.length}/${total} (${progress}%)`);

        if (skip + limit >= total) {
          console.log(`[CryptoRankDirectAPI] Reached end of data`);
          break;
        }

        skip += limit;
        await this.sleep(300 + Math.random() * 200);
        
      } catch (error) {
        console.error(`[CryptoRankDirectAPI] Error at skip ${skip}:`, error.message);
        skip += limit;
        await this.sleep(2000);
      }
    }

    console.log(`[CryptoRankDirectAPI] Collected ${allRounds.length} unique funding rounds`);
    return allRounds;
  }

  /**
   * Fetch investors/funds
   * Uses POST /funds with { limit, skip }
   */
  async fetchAllInvestors(maxRecords = 2000): Promise<NormalizedInvestor[]> {
    console.log(`[CryptoRankDirectAPI] Fetching all investors (max ${maxRecords})...`);
    
    const allInvestors: NormalizedInvestor[] = [];
    const seenIds = new Set<string>();
    let skip = 0;
    const limit = 50;

    while (allInvestors.length < maxRecords) {
      try {
        const response = await this.client.post('/funds', {
          limit,
          skip,
        });

        const data = response.data.data || response.data || [];
        const total = response.data.total || 0;

        if (data.length === 0) {
          console.log(`[CryptoRankDirectAPI] No more investors at skip ${skip}`);
          break;
        }

        let newItems = 0;
        for (const item of data) {
          const normalized = this.normalizeInvestor(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allInvestors.push(normalized);
            newItems++;
          }
        }

        console.log(`[CryptoRankDirectAPI] Skip ${skip}: ${data.length} items, ${newItems} new, total: ${allInvestors.length}/${total}`);

        if (skip + limit >= total) break;

        skip += limit;
        await this.sleep(300 + Math.random() * 200);
        
      } catch (error) {
        console.error(`[CryptoRankDirectAPI] Error at skip ${skip}:`, error.message);
        break;
      }
    }

    console.log(`[CryptoRankDirectAPI] Collected ${allInvestors.length} unique investors`);
    return allInvestors;
  }

  /**
   * Fetch token unlocks
   */
  async fetchAllUnlocks(maxRecords = 500): Promise<NormalizedUnlock[]> {
    console.log(`[CryptoRankDirectAPI] Fetching all unlocks (max ${maxRecords})...`);
    
    const allUnlocks: NormalizedUnlock[] = [];
    const seenIds = new Set<string>();
    let skip = 0;
    const limit = 50;

    while (allUnlocks.length < maxRecords) {
      try {
        const response = await this.client.post('/token-unlocks', {
          limit,
          skip,
        });

        const data = response.data.data || response.data || [];
        const total = response.data.total || 0;

        if (data.length === 0) {
          console.log(`[CryptoRankDirectAPI] No more unlocks at skip ${skip}`);
          break;
        }

        let newItems = 0;
        for (const item of data) {
          const normalized = this.normalizeUnlock(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allUnlocks.push(normalized);
            newItems++;
          }
        }

        console.log(`[CryptoRankDirectAPI] Skip ${skip}: ${data.length} items, ${newItems} new, total: ${allUnlocks.length}/${total}`);

        if (skip + limit >= total || data.length < limit) break;

        skip += limit;
        await this.sleep(300 + Math.random() * 200);
        
      } catch (error) {
        console.error(`[CryptoRankDirectAPI] Error at skip ${skip}:`, error.message);
        break;
      }
    }

    console.log(`[CryptoRankDirectAPI] Collected ${allUnlocks.length} unique unlocks`);
    return allUnlocks;
  }

  /**
   * Normalize funding round from CryptoRank v0 API
   */
  private normalizeFunding(item: any): NormalizedFunding | null {
    if (!item) return null;

    const projectKey = item.key;
    const project = item.name;
    if (!projectKey && !project) return null;

    const symbol = item.symbol || '';
    const stage = item.stage || 'unknown';
    const date = this.parseTimestamp(item.date);

    const externalId = item.id?.toString() || `${projectKey || project}-${stage}-${date || 'nodate'}`;
    const key = `cryptorank:funding:${externalId}`.toLowerCase();

    // Parse investors from funds array
    const investors: any[] = [];
    const leadInvestors: string[] = [];

    if (Array.isArray(item.funds)) {
      for (const fund of item.funds) {
        const fundName = fund.name;
        if (!fundName || investors.find(i => i.name === fundName)) continue;

        investors.push({
          name: fundName,
          key: fund.key,
          slug: fund.slug,
          tier: fund.tier,
          type: fund.type,
          category: fund.category?.name || null,
          total_investments: fund.totalInvestments,
        });

        if (fund.tier === 1 || fund.type === 'LEAD') {
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
   * Normalize investor from CryptoRank v0 API
   */
  private normalizeInvestor(item: any): NormalizedInvestor | null {
    if (!item) return null;

    const name = item.name;
    const slug = item.key || item.slug;
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
      image: item.logo || item.image || item.icon,
      investments_count: item.totalInvestments || item.count || 0,
      portfolio_value: item.portfolioValue,
      website: item.website,
      twitter: item.twitter,
      description: item.description,
      updated_at: new Date(),
    };
  }

  /**
   * Normalize unlock from CryptoRank v0 API
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
      unlock_usd: item.unlockUsd || item.value,
      tokens_percent: item.tokensPercent || item.percent,
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
