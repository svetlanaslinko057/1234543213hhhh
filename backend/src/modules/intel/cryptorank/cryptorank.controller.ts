import { Controller, Get, Post, Query } from '@nestjs/common';
import { CryptoRankScraperService } from './cryptorank-scraper.service';
import { CryptoRankSyncService } from './cryptorank-sync.service';

@Controller('intel/cryptorank')
export class CryptoRankController {
  constructor(
    private readonly scraper: CryptoRankScraperService,
    private readonly sync: CryptoRankSyncService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // SCRAPE ENDPOINTS (raw data, no DB)
  // ═══════════════════════════════════════════════════════════════

  @Get('scrape/funding')
  async scrapeFunding(@Query('pages') pages?: string) {
    const maxPages = parseInt(pages || '1', 10);
    const funding = await this.scraper.scrapeFunding(maxPages);
    return {
      ok: true,
      source: 'cryptorank',
      method: 'puppeteer',
      count: funding.length,
      data: funding,
    };
  }

  @Get('scrape/investors')
  async scrapeInvestors() {
    const investors = await this.scraper.scrapeInvestors();
    return {
      ok: true,
      source: 'cryptorank',
      count: investors.length,
      data: investors,
    };
  }

  @Get('scrape/unlocks')
  async scrapeUnlocks() {
    const unlocks = await this.scraper.scrapeUnlocks();
    return {
      ok: true,
      source: 'cryptorank',
      count: unlocks.length,
      data: unlocks,
    };
  }

  @Get('scrape/categories')
  async scrapeCategories() {
    const categories = await this.scraper.scrapeCategories();
    return {
      ok: true,
      source: 'cryptorank',
      count: categories.length,
      data: categories,
    };
  }

  @Get('scrape/launchpads')
  async scrapeLaunchpads() {
    const launchpads = await this.scraper.scrapeLaunchpads();
    return {
      ok: true,
      source: 'cryptorank',
      count: launchpads.length,
      data: launchpads,
    };
  }

  @Get('scrape/market')
  async scrapeMarket() {
    const market = await this.scraper.scrapeMarket();
    return {
      ok: true,
      source: 'cryptorank',
      data: market,
    };
  }

  @Get('scrape/all')
  async scrapeAll() {
    const results = await this.scraper.scrapeAll();
    return {
      ok: true,
      source: 'cryptorank',
      method: 'puppeteer',
      ...results,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SYNC ENDPOINTS (scrape + save to DB)
  // ═══════════════════════════════════════════════════════════════

  @Post('sync/funding')
  async syncFunding(@Query('pages') pages?: string) {
    const result = await this.sync.syncFunding(parseInt(pages || '1', 10));
    return { ok: true, ...result };
  }

  @Post('sync/investors')
  async syncInvestors() {
    const result = await this.sync.syncInvestors();
    return { ok: true, ...result };
  }

  @Post('sync/unlocks')
  async syncUnlocks() {
    const result = await this.sync.syncUnlocks();
    return { ok: true, ...result };
  }

  @Post('sync/categories')
  async syncCategories() {
    const result = await this.sync.syncCategories();
    return { ok: true, ...result };
  }

  @Post('sync/launchpads')
  async syncLaunchpads() {
    const result = await this.sync.syncLaunchpads();
    return { ok: true, ...result };
  }

  @Post('sync/market')
  async syncMarket() {
    const result = await this.sync.syncMarket();
    return { ok: true, ...result };
  }

  @Post('sync/all')
  async syncAll() {
    const result = await this.sync.syncAll();
    return { ok: true, ...result };
  }
}
