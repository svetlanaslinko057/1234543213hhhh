/**
 * Entity Resolution Controller
 * 
 * API endpoints для Entity Resolution Engine
 */

import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { EntityResolutionService } from './entity-resolution.service';

@Controller('entities')
export class EntityResolutionController {
  constructor(private readonly resolution: EntityResolutionService) {}

  /**
   * Run full entity resolution pipeline
   */
  @Post('resolve')
  async runResolution() {
    return this.resolution.runFullResolution();
  }

  /**
   * Get resolution stats
   */
  @Get('stats')
  async getStats() {
    return this.resolution.getResolutionStats();
  }

  /**
   * Get investor leaderboard
   */
  @Get('leaderboard')
  async getLeaderboard(
    @Query('tier') tier?: string,
    @Query('limit') limit?: string,
  ) {
    return this.resolution.getLeaderboard(
      tier,
      parseInt(limit || '50', 10)
    );
  }

  /**
   * Get coinvestors with weights
   */
  @Get('coinvest')
  async getCoinvestors(
    @Query('investor') investor: string,
    @Query('min_count') minCount?: string,
    @Query('limit') limit?: string,
  ) {
    if (!investor) {
      return { error: 'investor parameter required' };
    }
    
    return this.resolution.getCoinvestors(
      investor,
      parseInt(minCount || '2', 10),
      parseInt(limit || '50', 10)
    );
  }

  /**
   * Find potential duplicates
   */
  @Get('duplicates')
  async findDuplicates(
    @Query('threshold') threshold?: string,
    @Query('limit') limit?: string,
  ) {
    return this.resolution.findUnmergedDuplicates(
      parseFloat(threshold || '0.85'),
      parseInt(limit || '100', 10)
    );
  }

  /**
   * Manual merge two entities
   */
  @Post('merge')
  async manualMerge(@Body() body: {
    canonical_id_a: string;
    canonical_id_b: string;
    keep: 'a' | 'b';
  }) {
    if (!body.canonical_id_a || !body.canonical_id_b) {
      return { error: 'canonical_id_a and canonical_id_b required' };
    }

    const result = await this.resolution.manualMerge(
      body.canonical_id_a,
      body.canonical_id_b,
      body.keep || 'a'
    );

    if (!result) {
      return { error: 'One or both entities not found' };
    }

    return {
      status: 'merged',
      entity: result,
    };
  }

  /**
   * Data quality score
   */
  @Get('quality')
  async getDataQuality() {
    const score = await this.resolution.calculateDataQuality();
    return {
      data_quality_score: score,
      status: score >= 75 ? 'GOOD' : score >= 50 ? 'MEDIUM' : 'LOW',
      target: 75,
    };
  }
}
