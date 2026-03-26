/**
 * Scheduler Executor
 * 
 * Executes jobs with:
 * - Concurrency control per group
 * - Dependency resolution
 * - Timeout handling
 * - Lock management (prevent parallel runs)
 * - Run logging
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SchedulerRegistry, ScheduledJob, ConcurrencyGroup, CONCURRENCY_LIMITS } from './scheduler.registry';

export interface JobRun {
  jobId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'success' | 'failed' | 'timeout' | 'skipped';
  duration_ms?: number;
  result?: any;
  error?: string;
  triggeredBy: 'scheduler' | 'manual' | 'dependency';
  dependencyOf?: string;
}

@Injectable()
export class SchedulerExecutor {
  private readonly logger = new Logger(SchedulerExecutor.name);
  
  // Active job counts per concurrency group
  private activeJobs: Map<ConcurrencyGroup, Set<string>> = new Map();
  
  // Maintenance mode
  private maintenanceMode = false;

  constructor(
    private readonly registry: SchedulerRegistry,
    @InjectModel('scheduler_runs') private runsModel: Model<any>,
    @InjectModel('scheduler_locks') private locksModel: Model<any>,
  ) {
    // Initialize concurrency tracking
    for (const group of Object.keys(CONCURRENCY_LIMITS) as ConcurrencyGroup[]) {
      this.activeJobs.set(group, new Set());
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EXECUTION
  // ═══════════════════════════════════════════════════════════════

  async executeJob(
    jobId: string,
    triggeredBy: 'scheduler' | 'manual' | 'dependency' = 'scheduler',
    options: {
      skipDependencies?: boolean;
      forceRun?: boolean;
      dependencyOf?: string;
    } = {},
  ): Promise<JobRun> {
    const job = this.registry.get(jobId);
    if (!job) {
      return this.createSkippedRun(jobId, triggeredBy, 'Job not found');
    }

    // Check maintenance mode
    if (this.maintenanceMode && !options.forceRun) {
      this.logger.warn(`[Scheduler] Skipping ${jobId} - maintenance mode`);
      return this.createSkippedRun(jobId, triggeredBy, 'Maintenance mode');
    }

    // Check if job is enabled
    if (!job.enabled && !options.forceRun) {
      return this.createSkippedRun(jobId, triggeredBy, 'Job disabled');
    }

    // Check concurrency limit
    if (!this.canStartJob(job)) {
      this.logger.warn(`[Scheduler] Skipping ${jobId} - concurrency limit reached`);
      return this.createSkippedRun(jobId, triggeredBy, 'Concurrency limit');
    }

    // Acquire lock
    const lockAcquired = await this.acquireLock(jobId);
    if (!lockAcquired) {
      this.logger.warn(`[Scheduler] Skipping ${jobId} - already running`);
      return this.createSkippedRun(jobId, triggeredBy, 'Already running');
    }

    // Execute dependencies first (unless skipped)
    if (!options.skipDependencies && job.dependencies.length > 0) {
      for (const depId of job.dependencies) {
        const depRun = await this.executeJob(depId, 'dependency', {
          dependencyOf: jobId,
        });
        
        if (depRun.status === 'failed' || depRun.status === 'timeout') {
          await this.releaseLock(jobId);
          return this.createSkippedRun(jobId, triggeredBy, `Dependency ${depId} failed`);
        }
      }
    }

    // Start execution
    const run: JobRun = {
      jobId,
      startedAt: new Date(),
      status: 'running',
      triggeredBy,
      dependencyOf: options.dependencyOf,
    };

    this.markJobStarted(job);

    try {
      this.logger.log(`[Scheduler] Starting ${jobId}`);
      
      // Execute with timeout
      const result = await this.executeWithTimeout(job);
      
      run.completedAt = new Date();
      run.duration_ms = run.completedAt.getTime() - run.startedAt.getTime();
      run.status = 'success';
      run.result = result;

      this.logger.log(`[Scheduler] Completed ${jobId} in ${run.duration_ms}ms`);
    } catch (error: any) {
      run.completedAt = new Date();
      run.duration_ms = run.completedAt.getTime() - run.startedAt.getTime();
      
      if (error.message === 'TIMEOUT') {
        run.status = 'timeout';
        run.error = `Timeout after ${job.timeoutMs}ms`;
        this.logger.error(`[Scheduler] Timeout ${jobId}`);
      } else {
        run.status = 'failed';
        run.error = error.message;
        this.logger.error(`[Scheduler] Failed ${jobId}: ${error.message}`);
      }
    } finally {
      this.markJobCompleted(job);
      await this.releaseLock(jobId);
    }

    // Save run
    await this.saveRun(run);

    return run;
  }

  private async executeWithTimeout(job: ScheduledJob): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('TIMEOUT'));
      }, job.timeoutMs);

      // Execute the handler
      this.callHandler(job.handler)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private async callHandler(handlerPath: string): Promise<any> {
    // Handler format: "service.method"
    // In production, this would resolve to actual service methods
    // For now, we'll emit an event or call via HTTP
    
    const [service, method] = handlerPath.split('.');
    
    // Map handlers to actual endpoints
    const endpointMap: Record<string, string> = {
      'parsers.syncDropstabInvestors': '/api/parsers/sync/dropstab/investors?pages=10',
      'parsers.syncDropstabFunding': '/api/parsers/sync/dropstab/fundraising?pages=20',
      'parsers.syncCryptoRankFunding': '/api/parsers/sync/cryptorank/funding?pages=10',
      'parsers.syncICODrops': '/api/parsers/sync/icodrops',
      'news.syncTierA': '/api/news/sync/tier/A',
      'news.syncTierB': '/api/news/sync/tier/B',
      'news.syncTierC': '/api/news/sync/tier/C',
      'entities.resolve': '/api/entities/resolve',
      'smartMoney.analyze': '/api/smart-money/analyze',
      'graphBuilders.buildDerivedEdges': '/api/graph-builders/derived/build-all',
      'rootdata.syncAll': '/api/rootdata/sync?pages=10',
      'newsIntelligence.extractEntities': '/api/news-intelligence/extract',
      'newsIntelligence.cluster': '/api/news-intelligence/cluster',
      'graph.fullRebuild': '/api/graph/rebuild',
      'graph.createSnapshot': '/api/graph/snapshot',
      'reliability.recompute': '/api/reliability/recompute',
      // Block 5: Graph Pipeline
      'graphPipeline.run': '/api/graph-pipeline/run',
    };

    const endpoint = endpointMap[handlerPath];
    if (!endpoint) {
      throw new Error(`Unknown handler: ${handlerPath}`);
    }

    // Call internal endpoint
    const axios = (await import('axios')).default;
    const response = await axios.post(`http://localhost:3001${endpoint}`, {}, {
      timeout: 300000, // 5 min default
    });

    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════
  // TIER EXECUTION
  // ═══════════════════════════════════════════════════════════════

  async executeTier(tier: 'T1' | 'T2' | 'T3' | 'T4'): Promise<JobRun[]> {
    const jobs = this.registry.getByTier(tier);
    const runs: JobRun[] = [];

    this.logger.log(`[Scheduler] Executing tier ${tier} (${jobs.length} jobs)`);

    // Sort by dependencies (topological sort)
    const sorted = this.topologicalSort(jobs);

    for (const job of sorted) {
      const run = await this.executeJob(job.id, 'scheduler');
      runs.push(run);
    }

    return runs;
  }

  private topologicalSort(jobs: ScheduledJob[]): ScheduledJob[] {
    const jobMap = new Map(jobs.map(j => [j.id, j]));
    const sorted: ScheduledJob[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (job: ScheduledJob) => {
      if (temp.has(job.id)) {
        throw new Error(`Circular dependency detected: ${job.id}`);
      }
      if (visited.has(job.id)) return;

      temp.add(job.id);

      for (const depId of job.dependencies) {
        const dep = jobMap.get(depId);
        if (dep) visit(dep);
      }

      temp.delete(job.id);
      visited.add(job.id);
      sorted.push(job);
    };

    for (const job of jobs) {
      if (!visited.has(job.id)) {
        visit(job);
      }
    }

    return sorted;
  }

  // ═══════════════════════════════════════════════════════════════
  // CONCURRENCY CONTROL
  // ═══════════════════════════════════════════════════════════════

  private canStartJob(job: ScheduledJob): boolean {
    const active = this.activeJobs.get(job.concurrencyGroup) || new Set();
    const limit = CONCURRENCY_LIMITS[job.concurrencyGroup];
    return active.size < limit;
  }

  private markJobStarted(job: ScheduledJob): void {
    const active = this.activeJobs.get(job.concurrencyGroup);
    if (active) {
      active.add(job.id);
    }
  }

  private markJobCompleted(job: ScheduledJob): void {
    const active = this.activeJobs.get(job.concurrencyGroup);
    if (active) {
      active.delete(job.id);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LOCKING
  // ═══════════════════════════════════════════════════════════════

  private async acquireLock(jobId: string): Promise<boolean> {
    try {
      const now = new Date();
      const lockExpiry = new Date(now.getTime() + 30 * 60 * 1000); // 30 min max

      const result = await this.locksModel.updateOne(
        {
          job_id: jobId,
          $or: [
            { locked: false },
            { expires_at: { $lt: now } },
          ],
        },
        {
          $set: {
            job_id: jobId,
            locked: true,
            locked_at: now,
            expires_at: lockExpiry,
          },
        },
        { upsert: true }
      );

      return result.modifiedCount > 0 || result.upsertedCount > 0;
    } catch (error) {
      return false;
    }
  }

  private async releaseLock(jobId: string): Promise<void> {
    await this.locksModel.updateOne(
      { job_id: jobId },
      { $set: { locked: false } }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RUN LOGGING
  // ═══════════════════════════════════════════════════════════════

  private async saveRun(run: JobRun): Promise<void> {
    await this.runsModel.create(run);
  }

  private createSkippedRun(
    jobId: string,
    triggeredBy: 'scheduler' | 'manual' | 'dependency',
    reason: string,
  ): JobRun {
    return {
      jobId,
      startedAt: new Date(),
      completedAt: new Date(),
      status: 'skipped',
      duration_ms: 0,
      error: reason,
      triggeredBy,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MAINTENANCE MODE
  // ═══════════════════════════════════════════════════════════════

  setMaintenanceMode(enabled: boolean): void {
    this.maintenanceMode = enabled;
    this.logger.log(`[Scheduler] Maintenance mode: ${enabled ? 'ON' : 'OFF'}`);
  }

  isMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  // ═══════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════

  getStatus(): Record<string, any> {
    const status: Record<string, any> = {
      maintenanceMode: this.maintenanceMode,
      activeJobs: {},
    };

    for (const [group, active] of this.activeJobs.entries()) {
      status.activeJobs[group] = {
        active: Array.from(active),
        count: active.size,
        limit: CONCURRENCY_LIMITS[group],
      };
    }

    return status;
  }
}
