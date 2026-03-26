/**
 * Anomaly Detection Service
 * 
 * Detects abnormal patterns in data collection:
 * - Item count drops (vs baseline)
 * - Sudden spikes
 * - Pattern breaks
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface AnomalyResult {
  isAnomaly: boolean;
  type: 'drop' | 'spike' | 'pattern' | 'none';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: {
    expected: number;
    actual: number;
    deviationPercent: number;
    message: string;
  };
}

export interface SourceBaseline {
  sourceId: string;
  avgItemCount: number;
  stdDev: number;
  minItems: number;
  maxItems: number;
  samples: number;
  lastUpdated: Date;
}

@Injectable()
export class AnomalyDetectionService implements OnModuleInit {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private baselinesCollection: any;
  private anomalyLogsCollection: any;
  private baselines: Map<string, SourceBaseline> = new Map();

  // Thresholds
  private readonly DROP_THRESHOLD = 0.25; // 75% drop from average
  private readonly SPIKE_THRESHOLD = 3.0; // 3x average
  private readonly MIN_SAMPLES = 5; // Need 5 samples for baseline

  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit() {
    this.baselinesCollection = this.connection.collection('source_baselines');
    this.anomalyLogsCollection = this.connection.collection('anomaly_logs');
    
    await this.baselinesCollection.createIndex({ sourceId: 1 }, { unique: true });
    await this.anomalyLogsCollection.createIndex({ sourceId: 1, detectedAt: -1 });
    await this.anomalyLogsCollection.createIndex({ detectedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
    
    // Load baselines
    const docs = await this.baselinesCollection.find({}).toArray();
    for (const doc of docs) {
      this.baselines.set(doc.sourceId, doc);
    }
    
    this.logger.log(`Loaded ${this.baselines.size} source baselines`);
  }

  /**
   * Update baseline and check for anomalies
   */
  async checkAndUpdate(sourceId: string, itemCount: number): Promise<AnomalyResult> {
    let baseline = this.baselines.get(sourceId);
    
    if (!baseline) {
      // Initialize baseline
      baseline = {
        sourceId,
        avgItemCount: itemCount,
        stdDev: 0,
        minItems: itemCount,
        maxItems: itemCount,
        samples: 1,
        lastUpdated: new Date(),
      };
      this.baselines.set(sourceId, baseline);
      await this.saveBaseline(baseline);
      
      return {
        isAnomaly: false,
        type: 'none',
        severity: 'low',
        details: {
          expected: itemCount,
          actual: itemCount,
          deviationPercent: 0,
          message: 'First sample, baseline initialized',
        },
      };
    }

    // Check for anomaly before updating baseline
    const result = this.detectAnomaly(baseline, itemCount);
    
    if (result.isAnomaly) {
      // Log the anomaly
      await this.anomalyLogsCollection.insertOne({
        sourceId,
        detectedAt: new Date(),
        type: result.type,
        severity: result.severity,
        itemCount,
        baseline: {
          avg: baseline.avgItemCount,
          stdDev: baseline.stdDev,
          min: baseline.minItems,
          max: baseline.maxItems,
        },
        details: result.details,
      });
      
      this.logger.warn(`ANOMALY [${result.severity}] for ${sourceId}: ${result.details.message}`);
    }
    
    // Update baseline with new sample (don't update if anomaly is critical)
    if (result.severity !== 'critical') {
      baseline = this.updateBaseline(baseline, itemCount);
      this.baselines.set(sourceId, baseline);
      await this.saveBaseline(baseline);
    }
    
    return result;
  }

  /**
   * Detect anomaly against baseline
   */
  private detectAnomaly(baseline: SourceBaseline, itemCount: number): AnomalyResult {
    const avg = baseline.avgItemCount;
    const deviationPercent = avg > 0 ? Math.round(((itemCount - avg) / avg) * 100) : 0;
    
    // Not enough samples yet
    if (baseline.samples < this.MIN_SAMPLES) {
      return {
        isAnomaly: false,
        type: 'none',
        severity: 'low',
        details: {
          expected: avg,
          actual: itemCount,
          deviationPercent,
          message: `Building baseline (${baseline.samples}/${this.MIN_SAMPLES} samples)`,
        },
      };
    }

    // Check for drop
    if (itemCount < avg * this.DROP_THRESHOLD) {
      const severity = itemCount === 0 ? 'critical' : 
                      itemCount < avg * 0.1 ? 'high' : 'medium';
      
      return {
        isAnomaly: true,
        type: 'drop',
        severity,
        details: {
          expected: Math.round(avg),
          actual: itemCount,
          deviationPercent,
          message: `Item count dropped ${Math.abs(deviationPercent)}% (expected ~${Math.round(avg)}, got ${itemCount})`,
        },
      };
    }

    // Check for spike
    if (itemCount > avg * this.SPIKE_THRESHOLD) {
      return {
        isAnomaly: true,
        type: 'spike',
        severity: 'medium',
        details: {
          expected: Math.round(avg),
          actual: itemCount,
          deviationPercent,
          message: `Unusual spike: ${itemCount} items (normally ~${Math.round(avg)})`,
        },
      };
    }

    // Check for pattern break (using std dev)
    if (baseline.stdDev > 0 && baseline.samples >= 10) {
      const zScore = Math.abs(itemCount - avg) / baseline.stdDev;
      if (zScore > 3) {
        return {
          isAnomaly: true,
          type: 'pattern',
          severity: 'low',
          details: {
            expected: Math.round(avg),
            actual: itemCount,
            deviationPercent,
            message: `Pattern deviation detected (z-score: ${zScore.toFixed(1)})`,
          },
        };
      }
    }

    // No anomaly
    return {
      isAnomaly: false,
      type: 'none',
      severity: 'low',
      details: {
        expected: Math.round(avg),
        actual: itemCount,
        deviationPercent,
        message: 'Within normal range',
      },
    };
  }

  /**
   * Update baseline with new sample
   */
  private updateBaseline(baseline: SourceBaseline, itemCount: number): SourceBaseline {
    const n = baseline.samples;
    const oldMean = baseline.avgItemCount;
    const oldVariance = baseline.stdDev * baseline.stdDev;
    
    // Welford's online algorithm for mean and variance
    const newMean = oldMean + (itemCount - oldMean) / (n + 1);
    const newVariance = n === 0 ? 0 : 
      (oldVariance * n + (itemCount - oldMean) * (itemCount - newMean)) / (n + 1);
    
    return {
      sourceId: baseline.sourceId,
      avgItemCount: newMean,
      stdDev: Math.sqrt(newVariance),
      minItems: Math.min(baseline.minItems, itemCount),
      maxItems: Math.max(baseline.maxItems, itemCount),
      samples: n + 1,
      lastUpdated: new Date(),
    };
  }

  private async saveBaseline(baseline: SourceBaseline): Promise<void> {
    await this.baselinesCollection.updateOne(
      { sourceId: baseline.sourceId },
      { $set: baseline },
      { upsert: true }
    );
  }

  /**
   * Get baseline for source
   */
  getBaseline(sourceId: string): SourceBaseline | undefined {
    return this.baselines.get(sourceId);
  }

  /**
   * Get all baselines
   */
  getAllBaselines(): SourceBaseline[] {
    return Array.from(this.baselines.values());
  }

  /**
   * Get recent anomalies
   */
  async getRecentAnomalies(hours = 24, minSeverity?: string): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const query: any = { detectedAt: { $gte: since } };
    
    if (minSeverity) {
      const severityOrder = ['low', 'medium', 'high', 'critical'];
      const minIdx = severityOrder.indexOf(minSeverity);
      if (minIdx >= 0) {
        query.severity = { $in: severityOrder.slice(minIdx) };
      }
    }
    
    return this.anomalyLogsCollection
      .find(query)
      .sort({ detectedAt: -1 })
      .toArray();
  }

  /**
   * Get anomaly history for source
   */
  async getAnomalyHistory(sourceId: string, limit = 50): Promise<any[]> {
    return this.anomalyLogsCollection
      .find({ sourceId })
      .sort({ detectedAt: -1 })
      .limit(limit)
      .toArray();
  }
}
