import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CryptoRankScraperService, CryptoRankFunding, CryptoRankInvestor, CryptoRankUnlock } from './cryptorank-scraper.service';

@Injectable()
export class CryptoRankSyncService {
  constructor(
    private readonly scraper: CryptoRankScraperService,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('intel_categories') private categoriesModel: Model<any>,
    @InjectModel('intel_launchpads') private launchpadsModel: Model<any>,
    @InjectModel('intel_market') private marketModel: Model<any>,
  ) {}

  async syncFunding(maxPages: number = 1): Promise<any> {
    console.log('[CryptoRankSync] Syncing funding...');

    const funding = await this.scraper.scrapeFunding(maxPages);
    if (!funding.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;
    for (const doc of funding) {
      const result = await this.upsertWithDiff(this.fundraisingModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[CryptoRankSync] Funding: ${funding.length} scraped, ${changed} changed`);
    return { total: funding.length, changed };
  }

  async syncInvestors(): Promise<any> {
    console.log('[CryptoRankSync] Syncing investors...');

    const investors = await this.scraper.scrapeInvestors();
    if (!investors.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;
    for (const doc of investors) {
      const result = await this.upsertWithDiff(this.investorsModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[CryptoRankSync] Investors: ${investors.length} scraped, ${changed} changed`);
    return { total: investors.length, changed };
  }

  async syncUnlocks(): Promise<any> {
    console.log('[CryptoRankSync] Syncing unlocks...');

    const unlocks = await this.scraper.scrapeUnlocks();
    if (!unlocks.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;
    for (const doc of unlocks) {
      const result = await this.upsertWithDiff(this.unlocksModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[CryptoRankSync] Unlocks: ${unlocks.length} scraped, ${changed} changed`);
    return { total: unlocks.length, changed };
  }

  async syncCategories(): Promise<any> {
    console.log('[CryptoRankSync] Syncing categories...');

    const categories = await this.scraper.scrapeCategories();
    if (!categories.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;
    for (const doc of categories) {
      const result = await this.upsertWithDiff(this.categoriesModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[CryptoRankSync] Categories: ${categories.length} scraped, ${changed} changed`);
    return { total: categories.length, changed };
  }

  async syncLaunchpads(): Promise<any> {
    console.log('[CryptoRankSync] Syncing launchpads...');

    const launchpads = await this.scraper.scrapeLaunchpads();
    if (!launchpads.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;
    for (const doc of launchpads) {
      const result = await this.upsertWithDiff(this.launchpadsModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[CryptoRankSync] Launchpads: ${launchpads.length} scraped, ${changed} changed`);
    return { total: launchpads.length, changed };
  }

  async syncMarket(): Promise<any> {
    console.log('[CryptoRankSync] Syncing market...');

    const market = await this.scraper.scrapeMarket();
    if (!market) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    const result = await this.upsertWithDiff(this.marketModel, market);
    
    console.log(`[CryptoRankSync] Market: 1 record, ${result.changed ? 'changed' : 'unchanged'}`);
    return { total: 1, changed: result.changed ? 1 : 0 };
  }

  async syncAll(): Promise<any> {
    console.log('[CryptoRankSync] Starting FULL sync (all pages)...');

    const results: any = {
      source: 'cryptorank',
      method: 'puppeteer',
      ts: Date.now(),
      syncs: {},
    };

    // FULL SYNC - парсим ВСЕ страницы
    const tasks = [
      ['funding', () => this.syncFunding(100)],  // 100 страниц = ~2000 funding rounds
      ['investors', () => this.syncInvestorsFull()],
      ['unlocks', () => this.syncUnlocksFull()],
      ['categories', () => this.syncCategories()],
      ['launchpads', () => this.syncLaunchpads()],
      ['market', () => this.syncMarket()],
    ] as const;

    for (const [name, fn] of tasks) {
      try {
        results.syncs[name] = await fn();
      } catch (error) {
        console.error(`[CryptoRankSync] ${name} sync failed:`, error.message);
        results.syncs[name] = { error: error.message };
      }
    }

    console.log('[CryptoRankSync] Full sync complete');
    return results;
  }

  async syncInvestorsFull(): Promise<any> {
    console.log('[CryptoRankSync] Syncing ALL investors (full)...');

    const investors = await this.scraper.scrapeInvestorsFull();
    if (!investors.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;
    for (const doc of investors) {
      const result = await this.upsertWithDiff(this.investorsModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[CryptoRankSync] Investors: ${investors.length} scraped, ${changed} changed`);
    return { total: investors.length, changed };
  }

  async syncUnlocksFull(): Promise<any> {
    console.log('[CryptoRankSync] Syncing ALL unlocks (full)...');

    const unlocks = await this.scraper.scrapeUnlocksFull();
    if (!unlocks.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;
    for (const doc of unlocks) {
      const result = await this.upsertWithDiff(this.unlocksModel, doc);
      if (result.changed) changed++;
    }

    console.log(`[CryptoRankSync] Unlocks: ${unlocks.length} scraped, ${changed} changed`);
    return { total: unlocks.length, changed };
  }

  private async upsertWithDiff(model: Model<any>, doc: any): Promise<{ changed: boolean }> {
    const existing = await model.findOne({ key: doc.key });
    
    if (!existing) {
      doc.updated_at = new Date();
      await model.create(doc);
      return { changed: true };
    }

    let hasChanges = false;
    for (const key of Object.keys(doc)) {
      if (key === 'updated_at' || key === '_id') continue;
      if (JSON.stringify(existing[key]) !== JSON.stringify(doc[key])) {
        hasChanges = true;
        break;
      }
    }

    if (hasChanges) {
      doc.updated_at = new Date();
      await model.updateOne({ key: doc.key }, { $set: doc });
    }

    return { changed: hasChanges };
  }
}
