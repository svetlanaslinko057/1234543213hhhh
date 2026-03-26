import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DropstabScraperService } from './dropstab-scraper.service';

@Injectable()
export class DropstabSyncService {
  constructor(
    private readonly scraper: DropstabScraperService,
    @InjectModel('intel_projects') private projectsModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_categories') private categoriesModel: Model<any>,
    @InjectModel('intel_activity') private activityModel: Model<any>,
  ) {}

  async syncMarkets(limit: number = 100, maxPages: number = 1): Promise<any> {
    console.log(`[DropstabSync] Syncing markets (maxPages=${maxPages})...`);

    const coins = await this.scraper.scrapeCoins(maxPages);
    if (!coins.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;
    let processed = 0;

    for (const coin of coins.slice(0, limit * maxPages)) {
      const doc = this.buildProjectDoc(coin);
      const result = await this.upsertWithDiff(this.projectsModel, doc);
      if (result.changed) changed++;
      processed++;
    }

    console.log(`[DropstabSync] Markets: ${coins.length} scraped, ${processed} processed, ${changed} changed`);
    return { total: coins.length, processed, changed };
  }

  async syncMarketsFull(maxPages: number = 200): Promise<any> {
    console.log('[DropstabSync] Starting FULL market sync...');
    return this.syncMarkets(100, maxPages);
  }

  async syncUnlocks(limit: number = 100): Promise<any> {
    console.log('[DropstabSync] Syncing unlocks...');

    const unlocks = await this.scraper.scrapeUnlocks();
    if (!unlocks.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;

    for (const unlock of unlocks.slice(0, limit)) {
      const doc = this.buildUnlockDoc(unlock);
      const result = await this.upsertWithDiff(this.unlocksModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[DropstabSync] Unlocks: ${unlocks.length} scraped, ${changed} changed`);
    return { total: unlocks.length, changed };
  }

  async syncCategories(): Promise<any> {
    console.log('[DropstabSync] Syncing categories...');

    const categories = await this.scraper.scrapeCategories();
    if (!categories.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;

    for (const cat of categories) {
      const doc = this.buildCategoryDoc(cat);
      const result = await this.upsertWithDiff(this.categoriesModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[DropstabSync] Categories: ${categories.length} scraped, ${changed} changed`);
    return { total: categories.length, changed };
  }

  async syncTrending(): Promise<any> {
    console.log('[DropstabSync] Syncing trending...');

    const perf = await this.scraper.scrapeTopPerformance();
    const { gainers, losers } = perf;

    if (!gainers.length && !losers.length) {
      return { total: 0, note: 'No data from scraper' };
    }

    const date = new Date().toISOString().split('T')[0];

    for (let idx = 0; idx < gainers.length; idx++) {
      const doc = this.buildActivityDoc(gainers[idx], 'gainer', idx, date);
      await this.activityModel.updateOne({ key: doc.key }, { $set: doc }, { upsert: true });
    }

    for (let idx = 0; idx < losers.length; idx++) {
      const doc = this.buildActivityDoc(losers[idx], 'loser', idx, date);
      await this.activityModel.updateOne({ key: doc.key }, { $set: doc }, { upsert: true });
    }

    console.log(`[DropstabSync] Trending: ${gainers.length} gainers, ${losers.length} losers`);
    return { gainers: gainers.length, losers: losers.length };
  }

  async syncInvestors(maxPages: number = 1): Promise<any> {
    console.log(`[DropstabSync] Syncing investors (max ${maxPages} pages)...`);

    const investors = await this.scraper.scrapeInvestors(maxPages);
    if (!investors.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;

    for (const investor of investors) {
      const doc = this.buildInvestorDoc(investor);
      const result = await this.upsertWithDiff(this.investorsModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[DropstabSync] Investors: ${investors.length} scraped, ${changed} changed`);
    return { total: investors.length, changed };
  }

  async syncFundraising(maxPages: number = 1): Promise<any> {
    console.log(`[DropstabSync] Syncing fundraising (max ${maxPages} pages)...`);

    const rounds = await this.scraper.scrapeFundraising(maxPages);
    if (!rounds.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;

    for (const round of rounds) {
      const doc = this.buildFundingDoc(round);
      const result = await this.upsertWithDiff(this.fundraisingModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[DropstabSync] Fundraising: ${rounds.length} scraped, ${changed} changed`);
    return { total: rounds.length, changed };
  }

  async syncListings(limit: number = 100): Promise<any> {
    console.log('[DropstabSync] Syncing listings...');

    const activities = await this.scraper.scrapeActivities();
    if (!activities.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;

    for (const activity of activities.slice(0, limit)) {
      const doc = this.buildListingDoc(activity);
      if (doc) {
        const result = await this.upsertWithDiff(this.activityModel, doc);
        if (result.changed) changed++;
      }
    }

    console.log(`[DropstabSync] Listings: ${activities.length} scraped, ${changed} changed`);
    return { total: activities.length, changed };
  }

  async syncAll(): Promise<any> {
    console.log('[DropstabSync] Starting FULL sync (all pages)...');

    const results: any = {
      source: 'dropstab',
      method: 'puppeteer',
      ts: Date.now(),
      syncs: {},
    };

    // FULL SYNC - парсим ВСЕ страницы
    const tasks = [
      ['markets', () => this.syncMarketsFull(50)],  // 50 страниц = 5000 монет
      ['unlocks', () => this.syncUnlocks(1000)],
      ['categories', () => this.syncCategories()],
      ['trending', () => this.syncTrending()],
      ['investors', () => this.syncInvestorsFull()],
      ['fundraising', () => this.syncFundraisingFull()],
      ['listings', () => this.syncListings(500)],
    ] as const;

    for (const [name, fn] of tasks) {
      try {
        results.syncs[name] = await fn();
      } catch (error) {
        console.error(`[DropstabSync] ${name} sync failed:`, error.message);
        results.syncs[name] = { error: error.message };
      }
    }

    console.log('[DropstabSync] Full sync complete');
    return results;
  }

  async syncInvestorsFull(): Promise<any> {
    console.log('[DropstabSync] Syncing ALL investors (full - 50 pages)...');
    return this.syncInvestors(50);
  }

  async syncFundraisingFull(): Promise<any> {
    console.log('[DropstabSync] Syncing ALL fundraising (full - 50 pages)...');
    return this.syncFundraising(50);
  }

  // ═══════════════════════════════════════════════════════════════
  // DOCUMENT BUILDERS
  // ═══════════════════════════════════════════════════════════════

  private buildProjectDoc(coin: any): any {
    return {
      key: `dropstab:${coin.slug}`,
      source: 'dropstab',
      slug: coin.slug,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      price_usd: coin.price_usd,
      market_cap: coin.market_cap,
      fully_diluted_valuation: coin.fully_diluted_valuation,
      total_volume: coin.total_volume,
      price_change_percentage_24h: coin.price_change_percentage_24h,
      market_cap_rank: coin.market_cap_rank,
      updated_at: new Date(),
    };
  }

  private buildUnlockDoc(unlock: any): any {
    return {
      key: `dropstab:unlock:${unlock.slug}:${unlock.unlock_date || 'unknown'}`,
      source: 'dropstab',
      slug: unlock.slug,
      symbol: unlock.symbol,
      name: unlock.name,
      unlock_date: unlock.unlock_date,
      unlock_percent: unlock.unlock_percent,
      unlock_usd: unlock.unlock_usd,
      tokens_amount: unlock.tokens_amount,
      allocation: unlock.allocation,
      updated_at: new Date(),
    };
  }

  private buildInvestorDoc(investor: any): any {
    return {
      key: `dropstab:investor:${investor.slug}`,
      source: 'dropstab',
      slug: investor.slug,
      name: investor.name,
      tier: investor.tier,
      type: investor.type,
      image: investor.image,
      investments_count: investor.investments_count,
      website: investor.website,
      twitter: investor.twitter,
      updated_at: new Date(),
    };
  }

  private buildFundingDoc(funding: any): any {
    // funding приходит от parseFunding в scraper
    const slug = funding.project?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
    const roundKey = funding.round?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
    
    return {
      key: funding.key || `dropstab:funding:${slug}:${roundKey}:${funding.date || 'nodate'}`,
      source: 'dropstab',
      slug,
      project: funding.project,
      symbol: funding.symbol,
      round: funding.round,
      date: funding.date,
      amount: funding.amount,
      valuation: funding.valuation,
      investors: funding.investors || [],
      lead_investor: funding.lead_investor,
      updated_at: new Date(),
    };
  }

  private buildCategoryDoc(cat: any): any {
    const catId = cat.slug || cat.id || String(cat.name || '').toLowerCase().replace(/\s+/g, '-');
    return {
      key: `dropstab:category:${catId}`,
      source: 'dropstab',
      category_id: catId,
      name: cat.name || '',
      slug: cat.slug || catId,
      coins_count: cat.coinsCount || 0,
      market_cap: cat.marketCap || 0,
      updated_at: new Date(),
    };
  }

  private buildActivityDoc(item: any, type: string, rank: number, date: string): any {
    const getUsd = (data: any) => {
      if (data === null || data === undefined) return null;
      if (typeof data === 'object' && data.USD !== undefined) return parseFloat(data.USD) || null;
      return parseFloat(data) || null;
    };

    return {
      key: `dropstab:${type}:${item.symbol || rank}:${date}`,
      source: 'dropstab',
      type,
      symbol: String(item.symbol || '').toUpperCase(),
      name: item.name || '',
      slug: item.slug || '',
      rank: rank + 1,
      price: getUsd(item.price),
      change_24h: typeof item.change === 'object' ? getUsd(item.change?.['1D']) : getUsd(item.change),
      date,
      updated_at: new Date(),
    };
  }

  private buildListingDoc(item: any): any | null {
    const activityId = item.id;
    if (!activityId) return null;

    return {
      key: `dropstab:activity:${activityId}`,
      source: 'dropstab',
      type: 'activity',
      activity_id: activityId,
      title: item.title || item.name,
      description: item.description,
      status: item.status,
      date: item.date,
      coin_symbol: String(item.coinSymbol || '').toUpperCase(),
      exchange: item.exchange,
      updated_at: new Date(),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // UPSERT WITH DIFF
  // ═══════════════════════════════════════════════════════════════

  private async upsertWithDiff(model: Model<any>, doc: any): Promise<{ changed: boolean }> {
    const existing = await model.findOne({ key: doc.key });
    
    if (!existing) {
      await model.create(doc);
      return { changed: true };
    }

    // Check for changes (simple comparison)
    let hasChanges = false;
    for (const key of Object.keys(doc)) {
      if (key === 'updated_at' || key === '_id') continue;
      if (JSON.stringify(existing[key]) !== JSON.stringify(doc[key])) {
        hasChanges = true;
        break;
      }
    }

    if (hasChanges) {
      await model.updateOne({ key: doc.key }, { $set: doc });
    }

    return { changed: hasChanges };
  }
}
