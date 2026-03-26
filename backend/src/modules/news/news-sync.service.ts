import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NewsFetcherService, NewsArticle } from './news-fetcher.service';
import { getActiveSources, getSourcesByTier } from './news-sources.config';

@Injectable()
export class NewsSyncService {
  constructor(
    private readonly fetcher: NewsFetcherService,
    @InjectModel('news_articles') private articlesModel: Model<any>,
    @InjectModel('news_sources') private sourcesModel: Model<any>,
  ) {}

  async syncSource(sourceId: string, limit: number = 30): Promise<any> {
    console.log(`[NewsSync] Syncing source: ${sourceId}`);

    const articles = await this.fetcher.fetchSource(sourceId, limit);
    if (!articles.length) {
      return { source: sourceId, total: 0, new: 0 };
    }

    let newCount = 0;
    for (const article of articles) {
      const result = await this.storeArticle(article);
      if (result.isNew) newCount++;
    }

    // Update source status
    await this.sourcesModel.updateOne(
      { id: sourceId },
      {
        $set: {
          last_sync: new Date().toISOString(),
          status: 'active',
        },
        $inc: { sync_count: 1 },
      },
      { upsert: true },
    );

    console.log(`[NewsSync] ${sourceId}: ${articles.length} fetched, ${newCount} new`);
    return { source: sourceId, total: articles.length, new: newCount };
  }

  async syncTierA(limit: number = 30): Promise<any> {
    console.log('[NewsSync] Syncing Tier A sources...');
    const sources = getSourcesByTier('A');
    const results: any = { tier: 'A', sources: {}, total: 0, new: 0 };

    for (const source of sources) {
      const result = await this.syncSource(source.id, limit);
      results.sources[source.id] = result;
      results.total += result.total;
      results.new += result.new;
    }

    return results;
  }

  async syncTierB(limit: number = 30): Promise<any> {
    console.log('[NewsSync] Syncing Tier B sources...');
    const sources = getSourcesByTier('B');
    const results: any = { tier: 'B', sources: {}, total: 0, new: 0 };

    for (const source of sources) {
      const result = await this.syncSource(source.id, limit);
      results.sources[source.id] = result;
      results.total += result.total;
      results.new += result.new;
    }

    return results;
  }

  async syncTierC(limit: number = 20): Promise<any> {
    console.log('[NewsSync] Syncing Tier C sources...');
    const sources = getSourcesByTier('C');
    const results: any = { tier: 'C', sources: {}, total: 0, new: 0 };

    for (const source of sources) {
      const result = await this.syncSource(source.id, limit);
      results.sources[source.id] = result;
      results.total += result.total;
      results.new += result.new;
    }

    return results;
  }

  async syncAll(limit: number = 30): Promise<any> {
    const start = Date.now();
    console.log('[NewsSync] Starting full sync...');

    const results: any = {
      ts: Date.now(),
      method: 'rss_parser',
      tiers: {},
      totals: { fetched: 0, new: 0 },
    };

    // Sync by tier
    results.tiers.A = await this.syncTierA(limit);
    results.tiers.B = await this.syncTierB(limit);
    results.tiers.C = await this.syncTierC(Math.min(limit, 20));

    // Calculate totals
    for (const tier of ['A', 'B', 'C']) {
      results.totals.fetched += results.tiers[tier].total;
      results.totals.new += results.tiers[tier].new;
    }

    results.elapsed_sec = Math.round((Date.now() - start) / 100) / 10;

    console.log(`[NewsSync] Full sync complete: ${results.totals.fetched} fetched, ${results.totals.new} new`);
    return results;
  }

  private async storeArticle(article: NewsArticle): Promise<{ isNew: boolean }> {
    // Check if exists by ID or content hash
    const existing = await this.articlesModel.findOne({
      $or: [
        { id: article.id },
        { content_hash: article.content_hash },
      ],
    });

    if (existing) {
      return { isNew: false };
    }

    await this.articlesModel.create({
      ...article,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return { isNew: true };
  }

  async getStats(): Promise<any> {
    const [total, bySource, recent] = await Promise.all([
      this.articlesModel.countDocuments(),
      this.articlesModel.aggregate([
        { $group: { _id: '$source_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.articlesModel
        .find({})
        .sort({ published_at: -1 })
        .limit(10)
        .lean(),
    ]);

    return {
      total_articles: total,
      by_source: bySource.reduce((acc, s) => {
        acc[s._id] = s.count;
        return acc;
      }, {}),
      recent: recent.map(a => ({
        id: a.id,
        title: a.title,
        source: a.source_name,
        published: a.published_at,
      })),
    };
  }
}
