/**
 * Dropstab API Service - Direct API calls instead of browser scraping
 * 
 * Discovered API: https://api2.dropstab.com/portfolio/api/
 */

import axios, { AxiosInstance } from 'axios';
import { NormalizedInvestor, NormalizedFunding, NormalizedUnlock } from '../common/parser.types';

const API_BASE = 'https://api2.dropstab.com/portfolio/api';

export class DropstabApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://dropstab.com/',
        'Origin': 'https://dropstab.com',
      },
    });
  }

  /**
   * Fetch investors with pagination
   */
  async fetchInvestors(page = 0, size = 20): Promise<{
    content: any[];
    totalPages: number;
    totalElements: number;
    last: boolean;
    number: number;
  }> {
    try {
      // API requires POST method
      const response = await this.client.post('/investors', {
        page,
        size,
        sortBy: 'rating',
        sortDir: 'asc',
      });
      return response.data;
    } catch (error) {
      console.error(`[DropstabAPI] Error fetching investors page ${page}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch all investors (all pages)
   */
  async fetchAllInvestors(maxPages = 100): Promise<NormalizedInvestor[]> {
    console.log(`[DropstabAPI] Fetching all investors (max ${maxPages} pages)...`);
    
    const allInvestors: NormalizedInvestor[] = [];
    const seenIds = new Set<string>();
    let currentPage = 0;

    while (currentPage < maxPages) {
      try {
        const data = await this.fetchInvestors(currentPage, 50);
        
        if (!data.content || data.content.length === 0) {
          console.log(`[DropstabAPI] No more investors at page ${currentPage}`);
          break;
        }

        for (const item of data.content) {
          const normalized = this.normalizeInvestor(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allInvestors.push(normalized);
          }
        }

        console.log(`[DropstabAPI] Page ${currentPage + 1}/${data.totalPages}: ${data.content.length} items, total: ${allInvestors.length}/${data.totalElements}`);

        if (data.last) {
          console.log(`[DropstabAPI] Reached last page`);
          break;
        }

        currentPage++;
        
        // Rate limiting
        await this.sleep(500 + Math.random() * 500);
      } catch (error) {
        console.error(`[DropstabAPI] Error on page ${currentPage}:`, error.message);
        break;
      }
    }

    console.log(`[DropstabAPI] Collected ${allInvestors.length} unique investors`);
    return allInvestors;
  }

  /**
   * Fetch fundraising rounds with pagination
   */
  async fetchFundraising(page = 0, size = 50): Promise<{
    content: any[];
    totalPages: number;
    totalElements: number;
    last: boolean;
    number: number;
  }> {
    try {
      // API uses POST with query params and empty JSON body
      const response = await this.client.post(
        `/fundraisingRounds?page=${page}&size=${size}&sort=announceDate&order=DESC`,
        {}, // empty body required
      );
      
      // Normalize response format
      const data = response.data;
      return {
        content: data.content || [],
        totalPages: data.totalPages || 1,
        totalElements: data.totalElements || data.content?.length || 0,
        last: data.last ?? true,
        number: data.number || page,
      };
    } catch (error) {
      console.error(`[DropstabAPI] Error fetching fundraising page ${page}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch all fundraising rounds
   */
  async fetchAllFundraising(maxPages = 200): Promise<NormalizedFunding[]> {
    console.log(`[DropstabAPI] Fetching all fundraising (max ${maxPages} pages)...`);
    
    const allRounds: NormalizedFunding[] = [];
    const seenIds = new Set<string>();
    let currentPage = 0;

    while (currentPage < maxPages) {
      try {
        const data = await this.fetchFundraising(currentPage, 50);
        
        if (!data.content || data.content.length === 0) {
          console.log(`[DropstabAPI] No more fundraising at page ${currentPage}`);
          break;
        }

        for (const item of data.content) {
          const normalized = this.normalizeFunding(item);
          if (normalized && !seenIds.has(normalized.externalId)) {
            seenIds.add(normalized.externalId);
            allRounds.push(normalized);
          }
        }

        console.log(`[DropstabAPI] Page ${currentPage + 1}/${data.totalPages}: ${data.content.length} items, total: ${allRounds.length}/${data.totalElements}`);

        if (data.last) {
          console.log(`[DropstabAPI] Reached last page`);
          break;
        }

        currentPage++;
        await this.sleep(500 + Math.random() * 500);
      } catch (error) {
        console.error(`[DropstabAPI] Error on page ${currentPage}:`, error.message);
        break;
      }
    }

    console.log(`[DropstabAPI] Collected ${allRounds.length} unique fundraising rounds`);
    return allRounds;
  }

  /**
   * Fetch unlocks/vesting
   */
  async fetchUnlocks(): Promise<NormalizedUnlock[]> {
    console.log(`[DropstabAPI] Fetching unlocks...`);
    
    try {
      // Try vesting endpoint with POST
      const response = await this.client.post('/vesting', {
        page: 0,
        size: 100,
      });

      const data = response.data;
      const content = data.content || data.data || (Array.isArray(data) ? data : []);
      
      const allUnlocks: NormalizedUnlock[] = [];
      const seenIds = new Set<string>();

      for (const item of content) {
        const normalized = this.normalizeUnlock(item);
        if (normalized && !seenIds.has(normalized.externalId)) {
          seenIds.add(normalized.externalId);
          allUnlocks.push(normalized);
        }
      }

      console.log(`[DropstabAPI] Collected ${allUnlocks.length} unlocks`);
      return allUnlocks;
    } catch (error) {
      console.error(`[DropstabAPI] Error fetching unlocks:`, error.message);
      return [];
    }
  }

  /**
   * Normalize investor data
   */
  private normalizeInvestor(item: any): NormalizedInvestor | null {
    if (!item) return null;

    const name = item.name;
    const slug = item.investorSlug || item.slug || item.id?.toString();
    if (!name || !slug) return null;

    const externalId = item.id?.toString() || slug;
    const key = `dropstab:investor:${slug}`;

    // Extract twitter
    let twitter = item.twitterUrl;
    if (!twitter && Array.isArray(item.links)) {
      const twitterLink = item.links.find((l: any) => 
        l.link?.includes('twitter') || l.link?.includes('x.com')
      );
      twitter = twitterLink?.link;
    }

    // Parse tier - can be string like "Tier 1" or number
    let tier: number | undefined;
    if (typeof item.tier === 'number') {
      tier = item.tier;
    } else if (typeof item.tier === 'string') {
      const match = item.tier.match(/\d+/);
      tier = match ? parseInt(match[0], 10) : undefined;
    } else if (typeof item.rating === 'number') {
      tier = item.rating;
    } else if (typeof item.rank === 'number') {
      tier = item.rank;
    }

    return {
      key,
      externalId,
      source: 'dropstab',
      name,
      slug,
      tier,
      type: item.ventureType,
      category: item.category,
      image: item.logo || item.image,
      investments_count: item.totalInvestments || item.investmentsCount || 0,
      portfolio_value: item.portfolioValue,
      website: item.websiteUrl || item.website,
      twitter,
      description: item.description,
      updated_at: new Date(),
    };
  }

  /**
   * Normalize funding data
   */
  private normalizeFunding(item: any): NormalizedFunding | null {
    if (!item) return null;

    const project = item.name || item.projectName || item.coinName;
    if (!project) return null;

    const symbol = String(item.symbol || item.ticker || '').toUpperCase();
    const slug = item.slug || item.coinSlug || project.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const roundName = item.stage || item.round || item.roundName || 'unknown';
    const date = this.parseTimestamp(item.announceDate || item.saleDate || item.date || item.fundingDate);
    
    const externalId = item.saleId?.toString() || item.id?.toString() || `${slug}-${roundName}-${date || 'nodate'}`;
    const key = `dropstab:funding:${externalId}`;

    // Parse investors from different fields
    const investors: any[] = [];
    const leadInvestors: string[] = [];
    
    // Try different investor sources
    const invSources = [
      item.investors,
      item.ventureCapitals,
      item.leadInvestors,
    ].filter(Boolean);
    
    for (const invData of invSources) {
      if (!Array.isArray(invData)) continue;
      
      for (const inv of invData) {
        if (typeof inv === 'string') {
          if (!investors.find(i => i.name === inv)) {
            investors.push({ name: inv });
          }
        } else if (typeof inv === 'object' && inv) {
          const invName = inv.name || inv.fundName;
          if (invName && !investors.find(i => i.name === invName)) {
            const invObj = {
              name: invName,
              slug: inv.slug || inv.investorSlug,
              tier: this.parseTier(inv.tier),
              type: inv.type,
              image: inv.image || inv.logo,
            };
            investors.push(invObj);
            if (inv.lead) {
              leadInvestors.push(invName);
            }
          }
        }
      }
    }

    return {
      key,
      externalId,
      source: 'dropstab',
      project,
      project_key: slug,
      symbol: symbol || slug.toUpperCase(),
      round: roundName,
      date,
      amount: item.fundsRaised || item.amount || item.raised,
      valuation: item.preValuation || item.valuation,
      investors,
      investors_count: investors.length,
      lead_investors: leadInvestors,
      category: item.category,
      updated_at: new Date(),
    };
  }

  /**
   * Parse tier from string or number
   */
  private parseTier(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const match = value.match(/\d+/);
      return match ? parseInt(match[0], 10) : undefined;
    }
    return undefined;
  }

  /**
   * Normalize unlock data
   */
  private normalizeUnlock(item: any): NormalizedUnlock | null {
    if (!item) return null;

    const symbol = String(item.symbol || item.ticker || '').toUpperCase();
    const slug = item.slug || item.project || symbol.toLowerCase();
    if (!slug && !symbol) return null;

    const unlockDate = item.unlockDate || item.date || item.nextUnlock;
    const externalId = item.id?.toString() || `${slug}-${unlockDate || 'unknown'}`;
    const key = `dropstab:unlock:${externalId}`;

    return {
      key,
      externalId,
      source: 'dropstab',
      project_key: slug,
      symbol,
      name: item.name || item.projectName,
      unlock_date: unlockDate,
      unlock_usd: item.unlockAmount || item.unlockUsd,
      tokens_percent: item.unlockPercent || item.percent,
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
}
