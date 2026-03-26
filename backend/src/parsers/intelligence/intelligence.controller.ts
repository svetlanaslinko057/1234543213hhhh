/**
 * Intelligence Controller
 * 
 * Endpoints for Self-Learning Ingestion Engine:
 * - Schema drift detection
 * - Strategy learning metrics
 * - Payload discovery
 * - Anomaly detection
 * - Auto-recovery
 */

import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { SchemaDriftService } from './schema-drift.service';
import { StrategyLearningService, ParsingMode } from './strategy-learning.service';
import { PayloadDiscoveryService } from './payload-discovery.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { AutoRecoveryService } from './auto-recovery.service';

@Controller('parsers/intelligence')
export class IntelligenceController {
  constructor(
    private readonly schemaDrift: SchemaDriftService,
    private readonly strategyLearning: StrategyLearningService,
    private readonly payloadDiscovery: PayloadDiscoveryService,
    private readonly anomalyDetection: AnomalyDetectionService,
    private readonly autoRecovery: AutoRecoveryService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // OVERVIEW
  // ═══════════════════════════════════════════════════════════════

  @Get('overview')
  async getOverview() {
    const metrics = this.strategyLearning.getAllMetrics();
    const signatures = this.schemaDrift.getAllSignatures();
    const baselines = this.anomalyDetection.getAllBaselines();
    const recoveryStates = this.autoRecovery.getAllStates();
    
    const recentDrifts = await this.schemaDrift.getRecentDrifts(24);
    const recentAnomalies = await this.anomalyDetection.getRecentAnomalies(24);
    const recentActions = await this.autoRecovery.getRecentActions(24);
    
    return {
      ts: Date.now(),
      summary: {
        sourcesTracked: metrics.length,
        schemaSignatures: signatures.length,
        baselines: baselines.length,
        sourcesInRecovery: recoveryStates.filter(s => s.inRecovery).length,
      },
      last24h: {
        schemaDrifts: recentDrifts.length,
        anomalies: recentAnomalies.length,
        recoveryActions: recentActions.length,
      },
      trustScores: {
        high: metrics.filter(m => m.trustScore >= 70).length,
        medium: metrics.filter(m => m.trustScore >= 40 && m.trustScore < 70).length,
        low: metrics.filter(m => m.trustScore < 40).length,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SCHEMA DRIFT
  // ═══════════════════════════════════════════════════════════════

  @Get('drift/recent')
  async getRecentDrifts(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours) : 24;
    return this.schemaDrift.getRecentDrifts(h);
  }

  @Get('drift/:sourceId')
  async getDriftHistory(@Param('sourceId') sourceId: string) {
    return {
      sourceId,
      signature: this.schemaDrift.getSignature(sourceId, 'rss') || 
                 this.schemaDrift.getSignature(sourceId, 'html') ||
                 this.schemaDrift.getSignature(sourceId, 'api'),
      history: await this.schemaDrift.getDriftHistory(sourceId),
    };
  }

  @Get('drift/signatures')
  getSignatures() {
    return this.schemaDrift.getAllSignatures();
  }

  // ═══════════════════════════════════════════════════════════════
  // STRATEGY LEARNING
  // ═══════════════════════════════════════════════════════════════

  @Get('strategy/metrics')
  getStrategyMetrics() {
    return this.strategyLearning.getAllMetrics();
  }

  @Get('strategy/decisions')
  async getDecisionHistory(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit) : 50;
    return this.strategyLearning.getDecisionHistory(undefined, l);
  }

  @Get('strategy/trust-ranking')
  getTrustRanking(@Query('minScore') minScore?: string) {
    const min = minScore ? parseInt(minScore) : 0;
    return this.strategyLearning.getByTrustScore(min);
  }

  @Get('strategy/:sourceId')
  getSourceStrategy(@Param('sourceId') sourceId: string) {
    const metrics = this.strategyLearning.getMetrics(sourceId);
    const { mode, confidence } = this.strategyLearning.getRecommendedMode(sourceId);
    
    return {
      sourceId,
      metrics,
      recommendation: { mode, confidence },
    };
  }

  @Post('strategy/record')
  async recordRun(@Body() body: { 
    sourceId: string; 
    success: boolean; 
    itemCount: number; 
    mode: ParsingMode;
  }) {
    return this.strategyLearning.recordRun(body.sourceId, {
      success: body.success,
      itemCount: body.itemCount,
      mode: body.mode,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PAYLOAD DISCOVERY
  // ═══════════════════════════════════════════════════════════════

  @Get('discovery/candidates')
  async getDiscoveredCandidates(@Query('minScore') minScore?: string) {
    const min = minScore ? parseInt(minScore) : 50;
    return this.payloadDiscovery.getTopCandidates(min);
  }

  @Get('discovery/:sourceId')
  getSourceCandidates(@Param('sourceId') sourceId: string) {
    return {
      sourceId,
      best: this.payloadDiscovery.getBestCandidate(sourceId),
      all: this.payloadDiscovery.getCandidates(sourceId),
    };
  }

  @Post('discovery/verify')
  async verifyCandiate(@Body() body: { sourceId: string; endpoint: string }) {
    await this.payloadDiscovery.verifyCandidate(body.sourceId, body.endpoint);
    return { success: true, message: 'Candidate verified' };
  }

  // ═══════════════════════════════════════════════════════════════
  // ANOMALY DETECTION
  // ═══════════════════════════════════════════════════════════════

  @Get('anomalies/recent')
  async getRecentAnomalies(
    @Query('hours') hours?: string,
    @Query('minSeverity') minSeverity?: string
  ) {
    const h = hours ? parseInt(hours) : 24;
    return this.anomalyDetection.getRecentAnomalies(h, minSeverity);
  }

  @Get('anomalies/:sourceId')
  async getSourceAnomalies(@Param('sourceId') sourceId: string) {
    return {
      sourceId,
      baseline: this.anomalyDetection.getBaseline(sourceId),
      history: await this.anomalyDetection.getAnomalyHistory(sourceId),
    };
  }

  @Get('anomalies/baselines')
  getBaselines() {
    return this.anomalyDetection.getAllBaselines();
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTO-RECOVERY
  // ═══════════════════════════════════════════════════════════════

  @Get('recovery/status')
  getRecoveryStatus() {
    const states = this.autoRecovery.getAllStates();
    const inRecovery = this.autoRecovery.getSourcesInRecovery();
    
    return {
      ts: Date.now(),
      total: states.length,
      inRecovery: inRecovery.length,
      sources: states.map(s => ({
        sourceId: s.sourceId,
        currentMode: s.currentMode,
        primaryMode: s.primaryMode,
        inRecovery: s.inRecovery,
        consecutiveFailures: s.consecutiveFailures,
        consecutiveSuccesses: s.consecutiveSuccesses,
      })),
      recovering: inRecovery,
    };
  }

  @Get('recovery/actions')
  async getRecoveryActions(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours) : 24;
    return this.autoRecovery.getRecentActions(h);
  }

  @Get('recovery/:sourceId')
  async getSourceRecovery(@Param('sourceId') sourceId: string) {
    return {
      sourceId,
      state: this.autoRecovery.getState(sourceId),
      actions: await this.autoRecovery.getActionHistory(sourceId),
    };
  }

  @Post('recovery/:sourceId/trigger')
  async triggerRecovery(@Param('sourceId') sourceId: string) {
    const action = await this.autoRecovery.manualRecover(sourceId);
    return { success: true, action };
  }
}
