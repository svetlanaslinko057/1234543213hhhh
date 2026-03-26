/**
 * Graph Snapshot Repository
 * 
 * BLOCK 5: Persistence layer for graph snapshots
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GraphSnapshot, BuildWindow } from './graph-pipeline.types';

@Injectable()
export class GraphSnapshotRepository {
  private readonly logger = new Logger(GraphSnapshotRepository.name);

  constructor(
    @InjectModel('graph_snapshots') private readonly model: Model<any>,
  ) {}

  /**
   * Create a new snapshot
   */
  async create(snapshot: GraphSnapshot): Promise<void> {
    await this.model.create(snapshot);
    this.logger.log(`[SnapshotRepo] Created snapshot ${snapshot.buildId}`);
  }

  /**
   * Get the latest snapshot for a window
   */
  async latest(window?: BuildWindow): Promise<GraphSnapshot | null> {
    const filter = window ? { window } : {};
    const doc = await this.model
      .findOne(filter)
      .sort({ createdAt: -1 })
      .lean();
    return doc as unknown as GraphSnapshot | null;
  }

  /**
   * Get snapshot by buildId
   */
  async getById(buildId: string): Promise<GraphSnapshot | null> {
    const doc = await this.model.findOne({ buildId }).lean();
    return doc as unknown as GraphSnapshot | null;
  }

  /**
   * List recent snapshots
   */
  async list(options: {
    window?: BuildWindow;
    limit?: number;
    skip?: number;
  } = {}): Promise<GraphSnapshot[]> {
    const { window, limit = 20, skip = 0 } = options;
    const filter = window ? { window } : {};

    const docs = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    return docs as unknown as GraphSnapshot[];
  }

  /**
   * Delete old snapshots (keep last N)
   */
  async cleanup(keepLast: number = 10): Promise<number> {
    const toKeep = await this.model
      .find({})
      .sort({ createdAt: -1 })
      .limit(keepLast)
      .select('_id')
      .lean();

    const keepIds = toKeep.map((s: any) => s._id);

    const result = await this.model.deleteMany({
      _id: { $nin: keepIds },
    });

    this.logger.log(`[SnapshotRepo] Cleaned up ${result.deletedCount} old snapshots`);
    return result.deletedCount || 0;
  }

  /**
   * Get snapshot stats
   */
  async getStats(): Promise<{
    total: number;
    byWindow: Record<string, number>;
    latest: Date | null;
  }> {
    const [total, byWindow, latestDoc] = await Promise.all([
      this.model.countDocuments({}),
      this.model.aggregate([
        { $group: { _id: '$window', count: { $sum: 1 } } },
      ]),
      this.model.findOne({}).sort({ createdAt: -1 }).select('createdAt').lean(),
    ]);

    return {
      total,
      byWindow: Object.fromEntries(byWindow.map((w: any) => [w._id, w.count])),
      latest: (latestDoc as any)?.createdAt || null,
    };
  }
}
