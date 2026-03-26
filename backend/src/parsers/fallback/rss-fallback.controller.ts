/**
 * RSS FALLBACK CONTROLLER
 * 
 * API endpoints for RSS fallback system
 */

import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RssFallbackEngine } from './rss-fallback.engine';
import { getEnabledSources, getSourceById, NEWS_SOURCES } from './source.config';

@Controller('news')
export class RssFallbackController {
  constructor(
    private readonly fallbackEngine: RssFallbackEngine,
    @InjectModel('news_articles') private newsModel: Model<any>,
  ) {}

  /**
   * Get source configuration
   */
  @Get('sources')
  getSources() {
    return {
      ts: Date.now(),
      total: NEWS_SOURCES.length,
      enabled: getEnabledSources().length,
      sources: NEWS_SOURCES.map(s => ({
        id: s.id,
        name: s.name,
        tier: s.tier,
        enabled: s.enabled,
        rssUrl: s.rssUrl,
        fallbackMode: s.fallback.mode,
      })),
    };
  }

  /**
   * Get source detail
   */
  @Get('sources/:id')
  getSourceDetail(@Param('id') id: string) {
    const source = getSourceById(id);
    if (!source) {
      return { error: 'Source not found', id };
    }
    return source;
  }

  /**
 * Run all sources with fallback
 */
  @Post('sync')
  async syncAll(): Promise<any> {
    const startTime = Date.now();
    const result = await this.fallbackEngine.runAllSources();

    // Save articles to MongoDB
    let totalSaved = 0;
    for (const r of result.results) {
      if (r.success && r.articles.length > 0) {
        for (const article of r.articles) {
          const articleId = this.generateArticleId(article.url, article.source);
          
          await this.newsModel.updateOne(
            { id: articleId },
            {
              $set: {
                id: articleId,
                source_id: article.source,
                source_name: r.sourceName,
                url: article.url,
                title: article.title,
                summary: article.summary,
                published_at: article.publishedAt || new Date(),
                fetched_at: new Date(),
                method: article.method,
              },
            },
            { upsert: true }
          );
          totalSaved++;
        }
      }
    }

    return {
      ts: Date.now(),
      durationMs: Date.now() - startTime,
      ...result,
      totalSaved,
      coverage: {
        rss: result.byMethod['rss'] || 0,
        html: result.byMethod['html'] || 0,
        replace: result.byMethod['replace'] || 0,
        failed: result.byMethod['failed'] || 0,
        rate: Math.round((result.successful / result.total) * 100),
      },
    };
  }

  /**
   * Run single source
   */
  @Post('sync/:id')
  async syncSource(@Param('id') id: string) {
    const source = getSourceById(id);
    if (!source) {
      return { error: 'Source not found', id };
    }

    const result = await this.fallbackEngine.runSource(source);

    // Save articles
    let saved = 0;
    if (result.success && result.articles.length > 0) {
      for (const article of result.articles) {
        const articleId = this.generateArticleId(article.url, article.source);
        
        await this.newsModel.updateOne(
          { id: articleId },
          {
            $set: {
              id: articleId,
              source_id: article.source,
              source_name: result.sourceName,
              url: article.url,
              title: article.title,
              summary: article.summary,
              published_at: article.publishedAt || new Date(),
              fetched_at: new Date(),
              method: article.method,
            },
          },
          { upsert: true }
        );
        saved++;
      }
    }

    return {
      ...result,
      saved,
    };
  }

  /**
   * Get news stats
   */
  @Get('stats')
  async getStats() {
    const [
      totalCount,
      bySource,
      byMethod,
      recent,
    ] = await Promise.all([
      this.newsModel.countDocuments({}),
      this.newsModel.aggregate([
        { $group: { _id: '$source_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.newsModel.aggregate([
        { $group: { _id: '$method', count: { $sum: 1 } } },
      ]),
      this.newsModel
        .find({})
        .sort({ fetched_at: -1 })
        .limit(10)
        .select('title source_id method fetched_at')
        .lean(),
    ]);

    return {
      ts: Date.now(),
      total: totalCount,
      bySource,
      byMethod,
      recentArticles: recent,
    };
  }

  /**
   * Get articles with filtering
   */
  @Get('articles')
  async getArticles(
    @Query('source') source?: string,
    @Query('limit') limit?: string,
    @Query('method') method?: string,
  ) {
    const filter: any = {};
    if (source) filter.source_id = source;
    if (method) filter.method = method;

    const articles = await this.newsModel
      .find(filter)
      .sort({ fetched_at: -1 })
      .limit(parseInt(limit || '50', 10))
      .lean();

    return {
      ts: Date.now(),
      count: articles.length,
      articles,
    };
  }

  private generateArticleId(url: string, sourceId: string): string {
    const hash = Buffer.from(url).toString('base64').substring(0, 40);
    return `${sourceId}:${hash}`;
  }
}
