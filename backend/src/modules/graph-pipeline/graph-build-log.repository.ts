/**
 * Graph Build Log Repository
 * 
 * BLOCK 5: Persistence layer for build logs
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GraphBuildLog } from './graph-pipeline.types';

@Injectable()
export class GraphBuildLogRepository {
  private readonly logger = new Logger(GraphBuildLogRepository.name);

  constructor(
    @InjectModel('graph_build_logs') private readonly model: Model<any>,
  ) {}

  /**
   * Create a new build log
   */
  async create(log: GraphBuildLog): Promise<void> {
    await this.model.create(log);
    this.logger.log(
      `[BuildLogRepo] Created log ${log.buildId} (success: ${log.success})`
    );
  }

  /**
   * Get log by buildId
   */
  async getById(buildId: string): Promise<GraphBuildLog | null> {
    const doc = await this.model.findOne({ buildId }).lean();
    return doc as unknown as GraphBuildLog | null;
  }

  /**
   * List recent build logs
   */
  async list(options: {
    limit?: number;
    skip?: number;
    successOnly?: boolean;
    failedOnly?: boolean;
  } = {}): Promise<GraphBuildLog[]> {
    const { limit = 20, skip = 0, successOnly, failedOnly } = options;

    const filter: any = {};
    if (successOnly) filter.success = true;
    if (failedOnly) filter.success = false;

    const docs = await this.model
      .find(filter)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    return docs as unknown as GraphBuildLog[];
  }

  /**
   * Get build statistics
   */
  async getStats(hours: number = 24): Promise<{
    total: number;
    successful: number;
    failed: number;
    avgDurationMs: number;
    avgNodeCount: number;
    avgEdgeCount: number;
  }> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const pipeline = [
      { $match: { startedAt: { $gte: cutoff } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          successful: { $sum: { $cond: ['$success', 1, 0] } },
          failed: { $sum: { $cond: ['$success', 0, 1] } },
          avgDuration: { $avg: '$stats.durationMs' },
          avgNodes: { $avg: '$stats.nodeCount' },
          avgEdges: { $avg: '$stats.totalEdgeCount' },
        },
      },
    ];

    const result = await this.model.aggregate(pipeline);
    const stats = result[0] || {};

    return {
      total: stats.total || 0,
      successful: stats.successful || 0,
      failed: stats.failed || 0,
      avgDurationMs: Math.round(stats.avgDuration || 0),
      avgNodeCount: Math.round(stats.avgNodes || 0),
      avgEdgeCount: Math.round(stats.avgEdges || 0),
    };
  }

  /**
   * Get latest successful build
   */
  async latestSuccessful(): Promise<GraphBuildLog | null> {
    const doc = await this.model
      .findOne({ success: true })
      .sort({ finishedAt: -1 })
      .lean();
    return doc as unknown as GraphBuildLog | null;
  }

  /**
   * Delete old logs (keep last N)
   */
  async cleanup(keepLast: number = 100): Promise<number> {
    const toKeep = await this.model
      .find({})
      .sort({ startedAt: -1 })
      .limit(keepLast)
      .select('_id')
      .lean();

    const keepIds = toKeep.map((l: any) => l._id);

    const result = await this.model.deleteMany({
      _id: { $nin: keepIds },
    });

    this.logger.log(`[BuildLogRepo] Cleaned up ${result.deletedCount} old logs`);
    return result.deletedCount || 0;
  }
}
