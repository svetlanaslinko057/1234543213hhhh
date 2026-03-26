/**
 * News Intelligence Service
 * 
 * BLOCK 6: CORE - Orchestrates news processing pipeline
 * 
 * Pipeline:
 * raw articles → extract → normalize → cluster → rank → events + graph edges
 * 
 * This makes the system "live" - news becomes intelligence
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EntityExtractorService, ExtractedEntities } from './extractors/entity-extractor.service';
import { EntityNormalizerService, NormalizedEntities } from './normalizers/entity-normalizer.service';
import { NewsClusteringService, NewsEvent, NewsCluster } from './clustering/news-clustering.service';
import { NewsRankingService, RankedCluster } from './ranking/news-ranking.service';

export interface ProcessedNews {
  events: NewsEvent[];
  clusters: RankedCluster[];
  stats: {
    articlesProcessed: number;
    eventsCreated: number;
    clustersCreated: number;
    entitiesExtracted: number;
    entitiesMatched: number;
    processingTimeMs: number;
  };
}

export interface GraphNewsEdge {
  from: string;
  to: string;
  type: 'mentioned_in_news' | 'co_mentioned_with';
  clusterId: string;
  eventId?: string;
  score: number;
  confidence: number;
  publishedAt: Date;
}

@Injectable()
export class NewsIntelligenceService {
  private readonly logger = new Logger(NewsIntelligenceService.name);

  constructor(
    private readonly extractor: EntityExtractorService,
    private readonly normalizer: EntityNormalizerService,
    private readonly clustering: NewsClusteringService,
    private readonly ranking: NewsRankingService,

    @InjectModel('news_articles') private articlesModel: Model<any>,
    @InjectModel('news_events') private eventsModel: Model<any>,
    @InjectModel('news_clusters') private clustersModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // MAIN PROCESSING PIPELINE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Process raw articles through the intelligence pipeline
   */
  async process(rawArticles: any[]): Promise<ProcessedNews> {
    const startTime = Date.now();

    const events: NewsEvent[] = [];
    let totalEntitiesExtracted = 0;
    let totalEntitiesMatched = 0;

    // 1. Process each article
    for (const article of rawArticles) {
      const text = this.getArticleText(article);
      if (!text) continue;

      // Extract entities
      const extracted = this.extractor.extract(text);
      totalEntitiesExtracted += 
        extracted.projects.length + 
        extracted.funds.length + 
        extracted.tokens.length + 
        extracted.persons.length;

      // Normalize to canonical IDs
      const normalized = await this.normalizer.normalize(extracted);
      totalEntitiesMatched += normalized.all.filter(e => e.matched).length;

      // Create event
      const event: NewsEvent = {
        id: article._id?.toString() || article.id || `event_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        title: article.title,
        source: article.source || 'unknown',
        publishedAt: new Date(article.published_at || article.publishedAt || Date.now()),
        type: this.detectEventType(article, extracted),
        entities: normalized.all.map(e => ({
          canonicalId: e.canonicalId,
          type: e.type,
          confidence: e.confidence,
        })),
        content: article.summary || article.content?.slice(0, 500),
      };

      if (event.entities.length > 0) {
        events.push(event);
      }
    }

    // 2. Cluster events
    const clusters = this.clustering.cluster(events);

    // 3. Rank clusters
    const rankedClusters = this.ranking.rank(clusters);

    const processingTimeMs = Date.now() - startTime;

    this.logger.log(
      `[NewsIntelligence] Processed ${rawArticles.length} articles → ` +
      `${events.length} events → ${rankedClusters.length} clusters ` +
      `(${processingTimeMs}ms)`
    );

    return {
      events,
      clusters: rankedClusters,
      stats: {
        articlesProcessed: rawArticles.length,
        eventsCreated: events.length,
        clustersCreated: rankedClusters.length,
        entitiesExtracted: totalEntitiesExtracted,
        entitiesMatched: totalEntitiesMatched,
        processingTimeMs,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GRAPH INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate graph edges from processed news
   * For integration with Graph Pipeline
   */
  generateGraphEdges(processed: ProcessedNews): GraphNewsEdge[] {
    const edges: GraphNewsEdge[] = [];

    for (const cluster of processed.clusters) {
      const publishedAt = cluster.lastSeenAt;
      const score = cluster.rankScore;

      // 1. mentioned_in_news edges (entity → cluster)
      for (const entityId of cluster.entities) {
        edges.push({
          from: entityId,
          to: `news:${cluster.id}`,
          type: 'mentioned_in_news',
          clusterId: cluster.id,
          score,
          confidence: Math.min(0.9, 0.5 + cluster.sources.length * 0.1),
          publishedAt,
        });
      }

      // 2. co_mentioned_with edges (entity ↔ entity)
      // Only for clusters with multiple entities
      if (cluster.entities.length >= 2 && cluster.entities.length <= 10) {
        for (let i = 0; i < cluster.entities.length; i++) {
          for (let j = i + 1; j < cluster.entities.length; j++) {
            const [a, b] = [cluster.entities[i], cluster.entities[j]].sort();
            
            edges.push({
              from: a,
              to: b,
              type: 'co_mentioned_with',
              clusterId: cluster.id,
              score: score * 0.8, // Slightly lower score for derived edges
              confidence: Math.min(0.85, 0.4 + cluster.eventCount * 0.05),
              publishedAt,
            });
          }
        }
      }
    }

    this.logger.log(`[NewsIntelligence] Generated ${edges.length} graph edges`);
    return edges;
  }

  // ═══════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Save processed events and clusters to database
   */
  async saveResults(processed: ProcessedNews): Promise<void> {
    const now = new Date();

    // Save events
    if (processed.events.length > 0) {
      const eventDocs = processed.events.map(e => ({
        ...e,
        createdAt: now,
      }));

      await this.eventsModel.insertMany(eventDocs, { ordered: false }).catch(e => {
        this.logger.warn(`[NewsIntelligence] Event save partial fail: ${e.message}`);
      });
    }

    // Save clusters
    if (processed.clusters.length > 0) {
      const clusterDocs = processed.clusters.map(c => ({
        clusterId: c.id,
        type: c.type,
        mainEntity: c.mainEntity,
        entities: c.entities,
        eventCount: c.eventCount,
        rankScore: c.rankScore,
        rankFactors: c.rankFactors,
        sources: c.sources,
        firstSeenAt: c.firstSeenAt,
        lastSeenAt: c.lastSeenAt,
        createdAt: now,
      }));

      await this.clustersModel.insertMany(clusterDocs, { ordered: false }).catch(e => {
        this.logger.warn(`[NewsIntelligence] Cluster save partial fail: ${e.message}`);
      });
    }

    this.logger.log(
      `[NewsIntelligence] Saved ${processed.events.length} events, ` +
      `${processed.clusters.length} clusters`
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // QUERY API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get top news clusters (for main page)
   */
  async getTopClusters(limit = 20): Promise<RankedCluster[]> {
    const docs = await this.clustersModel
      .find({})
      .sort({ rankScore: -1, lastSeenAt: -1 })
      .limit(limit)
      .lean();

    return docs as unknown as RankedCluster[];
  }

  /**
   * Get clusters for a specific entity
   */
  async getEntityClusters(entityId: string, limit = 10): Promise<RankedCluster[]> {
    const docs = await this.clustersModel
      .find({ entities: entityId })
      .sort({ lastSeenAt: -1 })
      .limit(limit)
      .lean();

    return docs as unknown as RankedCluster[];
  }

  /**
   * Get recent events
   */
  async getRecentEvents(hours = 24, limit = 50): Promise<NewsEvent[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const docs = await this.eventsModel
      .find({ publishedAt: { $gte: cutoff } })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();

    return docs as unknown as NewsEvent[];
  }

  /**
   * Get stats
   */
  async getStats(): Promise<Record<string, any>> {
    const [eventCount, clusterCount, recentClusters] = await Promise.all([
      this.eventsModel.countDocuments({}),
      this.clustersModel.countDocuments({}),
      this.clustersModel
        .find({})
        .sort({ rankScore: -1 })
        .limit(5)
        .select('type mainEntity rankScore eventCount')
        .lean(),
    ]);

    return {
      totalEvents: eventCount,
      totalClusters: clusterCount,
      topClusters: recentClusters,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get text content from article
   */
  private getArticleText(article: any): string {
    const parts = [
      article.title,
      article.summary,
      article.content,
      article.description,
    ].filter(Boolean);

    return parts.join(' ');
  }

  /**
   * Detect event type from article content
   */
  private detectEventType(article: any, extracted: ExtractedEntities): string {
    const text = this.getArticleText(article).toLowerCase();

    // Funding events
    if (
      text.includes('raise') ||
      text.includes('funding') ||
      text.includes('investment') ||
      text.includes('series a') ||
      text.includes('series b') ||
      text.includes('seed round')
    ) {
      return 'funding';
    }

    // Launch events
    if (
      text.includes('launch') ||
      text.includes('release') ||
      text.includes('mainnet') ||
      text.includes('testnet')
    ) {
      return 'launch';
    }

    // Partnership events
    if (
      text.includes('partner') ||
      text.includes('collaboration') ||
      text.includes('integrate') ||
      text.includes('join')
    ) {
      return 'partnership';
    }

    // Listing events
    if (
      text.includes('list') ||
      text.includes('trading') &&
      extracted.tokens.length > 0
    ) {
      return 'listing';
    }

    // Acquisition events
    if (
      text.includes('acquire') ||
      text.includes('acquisition') ||
      text.includes('merge')
    ) {
      return 'acquisition';
    }

    // Regulatory events
    if (
      text.includes('sec') ||
      text.includes('regulation') ||
      text.includes('compliance') ||
      text.includes('legal')
    ) {
      return 'regulatory';
    }

    return 'generic';
  }
}
