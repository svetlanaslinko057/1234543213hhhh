/**
 * Parser Report Service
 * 
 * Generates daily ingestion reports with:
 * - Source status summary
 * - Ingestion metrics
 * - Fallback usage
 * - Alerts for problems
 * - Top/bottom sources
 */

import { Injectable } from '@nestjs/common';
import { ParserRuntimeStateService } from './parser-runtime-state.service';
import { ParserLogService } from './parser-log.service';

export interface DailyReport {
  date: string;
  generatedAt: string;
  summary: {
    totalSources: number;
    ok: number;
    degraded: number;
    failed: number;
    quarantined: number;
    disabled: number;
    successRate: string;
  };
  ingestion: {
    totalRuns: number;
    totalFetched: number;
    totalSaved: number;
    totalDuplicates: number;
    avgDurationMs: number;
  };
  fallback: {
    rss: number;
    html: number;
    browser: number;
    api: number;
    replace: number;
  };
  alerts: string[];
  topSources: Array<{
    parserId: string;
    parserName: string;
    saved: number;
    successRate: string;
  }>;
  problematicSources: Array<{
    parserId: string;
    parserName: string;
    status: string;
    lastError?: string;
    consecutiveFailures: number;
  }>;
  zeroItemSources: string[];
  recoveredSources: string[];
  newlyBrokenSources: string[];
}

@Injectable()
export class ParserReportService {
  constructor(
    private readonly runtimeState: ParserRuntimeStateService,
    private readonly logService: ParserLogService,
  ) {}

  /**
   * Generate daily report
   */
  async generateDailyReport(): Promise<DailyReport> {
    const now = new Date();
    const states = this.runtimeState.getAll();
    const summary = this.runtimeState.getSummary();
    const logStats = await this.logService.get24hStats();
    
    // Generate alerts
    const alerts: string[] = [];
    
    // Check for problematic sources
    const problematicSources = states
      .filter(s => s.status === 'failed' || s.status === 'quarantined' || s.status === 'degraded')
      .map(s => ({
        parserId: s.parserId,
        parserName: s.parserName,
        status: s.status,
        lastError: s.lastError,
        consecutiveFailures: s.consecutiveFailures,
      }));

    for (const ps of problematicSources) {
      if (ps.consecutiveFailures >= 3) {
        alerts.push(`${ps.parserName} failed ${ps.consecutiveFailures} consecutive times`);
      }
      if (ps.status === 'quarantined') {
        alerts.push(`${ps.parserName} is quarantined`);
      }
    }

    // Check for empty runs
    const emptyRuns = await this.logService.getEmptyRuns24h();
    const emptyParsers = [...new Set(emptyRuns.map(r => r.parserId))];
    const zeroItemSources = emptyParsers.filter(p => {
      const runs = emptyRuns.filter(r => r.parserId === p);
      return runs.length >= 2; // At least 2 empty runs
    });

    for (const zs of zeroItemSources.slice(0, 3)) {
      alerts.push(`${zs} returned 0 items multiple times`);
    }

    // Get recovered sources
    const recoveredSources = await this.logService.getRecoveredParsers24h();
    
    // Newly broken = failed now but wasn't yesterday
    // Simplified: sources that have consecutive failures > 0 but less than 5
    const newlyBrokenSources = states
      .filter(s => s.consecutiveFailures > 0 && s.consecutiveFailures < 5 && s.status === 'failed')
      .map(s => s.parserId);

    // Top sources by volume
    const topSources = logStats.byParser
      .filter(p => p.totalSaved > 0)
      .slice(0, 10)
      .map(p => {
        const state = this.runtimeState.getById(p.parserId);
        return {
          parserId: p.parserId,
          parserName: state?.parserName || p.parserId,
          saved: p.totalSaved,
          successRate: p.runs > 0 ? `${Math.round(p.successful / p.runs * 100)}%` : '0%',
        };
      });

    // Count by mode
    const fallback = {
      rss: logStats.byMode['rss'] || 0,
      html: logStats.byMode['html'] || 0,
      browser: logStats.byMode['browser'] || 0,
      api: logStats.byMode['api'] || 0,
      replace: logStats.byMode['replace'] || 0,
    };

    // Success rate
    const successRate = logStats.totalRuns > 0
      ? `${Math.round(logStats.successful / logStats.totalRuns * 100)}%`
      : '0%';

    return {
      date: now.toISOString().split('T')[0],
      generatedAt: now.toISOString(),
      summary: {
        totalSources: summary.total,
        ok: summary.ok,
        degraded: summary.degraded,
        failed: summary.failed,
        quarantined: summary.quarantined,
        disabled: summary.disabled,
        successRate,
      },
      ingestion: {
        totalRuns: logStats.totalRuns,
        totalFetched: logStats.totalFetched,
        totalSaved: logStats.totalSaved,
        totalDuplicates: logStats.totalFetched - logStats.totalSaved,
        avgDurationMs: logStats.avgDurationMs,
      },
      fallback,
      alerts,
      topSources,
      problematicSources,
      zeroItemSources,
      recoveredSources,
      newlyBrokenSources,
    };
  }

  /**
   * Generate source quality scores
   */
  async getSourceQualityScores(): Promise<Array<{
    parserId: string;
    parserName: string;
    qualityScore: number;
    avgItemsPerDay: number;
    successRate: number;
    fallbackUsagePercent: number;
    lastNonEmptyRun: Date | null;
    status: string;
  }>> {
    const states = this.runtimeState.getAll();
    const logStats = await this.logService.get24hStats();

    const scores = states.map(state => {
      const parserStats = logStats.byParser.find(p => p.parserId === state.parserId);
      
      // Calculate quality score (0-100)
      let qualityScore = 50; // Base score
      
      // Success rate contribution (up to 30 points)
      const successRate = parserStats 
        ? (parserStats.successful / Math.max(parserStats.runs, 1)) * 100
        : 0;
      qualityScore += successRate * 0.3;
      
      // Item count contribution (up to 20 points)
      if (state.avgItemCount24h > 0) {
        qualityScore += Math.min(20, state.avgItemCount24h / 5);
      }
      
      // Recency contribution (up to 10 points)
      if (state.lastNonEmptyAt) {
        const hoursSinceLastData = (Date.now() - state.lastNonEmptyAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastData < 24) {
          qualityScore += 10 - (hoursSinceLastData / 24) * 10;
        }
      }
      
      // Penalties
      if (state.status === 'failed') qualityScore -= 20;
      if (state.status === 'quarantined') qualityScore -= 30;
      if (state.status === 'degraded') qualityScore -= 10;
      if (state.fallbackInUse) qualityScore -= 5;
      
      return {
        parserId: state.parserId,
        parserName: state.parserName,
        qualityScore: Math.max(0, Math.min(100, Math.round(qualityScore))),
        avgItemsPerDay: state.avgItemCount24h,
        successRate,
        fallbackUsagePercent: state.fallbackInUse ? 100 : 0,
        lastNonEmptyRun: state.lastNonEmptyAt || null,
        status: state.status,
      };
    });

    return scores.sort((a, b) => b.qualityScore - a.qualityScore);
  }
}
