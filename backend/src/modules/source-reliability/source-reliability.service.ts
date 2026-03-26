/**
 * Source Reliability Service
 * 
 * CRITICAL: Dynamic scoring of data sources based on:
 * - reliability_score: How often data is correct
 * - latency_score: Response time
 * - freshness_score: How up-to-date is data
 * - error_rate: Failure rate
 * - final_score: Weighted combination
 * 
 * Restored from Python version for intelligent source selection
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// Score weights (from Python version)
const SCORE_WEIGHTS = {
  reliability: 0.35,
  latency: 0.20,
  freshness: 0.25,
  error_rate: 0.20, // Inverse - lower is better
};

// Source capabilities - what each source provides best
const SOURCE_CAPABILITIES: Record<string, string[]> = {
  // Tier 1 - Core
  cryptorank: ['funding', 'ico', 'unlocks', 'activities', 'persons'],
  rootdata: ['funding', 'funds', 'persons', 'portfolio', 'teams'],
  defillama: ['tvl', 'defi', 'chains', 'protocols'],
  dropstab: ['tokenomics', 'vesting', 'allocations', 'investors'],
  
  // Tier 2 - Market
  coingecko: ['prices', 'market_cap', 'volume', 'token_info'],
  coinmarketcap: ['prices', 'market_cap', 'rankings'],
  tokenunlocks: ['unlocks', 'vesting_schedule'],
  
  // Tier 3 - Activities
  icodrops: ['ico', 'ido', 'sales'],
  dropsearn: ['activities', 'airdrops'],
  dappradar: ['dapps', 'usage', 'rankings'],
  
  // Tier 4 - Research
  messari: ['research', 'profiles', 'metrics'],
  github: ['developer_activity', 'commits', 'contributors'],
  
  // Exchanges
  binance: ['prices', 'orderbook', 'trades', 'candles'],
  coinbase: ['prices', 'orderbook', 'trades', 'candles'],
  bybit: ['prices', 'orderbook', 'trades', 'candles'],
  hyperliquid: ['perps', 'funding', 'open_interest'],
};

// Default scores for new sources
const DEFAULT_SCORES = {
  reliability_score: 0.7,
  latency_score: 0.7,
  freshness_score: 0.7,
  error_rate: 0.1,
  final_score: 0.65,
};

export interface SourceMetrics {
  source_id: string;
  reliability_score: number;
  latency_score: number;
  freshness_score: number;
  error_rate: number;
  final_score: number;
  
  // Stats
  total_fetches: number;
  successful_fetches: number;
  avg_latency_ms: number;
  avg_data_age_hours: number;
  
  // Status
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  last_success_at?: Date;
  last_failure_at?: Date;
  last_error?: string;
  
  // Capabilities
  capabilities: string[];
  
  updated_at: Date;
}

export interface FetchRecord {
  source_id: string;
  success: boolean;
  latency_ms: number;
  data_freshness_hours?: number;
  endpoint?: string;
  error?: string;
  items_count?: number;
  // V2 fields for penalty calculation
  used_fallback?: boolean;
  fallback_type?: string;
  schema_drift_detected?: boolean;
  anomaly_detected?: boolean;
}

@Injectable()
export class SourceReliabilityService {
  private readonly logger = new Logger(SourceReliabilityService.name);

  constructor(
    @InjectModel('source_metrics') private metricsModel: Model<any>,
    @InjectModel('source_reliability_history') private historyModel: Model<any>,
    @InjectModel('source_fetch_logs') private fetchLogModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  async ensureIndexes(): Promise<void> {
    await this.metricsModel.collection.createIndex({ source_id: 1 }, { unique: true });
    await this.metricsModel.collection.createIndex({ final_score: -1 });
    await this.metricsModel.collection.createIndex({ status: 1 });
    
    await this.historyModel.collection.createIndex({ source_id: 1, timestamp: -1 });
    await this.fetchLogModel.collection.createIndex({ source_id: 1, timestamp: -1 });
    
    this.logger.log('[SourceReliability] Indexes created');
  }

  async seedInitialSources(): Promise<number> {
    const now = new Date();
    let seeded = 0;

    for (const [sourceId, capabilities] of Object.entries(SOURCE_CAPABILITIES)) {
      const existing = await this.metricsModel.findOne({ source_id: sourceId });
      
      if (!existing) {
        await this.metricsModel.create({
          source_id: sourceId,
          ...DEFAULT_SCORES,
          status: 'unknown',
          total_fetches: 0,
          successful_fetches: 0,
          avg_latency_ms: 0,
          avg_data_age_hours: 0,
          capabilities,
          updated_at: now,
        });
        seeded++;
      }
    }

    this.logger.log(`[SourceReliability] Seeded ${seeded} sources with default metrics`);
    return seeded;
  }

  // ═══════════════════════════════════════════════════════════════
  // RECORD FETCH
  // ═══════════════════════════════════════════════════════════════

  async recordFetch(record: FetchRecord): Promise<void> {
    const now = new Date();

    // 1. Log the fetch
    await this.fetchLogModel.create({
      source_id: record.source_id,
      success: record.success,
      latency_ms: record.latency_ms,
      data_freshness_hours: record.data_freshness_hours,
      endpoint: record.endpoint,
      error: record.error,
      items_count: record.items_count,
      timestamp: now,
    });

    // 2. Update metrics
    await this.updateMetrics(record.source_id);
  }

  private async updateMetrics(sourceId: string): Promise<void> {
    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const cutoff1h = new Date(now.getTime() - 60 * 60 * 1000);

    // Get recent fetches
    const fetches24h = await this.fetchLogModel
      .find({ source_id: sourceId, timestamp: { $gte: cutoff24h } })
      .lean();

    if (fetches24h.length === 0) return;

    const fetches1h = fetches24h.filter(f => new Date(f.timestamp) >= cutoff1h);

    // Calculate metrics
    const total = fetches24h.length;
    const successful = fetches24h.filter(f => f.success).length;
    const failed = total - successful;

    // Reliability score (success rate)
    const reliabilityScore = total > 0 ? successful / total : 0.5;

    // Latency score (100ms = 1.0, 5000ms = 0.0)
    const latencies = fetches24h
      .filter(f => f.success && f.latency_ms)
      .map(f => f.latency_ms);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 1000;
    const latencyScore = Math.max(0, Math.min(1, 1 - (avgLatency - 100) / 4900));

    // Freshness score (0h = 1.0, 24h = 0.0)
    const freshnessValues = fetches24h
      .filter(f => f.data_freshness_hours !== undefined)
      .map(f => f.data_freshness_hours);
    const avgFreshness = freshnessValues.length > 0
      ? freshnessValues.reduce((a, b) => a + b, 0) / freshnessValues.length
      : 12;
    const freshnessScore = Math.max(0, Math.min(1, 1 - avgFreshness / 24));

    // Error rate
    const errorRate = total > 0 ? failed / total : 0.5;

    // Final score (weighted)
    const finalScore =
      reliabilityScore * SCORE_WEIGHTS.reliability +
      latencyScore * SCORE_WEIGHTS.latency +
      freshnessScore * SCORE_WEIGHTS.freshness +
      (1 - errorRate) * SCORE_WEIGHTS.error_rate;

    // Determine status
    let status: 'healthy' | 'degraded' | 'down';
    if (finalScore >= 0.8 && errorRate < 0.1) {
      status = 'healthy';
    } else if (finalScore >= 0.5 && errorRate < 0.3) {
      status = 'degraded';
    } else {
      status = 'down';
    }

    // Find last success/failure
    const sortedFetches = [...fetches24h].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const lastSuccess = sortedFetches.find(f => f.success);
    const lastFailure = sortedFetches.find(f => !f.success);

    // Recent success rate (last hour)
    const recentSuccessRate = fetches1h.length > 0
      ? fetches1h.filter(f => f.success).length / fetches1h.length
      : 0;

    // Update metrics document
    const metrics = {
      source_id: sourceId,
      reliability_score: Math.round(reliabilityScore * 1000) / 1000,
      latency_score: Math.round(latencyScore * 1000) / 1000,
      freshness_score: Math.round(freshnessScore * 1000) / 1000,
      error_rate: Math.round(errorRate * 1000) / 1000,
      final_score: Math.round(finalScore * 1000) / 1000,
      total_fetches: total,
      successful_fetches: successful,
      avg_latency_ms: Math.round(avgLatency),
      avg_data_age_hours: Math.round(avgFreshness * 10) / 10,
      status,
      last_success_at: lastSuccess?.timestamp,
      last_failure_at: lastFailure?.timestamp,
      last_error: lastFailure?.error,
      recent_success_rate: Math.round(recentSuccessRate * 100) / 100,
      capabilities: SOURCE_CAPABILITIES[sourceId] || [],
      updated_at: now,
    };

    await this.metricsModel.updateOne(
      { source_id: sourceId },
      { $set: metrics },
      { upsert: true }
    );

    // Store history point
    await this.historyModel.create({
      source_id: sourceId,
      final_score: metrics.final_score,
      reliability_score: metrics.reliability_score,
      latency_score: metrics.latency_score,
      error_rate: metrics.error_rate,
      timestamp: now,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // GET METRICS
  // ═══════════════════════════════════════════════════════════════

  async getSourceMetrics(sourceId: string): Promise<SourceMetrics | null> {
    const doc = await this.metricsModel.findOne({ source_id: sourceId }).lean();

    if (!doc) {
      return {
        source_id: sourceId,
        ...DEFAULT_SCORES,
        total_fetches: 0,
        successful_fetches: 0,
        avg_latency_ms: 0,
        avg_data_age_hours: 0,
        status: 'unknown',
        capabilities: SOURCE_CAPABILITIES[sourceId] || [],
        updated_at: new Date(),
      };
    }

    return doc as unknown as SourceMetrics;
  }

  async getAllMetrics(): Promise<SourceMetrics[]> {
    const docs = await this.metricsModel
      .find({})
      .sort({ final_score: -1 })
      .lean();
    return docs as unknown as SourceMetrics[];
  }

  // ═══════════════════════════════════════════════════════════════
  // BEST SOURCE SELECTION - КРИТИЧЕСКАЯ ФУНКЦИЯ
  // ═══════════════════════════════════════════════════════════════

  async getBestSource(
    dataType: string,
    candidates?: string[],
    minScore = 0.3,
  ): Promise<string | null> {
    // Get candidates that support this data type
    if (!candidates) {
      candidates = Object.entries(SOURCE_CAPABILITIES)
        .filter(([_, caps]) => caps.includes(dataType))
        .map(([id]) => id);
    }

    if (candidates.length === 0) {
      this.logger.warn(`[SourceReliability] No candidates for data_type=${dataType}`);
      return null;
    }

    // Get scores for candidates
    const scored: Array<{ sourceId: string; score: number }> = [];

    for (const sourceId of candidates) {
      const metrics = await this.getSourceMetrics(sourceId);
      const score = metrics?.final_score ?? DEFAULT_SCORES.final_score;

      if (score >= minScore) {
        scored.push({ sourceId, score });
      }
    }

    if (scored.length === 0) {
      this.logger.warn(
        `[SourceReliability] No sources above min_score=${minScore}, using first candidate`
      );
      return candidates[0];
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0].sourceId;
    this.logger.debug(
      `[SourceReliability] Best source for ${dataType}: ${best} (score=${scored[0].score})`
    );

    return best;
  }

  async getSourceRanking(dataType?: string, limit = 10): Promise<SourceMetrics[]> {
    let allMetrics = await this.getAllMetrics();

    if (dataType) {
      // Filter by capability
      const capableSources = Object.entries(SOURCE_CAPABILITIES)
        .filter(([_, caps]) => caps.includes(dataType))
        .map(([id]) => id);
      
      allMetrics = allMetrics.filter(m => capableSources.includes(m.source_id));
    }

    return allMetrics.slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════════

  async getSourceHistory(sourceId: string, hours = 24): Promise<any[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.historyModel
      .find({
        source_id: sourceId,
        timestamp: { $gte: cutoff },
      })
      .sort({ timestamp: 1 })
      .lean();
  }

  // ═══════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════

  async getStats(): Promise<Record<string, any>> {
    const totalSources = await this.metricsModel.countDocuments({});
    const healthy = await this.metricsModel.countDocuments({ status: 'healthy' });
    const degraded = await this.metricsModel.countDocuments({ status: 'degraded' });
    const down = await this.metricsModel.countDocuments({ status: 'down' });

    // Average scores
    const pipeline = [
      {
        $group: {
          _id: null,
          avg_final: { $avg: '$final_score' },
          avg_reliability: { $avg: '$reliability_score' },
          avg_latency: { $avg: '$avg_latency_ms' },
          total_fetches: { $sum: '$total_fetches' },
        },
      },
    ];

    const aggResult = await this.metricsModel.aggregate(pipeline);
    const averages = aggResult[0] || {};

    return {
      total_sources: totalSources,
      healthy,
      degraded,
      down,
      unknown: totalSources - healthy - degraded - down,
      avg_final_score: Math.round((averages.avg_final || 0) * 1000) / 1000,
      avg_reliability: Math.round((averages.avg_reliability || 0) * 1000) / 1000,
      avg_latency_ms: Math.round(averages.avg_latency || 0),
      total_fetches_tracked: averages.total_fetches || 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CAPABILITIES
  // ═══════════════════════════════════════════════════════════════

  getCapabilities(sourceId: string): string[] {
    return SOURCE_CAPABILITIES[sourceId] || [];
  }

  getAllCapabilities(): Record<string, string[]> {
    return { ...SOURCE_CAPABILITIES };
  }
}
