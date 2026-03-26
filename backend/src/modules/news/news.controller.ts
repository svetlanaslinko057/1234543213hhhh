import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import { NewsFetcherService } from './news-fetcher.service';
import { NewsSyncService } from './news-sync.service';
import { getActiveSources, getSourcesByTier, NEWS_SOURCES } from './news-sources.config';

@Controller('news')
export class NewsController {
  constructor(
    private readonly fetcher: NewsFetcherService,
    private readonly sync: NewsSyncService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // INFO ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('sources')
  getSources() {
    const sources = getActiveSources();
    return {
      ok: true,
      total: sources.length,
      by_tier: {
        A: getSourcesByTier('A').length,
        B: getSourcesByTier('B').length,
        C: getSourcesByTier('C').length,
      },
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        tier: s.tier,
        language: s.language,
        rss_url: s.rss_url,
      })),
    };
  }

  @Get('stats')
  async getStats() {
    const stats = await this.sync.getStats();
    return { ok: true, ...stats };
  }

  // ═══════════════════════════════════════════════════════════════
  // FETCH ENDPOINTS (raw data, no DB)
  // ═══════════════════════════════════════════════════════════════

  @Get('fetch/:sourceId')
  async fetchSource(
    @Param('sourceId') sourceId: string,
    @Query('limit') limit?: string,
  ) {
    const articles = await this.fetcher.fetchSource(sourceId, parseInt(limit || '30', 10));
    return {
      ok: true,
      source: sourceId,
      count: articles.length,
      data: articles,
    };
  }

  @Get('fetch/tier/a')
  async fetchTierA(@Query('limit') limit?: string) {
    const results = await this.fetcher.fetchTierA(parseInt(limit || '30', 10));
    const total = results.reduce((sum, r) => sum + r.articles.length, 0);
    return {
      ok: true,
      tier: 'A',
      sources: results.length,
      total_articles: total,
      data: results,
    };
  }

  @Get('fetch/tier/b')
  async fetchTierB(@Query('limit') limit?: string) {
    const results = await this.fetcher.fetchTierB(parseInt(limit || '30', 10));
    const total = results.reduce((sum, r) => sum + r.articles.length, 0);
    return {
      ok: true,
      tier: 'B',
      sources: results.length,
      total_articles: total,
      data: results,
    };
  }

  @Get('fetch/all')
  async fetchAll(@Query('limit') limit?: string) {
    const result = await this.fetcher.fetchAll(parseInt(limit || '20', 10));
    return { ok: true, ...result };
  }

  // ═══════════════════════════════════════════════════════════════
  // SYNC ENDPOINTS (fetch + store to DB)
  // Note: Specific routes must come BEFORE parameterized routes
  // ═══════════════════════════════════════════════════════════════

  @Post('sync/all')
  async syncAll(@Query('limit') limit?: string) {
    const result = await this.sync.syncAll(parseInt(limit || '20', 10));
    return { ok: true, source: 'all', ...result };
  }

  @Post('sync/tier/a')
  async syncTierA(@Query('limit') limit?: string) {
    const result = await this.sync.syncTierA(parseInt(limit || '30', 10));
    return { ok: true, ...result };
  }

  @Post('sync/tier/b')
  async syncTierB(@Query('limit') limit?: string) {
    const result = await this.sync.syncTierB(parseInt(limit || '30', 10));
    return { ok: true, ...result };
  }

  @Post('sync/tier/c')
  async syncTierC(@Query('limit') limit?: string) {
    const result = await this.sync.syncTierC(parseInt(limit || '20', 10));
    return { ok: true, ...result };
  }

  @Post('sync/source/:sourceId')
  async syncSource(
    @Param('sourceId') sourceId: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.sync.syncSource(sourceId, parseInt(limit || '30', 10));
    return { ok: true, ...result };
  }
}
