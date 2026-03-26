/**
 * Parser Log Service
 * 
 * Stores detailed run logs for each parser execution.
 * Enables debugging, auditing, and historical analysis.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface ParserRunLog {
  _id?: string;
  parserId: string;
  parserName: string;
  startedAt: Date;
  finishedAt: Date;
  success: boolean;

  fetched: number;
  normalized: number;
  deduped: number;
  saved: number;

  durationMs: number;

  status: 'ok' | 'degraded' | 'failed';
  modeUsed: string;
  fallbackUsed: boolean;

  errors: string[];
  warnings: string[];

  responseMeta?: {
    httpStatus?: number;
    contentType?: string;
    candidateUrls?: string[];
    schemaSignature?: string;
    responseSize?: number;
  };
}

@Injectable()
export class ParserLogService implements OnModuleInit {
  private logsCollection: any;

  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit() {
    this.logsCollection = this.connection.collection('parser_run_logs');
    
    // Create indexes
    await this.logsCollection.createIndex({ parserId: 1, startedAt: -1 });
    await this.logsCollection.createIndex({ startedAt: -1 });
    await this.logsCollection.createIndex({ status: 1 });
    await this.logsCollection.createIndex({ success: 1 });
    
    // TTL index - keep logs for 30 days
    await this.logsCollection.createIndex(
      { startedAt: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60 }
    );
    
    console.log(`[ParserLogs] Log collection initialized`);
  }

  /**
   * Create a new run log
   */
  async create(log: ParserRunLog): Promise<void> {
    await this.logsCollection.insertOne({
      ...log,
      createdAt: new Date(),
    });
  }

  /**
   * Get logs for a specific parser
   */
  async getByParser(parserId: string, limit = 50): Promise<ParserRunLog[]> {
    const docs = await this.logsCollection
      .find({ parserId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
    return docs;
  }

  /**
   * Get latest logs across all parsers
   */
  async getLatest(limit = 100): Promise<ParserRunLog[]> {
    const docs = await this.logsCollection
      .find({})
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
    return docs;
  }

  /**
   * Get failed logs since a date
   */
  async getFailedSince(since: Date, limit = 100): Promise<ParserRunLog[]> {
    const docs = await this.logsCollection
      .find({
        success: false,
        startedAt: { $gte: since },
      })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
    return docs;
  }

  /**
   * Get logs with status degraded or failed since a date
   */
  async getProblematicSince(since: Date, limit = 100): Promise<ParserRunLog[]> {
    const docs = await this.logsCollection
      .find({
        status: { $in: ['degraded', 'failed'] },
        startedAt: { $gte: since },
      })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
    return docs;
  }

  /**
   * Get aggregated stats for last 24 hours
   */
  async get24hStats(): Promise<{
    totalRuns: number;
    successful: number;
    failed: number;
    degraded: number;
    totalFetched: number;
    totalSaved: number;
    avgDurationMs: number;
    byParser: Array<{
      parserId: string;
      runs: number;
      successful: number;
      failed: number;
      totalSaved: number;
    }>;
    byMode: Record<string, number>;
  }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Aggregate totals
    const totalsAgg = await this.logsCollection.aggregate([
      { $match: { startedAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalRuns: { $sum: 1 },
          successful: { $sum: { $cond: ['$success', 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          degraded: { $sum: { $cond: [{ $eq: ['$status', 'degraded'] }, 1, 0] } },
          totalFetched: { $sum: '$fetched' },
          totalSaved: { $sum: '$saved' },
          avgDurationMs: { $avg: '$durationMs' },
        },
      },
    ]).toArray();

    const totals = totalsAgg[0] || {
      totalRuns: 0,
      successful: 0,
      failed: 0,
      degraded: 0,
      totalFetched: 0,
      totalSaved: 0,
      avgDurationMs: 0,
    };

    // Aggregate by parser
    const byParserAgg = await this.logsCollection.aggregate([
      { $match: { startedAt: { $gte: since } } },
      {
        $group: {
          _id: '$parserId',
          runs: { $sum: 1 },
          successful: { $sum: { $cond: ['$success', 1, 0] } },
          failed: { $sum: { $cond: [{ $not: '$success' }, 1, 0] } },
          totalSaved: { $sum: '$saved' },
        },
      },
      { $sort: { totalSaved: -1 } },
    ]).toArray();

    const byParser = byParserAgg.map((p: any) => ({
      parserId: p._id,
      runs: p.runs,
      successful: p.successful,
      failed: p.failed,
      totalSaved: p.totalSaved,
    }));

    // Aggregate by mode
    const byModeAgg = await this.logsCollection.aggregate([
      { $match: { startedAt: { $gte: since } } },
      {
        $group: {
          _id: '$modeUsed',
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    const byMode: Record<string, number> = {};
    for (const m of byModeAgg) {
      byMode[m._id || 'unknown'] = m.count;
    }

    return {
      totalRuns: totals.totalRuns,
      successful: totals.successful,
      failed: totals.failed,
      degraded: totals.degraded,
      totalFetched: totals.totalFetched,
      totalSaved: totals.totalSaved,
      avgDurationMs: Math.round(totals.avgDurationMs || 0),
      byParser,
      byMode,
    };
  }

  /**
   * Get unique parsers that failed in last 24h
   */
  async getFailedParsers24h(): Promise<string[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await this.logsCollection.distinct('parserId', {
      success: false,
      startedAt: { $gte: since },
    });
    
    return result;
  }

  /**
   * Get parsers that recovered (were failing, now ok)
   */
  async getRecoveredParsers24h(): Promise<string[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find parsers that had failures and then successes
    const pipeline = [
      { $match: { startedAt: { $gte: since } } },
      { $sort: { parserId: 1, startedAt: 1 } },
      {
        $group: {
          _id: '$parserId',
          statuses: { $push: '$status' },
        },
      },
      {
        $match: {
          statuses: {
            $all: [{ $elemMatch: { $eq: 'failed' } }, { $elemMatch: { $eq: 'ok' } }],
          },
        },
      },
    ];

    const result = await this.logsCollection.aggregate(pipeline).toArray();
    return result.map((r: any) => r._id);
  }

  /**
   * Get empty runs (success but 0 items)
   */
  async getEmptyRuns24h(): Promise<ParserRunLog[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const docs = await this.logsCollection
      .find({
        success: true,
        saved: 0,
        startedAt: { $gte: since },
      })
      .sort({ startedAt: -1 })
      .toArray();
    
    return docs;
  }

  /**
   * Count logs
   */
  async count(): Promise<number> {
    return await this.logsCollection.countDocuments({});
  }
}
