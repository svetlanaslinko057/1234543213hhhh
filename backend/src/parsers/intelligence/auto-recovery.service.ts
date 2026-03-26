/**
 * Auto-Recovery Service
 * 
 * Automatically recovers failed sources:
 * - Switches to fallback when primary fails
 * - Promotes stable fallback to primary
 * - Manages source replacement
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { StrategyLearningService, ParsingMode } from './strategy-learning.service';
import { SchemaDriftService } from './schema-drift.service';
import { AnomalyDetectionService } from './anomaly-detection.service';

export interface RecoveryAction {
  sourceId: string;
  action: 'switch_mode' | 'quarantine' | 'replace' | 'recover' | 'disable';
  fromMode?: ParsingMode;
  toMode?: ParsingMode;
  reason: string;
  timestamp: Date;
  automated: boolean;
}

export interface SourceRecoveryState {
  sourceId: string;
  currentMode: ParsingMode;
  primaryMode: ParsingMode;
  fallbackChain: ParsingMode[];
  
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  
  inRecovery: boolean;
  recoveryStartedAt?: Date;
  
  lastAutoSwitch?: Date;
  switchCooldownUntil?: Date;
}

const STABLE_RUNS_TO_PROMOTE = 5;
const FAILURE_THRESHOLD = 3;
const SWITCH_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class AutoRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(AutoRecoveryService.name);
  private recoveryCollection: any;
  private actionsCollection: any;
  private states: Map<string, SourceRecoveryState> = new Map();

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly strategyLearning: StrategyLearningService,
    private readonly schemaDrift: SchemaDriftService,
    private readonly anomalyDetection: AnomalyDetectionService,
  ) {}

  async onModuleInit() {
    this.recoveryCollection = this.connection.collection('source_recovery_state');
    this.actionsCollection = this.connection.collection('recovery_actions');
    
    await this.recoveryCollection.createIndex({ sourceId: 1 }, { unique: true });
    await this.actionsCollection.createIndex({ sourceId: 1, timestamp: -1 });
    await this.actionsCollection.createIndex({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
    
    // Load states
    const docs = await this.recoveryCollection.find({}).toArray();
    for (const doc of docs) {
      this.states.set(doc.sourceId, doc);
    }
    
    this.logger.log(`Loaded ${this.states.size} source recovery states`);
  }

  /**
   * Initialize recovery state for a source
   */
  initializeSource(
    sourceId: string, 
    primaryMode: ParsingMode = 'rss',
    fallbackChain: ParsingMode[] = ['html', 'browser']
  ): SourceRecoveryState {
    const state: SourceRecoveryState = {
      sourceId,
      currentMode: primaryMode,
      primaryMode,
      fallbackChain,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      inRecovery: false,
    };
    this.states.set(sourceId, state);
    return state;
  }

  /**
   * Process run result and determine recovery actions
   */
  async processRunResult(
    sourceId: string,
    success: boolean,
    itemCount: number,
    mode: ParsingMode
  ): Promise<RecoveryAction | null> {
    let state = this.states.get(sourceId);
    if (!state) {
      state = this.initializeSource(sourceId);
    }

    // Update counters
    if (success && itemCount > 0) {
      state.consecutiveFailures = 0;
      state.consecutiveSuccesses++;
    } else {
      state.consecutiveSuccesses = 0;
      state.consecutiveFailures++;
    }

    // Check for anomalies
    const anomaly = await this.anomalyDetection.checkAndUpdate(sourceId, itemCount);
    
    // Check for schema drift
    // (Would need data to check - simplified here)

    let action: RecoveryAction | null = null;

    // Decide on recovery action
    if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
      // Source is failing - try fallback
      action = await this.tryFallback(state);
    } else if (state.inRecovery && state.consecutiveSuccesses >= STABLE_RUNS_TO_PROMOTE) {
      // Fallback is stable - consider promotion
      action = await this.considerPromotion(state);
    } else if (anomaly.isAnomaly && anomaly.severity === 'critical') {
      // Critical anomaly - trigger recovery
      action = await this.triggerRecovery(state, `Critical anomaly: ${anomaly.details.message}`);
    }

    // Save state
    state.currentMode = mode;
    await this.saveState(state);

    return action;
  }

  /**
   * Try switching to next fallback in chain
   */
  private async tryFallback(state: SourceRecoveryState): Promise<RecoveryAction | null> {
    // Check cooldown
    if (state.switchCooldownUntil && new Date() < state.switchCooldownUntil) {
      return null;
    }

    const currentIdx = state.fallbackChain.indexOf(state.currentMode);
    const nextIdx = currentIdx + 1;
    
    if (nextIdx >= state.fallbackChain.length) {
      // No more fallbacks - quarantine
      return this.quarantineSource(state, 'All fallback options exhausted');
    }

    const nextMode = state.fallbackChain[nextIdx];
    const action: RecoveryAction = {
      sourceId: state.sourceId,
      action: 'switch_mode',
      fromMode: state.currentMode,
      toMode: nextMode,
      reason: `${state.consecutiveFailures} consecutive failures on ${state.currentMode}`,
      timestamp: new Date(),
      automated: true,
    };

    state.currentMode = nextMode;
    state.inRecovery = true;
    state.recoveryStartedAt = new Date();
    state.consecutiveFailures = 0;
    state.lastAutoSwitch = new Date();
    state.switchCooldownUntil = new Date(Date.now() + SWITCH_COOLDOWN_MS);

    await this.logAction(action);
    this.logger.log(`Auto-switch: ${state.sourceId} ${action.fromMode} → ${action.toMode}`);

    return action;
  }

  /**
   * Consider promoting fallback to primary
   */
  private async considerPromotion(state: SourceRecoveryState): Promise<RecoveryAction | null> {
    // Check if learning service recommends current mode
    const { mode: recommended, confidence } = this.strategyLearning.getRecommendedMode(state.sourceId);
    
    if (recommended === state.currentMode && confidence >= 0.7) {
      // Promote fallback to primary
      const action: RecoveryAction = {
        sourceId: state.sourceId,
        action: 'switch_mode',
        fromMode: state.primaryMode,
        toMode: state.currentMode,
        reason: `Fallback ${state.currentMode} stable for ${state.consecutiveSuccesses} runs, promoting to primary`,
        timestamp: new Date(),
        automated: true,
      };

      state.primaryMode = state.currentMode;
      state.inRecovery = false;
      state.recoveryStartedAt = undefined;

      await this.logAction(action);
      this.logger.log(`Promoted: ${state.sourceId} fallback ${state.currentMode} → primary`);

      return action;
    }

    return null;
  }

  /**
   * Trigger recovery mode
   */
  private async triggerRecovery(state: SourceRecoveryState, reason: string): Promise<RecoveryAction> {
    state.inRecovery = true;
    state.recoveryStartedAt = new Date();

    const action: RecoveryAction = {
      sourceId: state.sourceId,
      action: 'recover',
      reason,
      timestamp: new Date(),
      automated: true,
    };

    await this.logAction(action);
    return action;
  }

  /**
   * Quarantine a source
   */
  private async quarantineSource(state: SourceRecoveryState, reason: string): Promise<RecoveryAction> {
    const action: RecoveryAction = {
      sourceId: state.sourceId,
      action: 'quarantine',
      reason,
      timestamp: new Date(),
      automated: true,
    };

    await this.logAction(action);
    this.logger.warn(`Quarantined: ${state.sourceId} - ${reason}`);

    return action;
  }

  /**
   * Manual recovery trigger
   */
  async manualRecover(sourceId: string): Promise<RecoveryAction> {
    let state = this.states.get(sourceId);
    if (!state) {
      state = this.initializeSource(sourceId);
    }

    state.currentMode = state.primaryMode;
    state.consecutiveFailures = 0;
    state.consecutiveSuccesses = 0;
    state.inRecovery = false;
    state.switchCooldownUntil = undefined;

    await this.saveState(state);

    const action: RecoveryAction = {
      sourceId,
      action: 'recover',
      toMode: state.primaryMode,
      reason: 'Manual recovery triggered',
      timestamp: new Date(),
      automated: false,
    };

    await this.logAction(action);
    return action;
  }

  private async saveState(state: SourceRecoveryState): Promise<void> {
    this.states.set(state.sourceId, state);
    await this.recoveryCollection.updateOne(
      { sourceId: state.sourceId },
      { $set: state },
      { upsert: true }
    );
  }

  private async logAction(action: RecoveryAction): Promise<void> {
    await this.actionsCollection.insertOne(action);
  }

  /**
   * Get recovery state for source
   */
  getState(sourceId: string): SourceRecoveryState | undefined {
    return this.states.get(sourceId);
  }

  /**
   * Get all states
   */
  getAllStates(): SourceRecoveryState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get sources in recovery
   */
  getSourcesInRecovery(): SourceRecoveryState[] {
    return this.getAllStates().filter(s => s.inRecovery);
  }

  /**
   * Get recent actions
   */
  async getRecentActions(hours = 24): Promise<RecoveryAction[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.actionsCollection
      .find({ timestamp: { $gte: since } })
      .sort({ timestamp: -1 })
      .toArray();
  }

  /**
   * Get actions for source
   */
  async getActionHistory(sourceId: string, limit = 50): Promise<RecoveryAction[]> {
    return this.actionsCollection
      .find({ sourceId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }
}
