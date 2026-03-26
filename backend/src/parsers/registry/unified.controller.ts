/**
 * UNIFIED PARSER CONTROLLER
 * 
 * HTTP endpoints for unified parser orchestration
 */

import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import { UnifiedParserOrchestrator } from './unified.orchestrator';
import { getRegistrySummary, getAllParsers, getParserById } from './parser.registry';

@Controller('discovery')
export class UnifiedParserController {
  constructor(
    private readonly orchestrator: UnifiedParserOrchestrator,
  ) {}

  /**
   * Get parser registry summary
   */
  @Get('registry')
  getRegistry() {
    return {
      ts: Date.now(),
      ...getRegistrySummary(),
      parsers: getAllParsers().map(p => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        enabled: p.enabled,
        entityType: p.entityType,
        sourceUrl: p.sourceUrl,
      })),
    };
  }

  /**
   * Get specific parser info
   */
  @Get('registry/:id')
  getParserInfo(@Param('id') id: string) {
    const parser = getParserById(id);
    if (!parser) {
      return { error: 'Parser not found', id };
    }
    
    const status = this.orchestrator.getParserStatus(id);
    
    return {
      ...parser,
      runtime: status || { status: 'unknown', lastRun: null },
    };
  }

  /**
   * Get health dashboard
   */
  @Get('health')
  async getHealth() {
    return this.orchestrator.getHealthDashboard();
  }

  /**
   * Run ALL parsers
   */
  @Post('run/all')
  async runAll() {
    return this.orchestrator.runAll();
  }

  /**
   * Run only API parsers (Dropstab + CryptoRank)
   */
  @Post('run/api')
  async runApiParsers() {
    const results = await this.orchestrator.runApiParsers();
    return {
      ts: Date.now(),
      type: 'api',
      count: results.length,
      results,
    };
  }

  /**
   * Run only RSS parsers
   */
  @Post('run/rss')
  async runRssParsers() {
    const results = await this.orchestrator.runRssParsers();
    return {
      ts: Date.now(),
      type: 'rss',
      count: results.length,
      successful: results.filter(r => r.success).length,
      results,
    };
  }
}
