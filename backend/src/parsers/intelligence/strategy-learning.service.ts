/**
 * Self-Learning Strategy Engine
 * 
 * Automatically selects the best parsing strategy for each source:
 * - Tracks success rates per mode (rss, html, browser, api)
 * - Calculates scores based on success + item yield
 * - Auto-switches to better performing mode
 * - Prevents thrashing with confidence threshold
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export type ParsingMode = 'rss' | 'html' | 'browser' | 'api' | 'xhr';

export interface SourceMetrics {
  sourceId: string;
  
  // Success rates by mode (0-100)
  successRates: Record<ParsingMode, number>;
  
  // Average items per successful run
  avgItems: Record<ParsingMode, number>;
  
  // Total runs per mode
  runCounts: Record<ParsingMode, number>;
  
  // Last successful run per mode
  lastSuccess: Record<ParsingMode, Date | null>;
  
  // Currently recommended mode
  recommendedMode: ParsingMode;
  
  // Confidence in recommendation (0-1)
  confidence: number;
  
  // Trust score (0-100)
  trustScore: number;
  
  updatedAt: Date;
}

interface RunResult {
  success: boolean;
  itemCount: number;
  mode: ParsingMode;
}

const MIN_RUNS_FOR_CONFIDENCE = 3;
const MODE_SWITCH_THRESHOLD = 0.7; // 70% confidence needed to switch

@Injectable()
export class StrategyLearningService implements OnModuleInit {
  private readonly logger = new Logger(StrategyLearningService.name);
  private metricsCollection: any;
  private decisionLogsCollection: any;
  private metrics: Map<string, SourceMetrics> = new Map();

  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit() {
    this.metricsCollection = this.connection.collection('source_learning_metrics');
    this.decisionLogsCollection = this.connection.collection('strategy_decisions');
    
    await this.metricsCollection.createIndex({ sourceId: 1 }, { unique: true });
    await this.decisionLogsCollection.createIndex({ sourceId: 1, decidedAt: -1 });
    
    // Load existing metrics
    const docs = await this.metricsCollection.find({}).toArray();
    for (const doc of docs) {
      this.metrics.set(doc.sourceId, this.docToMetrics(doc));
    }
    
    this.logger.log(`Loaded ${this.metrics.size} source learning metrics`);
  }

  private docToMetrics(doc: any): SourceMetrics {
    return {
      sourceId: doc.sourceId,
      successRates: doc.successRates || { rss: 0, html: 0, browser: 0, api: 0, xhr: 0 },
      avgItems: doc.avgItems || { rss: 0, html: 0, browser: 0, api: 0, xhr: 0 },
      runCounts: doc.runCounts || { rss: 0, html: 0, browser: 0, api: 0, xhr: 0 },
      lastSuccess: doc.lastSuccess || { rss: null, html: null, browser: null, api: null, xhr: null },
      recommendedMode: doc.recommendedMode || 'rss',
      confidence: doc.confidence || 0,
      trustScore: doc.trustScore || 50,
      updatedAt: doc.updatedAt || new Date(),
    };
  }

  private initMetrics(sourceId: string): SourceMetrics {
    return {
      sourceId,
      successRates: { rss: 50, html: 50, browser: 50, api: 50, xhr: 50 },
      avgItems: { rss: 0, html: 0, browser: 0, api: 0, xhr: 0 },
      runCounts: { rss: 0, html: 0, browser: 0, api: 0, xhr: 0 },
      lastSuccess: { rss: null, html: null, browser: null, api: null, xhr: null },
      recommendedMode: 'rss',
      confidence: 0,
      trustScore: 50,
      updatedAt: new Date(),
    };
  }

  /**
   * Record a run result and update metrics
   */
  async recordRun(sourceId: string, result: RunResult): Promise<{
    modeChanged: boolean;
    newMode?: ParsingMode;
    confidence: number;
  }> {
    let metrics = this.metrics.get(sourceId);
    if (!metrics) {
      metrics = this.initMetrics(sourceId);
    }

    const mode = result.mode;
    
    // Update run count
    metrics.runCounts[mode] = (metrics.runCounts[mode] || 0) + 1;
    
    // Update success rate (exponential moving average)
    const successValue = result.success ? 100 : 0;
    const alpha = 0.2; // Learning rate
    metrics.successRates[mode] = Math.round(
      metrics.successRates[mode] * (1 - alpha) + successValue * alpha
    );
    
    // Update average items
    if (result.success && result.itemCount > 0) {
      metrics.avgItems[mode] = Math.round(
        metrics.avgItems[mode] * 0.8 + result.itemCount * 0.2
      );
      metrics.lastSuccess[mode] = new Date();
    }
    
    // Calculate trust score
    metrics.trustScore = this.calculateTrustScore(metrics);
    
    // Determine best mode
    const oldMode = metrics.recommendedMode;
    const { bestMode, confidence } = this.chooseBestMode(metrics);
    
    metrics.confidence = confidence;
    metrics.updatedAt = new Date();
    
    // Check if we should switch modes
    let modeChanged = false;
    if (bestMode !== oldMode && confidence >= MODE_SWITCH_THRESHOLD) {
      metrics.recommendedMode = bestMode;
      modeChanged = true;
      
      // Log the decision
      await this.decisionLogsCollection.insertOne({
        sourceId,
        decidedAt: new Date(),
        previousMode: oldMode,
        newMode: bestMode,
        confidence,
        reason: `${bestMode} has better score (${this.getModeScore(metrics, bestMode).toFixed(1)} vs ${this.getModeScore(metrics, oldMode).toFixed(1)})`,
        metrics: {
          successRates: { ...metrics.successRates },
          avgItems: { ...metrics.avgItems },
          runCounts: { ...metrics.runCounts },
        },
      });
      
      this.logger.log(`Strategy switch for ${sourceId}: ${oldMode} → ${bestMode} (confidence: ${(confidence * 100).toFixed(0)}%)`);
    }
    
    // Save metrics
    this.metrics.set(sourceId, metrics);
    await this.metricsCollection.updateOne(
      { sourceId },
      { $set: metrics },
      { upsert: true }
    );
    
    return {
      modeChanged,
      newMode: modeChanged ? bestMode : undefined,
      confidence,
    };
  }

  /**
   * Calculate score for a mode
   */
  private getModeScore(metrics: SourceMetrics, mode: ParsingMode): number {
    const successWeight = 0.6;
    const itemsWeight = 0.3;
    const recencyWeight = 0.1;
    
    const successScore = metrics.successRates[mode] || 0;
    const itemsScore = Math.min(100, (metrics.avgItems[mode] || 0) * 2);
    
    // Recency: higher score if used recently
    let recencyScore = 0;
    const lastSuccess = metrics.lastSuccess[mode];
    if (lastSuccess) {
      const hoursSinceSuccess = (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 60 * 60);
      recencyScore = Math.max(0, 100 - hoursSinceSuccess * 2);
    }
    
    return successScore * successWeight + itemsScore * itemsWeight + recencyScore * recencyWeight;
  }

  /**
   * Choose the best mode based on metrics
   */
  private chooseBestMode(metrics: SourceMetrics): { bestMode: ParsingMode; confidence: number } {
    const modes: ParsingMode[] = ['rss', 'html', 'browser', 'api', 'xhr'];
    
    const scores = modes.map(mode => ({
      mode,
      score: this.getModeScore(metrics, mode),
      runs: metrics.runCounts[mode] || 0,
    }));
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    const best = scores[0];
    const second = scores[1];
    
    // Calculate confidence based on:
    // 1. Score difference
    // 2. Number of runs
    const scoreDiff = second ? (best.score - second.score) / 100 : 0.5;
    const runsConfidence = Math.min(1, best.runs / MIN_RUNS_FOR_CONFIDENCE);
    
    const confidence = Math.min(1, scoreDiff * 0.5 + runsConfidence * 0.5);
    
    return { bestMode: best.mode, confidence };
  }

  /**
   * Calculate trust score for a source
   */
  private calculateTrustScore(metrics: SourceMetrics): number {
    // Find best performing mode
    const modes: ParsingMode[] = ['rss', 'html', 'browser', 'api', 'xhr'];
    let bestSuccessRate = 0;
    let bestAvgItems = 0;
    
    for (const mode of modes) {
      if (metrics.runCounts[mode] > 0) {
        bestSuccessRate = Math.max(bestSuccessRate, metrics.successRates[mode]);
        bestAvgItems = Math.max(bestAvgItems, metrics.avgItems[mode]);
      }
    }
    
    // Trust = success rate * 0.4 + non-empty rate * 0.3 + freshness * 0.2 - fallback penalty * 0.1
    const successComponent = bestSuccessRate * 0.4;
    const itemsComponent = Math.min(30, bestAvgItems * 0.6); // Cap at 30
    
    // Freshness: check most recent success
    let freshnessComponent = 0;
    for (const mode of modes) {
      const lastSuccess = metrics.lastSuccess[mode];
      if (lastSuccess) {
        const hoursSince = (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 60 * 60);
        const freshness = Math.max(0, 20 - hoursSince * 0.5);
        freshnessComponent = Math.max(freshnessComponent, freshness);
      }
    }
    
    // Fallback penalty: if not using RSS, slight penalty
    const fallbackPenalty = metrics.recommendedMode !== 'rss' ? 5 : 0;
    
    return Math.round(Math.min(100, Math.max(0,
      successComponent + itemsComponent + freshnessComponent - fallbackPenalty
    )));
  }

  /**
   * Get recommended mode for a source
   */
  getRecommendedMode(sourceId: string): { mode: ParsingMode; confidence: number } {
    const metrics = this.metrics.get(sourceId);
    if (!metrics) {
      return { mode: 'rss', confidence: 0 };
    }
    return { mode: metrics.recommendedMode, confidence: metrics.confidence };
  }

  /**
   * Get metrics for a source
   */
  getMetrics(sourceId: string): SourceMetrics | undefined {
    return this.metrics.get(sourceId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): SourceMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get sources ranked by trust score
   */
  getByTrustScore(minScore = 0): SourceMetrics[] {
    return this.getAllMetrics()
      .filter(m => m.trustScore >= minScore)
      .sort((a, b) => b.trustScore - a.trustScore);
  }

  /**
   * Get strategy decision history
   */
  async getDecisionHistory(sourceId?: string, limit = 50): Promise<any[]> {
    const query = sourceId ? { sourceId } : {};
    return this.decisionLogsCollection
      .find(query)
      .sort({ decidedAt: -1 })
      .limit(limit)
      .toArray();
  }
}
