/**
 * Graph Pipeline Controller
 * 
 * BLOCK 5: REST API for graph pipeline operations
 */

import { Controller, Get, Post, Query, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { GraphPipelineService } from './graph-pipeline.service';
import { BuildWindow } from './graph-pipeline.types';

@Controller('graph-pipeline')
export class GraphPipelineController {
  constructor(private readonly pipelineService: GraphPipelineService) {}

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE EXECUTION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Run the full graph pipeline
   * POST /api/graph-pipeline/run
   */
  @Post('run')
  async runPipeline(
    @Body() body: { window?: BuildWindow } = {},
  ) {
    if (this.pipelineService.isRunningPipeline()) {
      throw new HttpException('Pipeline is already running', HttpStatus.CONFLICT);
    }

    const window = body.window || '30d';
    const result = await this.pipelineService.run(window, 'api');

    return {
      success: result.success,
      buildId: result.buildId,
      snapshotId: result.snapshotId,
      stats: result.stats,
      stages: result.stages,
      totalDurationMs: result.totalDurationMs,
      warnings: result.warnings,
      errors: result.errors,
    };
  }

  /**
   * Check if pipeline is running
   * GET /api/graph-pipeline/status
   */
  @Get('status')
  getStatus() {
    return {
      isRunning: this.pipelineService.isRunningPipeline(),
      timestamp: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get latest snapshot overview
   * GET /api/graph-pipeline/overview
   */
  @Get('overview')
  async getOverview() {
    return this.pipelineService.getGraphOverview();
  }

  /**
   * Get latest snapshot (full)
   * GET /api/graph-pipeline/snapshot/latest
   */
  @Get('snapshot/latest')
  async getLatestSnapshot() {
    const snapshot = await this.pipelineService.getLatestSnapshot();
    if (!snapshot) {
      throw new HttpException('No snapshot available', HttpStatus.NOT_FOUND);
    }
    return snapshot;
  }

  /**
   * Get snapshot by buildId
   * GET /api/graph-pipeline/snapshot/:buildId
   */
  @Get('snapshot/:buildId')
  async getSnapshotById(@Param('buildId') buildId: string) {
    const snapshot = await this.pipelineService.getSnapshotById(buildId);
    if (!snapshot) {
      throw new HttpException('Snapshot not found', HttpStatus.NOT_FOUND);
    }
    return snapshot;
  }

  /**
   * List all snapshots
   * GET /api/graph-pipeline/snapshots
   */
  @Get('snapshots')
  async listSnapshots(@Query('limit') limit?: string) {
    return this.pipelineService.listSnapshots(parseInt(limit || '10', 10));
  }

  // ═══════════════════════════════════════════════════════════════
  // PROJECTIONS (For UI)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get a specific projection from latest snapshot
   * GET /api/graph-pipeline/projection/:key
   */
  @Get('projection/:key')
  async getProjection(@Param('key') key: string) {
    const snapshot = await this.pipelineService.getLatestSnapshot();
    if (!snapshot) {
      throw new HttpException('No snapshot available', HttpStatus.NOT_FOUND);
    }

    const projection = snapshot.projections.find(p => p.key === key);
    if (!projection) {
      throw new HttpException(`Projection '${key}' not found`, HttpStatus.NOT_FOUND);
    }

    return projection;
  }

  /**
   * List available projections
   * GET /api/graph-pipeline/projections
   */
  @Get('projections')
  async listProjections() {
    const snapshot = await this.pipelineService.getLatestSnapshot();
    if (!snapshot) {
      return { projections: [] };
    }

    return {
      projections: snapshot.projections.map(p => ({
        key: p.key,
        nodeCount: p.stats.nodeCount,
        edgeCount: p.stats.edgeCount,
        metadata: p.metadata,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // TOP ENTITIES (Dashboard)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get top nodes by type
   * GET /api/graph-pipeline/top-nodes?type=fund&limit=20
   */
  @Get('top-nodes')
  async getTopNodes(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const snapshot = await this.pipelineService.getLatestSnapshot();
    if (!snapshot) {
      return { nodes: [] };
    }

    let nodes = snapshot.topNodes;
    if (type) {
      nodes = nodes.filter(n => n.type === type);
    }

    const limitNum = parseInt(limit || '20', 10);
    return { nodes: nodes.slice(0, limitNum) };
  }

  /**
   * Get top edges by type
   * GET /api/graph-pipeline/top-edges?type=coinvested_with&limit=20
   */
  @Get('top-edges')
  async getTopEdges(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const snapshot = await this.pipelineService.getLatestSnapshot();
    if (!snapshot) {
      return { edges: [] };
    }

    let edges = snapshot.topEdges;
    if (type) {
      edges = edges.filter(e => e.type === type);
    }

    const limitNum = parseInt(limit || '20', 10);
    return { edges: edges.slice(0, limitNum) };
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD LOGS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get build log by buildId
   * GET /api/graph-pipeline/build-log/:buildId
   */
  @Get('build-log/:buildId')
  async getBuildLog(@Param('buildId') buildId: string) {
    const log = await this.pipelineService.getBuildLog(buildId);
    if (!log) {
      throw new HttpException('Build log not found', HttpStatus.NOT_FOUND);
    }
    return log;
  }

  /**
   * List recent build logs
   * GET /api/graph-pipeline/build-logs
   */
  @Get('build-logs')
  async listBuildLogs(@Query('limit') limit?: string) {
    return this.pipelineService.listBuildLogs(parseInt(limit || '20', 10));
  }

  /**
   * Get build statistics
   * GET /api/graph-pipeline/stats
   */
  @Get('stats')
  async getStats(@Query('hours') hours?: string) {
    return this.pipelineService.getBuildStats(parseInt(hours || '24', 10));
  }
}
