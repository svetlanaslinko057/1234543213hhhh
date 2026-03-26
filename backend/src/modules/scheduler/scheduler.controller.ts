/**
 * Scheduler Controller
 * 
 * API endpoints for scheduler management
 */

import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  // ═══════════════════════════════════════════════════════════════
  // START / STOP
  // ═══════════════════════════════════════════════════════════════

  @Post('start')
  start() {
    this.schedulerService.start();
    return { ok: true, started: true };
  }

  @Post('stop')
  stop() {
    this.schedulerService.stop();
    return { ok: true, started: false };
  }

  @Get('status')
  getStatus() {
    return this.schedulerService.getStatus();
  }

  // ═══════════════════════════════════════════════════════════════
  // TIER EXECUTION
  // ═══════════════════════════════════════════════════════════════

  @Post('run/tier/:tier')
  async executeTier(@Param('tier') tier: 'T1' | 'T2' | 'T3' | 'T4') {
    const runs = await this.schedulerService.executeTier(tier);
    return {
      tier,
      runs: runs.map(r => ({
        jobId: r.jobId,
        status: r.status,
        duration_ms: r.duration_ms,
        error: r.error,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // JOB EXECUTION
  // ═══════════════════════════════════════════════════════════════

  @Post('run/job/:jobId')
  async executeJob(
    @Param('jobId') jobId: string,
    @Query('skipDeps') skipDeps?: string,
    @Query('force') force?: string,
  ) {
    const run = await this.schedulerService.executeJob(jobId, {
      skipDependencies: skipDeps === 'true',
      forceRun: force === 'true',
    });
    return {
      jobId,
      status: run.status,
      duration_ms: run.duration_ms,
      error: run.error,
      result: run.result,
    };
  }

  @Post('run/chain/:jobId')
  async executeDependencyChain(@Param('jobId') jobId: string) {
    const runs = await this.schedulerService.executeDependencyChain(jobId);
    return {
      jobId,
      chain: runs.map(r => ({
        jobId: r.jobId,
        status: r.status,
        duration_ms: r.duration_ms,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // JOB MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  @Get('jobs')
  getJobs() {
    return this.schedulerService.getJobs();
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string) {
    const job = this.schedulerService.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }
    return job;
  }

  @Post('jobs/:jobId/enable')
  enableJob(@Param('jobId') jobId: string) {
    const success = this.schedulerService.enableJob(jobId);
    return { jobId, enabled: success };
  }

  @Post('jobs/:jobId/disable')
  disableJob(@Param('jobId') jobId: string) {
    const success = this.schedulerService.disableJob(jobId);
    return { jobId, disabled: success };
  }

  // ═══════════════════════════════════════════════════════════════
  // MAINTENANCE MODE
  // ═══════════════════════════════════════════════════════════════

  @Post('maintenance/on')
  enableMaintenanceMode() {
    this.schedulerService.setMaintenanceMode(true);
    return { maintenanceMode: true };
  }

  @Post('maintenance/off')
  disableMaintenanceMode() {
    this.schedulerService.setMaintenanceMode(false);
    return { maintenanceMode: false };
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════════

  @Get('runs')
  async getRecentRuns(
    @Query('jobId') jobId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.schedulerService.getRecentRuns(jobId, limit ? parseInt(limit, 10) : 50);
  }

  @Get('stats')
  async getRunStats(@Query('hours') hours?: string) {
    return this.schedulerService.getRunStats(hours ? parseInt(hours, 10) : 24);
  }
}
