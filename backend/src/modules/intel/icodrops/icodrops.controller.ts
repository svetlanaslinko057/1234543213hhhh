import { Controller, Get, Post, Query } from '@nestjs/common';
import { IcoDropsScraperService } from './icodrops-scraper.service';
import { IcoDropsSyncService } from './icodrops-sync.service';

@Controller('intel/icodrops')
export class IcoDropsController {
  constructor(
    private readonly scraper: IcoDropsScraperService,
    private readonly sync: IcoDropsSyncService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // SCRAPE ENDPOINTS (direct scraping, no DB save)
  // ═══════════════════════════════════════════════════════════════

  @Get('scrape/active')
  async scrapeActive() {
    const data = await this.scraper.scrapeActiveIcos();
    return { ok: true, method: 'puppeteer', count: data.length, data };
  }

  @Get('scrape/upcoming')
  async scrapeUpcoming() {
    const data = await this.scraper.scrapeUpcomingIcos();
    return { ok: true, method: 'puppeteer', count: data.length, data };
  }

  @Get('scrape/ended')
  async scrapeEnded(@Query('pages') pages?: string) {
    const maxPages = parseInt(pages || '10', 10);
    const data = await this.scraper.scrapeEndedIcos(maxPages);
    return { ok: true, method: 'puppeteer', count: data.length, data };
  }

  @Get('scrape/all')
  async scrapeAll(@Query('pages') pages?: string) {
    const endedPages = parseInt(pages || '50', 10);
    const result = await this.scraper.scrapeAll(endedPages);
    return { ok: true, ...result };
  }

  // ═══════════════════════════════════════════════════════════════
  // SYNC ENDPOINTS (scrape + save to MongoDB)
  // ═══════════════════════════════════════════════════════════════

  @Post('sync/active')
  async syncActive() {
    const result = await this.sync.syncActive();
    return { ok: true, source: 'icodrops', type: 'active', ...result };
  }

  @Post('sync/upcoming')
  async syncUpcoming() {
    const result = await this.sync.syncUpcoming();
    return { ok: true, source: 'icodrops', type: 'upcoming', ...result };
  }

  @Post('sync/ended')
  async syncEnded(@Query('pages') pages?: string) {
    const maxPages = parseInt(pages || '50', 10);
    const result = await this.sync.syncEnded(maxPages);
    return { ok: true, source: 'icodrops', type: 'ended', ...result };
  }

  @Post('sync/all')
  async syncAll(@Query('pages') pages?: string) {
    const endedPages = parseInt(pages || '50', 10);
    const result = await this.sync.syncAll(endedPages);
    return { ok: true, ...result };
  }
}
