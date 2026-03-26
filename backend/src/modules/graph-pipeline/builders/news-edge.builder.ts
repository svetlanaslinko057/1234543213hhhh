/**
 * News Edge Builder
 * 
 * BLOCK 5: Builds edges from news entity mentions
 * 
 * Edge type:
 * - mentioned_in_news: Entity -> NewsArticle
 */

import { Injectable, Logger } from '@nestjs/common';
import { GraphBuildContext, GraphEdge } from '../graph-pipeline.types';

@Injectable()
export class NewsEdgeBuilder {
  private readonly logger = new Logger(NewsEdgeBuilder.name);

  /**
   * Build news edges from extracted news entities
   */
  build(ctx: GraphBuildContext): Map<string, GraphEdge> {
    const edges = new Map<string, GraphEdge>();

    // ─────────────────────────────────────────────────────────────
    // Build mentioned_in_news edges from news events
    // ─────────────────────────────────────────────────────────────
    for (const event of ctx.newsEvents) {
      const entities = event.entityCanonicalIds || event.entities || [];
      const articleId = event.id || event.articleId;
      if (!articleId || entities.length === 0) continue;

      const sourceId = event.sourceId || event.source || 'news';
      const publishedAt = event.publishedAt ? new Date(event.publishedAt) : new Date();

      for (const entityId of entities) {
        const key = this.makeEdgeKey(entityId, articleId, 'mentioned_in_news');
        if (edges.has(key)) continue;

        edges.set(key, {
          id: key,
          key,
          from: entityId,
          to: `news:${articleId}`,
          type: 'mentioned_in_news',
          directed: true,
          weight: event.score || event.relevance || 1,
          confidence: event.confidence || 0.75,
          evidenceCount: 1,
          firstSeenAt: publishedAt,
          lastSeenAt: publishedAt,
          sourceIds: [sourceId],
          metadata: {
            title: event.title,
            clusterId: event.clusterId,
            sentiment: event.sentiment,
            articleUrl: event.url,
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Also process raw news articles if they have entity tags
    // ─────────────────────────────────────────────────────────────
    for (const article of ctx.newsArticles) {
      const entities = article.extracted_entities || article.tags || [];
      const articleId = article.id || article.content_hash;
      if (!articleId || entities.length === 0) continue;

      const publishedAt = article.published_at ? new Date(article.published_at) : new Date();

      for (const entity of entities) {
        // Entity can be string or object
        const entitySlug = typeof entity === 'string' 
          ? this.slugify(entity) 
          : (entity.slug || this.slugify(entity.name));
        
        if (!entitySlug) continue;

        // Try to match entity to known nodes
        const matchedNodeId = this.matchEntityToNode(entitySlug, ctx);
        if (!matchedNodeId) continue;

        const key = this.makeEdgeKey(matchedNodeId, articleId, 'mentioned_in_news');
        if (edges.has(key)) {
          // Update confidence if we have multiple mentions
          const existing = edges.get(key)!;
          existing.evidenceCount++;
          existing.confidence = Math.min(0.95, existing.confidence + 0.05);
          continue;
        }

        edges.set(key, {
          id: key,
          key,
          from: matchedNodeId,
          to: `news:${articleId}`,
          type: 'mentioned_in_news',
          directed: true,
          weight: 1,
          confidence: 0.65, // Lower confidence for raw article extraction
          evidenceCount: 1,
          firstSeenAt: publishedAt,
          lastSeenAt: publishedAt,
          sourceIds: [article.source_id || 'news'],
          metadata: {
            title: article.title,
            source: article.source_name,
            extractionMethod: 'article_tags',
          },
        });
      }
    }

    this.logger.log(`[NewsEdgeBuilder] Built ${edges.size} news edges`);
    return edges;
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private makeEdgeKey(from: string, to: string, type: string): string {
    return `${type}:${from}:${to}`;
  }

  /**
   * Try to match an entity name/slug to a known node in the graph
   */
  private matchEntityToNode(entitySlug: string, ctx: GraphBuildContext): string | null {
    // Check if we have a direct match in nodes
    const possibleIds = [
      `project:${entitySlug}`,
      `fund:${entitySlug}`,
      `person:${entitySlug}`,
    ];

    for (const id of possibleIds) {
      if (ctx.nodes.has(id)) {
        return id;
      }
    }

    // Try fuzzy match by label
    for (const [nodeId, node] of ctx.nodes.entries()) {
      if (this.slugify(node.label) === entitySlug) {
        return nodeId;
      }
    }

    return null;
  }

  private slugify(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
