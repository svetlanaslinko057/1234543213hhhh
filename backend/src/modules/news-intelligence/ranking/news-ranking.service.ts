/**
 * News Ranking Service
 * 
 * BLOCK 6: Ranks news clusters by importance
 * 
 * Factors:
 * - frequency: More articles = more important
 * - recency: Recent news > old news
 * - sourceWeight: Multiple sources = higher confidence
 * - entityImportance: Tier-1 entities boost score
 */

import { Injectable, Logger } from '@nestjs/common';
import { NewsCluster } from '../clustering/news-clustering.service';

export interface RankedCluster extends NewsCluster {
  rankScore: number;
  rankFactors: {
    frequency: number;
    recency: number;
    sourceWeight: number;
    entityWeight: number;
  };
}

// Source weights (tier-1 sources get higher weight)
const SOURCE_WEIGHTS: Record<string, number> = {
  coindesk: 1.2,
  theblock: 1.2,
  cointelegraph: 1.1,
  decrypt: 1.1,
  bloomberg: 1.3,
  reuters: 1.3,
  forbes: 1.2,
  twitter: 0.8,
  reddit: 0.7,
  default: 1.0,
};

// Known tier-1 entities (boost score)
const TIER1_ENTITIES = new Set([
  'a16z', 'paradigm', 'polychain', 'multicoin', 'pantera',
  'sequoia', 'binance', 'coinbase', 'jump', 'alameda',
  'dragonfly', 'framework', 'variant', 'haun', 'standard-crypto',
  'bitcoin', 'ethereum', 'solana', 'polygon', 'arbitrum',
  'optimism', 'base', 'avalanche', 'near', 'cosmos',
]);

@Injectable()
export class NewsRankingService {
  private readonly logger = new Logger(NewsRankingService.name);

  /**
   * Rank clusters by importance
   */
  rank(clusters: NewsCluster[]): RankedCluster[] {
    const ranked = clusters.map(cluster => this.scoreCluster(cluster));

    // Sort by rank score descending
    ranked.sort((a, b) => b.rankScore - a.rankScore);

    this.logger.log(`[NewsRankingService] Ranked ${ranked.length} clusters`);

    return ranked;
  }

  /**
   * Score a single cluster
   */
  private scoreCluster(cluster: NewsCluster): RankedCluster {
    // 1. Frequency factor (0-1)
    // More events = higher score, capped at 10
    const frequency = Math.min(1.0, cluster.eventCount / 10);

    // 2. Recency factor (0-1)
    const recency = this.computeRecency(cluster.lastSeenAt);

    // 3. Source weight (0-1)
    // Multiple high-quality sources boost confidence
    const sourceWeight = this.computeSourceWeight(cluster.sources);

    // 4. Entity importance (0-1)
    // Tier-1 entities boost score
    const entityWeight = this.computeEntityWeight(cluster.entities);

    // Combined score (weighted average)
    const rankScore = 
      frequency * 0.3 +
      recency * 0.35 +
      sourceWeight * 0.2 +
      entityWeight * 0.15;

    return {
      ...cluster,
      rankScore: Math.round(rankScore * 1000) / 1000,
      rankFactors: {
        frequency: Math.round(frequency * 100) / 100,
        recency: Math.round(recency * 100) / 100,
        sourceWeight: Math.round(sourceWeight * 100) / 100,
        entityWeight: Math.round(entityWeight * 100) / 100,
      },
    };
  }

  /**
   * Compute recency factor
   * Returns 1.0 for today, decays over time
   */
  private computeRecency(date: Date): number {
    const now = Date.now();
    const eventTime = new Date(date).getTime();
    const hoursOld = (now - eventTime) / (1000 * 60 * 60);

    if (hoursOld < 6) return 1.0;
    if (hoursOld < 12) return 0.95;
    if (hoursOld < 24) return 0.85;
    if (hoursOld < 48) return 0.7;
    if (hoursOld < 72) return 0.55;
    if (hoursOld < 168) return 0.4; // 1 week
    return 0.25;
  }

  /**
   * Compute source weight based on source quality and diversity
   */
  private computeSourceWeight(sources: string[]): number {
    if (sources.length === 0) return 0.5;

    // Calculate average weight of sources
    let totalWeight = 0;
    for (const source of sources) {
      const key = source.toLowerCase().replace(/[^a-z]/g, '');
      totalWeight += SOURCE_WEIGHTS[key] || SOURCE_WEIGHTS.default;
    }
    const avgWeight = totalWeight / sources.length;

    // Bonus for multiple sources (cross-validation)
    const diversityBonus = Math.min(0.2, sources.length * 0.05);

    return Math.min(1.0, (avgWeight / 1.3) * 0.8 + diversityBonus);
  }

  /**
   * Compute entity importance weight
   */
  private computeEntityWeight(entities: string[]): number {
    if (entities.length === 0) return 0.5;

    // Count tier-1 entities
    let tier1Count = 0;
    for (const entity of entities) {
      const slug = entity.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (TIER1_ENTITIES.has(slug)) {
        tier1Count++;
      }
    }

    // Base weight + tier-1 bonus
    const baseWeight = 0.5;
    const tier1Bonus = Math.min(0.4, tier1Count * 0.1);
    const entityCountBonus = Math.min(0.1, entities.length * 0.02);

    return baseWeight + tier1Bonus + entityCountBonus;
  }
}
