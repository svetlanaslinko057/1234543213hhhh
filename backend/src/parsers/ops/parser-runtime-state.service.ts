/**
 * Parser Runtime State Service
 * 
 * Manages runtime state for all sources:
 * - Status tracking (ok/degraded/failed/quarantined/disabled)
 * - Consecutive failures/empty runs
 * - Circuit breaker state
 * - Fallback mode tracking
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export type ParserStatus = 'ok' | 'degraded' | 'failed' | 'quarantined' | 'disabled' | 'unknown';
export type ActiveMode = 'rss' | 'html' | 'browser' | 'replace' | 'api' | 'xhr';

export interface ParserRuntimeState {
  parserId: string;
  parserName: string;
  enabled: boolean;
  activeMode: ActiveMode;
  status: ParserStatus;

  lastRunAt?: Date;
  lastSuccessAt?: Date;
  lastNonEmptyAt?: Date;
  lastFailureAt?: Date;

  consecutiveFailures: number;
  consecutiveEmptyRuns: number;
  totalRuns24h: number;
  successfulRuns24h: number;

  lastItemCount: number;
  avgItemCount24h: number;
  avgDurationMs24h: number;

  lastError?: string;
  lastWarnings: string[];
  circuitOpenUntil?: Date;

  fallbackInUse: boolean;
  sourceKind: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  entityType: string;
}

export interface RunResult {
  success: boolean;
  itemsFetched: number;
  itemsSaved: number;
  durationMs: number;
  modeUsed: ActiveMode;
  fallbackUsed: boolean;
  error?: string;
  warnings?: string[];
}

// Thresholds
const QUARANTINE_THRESHOLD = 5;
const QUARANTINE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SILENT_FAILURE_AVG_THRESHOLD = 5; // If avg > 5 and current = 0 → degraded

@Injectable()
export class ParserRuntimeStateService implements OnModuleInit {
  private stateCollection: any;
  private states: Map<string, ParserRuntimeState> = new Map();

  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit() {
    this.stateCollection = this.connection.collection('parser_runtime_state');
    
    // Create indexes
    await this.stateCollection.createIndex({ parserId: 1 }, { unique: true });
    await this.stateCollection.createIndex({ status: 1 });
    
    // Load existing states
    const docs = await this.stateCollection.find({}).toArray();
    for (const doc of docs) {
      this.states.set(doc.parserId, this.docToState(doc));
    }
    
    console.log(`[RuntimeState] Loaded ${this.states.size} parser states`);
  }

  private docToState(doc: any): ParserRuntimeState {
    return {
      parserId: doc.parserId,
      parserName: doc.parserName || doc.parserId,
      enabled: doc.enabled ?? true,
      activeMode: doc.activeMode || 'rss',
      status: doc.status || 'unknown',
      lastRunAt: doc.lastRunAt ? new Date(doc.lastRunAt) : undefined,
      lastSuccessAt: doc.lastSuccessAt ? new Date(doc.lastSuccessAt) : undefined,
      lastNonEmptyAt: doc.lastNonEmptyAt ? new Date(doc.lastNonEmptyAt) : undefined,
      lastFailureAt: doc.lastFailureAt ? new Date(doc.lastFailureAt) : undefined,
      consecutiveFailures: doc.consecutiveFailures || 0,
      consecutiveEmptyRuns: doc.consecutiveEmptyRuns || 0,
      totalRuns24h: doc.totalRuns24h || 0,
      successfulRuns24h: doc.successfulRuns24h || 0,
      lastItemCount: doc.lastItemCount || 0,
      avgItemCount24h: doc.avgItemCount24h || 0,
      avgDurationMs24h: doc.avgDurationMs24h || 0,
      lastError: doc.lastError,
      lastWarnings: doc.lastWarnings || [],
      circuitOpenUntil: doc.circuitOpenUntil ? new Date(doc.circuitOpenUntil) : undefined,
      fallbackInUse: doc.fallbackInUse || false,
      sourceKind: doc.sourceKind || 'rss',
      priority: doc.priority || 'medium',
      entityType: doc.entityType || 'news',
    };
  }

  /**
   * Initialize state for a parser (from registry)
   */
  async initializeParser(config: {
    parserId: string;
    parserName: string;
    sourceKind: string;
    priority?: string;
    entityType?: string;
    defaultMode?: ActiveMode;
  }): Promise<ParserRuntimeState> {
    const existing = this.states.get(config.parserId);
    if (existing) return existing;

    const state: ParserRuntimeState = {
      parserId: config.parserId,
      parserName: config.parserName,
      enabled: true,
      activeMode: config.defaultMode || 'rss',
      status: 'unknown',
      consecutiveFailures: 0,
      consecutiveEmptyRuns: 0,
      totalRuns24h: 0,
      successfulRuns24h: 0,
      lastItemCount: 0,
      avgItemCount24h: 0,
      avgDurationMs24h: 0,
      lastWarnings: [],
      fallbackInUse: false,
      sourceKind: config.sourceKind,
      priority: (config.priority as any) || 'medium',
      entityType: config.entityType || 'news',
    };

    await this.saveState(state);
    this.states.set(config.parserId, state);
    return state;
  }

  /**
   * Get all states
   */
  getAll(): ParserRuntimeState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get state by parser ID
   */
  getById(parserId: string): ParserRuntimeState | undefined {
    return this.states.get(parserId);
  }

  /**
   * Get all quarantined parsers
   */
  getQuarantined(): ParserRuntimeState[] {
    const now = new Date();
    return this.getAll().filter(s => 
      s.status === 'quarantined' && 
      s.circuitOpenUntil && 
      s.circuitOpenUntil > now
    );
  }

  /**
   * Get all failed/degraded parsers
   */
  getFailedOrDegraded(): ParserRuntimeState[] {
    return this.getAll().filter(s => 
      s.status === 'failed' || s.status === 'degraded'
    );
  }

  /**
   * Mark run started
   */
  async markRunStarted(parserId: string): Promise<void> {
    const state = this.states.get(parserId);
    if (!state) return;

    state.lastRunAt = new Date();
    await this.saveState(state);
  }

  /**
   * Mark run result - core logic for status determination
   */
  async markRunResult(parserId: string, result: RunResult): Promise<ParserRuntimeState | null> {
    let state = this.states.get(parserId);
    if (!state) return null;

    const now = new Date();

    // Update basic metrics
    state.lastRunAt = now;
    state.lastItemCount = result.itemsSaved;
    state.activeMode = result.modeUsed;
    state.fallbackInUse = result.fallbackUsed;
    state.totalRuns24h = (state.totalRuns24h || 0) + 1;

    // Update rolling averages (simplified)
    if (result.itemsSaved > 0) {
      state.avgItemCount24h = Math.round(
        (state.avgItemCount24h * 0.9 + result.itemsSaved * 0.1)
      );
    }
    state.avgDurationMs24h = Math.round(
      (state.avgDurationMs24h * 0.9 + result.durationMs * 0.1)
    );

    if (result.success) {
      state.lastSuccessAt = now;
      state.successfulRuns24h = (state.successfulRuns24h || 0) + 1;
      state.consecutiveFailures = 0;
      state.lastError = undefined;

      if (result.itemsSaved > 0) {
        state.lastNonEmptyAt = now;
        state.consecutiveEmptyRuns = 0;
        state.status = 'ok';
      } else {
        // Silent failure detection
        state.consecutiveEmptyRuns++;
        
        if (state.avgItemCount24h > SILENT_FAILURE_AVG_THRESHOLD) {
          // Expected items but got 0 → degraded
          state.status = 'degraded';
          state.lastWarnings = ['Silent failure: expected items but received 0'];
        } else {
          // Source might just be quiet
          state.status = state.consecutiveEmptyRuns >= 3 ? 'degraded' : 'ok';
        }
      }

      // Handle warnings
      if (result.warnings && result.warnings.length > 0) {
        state.lastWarnings = result.warnings;
        if (state.status === 'ok') {
          state.status = 'degraded';
        }
      }
    } else {
      // Run failed
      state.consecutiveFailures++;
      state.lastFailureAt = now;
      state.lastError = result.error;
      state.lastWarnings = result.warnings || [];

      if (state.consecutiveFailures >= QUARANTINE_THRESHOLD) {
        // Quarantine the source
        state.status = 'quarantined';
        state.circuitOpenUntil = new Date(now.getTime() + QUARANTINE_DURATION_MS);
      } else {
        state.status = 'failed';
      }
    }

    await this.saveState(state);
    return state;
  }

  /**
   * Mark parser as disabled
   */
  async markDisabled(parserId: string): Promise<void> {
    const state = this.states.get(parserId);
    if (!state) return;

    state.enabled = false;
    state.status = 'disabled';
    await this.saveState(state);
  }

  /**
   * Mark parser as enabled
   */
  async markEnabled(parserId: string): Promise<void> {
    const state = this.states.get(parserId);
    if (!state) return;

    state.enabled = true;
    state.status = 'unknown';
    state.consecutiveFailures = 0;
    state.consecutiveEmptyRuns = 0;
    await this.saveState(state);
  }

  /**
   * Put parser in quarantine
   */
  async markQuarantined(parserId: string, durationMs?: number): Promise<void> {
    const state = this.states.get(parserId);
    if (!state) return;

    state.status = 'quarantined';
    state.circuitOpenUntil = new Date(Date.now() + (durationMs || QUARANTINE_DURATION_MS));
    await this.saveState(state);
  }

  /**
   * Clear quarantine for parser
   */
  async clearQuarantine(parserId: string): Promise<void> {
    const state = this.states.get(parserId);
    if (!state) return;

    state.status = 'unknown';
    state.circuitOpenUntil = undefined;
    state.consecutiveFailures = 0;
    state.consecutiveEmptyRuns = 0;
    await this.saveState(state);
  }

  /**
   * Check if parser can run (not quarantined, not disabled)
   */
  canRun(parserId: string): { canRun: boolean; reason?: string } {
    const state = this.states.get(parserId);
    if (!state) return { canRun: true };

    if (!state.enabled || state.status === 'disabled') {
      return { canRun: false, reason: 'Parser is disabled' };
    }

    if (state.status === 'quarantined' && state.circuitOpenUntil) {
      if (new Date() < state.circuitOpenUntil) {
        return { canRun: false, reason: `Quarantined until ${state.circuitOpenUntil.toISOString()}` };
      }
    }

    return { canRun: true };
  }

  /**
   * Get summary stats
   */
  getSummary(): {
    total: number;
    ok: number;
    degraded: number;
    failed: number;
    quarantined: number;
    disabled: number;
    unknown: number;
  } {
    const states = this.getAll();
    return {
      total: states.length,
      ok: states.filter(s => s.status === 'ok').length,
      degraded: states.filter(s => s.status === 'degraded').length,
      failed: states.filter(s => s.status === 'failed').length,
      quarantined: states.filter(s => s.status === 'quarantined').length,
      disabled: states.filter(s => s.status === 'disabled').length,
      unknown: states.filter(s => s.status === 'unknown').length,
    };
  }

  /**
   * Update active mode (for fallback tracking)
   */
  async updateActiveMode(parserId: string, mode: ActiveMode): Promise<void> {
    const state = this.states.get(parserId);
    if (!state) return;

    state.activeMode = mode;
    state.fallbackInUse = mode !== 'rss' && state.sourceKind === 'rss';
    await this.saveState(state);
  }

  private async saveState(state: ParserRuntimeState): Promise<void> {
    this.states.set(state.parserId, state);
    await this.stateCollection.updateOne(
      { parserId: state.parserId },
      { $set: { ...state, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  /**
   * Reset daily counters (call via CRON at midnight)
   */
  async resetDailyCounters(): Promise<void> {
    for (const state of this.states.values()) {
      state.totalRuns24h = 0;
      state.successfulRuns24h = 0;
      await this.saveState(state);
    }
  }
}
