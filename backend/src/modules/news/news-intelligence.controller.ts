import { Controller, Get, Query } from '@nestjs/common';
import { getActiveSources, getSourcesByTier, NEWS_SOURCES } from './news-sources.config';
import { NewsSyncService } from './news-sync.service';

/**
 * News Intelligence Controller
 * Provides endpoints compatible with frontend expectations
 */
@Controller('news-intelligence')
export class NewsIntelligenceController {
  constructor(private readonly sync: NewsSyncService) {}

  @Get('sources-registry')
  async getSourcesRegistry(@Query('tier') tier?: string, @Query('language') language?: string, @Query('category') category?: string) {
    let sources = getActiveSources();
    
    // Apply filters
    if (tier) {
      sources = sources.filter(s => s.tier === tier.toUpperCase());
    }
    if (language) {
      sources = sources.filter(s => s.language === language);
    }

    // Get stats
    const dbStats = await this.sync.getStats();

    return {
      ok: true,
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        tier: s.tier,
        language: s.language,
        categories: [],
        rss_url: s.rss_url,
        status: 'active',
        articles_count: dbStats.by_source?.[s.id] || 0,
        last_sync: null,
      })),
      stats: {
        total: sources.length,
        by_tier: {
          A: getSourcesByTier('A').length,
          B: getSourcesByTier('B').length,
          C: getSourcesByTier('C').length,
          D: 0,
        },
        by_language: sources.reduce((acc, s) => {
          acc[s.language] = (acc[s.language] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        by_category: {},
        total_articles: dbStats.total_articles || 0,
      },
    };
  }
}
