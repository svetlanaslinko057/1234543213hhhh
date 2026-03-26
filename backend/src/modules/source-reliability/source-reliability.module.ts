/**
 * Source Reliability Module
 * 
 * CRITICAL: Dynamic scoring of data sources
 * Restored from Python version for intelligent source selection
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { SourceReliabilityService } from './source-reliability.service';
import { SourceReliabilityController } from './source-reliability.controller';

const FlexibleSchema = new MongooseSchema({}, { strict: false, timestamps: true });

// Fetch log with TTL (7 days)
const FetchLogSchema = new MongooseSchema({
  source_id: String,
  success: Boolean,
  latency_ms: Number,
  data_freshness_hours: Number,
  endpoint: String,
  error: String,
  items_count: Number,
  timestamp: { type: Date, default: Date.now, index: { expires: '7d' } },
}, { timestamps: true });

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'source_metrics', schema: FlexibleSchema },
      { name: 'source_reliability_history', schema: FlexibleSchema },
      { name: 'source_fetch_logs', schema: FetchLogSchema },
    ]),
  ],
  controllers: [SourceReliabilityController],
  providers: [SourceReliabilityService],
  exports: [SourceReliabilityService],
})
export class SourceReliabilityModule {}
