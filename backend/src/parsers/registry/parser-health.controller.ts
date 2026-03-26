/**
 * Parser Health Controller
 * 
 * Real-time health monitoring endpoints
 */

import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ParserHealthService, CircuitBreakerService } from '../antiblock';
import { StableParserOrchestrator } from './stable.orchestrator';
import { getRegistrySummary, getAllParsers } from './parser.registry';

@Controller('parsers')
export class ParserHealthController {
  constructor(
    private readonly orchestrator: StableParserOrchestrator,
    private readonly parserHealth: ParserHealthService,
    private readonly circuitBreaker: CircuitBreakerService,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('news_articles') private newsModel: Model<any>,
  ) {}

  /**
   * Main health endpoint - shows overall parser system health
   */
  @Get('health')
  async getHealth() {
    const [investorsCount, fundraisingCount, unlocksCount, newsCount] = await Promise.all([
      this.investorsModel.countDocuments({}),
      this.fundraisingModel.countDocuments({}),
      this.unlocksModel.countDocuments({}),
      this.newsModel.countDocuments({}),
    ]);

    const dashboard = this.orchestrator.getHealthDashboard();
    const registry = getRegistrySummary();
    const parserStatuses = this.orchestrator.getParserStatuses();

    return {
      ts: Date.now(),
      status: dashboard.status,
      lastFullRun: dashboard.lastFullRun,
      
      // Overall summary
      summary: {
        ...dashboard.health,
        registry: {
          total: registry.total,
          enabled: registry.enabled,
        },
      },
      
      // Collection counts
      collections: {
        intel_investors: investorsCount,
        intel_fundraising: fundraisingCount,
        intel_unlocks: unlocksCount,
        news_articles: newsCount,
      },
      
      // Individual parser health
      parsers: parserStatuses.map(p => ({
        id: p.parserId,
        name: p.parserName,
        status: p.status,
        lastSuccess: p.lastSuccessAt,
        lastFailure: p.lastFailureAt,
        lastError: p.lastError,
        consecutiveFailures: p.consecutiveFailures,
        successRate: p.totalRuns > 0 
          ? Math.round((p.totalSuccesses / p.totalRuns) * 100) 
          : null,
        avgDurationMs: p.avgDurationMs,
      })),
      
      // Circuit breaker states
      circuitBreakers: dashboard.circuitBreakers.filter(cb => 
        cb.state !== 'closed' || cb.failures > 0
      ),
    };
  }

  /**
   * Detailed status for specific parser
   */
  @Get('health/:parserId')
  getParserHealth(@Param('parserId') parserId: string) {
    const health = this.parserHealth.getHealth(parserId);
    const circuit = this.circuitBreaker.getState(parserId);

    if (!health) {
      return { error: 'Parser not found', parserId };
    }

    return {
      ...health,
      circuit: {
        state: circuit.state,
        failures: circuit.failures,
        canExecute: this.circuitBreaker.canExecute(parserId),
      },
    };
  }

  /**
   * Reset circuit breaker for specific parser
   */
  @Post('health/:parserId/reset')
  resetParser(@Param('parserId') parserId: string) {
    this.circuitBreaker.reset(parserId);
    this.parserHealth.reset(parserId);
    
    return { 
      success: true, 
      message: `Parser ${parserId} reset`,
      parserId,
    };
  }

  /**
   * Get circuit breaker states
   */
  @Get('circuits')
  getCircuits() {
    return {
      ts: Date.now(),
      circuits: this.circuitBreaker.getAllStates(),
    };
  }

  /**
   * Manual run - all parsers
   */
  @Post('run/all')
  async runAll() {
    return this.orchestrator.runAll();
  }

  /**
   * Manual run - API parsers only
   */
  @Post('run/api')
  async runApiParsers() {
    const results = await this.orchestrator.runApiParsers();
    return {
      ts: Date.now(),
      type: 'api',
      count: results.length,
      successful: results.filter(r => r.success).length,
      results,
    };
  }

  /**
   * Manual run - RSS parsers only
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

  /**
   * Get registry info
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
      })),
    };
  }
}
