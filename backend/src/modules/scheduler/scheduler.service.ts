/**
 * Scheduler Service
 * 
 * Main service that:
 * - Starts cron jobs on init
 * - Handles tier execution
 * - Provides admin controls
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SchedulerRegistry, PriorityTier, TIER_CRONS } from './scheduler.registry';
import { SchedulerExecutor, JobRun } from './scheduler.executor';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private started = false;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly executor: SchedulerExecutor,
    @InjectModel('scheduler_runs') private runsModel: Model<any>,
  ) {}

  async onModuleInit() {
    // Auto-start is disabled by default - call start() manually
    this.logger.log('[Scheduler] Ready. Call POST /api/scheduler/start to begin.');
  }

  onModuleDestroy() {
    this.stop();
  }

  // ═══════════════════════════════════════════════════════════════
  // START / STOP
  // ═══════════════════════════════════════════════════════════════

  start(): void {
    if (this.started) {
      this.logger.warn('[Scheduler] Already started');
      return;
    }

    this.logger.log('[Scheduler] Starting tier-based scheduling...');

    // T1 - every 10 minutes
    const t1Interval = setInterval(() => {
      this.executeTier('T1');
    }, 10 * 60 * 1000);
    this.intervals.set('T1', t1Interval);

    // T2 - every 15 minutes
    const t2Interval = setInterval(() => {
      this.executeTier('T2');
    }, 15 * 60 * 1000);
    this.intervals.set('T2', t2Interval);

    // T3 - every 30 minutes
    const t3Interval = setInterval(() => {
      this.executeTier('T3');
    }, 30 * 60 * 1000);
    this.intervals.set('T3', t3Interval);

    // T4 - every 3 hours
    const t4Interval = setInterval(() => {
      this.executeTier('T4');
    }, 3 * 60 * 60 * 1000);
    this.intervals.set('T4', t4Interval);

    this.started = true;
    this.logger.log('[Scheduler] Started with tier-based intervals');
  }

  stop(): void {
    this.logger.log('[Scheduler] Stopping...');
    
    for (const [tier, interval] of this.intervals.entries()) {
      clearInterval(interval);
      this.logger.log(`[Scheduler] Stopped tier ${tier}`);
    }
    this.intervals.clear();
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }

  // ═══════════════════════════════════════════════════════════════
  // TIER EXECUTION
  // ═══════════════════════════════════════════════════════════════

  async executeTier(tier: PriorityTier): Promise<JobRun[]> {
    if (this.executor.isMaintenanceMode()) {
      this.logger.warn(`[Scheduler] Skipping tier ${tier} - maintenance mode`);
      return [];
    }

    this.logger.log(`[Scheduler] Executing tier ${tier}`);
    return this.executor.executeTier(tier);
  }

  // ═══════════════════════════════════════════════════════════════
  // MANUAL EXECUTION
  // ═══════════════════════════════════════════════════════════════

  async executeJob(
    jobId: string,
    options: { skipDependencies?: boolean; forceRun?: boolean } = {},
  ): Promise<JobRun> {
    return this.executor.executeJob(jobId, 'manual', options);
  }

  async executeDependencyChain(jobId: string): Promise<JobRun[]> {
    const chain = this.registry.getDependencyChain(jobId);
    const runs: JobRun[] = [];

    this.logger.log(`[Scheduler] Executing chain for ${jobId}: ${chain.join(' → ')}`);

    for (const id of chain) {
      const run = await this.executor.executeJob(id, 'manual', { skipDependencies: true });
      runs.push(run);
      
      if (run.status === 'failed' || run.status === 'timeout') {
        this.logger.error(`[Scheduler] Chain stopped at ${id}`);
        break;
      }
    }

    return runs;
  }

  // ═══════════════════════════════════════════════════════════════
  // JOB MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  enableJob(jobId: string): boolean {
    return this.registry.enable(jobId);
  }

  disableJob(jobId: string): boolean {
    return this.registry.disable(jobId);
  }

  setMaintenanceMode(enabled: boolean): void {
    this.executor.setMaintenanceMode(enabled);
  }

  // ═══════════════════════════════════════════════════════════════
  // STATUS & HISTORY
  // ═══════════════════════════════════════════════════════════════

  getStatus(): Record<string, any> {
    return {
      started: this.started,
      maintenanceMode: this.executor.isMaintenanceMode(),
      registry: this.registry.getSummary(),
      executor: this.executor.getStatus(),
      tiers: {
        T1: { cron: TIER_CRONS.T1, jobs: this.registry.getByTier('T1').map(j => j.id) },
        T2: { cron: TIER_CRONS.T2, jobs: this.registry.getByTier('T2').map(j => j.id) },
        T3: { cron: TIER_CRONS.T3, jobs: this.registry.getByTier('T3').map(j => j.id) },
        T4: { cron: TIER_CRONS.T4, jobs: this.registry.getByTier('T4').map(j => j.id) },
      },
    };
  }

  getJobs(): any[] {
    return this.registry.getAll().map(j => ({
      id: j.id,
      name: j.name,
      kind: j.kind,
      tier: j.priorityTier,
      enabled: j.enabled,
      dependencies: j.dependencies,
      concurrencyGroup: j.concurrencyGroup,
    }));
  }

  getJob(jobId: string): any {
    const job = this.registry.get(jobId);
    if (!job) return null;

    return {
      ...job,
      dependencyChain: this.registry.getDependencyChain(jobId),
      dependents: this.registry.getDependents(jobId).map(j => j.id),
    };
  }

  async getRecentRuns(jobId?: string, limit = 50): Promise<any[]> {
    const filter: any = {};
    if (jobId) filter.jobId = jobId;

    return this.runsModel
      .find(filter)
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();
  }

  async getRunStats(hours = 24): Promise<Record<string, any>> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const pipeline = [
      { $match: { startedAt: { $gte: cutoff } } },
      {
        $group: {
          _id: { jobId: '$jobId', status: '$status' },
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration_ms' },
        },
      },
    ];

    const results = await this.runsModel.aggregate(pipeline);

    // Format results
    const stats: Record<string, any> = {};
    for (const r of results) {
      const jobId = r._id.jobId;
      if (!stats[jobId]) {
        stats[jobId] = { success: 0, failed: 0, timeout: 0, skipped: 0, avgDuration: 0 };
      }
      stats[jobId][r._id.status] = r.count;
      if (r._id.status === 'success') {
        stats[jobId].avgDuration = Math.round(r.avgDuration);
      }
    }

    return stats;
  }
}
