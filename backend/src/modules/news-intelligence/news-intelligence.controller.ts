/**
 * News Intelligence Controller
 * 
 * BLOCK 6: API endpoints for news intelligence
 */

import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { NewsIntelligenceService } from './news-intelligence.service';

@Controller('news-intelligence')
export class NewsIntelligenceController {
  private readonly logger = new Logger(NewsIntelligenceController.name);

  constructor(private readonly service: NewsIntelligenceService) {}

  /**
   * Process news articles (manual trigger)
   */
  @Post('process')
  async process(@Body() body: { articles?: any[]; fromDb?: boolean; limit?: number }) {
    let articles = body.articles || [];

    if (body.fromDb) {
      // Load from DB if no articles provided
      const limit = body.limit || 100;
      // This would need articlesModel access - simplified for now
      return { error: 'Use scheduler to process from DB' };
    }

    const result = await this.service.process(articles);
    await this.service.saveResults(result);

    return {
      success: true,
      stats: result.stats,
      topClusters: result.clusters.slice(0, 5).map(c => ({
        id: c.id,
        type: c.type,
        mainEntity: c.mainEntity,
        eventCount: c.eventCount,
        rankScore: c.rankScore,
      })),
    };
  }

  /**
   * Get top news clusters (for main page)
   */
  @Get('clusters/top')
  async getTopClusters(@Query('limit') limit?: string) {
    const clusters = await this.service.getTopClusters(parseInt(limit || '20', 10));
    return { clusters };
  }

  /**
   * Get clusters for entity
   */
  @Get('clusters/entity')
  async getEntityClusters(
    @Query('entityId') entityId: string,
    @Query('limit') limit?: string,
  ) {
    if (!entityId) {
      return { error: 'entityId required' };
    }
    const clusters = await this.service.getEntityClusters(
      entityId,
      parseInt(limit || '10', 10),
    );
    return { entityId, clusters };
  }

  /**
   * Get recent events
   */
  @Get('events/recent')
  async getRecentEvents(
    @Query('hours') hours?: string,
    @Query('limit') limit?: string,
  ) {
    const events = await this.service.getRecentEvents(
      parseInt(hours || '24', 10),
      parseInt(limit || '50', 10),
    );
    return { events };
  }

  /**
   * Get stats
   */
  @Get('stats')
  async getStats() {
    return this.service.getStats();
  }

  /**
   * Process recent unprocessed articles (for scheduler)
   */
  @Post('process-recent')
  async processRecent(
    @Query('hours') hours?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.processRecent(
      parseInt(hours || '6', 10),
      parseInt(limit || '200', 10),
    );
    return {
      success: true,
      stats: result.stats,
      topClusters: result.clusters.slice(0, 5).map(c => ({
        id: c.id,
        type: c.type,
        mainEntity: c.mainEntity,
        eventCount: c.eventCount,
        rankScore: c.rankScore,
      })),
    };
  }
}
