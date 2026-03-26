/**
 * Schema Drift Detection Service
 * 
 * Detects when source data structure changes BEFORE parser fails:
 * - Tracks payload signatures (keys, item count, hash)
 * - Compares current vs historical signatures
 * - Triggers alerts and fallback on drift
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as crypto from 'crypto';

export interface SchemaSignature {
  sourceId: string;
  mode: string; // rss | html | xhr | api
  
  topLevelKeys: string[];
  itemKeys: string[];
  
  itemCount: number;
  avgItemCount: number;
  
  sampleHash: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface DriftResult {
  drift: boolean;
  severity: 'none' | 'minor' | 'major' | 'critical';
  changes: {
    keysAdded: string[];
    keysRemoved: string[];
    countDrop: boolean;
    countDropPercent: number;
    hashChanged: boolean;
  };
}

@Injectable()
export class SchemaDriftService implements OnModuleInit {
  private readonly logger = new Logger(SchemaDriftService.name);
  private signaturesCollection: any;
  private driftLogsCollection: any;
  private signatures: Map<string, SchemaSignature> = new Map();

  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit() {
    this.signaturesCollection = this.connection.collection('schema_signatures');
    this.driftLogsCollection = this.connection.collection('schema_drift_logs');
    
    await this.signaturesCollection.createIndex({ sourceId: 1, mode: 1 }, { unique: true });
    await this.driftLogsCollection.createIndex({ sourceId: 1, detectedAt: -1 });
    await this.driftLogsCollection.createIndex({ detectedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
    
    // Load existing signatures
    const docs = await this.signaturesCollection.find({}).toArray();
    for (const doc of docs) {
      const key = `${doc.sourceId}:${doc.mode}`;
      this.signatures.set(key, doc);
    }
    
    this.logger.log(`Loaded ${this.signatures.size} schema signatures`);
  }

  /**
   * Build signature from data payload
   */
  buildSignature(sourceId: string, mode: string, data: any[]): Partial<SchemaSignature> {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        sourceId,
        mode,
        topLevelKeys: [],
        itemKeys: [],
        itemCount: 0,
        sampleHash: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const sample = data[0] || {};
    const itemKeys = Object.keys(sample).sort();
    
    // Create hash from first item structure
    const sampleStr = JSON.stringify(sample).slice(0, 500);
    const sampleHash = crypto.createHash('md5').update(sampleStr).digest('hex').slice(0, 16);

    return {
      sourceId,
      mode,
      topLevelKeys: ['data'], // Simplified
      itemKeys,
      itemCount: data.length,
      sampleHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Detect drift between previous and current signature
   */
  detectDrift(prev: SchemaSignature, next: Partial<SchemaSignature>): DriftResult {
    if (!prev) {
      return {
        drift: false,
        severity: 'none',
        changes: { keysAdded: [], keysRemoved: [], countDrop: false, countDropPercent: 0, hashChanged: false },
      };
    }

    const prevKeys = new Set(prev.itemKeys);
    const nextKeys = new Set(next.itemKeys || []);
    
    const keysAdded = [...nextKeys].filter(k => !prevKeys.has(k));
    const keysRemoved = [...prevKeys].filter(k => !nextKeys.has(k));
    
    const countDropPercent = prev.avgItemCount > 0 
      ? ((prev.avgItemCount - (next.itemCount || 0)) / prev.avgItemCount) * 100
      : 0;
    const countDrop = countDropPercent > 70; // 70%+ drop is significant
    
    const hashChanged = prev.sampleHash !== next.sampleHash;
    
    // Determine severity
    let severity: DriftResult['severity'] = 'none';
    
    if (keysRemoved.length > 0 && keysRemoved.length >= prev.itemKeys.length * 0.5) {
      severity = 'critical'; // Lost 50%+ of keys
    } else if (countDrop) {
      severity = 'major'; // Significant data drop
    } else if (keysRemoved.length > 0) {
      severity = 'minor'; // Some keys removed
    } else if (keysAdded.length > 3 || hashChanged) {
      severity = 'minor'; // Structure changed but not breaking
    }

    const drift = severity !== 'none';

    return {
      drift,
      severity,
      changes: {
        keysAdded,
        keysRemoved,
        countDrop,
        countDropPercent: Math.round(countDropPercent),
        hashChanged,
      },
    };
  }

  /**
   * Check data for drift and update signature
   */
  async checkAndUpdate(sourceId: string, mode: string, data: any[]): Promise<DriftResult> {
    const key = `${sourceId}:${mode}`;
    const prev = this.signatures.get(key);
    const next = this.buildSignature(sourceId, mode, data);
    
    const result = this.detectDrift(prev as SchemaSignature, next);
    
    if (result.drift) {
      // Log the drift
      await this.driftLogsCollection.insertOne({
        sourceId,
        mode,
        detectedAt: new Date(),
        severity: result.severity,
        changes: result.changes,
        prevSignature: prev ? {
          itemKeys: prev.itemKeys,
          itemCount: prev.avgItemCount,
          sampleHash: prev.sampleHash,
        } : null,
        newSignature: {
          itemKeys: next.itemKeys,
          itemCount: next.itemCount,
          sampleHash: next.sampleHash,
        },
      });
      
      this.logger.warn(`SCHEMA DRIFT [${result.severity}] detected for ${sourceId}:${mode}`);
    }
    
    // Update signature with rolling average
    const avgItemCount = prev 
      ? Math.round(prev.avgItemCount * 0.8 + (next.itemCount || 0) * 0.2)
      : (next.itemCount || 0);
    
    const updated: SchemaSignature = {
      sourceId,
      mode,
      topLevelKeys: next.topLevelKeys || [],
      itemKeys: next.itemKeys || [],
      itemCount: next.itemCount || 0,
      avgItemCount,
      sampleHash: next.sampleHash || '',
      createdAt: prev?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    
    this.signatures.set(key, updated);
    await this.signaturesCollection.updateOne(
      { sourceId, mode },
      { $set: updated },
      { upsert: true }
    );
    
    return result;
  }

  /**
   * Get drift history for a source
   */
  async getDriftHistory(sourceId: string, limit = 20): Promise<any[]> {
    return this.driftLogsCollection
      .find({ sourceId })
      .sort({ detectedAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Get all sources with recent drift
   */
  async getRecentDrifts(hours = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.driftLogsCollection
      .find({ detectedAt: { $gte: since } })
      .sort({ detectedAt: -1 })
      .toArray();
  }

  /**
   * Get current signature for source
   */
  getSignature(sourceId: string, mode: string): SchemaSignature | undefined {
    return this.signatures.get(`${sourceId}:${mode}`);
  }

  /**
   * Get all signatures
   */
  getAllSignatures(): SchemaSignature[] {
    return Array.from(this.signatures.values());
  }
}
