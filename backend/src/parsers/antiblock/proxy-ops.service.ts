/**
 * Proxy Operations Service
 * 
 * BLOCK 7: Advanced proxy management with scoring
 * 
 * Features:
 * - Dynamic proxy scoring (success rate, latency, block rate)
 * - Best proxy selection by target type
 * - Sticky routing (same target → same proxy type)
 * - Auto-quarantine (5 fails → 30min cooldown)
 * - Health monitoring
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export interface ProxyScore {
  proxyId: string;
  server: string;
  
  // Scores (0-1)
  successRate: number;
  latencyScore: number;
  freshnessScore: number;
  blockRate: number;
  finalScore: number;
  
  // Stats
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  blockedRequests: number;
  avgLatencyMs: number;
  
  // Status
  status: 'healthy' | 'degraded' | 'quarantined' | 'unknown';
  quarantineUntil?: Date;
  lastUsedAt?: Date;
  lastSuccessAt?: Date;
  lastErrorAt?: Date;
  lastError?: string;
  
  // Affinity
  targetAffinity: string[]; // ['rss', 'html', 'api']
}

// Target type → preferred proxy characteristics
const TARGET_PREFERENCES: Record<string, { preferResidential: boolean; minScore: number }> = {
  rss: { preferResidential: false, minScore: 0.5 }, // RSS feeds - datacenter OK
  html: { preferResidential: true, minScore: 0.6 }, // HTML scraping - residential better
  api: { preferResidential: false, minScore: 0.7 }, // API calls - fastest
  exchange: { preferResidential: false, minScore: 0.8 }, // Exchange APIs - most reliable
};

// Sticky routing cache (target → last successful proxy)
const STICKY_CACHE = new Map<string, { proxyId: string; expiresAt: number }>();
const STICKY_TTL = 10 * 60 * 1000; // 10 minutes

// Score weights
const SCORE_WEIGHTS = {
  successRate: 0.4,
  latency: 0.2,
  freshness: 0.2,
  blockRate: 0.2, // Inverse
};

@Injectable()
export class ProxyOpsService {
  private readonly logger = new Logger(ProxyOpsService.name);
  
  // In-memory scoring cache
  private scores = new Map<string, ProxyScore>();

  constructor(
    @InjectModel('proxy_metrics') private metricsModel: Model<any>,
    @InjectModel('proxy_requests') private requestsModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // BEST PROXY SELECTION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get best proxy for a specific target type
   * Uses sticky routing + scoring
   */
  async getBestProxy(
    target: 'rss' | 'html' | 'api' | 'exchange',
    targetUrl?: string,
  ): Promise<{ proxyId: string; server: string } | null> {
    const preferences = TARGET_PREFERENCES[target] || TARGET_PREFERENCES.api;

    // 1. Check sticky cache first
    if (targetUrl) {
      const stickyKey = `${target}:${this.extractDomain(targetUrl)}`;
      const sticky = STICKY_CACHE.get(stickyKey);
      
      if (sticky && sticky.expiresAt > Date.now()) {
        const score = this.scores.get(sticky.proxyId);
        if (score && score.status !== 'quarantined' && score.finalScore >= preferences.minScore) {
          this.logger.debug(`[ProxyOps] Sticky hit for ${stickyKey}: ${sticky.proxyId}`);
          return { proxyId: sticky.proxyId, server: score.server };
        }
      }
    }

    // 2. Get all available proxies with scores
    const candidates = Array.from(this.scores.values())
      .filter(s => s.status !== 'quarantined')
      .filter(s => s.finalScore >= preferences.minScore)
      .filter(s => !s.targetAffinity.length || s.targetAffinity.includes(target))
      .sort((a, b) => b.finalScore - a.finalScore);

    if (candidates.length === 0) {
      this.logger.warn(`[ProxyOps] No suitable proxy for target=${target}`);
      return null;
    }

    // 3. Select best proxy
    const best = candidates[0];

    // 4. Update sticky cache
    if (targetUrl) {
      const stickyKey = `${target}:${this.extractDomain(targetUrl)}`;
      STICKY_CACHE.set(stickyKey, {
        proxyId: best.proxyId,
        expiresAt: Date.now() + STICKY_TTL,
      });
    }

    return { proxyId: best.proxyId, server: best.server };
  }

  // ═══════════════════════════════════════════════════════════════
  // RECORD REQUEST RESULT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Record a proxy request result
   */
  async recordRequest(
    proxyId: string,
    target: string,
    result: {
      success: boolean;
      latencyMs: number;
      blocked?: boolean;
      error?: string;
      statusCode?: number;
    },
  ): Promise<void> {
    const now = new Date();

    // 1. Log to database
    await this.requestsModel.create({
      proxyId,
      target,
      success: result.success,
      latencyMs: result.latencyMs,
      blocked: result.blocked || false,
      error: result.error,
      statusCode: result.statusCode,
      timestamp: now,
    }).catch(() => {});

    // 2. Update in-memory score
    let score = this.scores.get(proxyId);
    if (!score) {
      score = this.createDefaultScore(proxyId, proxyId);
      this.scores.set(proxyId, score);
    }

    score.totalRequests++;
    score.lastUsedAt = now;

    if (result.success) {
      score.successfulRequests++;
      score.lastSuccessAt = now;
      score.avgLatencyMs = this.updateAvg(score.avgLatencyMs, result.latencyMs, score.totalRequests);
    } else {
      score.failedRequests++;
      score.lastErrorAt = now;
      score.lastError = result.error;

      if (result.blocked) {
        score.blockedRequests++;
      }
    }

    // 3. Recalculate scores
    this.recalculateScore(score);

    // 4. Check for quarantine
    if (this.shouldQuarantine(score)) {
      this.quarantine(score);
    }
  }

  /**
   * Report success (convenience method)
   */
  async reportSuccess(proxyId: string, target: string, latencyMs: number): Promise<void> {
    await this.recordRequest(proxyId, target, { success: true, latencyMs });
  }

  /**
   * Report failure (convenience method)
   */
  async reportFailure(
    proxyId: string,
    target: string,
    error: string,
    blocked = false,
  ): Promise<void> {
    await this.recordRequest(proxyId, target, {
      success: false,
      latencyMs: 0,
      error,
      blocked,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SCORING
  // ═══════════════════════════════════════════════════════════════

  private recalculateScore(score: ProxyScore): void {
    if (score.totalRequests === 0) return;

    // Success rate (0-1)
    score.successRate = score.successfulRequests / score.totalRequests;

    // Latency score (100ms = 1.0, 5000ms = 0.0)
    score.latencyScore = Math.max(0, Math.min(1, 1 - (score.avgLatencyMs - 100) / 4900));

    // Freshness score (based on last success time)
    const hoursSinceSuccess = score.lastSuccessAt
      ? (Date.now() - score.lastSuccessAt.getTime()) / (1000 * 60 * 60)
      : 24;
    score.freshnessScore = Math.max(0, Math.min(1, 1 - hoursSinceSuccess / 24));

    // Block rate (inverse)
    score.blockRate = score.blockedRequests / Math.max(1, score.totalRequests);

    // Final score
    score.finalScore =
      score.successRate * SCORE_WEIGHTS.successRate +
      score.latencyScore * SCORE_WEIGHTS.latency +
      score.freshnessScore * SCORE_WEIGHTS.freshness +
      (1 - score.blockRate) * SCORE_WEIGHTS.blockRate;

    // Update status
    if (score.finalScore >= 0.8 && score.blockRate < 0.1) {
      score.status = 'healthy';
    } else if (score.finalScore >= 0.5) {
      score.status = 'degraded';
    } else {
      score.status = 'quarantined';
    }
  }

  private shouldQuarantine(score: ProxyScore): boolean {
    // Quarantine if:
    // - 5+ consecutive failures (approximated by >5 failures in last 10 requests)
    // - Block rate > 30%
    // - Final score < 0.3
    
    const recentFailRate = score.totalRequests > 0
      ? score.failedRequests / score.totalRequests
      : 0;

    return (
      recentFailRate > 0.5 ||
      score.blockRate > 0.3 ||
      score.finalScore < 0.3
    );
  }

  private quarantine(score: ProxyScore): void {
    const cooldownMs = 30 * 60 * 1000; // 30 minutes
    score.status = 'quarantined';
    score.quarantineUntil = new Date(Date.now() + cooldownMs);

    this.logger.warn(
      `[ProxyOps] Quarantined proxy ${score.proxyId} for 30min ` +
      `(score=${score.finalScore.toFixed(2)}, blockRate=${score.blockRate.toFixed(2)})`
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PROXY REGISTRATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Register a proxy for scoring
   */
  registerProxy(
    proxyId: string,
    server: string,
    affinity: string[] = [],
  ): void {
    if (!this.scores.has(proxyId)) {
      const score = this.createDefaultScore(proxyId, server);
      score.targetAffinity = affinity;
      this.scores.set(proxyId, score);
      
      this.logger.log(`[ProxyOps] Registered proxy ${proxyId} with affinity: ${affinity.join(', ')}`);
    }
  }

  /**
   * Unquarantine a proxy (manual override)
   */
  unquarantine(proxyId: string): void {
    const score = this.scores.get(proxyId);
    if (score) {
      score.status = 'degraded';
      score.quarantineUntil = undefined;
      // Reset failure count
      score.failedRequests = Math.floor(score.failedRequests / 2);
      score.blockedRequests = Math.floor(score.blockedRequests / 2);
      this.recalculateScore(score);
      
      this.logger.log(`[ProxyOps] Unquarantined proxy ${proxyId}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STATUS API
  // ═══════════════════════════════════════════════════════════════

  getScores(): ProxyScore[] {
    return Array.from(this.scores.values())
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  getScore(proxyId: string): ProxyScore | null {
    return this.scores.get(proxyId) || null;
  }

  getStats(): {
    total: number;
    healthy: number;
    degraded: number;
    quarantined: number;
    avgScore: number;
    avgLatency: number;
    totalRequests: number;
    successRate: number;
  } {
    const scores = Array.from(this.scores.values());
    
    if (scores.length === 0) {
      return {
        total: 0,
        healthy: 0,
        degraded: 0,
        quarantined: 0,
        avgScore: 0,
        avgLatency: 0,
        totalRequests: 0,
        successRate: 0,
      };
    }

    const healthy = scores.filter(s => s.status === 'healthy').length;
    const degraded = scores.filter(s => s.status === 'degraded').length;
    const quarantined = scores.filter(s => s.status === 'quarantined').length;
    
    const totalRequests = scores.reduce((sum, s) => sum + s.totalRequests, 0);
    const successfulRequests = scores.reduce((sum, s) => sum + s.successfulRequests, 0);

    return {
      total: scores.length,
      healthy,
      degraded,
      quarantined,
      avgScore: scores.reduce((sum, s) => sum + s.finalScore, 0) / scores.length,
      avgLatency: scores.reduce((sum, s) => sum + s.avgLatencyMs, 0) / scores.length,
      totalRequests,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private createDefaultScore(proxyId: string, server: string): ProxyScore {
    return {
      proxyId,
      server,
      successRate: 0.7,
      latencyScore: 0.7,
      freshnessScore: 0.5,
      blockRate: 0,
      finalScore: 0.65,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      blockedRequests: 0,
      avgLatencyMs: 0,
      status: 'unknown',
      targetAffinity: [],
    };
  }

  private updateAvg(currentAvg: number, newValue: number, count: number): number {
    return (currentAvg * (count - 1) + newValue) / count;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
}
