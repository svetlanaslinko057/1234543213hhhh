/**
 * Source Reliability Controller
 * 
 * API endpoints for source reliability system
 */

import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { SourceReliabilityService, FetchRecord } from './source-reliability.service';

@Controller('reliability')
export class SourceReliabilityController {
  constructor(private readonly service: SourceReliabilityService) {}

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  @Post('init')
  async initialize() {
    await this.service.ensureIndexes();
    const seeded = await this.service.seedInitialSources();
    return { ok: true, seeded };
  }

  // ═══════════════════════════════════════════════════════════════
  // RECORD FETCH
  // ═══════════════════════════════════════════════════════════════

  @Post('record')
  async recordFetch(@Body() record: FetchRecord) {
    await this.service.recordFetch(record);
    return { ok: true, source_id: record.source_id };
  }

  // ═══════════════════════════════════════════════════════════════
  // METRICS
  // ═══════════════════════════════════════════════════════════════

  @Get('stats')
  async getStats() {
    return this.service.getStats();
  }

  @Get('metrics')
  async getAllMetrics() {
    return this.service.getAllMetrics();
  }

  @Get('metrics/:sourceId')
  async getSourceMetrics(@Param('sourceId') sourceId: string) {
    return this.service.getSourceMetrics(sourceId);
  }

  @Get('history/:sourceId')
  async getSourceHistory(
    @Param('sourceId') sourceId: string,
    @Query('hours') hours?: string,
  ) {
    return this.service.getSourceHistory(
      sourceId,
      hours ? parseInt(hours, 10) : 24,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // BEST SOURCE SELECTION
  // ═══════════════════════════════════════════════════════════════

  @Get('best')
  async getBestSource(
    @Query('type') dataType: string,
    @Query('minScore') minScore?: string,
  ) {
    if (!dataType) {
      return { error: 'type query param required' };
    }

    const best = await this.service.getBestSource(
      dataType,
      undefined,
      minScore ? parseFloat(minScore) : 0.3,
    );

    return { data_type: dataType, best_source: best };
  }

  @Get('ranking')
  async getSourceRanking(
    @Query('type') dataType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getSourceRanking(
      dataType,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CAPABILITIES
  // ═══════════════════════════════════════════════════════════════

  @Get('capabilities')
  getAllCapabilities() {
    return this.service.getAllCapabilities();
  }

  @Get('capabilities/:sourceId')
  getCapabilities(@Param('sourceId') sourceId: string) {
    return {
      source_id: sourceId,
      capabilities: this.service.getCapabilities(sourceId),
    };
  }
}
