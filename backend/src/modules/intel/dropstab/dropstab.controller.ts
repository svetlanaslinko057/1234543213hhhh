import { Controller, Get, Post, Query } from '@nestjs/common';
import { DropstabScraperService } from './dropstab-scraper.service';
import { DropstabSyncService } from './dropstab-sync.service';

@Controller('intel/dropstab')
export class DropstabController {
  constructor(
    private readonly scraper: DropstabScraperService,
    private readonly sync: DropstabSyncService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // SCRAPE ENDPOINTS (raw data, no DB)
  // ═══════════════════════════════════════════════════════════════

  @Get('scrape/coins')
  async scrapeCoins(@Query('pages') pages?: string) {
    const maxPages = parseInt(pages || '1', 10);
    const coins = await this.scraper.scrapeCoins(maxPages);
    return {
      ok: true,
      source: 'dropstab',
      method: 'puppeteer',
      count: coins.length,
      data: coins,
    };
  }

  @Get('scrape/vesting')
  async scrapeVesting() {
    const unlocks = await this.scraper.scrapeUnlocks();
    return {
      ok: true,
      source: 'dropstab',
      count: unlocks.length,
      data: unlocks,
    };
  }

  @Get('scrape/unlocks')
  async scrapeUnlocks() {
    const unlocks = await this.scraper.scrapeUnlocks();
    return {
      ok: true,
      source: 'dropstab',
      count: unlocks.length,
      data: unlocks,
    };
  }

  @Get('scrape/investors')
  async scrapeInvestors() {
    const investors = await this.scraper.scrapeInvestors();
    return {
      ok: true,
      source: 'dropstab',
      count: investors.length,
      data: investors,
    };
  }

  @Get('scrape/fundraising')
  async scrapeFundraising() {
    const rounds = await this.scraper.scrapeFundraising();
    return {
      ok: true,
      source: 'dropstab',
      count: rounds.length,
      data: rounds,
    };
  }

  @Get('scrape/categories')
  async scrapeCategories() {
    const categories = await this.scraper.scrapeCategories();
    return {
      ok: true,
      source: 'dropstab',
      count: categories.length,
      data: categories,
    };
  }

  @Get('scrape/trending')
  async scrapeTrending() {
    const perf = await this.scraper.scrapeTopPerformance();
    return {
      ok: true,
      source: 'dropstab',
      gainers: perf.gainers.length,
      losers: perf.losers.length,
      data: perf,
    };
  }

  @Get('scrape/activities')
  async scrapeActivities() {
    const activities = await this.scraper.scrapeActivities();
    return {
      ok: true,
      source: 'dropstab',
      count: activities.length,
      data: activities,
    };
  }

  @Get('scrape/all')
  async scrapeAll() {
    const results = await this.scraper.scrapeAll();
    return {
      ok: true,
      source: 'dropstab',
      method: 'puppeteer',
      ...results,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SYNC ENDPOINTS (scrape + save to DB)
  // ═══════════════════════════════════════════════════════════════

  @Post('sync/markets')
  async syncMarkets(
    @Query('limit') limit?: string,
    @Query('pages') pages?: string,
  ) {
    const result = await this.sync.syncMarkets(
      parseInt(limit || '100', 10),
      parseInt(pages || '1', 10),
    );
    return { ok: true, ...result };
  }

  @Post('sync/markets/full')
  async syncMarketsFull(@Query('pages') pages?: string) {
    const result = await this.sync.syncMarketsFull(parseInt(pages || '200', 10));
    return { ok: true, ...result };
  }

  @Post('sync/unlocks')
  async syncUnlocks(@Query('limit') limit?: string) {
    const result = await this.sync.syncUnlocks(parseInt(limit || '100', 10));
    return { ok: true, ...result };
  }

  @Post('sync/categories')
  async syncCategories() {
    const result = await this.sync.syncCategories();
    return { ok: true, ...result };
  }

  @Post('sync/trending')
  async syncTrending() {
    const result = await this.sync.syncTrending();
    return { ok: true, ...result };
  }

  @Post('sync/investors')
  async syncInvestors(@Query('pages') pages?: string) {
    const result = await this.sync.syncInvestors(parseInt(pages || '1', 10));
    return { ok: true, ...result };
  }

  @Post('sync/fundraising')
  async syncFundraising(@Query('pages') pages?: string) {
    const result = await this.sync.syncFundraising(parseInt(pages || '1', 10));
    return { ok: true, ...result };
  }

  @Post('sync/listings')
  async syncListings(@Query('limit') limit?: string) {
    const result = await this.sync.syncListings(parseInt(limit || '100', 10));
    return { ok: true, ...result };
  }

  @Post('sync/all')
  async syncAll() {
    const result = await this.sync.syncAll();
    return { ok: true, ...result };
  }
}
