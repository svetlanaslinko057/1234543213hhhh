/**
 * STABLE PARSER ORCHESTRATOR
 * 
 * Production-ready orchestrator with:
 * - Circuit breaker
 * - Health monitoring
 * - Anti-block layer
 * - Retry with backoff
 * - Adaptive fallback
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import * as Parser from 'rss-parser';

// Anti-block layer
import {
  HttpFingerprintService,
  CircuitBreakerService,
  ParserHealthService,
  ParserGuardService,
  ResilientFetchService,
  withRetry,
  humanPause,
} from '../antiblock';

// Existing services
import { DropstabApiService } from '../dropstab/dropstab.api';
import { CryptoRankDirectApiService } from '../cryptorank/cryptorank.direct-api';

// Registry
import {
  DISCOVERY_PARSERS,
  ParserDefinition,
  ParserRunResult,
  getEnabledParsers,
  getRssParsers,
  getApiParsers,
} from './parser.registry';

@Injectable()
export class StableParserOrchestrator implements OnModuleInit {
  private rssParser: Parser;
  private dropstabApi: DropstabApiService;
  private cryptoRankApi: CryptoRankDirectApiService;
  private isRunning = false;
  private lastFullRun: Date | null = null;

  constructor(
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('intel_categories') private categoriesModel: Model<any>,
    @InjectModel('intel_icos') private icosModel: Model<any>,
    @InjectModel('news_articles') private newsModel: Model<any>,
    private readonly httpFingerprint: HttpFingerprintService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly parserHealth: ParserHealthService,
    private readonly parserGuard: ParserGuardService,
    private readonly resilientFetch: ResilientFetchService,
  ) {
    this.dropstabApi = new DropstabApiService();
    this.cryptoRankApi = new CryptoRankDirectApiService();
  }

  async onModuleInit() {
    // Initialize RSS parser with anti-block headers
    this.rssParser = new Parser({
      timeout: 20000,
      headers: this.httpFingerprint.buildHeaders({ kind: 'rss' }),
      customFields: {
        item: ['media:content', 'content:encoded'],
      },
    });
    
    console.log('[StableOrchestrator] Initialized with anti-block layer');
  }

  // ==============================
  // CRON JOBS
  // ==============================

  @Cron('0 */6 * * *') // Every 6 hours
  async cronApiParsers() {
    console.log('[CRON] Running API parsers...');
    await this.runApiParsers();
  }

  @Cron('*/45 * * * *') // Every 45 minutes
  async cronRssParsers() {
    console.log('[CRON] Running RSS parsers...');
    await this.runRssParsers();
  }

  // ==============================
  // MAIN ORCHESTRATION
  // ==============================

  async runAll(): Promise<{
    summary: any;
    apiResults: ParserRunResult[];
    rssResults: ParserRunResult[];
    durationMs: number;
  }> {
    if (this.isRunning) {
      return {
        summary: { error: 'Another run is in progress' },
        apiResults: [],
        rssResults: [],
        durationMs: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    console.log('[StableOrchestrator] Starting FULL parser run...');

    try {
      // Run API parsers first (most important)
      const apiResults = await this.runApiParsers();
      
      // Small pause between types
      await humanPause(2000, 4000);
      
      // Run RSS parsers
      const rssResults = await this.runRssParsers();

      const durationMs = Date.now() - startTime;
      this.lastFullRun = new Date();

      const summary = {
        timestamp: new Date().toISOString(),
        durationMs,
        api: {
          total: apiResults.length,
          successful: apiResults.filter(r => r.success).length,
          failed: apiResults.filter(r => !r.success).length,
        },
        rss: {
          total: rssResults.length,
          successful: rssResults.filter(r => r.success).length,
          failed: rssResults.filter(r => !r.success).length,
        },
        health: this.parserHealth.getSummary(),
      };

      console.log('[StableOrchestrator] Full run complete:', JSON.stringify(summary, null, 2));

      return { summary, apiResults, rssResults, durationMs };
    } finally {
      this.isRunning = false;
    }
  }

  // ==============================
  // API PARSERS
  // ==============================

  async runApiParsers(): Promise<ParserRunResult[]> {
    const results: ParserRunResult[] = [];
    console.log('[StableOrchestrator] Running API parsers...');

    // Dropstab
    results.push(await this.runDropstabInvestors());
    await humanPause(1000, 2000);
    
    results.push(await this.runDropstabFundraising());
    await humanPause(1000, 2000);
    
    results.push(await this.runDropstabUnlocks());
    await humanPause(2000, 3000);

    // CryptoRank
    results.push(await this.runCryptoRankFunding());
    await humanPause(1000, 2000);
    
    results.push(await this.runCryptoRankInvestors());

    return results;
  }

  private async runDropstabInvestors(): Promise<ParserRunResult> {
    const parserId = 'dropstab_investors';
    const parserName = 'Dropstab Investors';
    const startTime = Date.now();

    const guardResult = await this.parserGuard.runGuarded(
      parserId,
      parserName,
      async () => {
        const items = await withRetry(
          () => this.dropstabApi.fetchAllInvestors(200),
          { retries: 3, baseDelayMs: 2000 }
        );

        let saved = 0;
        for (const item of items) {
          await this.investorsModel.updateOne(
            { key: item.key },
            { $set: item },
            { upsert: true }
          );
          saved++;
        }

        return { items, saved };
      }
    );

    if (guardResult.skipped) {
      return this.createSkippedResult(parserId, parserName, startTime);
    }

    if (!guardResult.success) {
      return this.createErrorResult(parserId, parserName, startTime, guardResult.error!);
    }

    const { items, saved } = guardResult.result!;
    return this.createSuccessResult(parserId, parserName, startTime, items.length, saved);
  }

  private async runDropstabFundraising(): Promise<ParserRunResult> {
    const parserId = 'dropstab_fundraising';
    const parserName = 'Dropstab Fundraising';
    const startTime = Date.now();

    const guardResult = await this.parserGuard.runGuarded(
      parserId,
      parserName,
      async () => {
        const items = await withRetry(
          () => this.dropstabApi.fetchAllFundraising(400),
          { retries: 3, baseDelayMs: 2000 }
        );

        let saved = 0;
        for (const item of items) {
          await this.fundraisingModel.updateOne(
            { key: item.key },
            { $set: item },
            { upsert: true }
          );
          saved++;
        }

        return { items, saved };
      }
    );

    if (guardResult.skipped) {
      return this.createSkippedResult(parserId, parserName, startTime);
    }

    if (!guardResult.success) {
      return this.createErrorResult(parserId, parserName, startTime, guardResult.error!);
    }

    const { items, saved } = guardResult.result!;
    return this.createSuccessResult(parserId, parserName, startTime, items.length, saved);
  }

  private async runDropstabUnlocks(): Promise<ParserRunResult> {
    const parserId = 'dropstab_unlocks';
    const parserName = 'Dropstab Unlocks';
    const startTime = Date.now();

    const guardResult = await this.parserGuard.runGuarded(
      parserId,
      parserName,
      async () => {
        const items = await this.dropstabApi.fetchUnlocks();

        let saved = 0;
        for (const item of items) {
          await this.unlocksModel.updateOne(
            { key: item.key },
            { $set: item },
            { upsert: true }
          );
          saved++;
        }

        return { items, saved };
      }
    );

    if (guardResult.skipped) {
      return this.createSkippedResult(parserId, parserName, startTime);
    }

    if (!guardResult.success) {
      return this.createErrorResult(parserId, parserName, startTime, guardResult.error!);
    }

    const { items, saved } = guardResult.result!;
    return this.createSuccessResult(parserId, parserName, startTime, items.length, saved);
  }

  private async runCryptoRankFunding(): Promise<ParserRunResult> {
    const parserId = 'cryptorank_funding';
    const parserName = 'CryptoRank Funding';
    const startTime = Date.now();

    const guardResult = await this.parserGuard.runGuarded(
      parserId,
      parserName,
      async () => {
        const items = await withRetry(
          () => this.cryptoRankApi.fetchAllFundingRounds(10000),
          { retries: 3, baseDelayMs: 3000 }
        );

        let saved = 0;
        for (const item of items) {
          await this.fundraisingModel.updateOne(
            { key: item.key },
            { $set: item },
            { upsert: true }
          );
          saved++;
        }

        return { items, saved };
      }
    );

    if (guardResult.skipped) {
      return this.createSkippedResult(parserId, parserName, startTime);
    }

    if (!guardResult.success) {
      return this.createErrorResult(parserId, parserName, startTime, guardResult.error!);
    }

    const { items, saved } = guardResult.result!;
    return this.createSuccessResult(parserId, parserName, startTime, items.length, saved);
  }

  private async runCryptoRankInvestors(): Promise<ParserRunResult> {
    const parserId = 'cryptorank_investors';
    const parserName = 'CryptoRank Investors';
    const startTime = Date.now();

    const guardResult = await this.parserGuard.runGuarded(
      parserId,
      parserName,
      async () => {
        const items = await withRetry(
          () => this.cryptoRankApi.fetchAllInvestors(3000),
          { retries: 3, baseDelayMs: 3000 }
        );

        let saved = 0;
        for (const item of items) {
          await this.investorsModel.updateOne(
            { key: item.key },
            { $set: item },
            { upsert: true }
          );
          saved++;
        }

        return { items, saved };
      }
    );

    if (guardResult.skipped) {
      return this.createSkippedResult(parserId, parserName, startTime);
    }

    if (!guardResult.success) {
      return this.createErrorResult(parserId, parserName, startTime, guardResult.error!);
    }

    const { items, saved } = guardResult.result!;
    return this.createSuccessResult(parserId, parserName, startTime, items.length, saved);
  }

  // ==============================
  // RSS PARSERS
  // ==============================

  async runRssParsers(): Promise<ParserRunResult[]> {
    const rssParsers = getRssParsers();
    const results: ParserRunResult[] = [];
    console.log(`[StableOrchestrator] Running ${rssParsers.length} RSS parsers...`);

    for (const parser of rssParsers) {
      const result = await this.runSingleRssParser(parser);
      results.push(result);
      
      // Human-like delay between parsers
      await humanPause(500, 1500);
    }

    const successful = results.filter(r => r.success).length;
    console.log(`[StableOrchestrator] RSS complete: ${successful}/${results.length} successful`);

    return results;
  }

  private async runSingleRssParser(parser: ParserDefinition): Promise<ParserRunResult> {
    const startTime = Date.now();

    const guardResult = await this.parserGuard.runGuarded(
      parser.id,
      parser.name,
      async () => {
        // Re-create parser with fresh headers for each request
        const freshParser = new Parser({
          timeout: 20000,
          headers: this.httpFingerprint.buildHeaders({ kind: 'rss' }),
        });

        const feed = await withRetry(
          () => freshParser.parseURL(parser.sourceUrl),
          { retries: 2, baseDelayMs: 1000 }
        );

        const items = feed.items || [];
        let saved = 0;

        for (const item of items) {
          const articleId = this.generateArticleId(item, parser.id);

          const doc = {
            id: articleId,
            source_id: parser.id,
            source_name: parser.name,
            url: item.link,
            title: item.title,
            summary: item.contentSnippet || item.content?.substring(0, 500),
            published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
            fetched_at: new Date(),
          };

          await this.newsModel.updateOne(
            { id: articleId },
            { $set: doc },
            { upsert: true }
          );
          saved++;
        }

        return { items, saved };
      }
    );

    if (guardResult.skipped) {
      return this.createSkippedResult(parser.id, parser.name, startTime);
    }

    if (!guardResult.success) {
      return this.createErrorResult(parser.id, parser.name, startTime, guardResult.error!);
    }

    const { items, saved } = guardResult.result!;
    return this.createSuccessResult(parser.id, parser.name, startTime, items.length, saved);
  }

  // ==============================
  // HEALTH & STATUS
  // ==============================

  getHealthDashboard(): {
    status: string;
    lastFullRun: Date | null;
    isRunning: boolean;
    health: any;
    circuitBreakers: any[];
    collections: any;
  } {
    return {
      status: this.isRunning ? 'running' : 'idle',
      lastFullRun: this.lastFullRun,
      isRunning: this.isRunning,
      health: this.parserHealth.getSummary(),
      circuitBreakers: this.circuitBreaker.getAllStates(),
      collections: {}, // Will be populated by controller
    };
  }

  getParserStatuses(): any[] {
    return this.parserHealth.getAllHealth();
  }

  // ==============================
  // HELPERS
  // ==============================

  private generateArticleId(item: any, sourceId: string): string {
    const guid = item.guid || item.id || item.link;
    if (guid) {
      return `${sourceId}:${Buffer.from(guid).toString('base64').substring(0, 40)}`;
    }
    const hash = Buffer.from(item.title || '').toString('base64').substring(0, 20);
    return `${sourceId}:${hash}:${Date.now()}`;
  }

  private createSuccessResult(
    parserId: string,
    parserName: string,
    startTime: number,
    fetched: number,
    saved: number
  ): ParserRunResult {
    return {
      parserId,
      parserName,
      success: true,
      status: 'active',
      fetched,
      normalized: fetched,
      saved,
      durationMs: Date.now() - startTime,
      errors: [],
      warnings: fetched === 0 ? ['No items returned'] : [],
      lastRun: new Date(),
    };
  }

  private createErrorResult(
    parserId: string,
    parserName: string,
    startTime: number,
    error: string
  ): ParserRunResult {
    return {
      parserId,
      parserName,
      success: false,
      status: 'broken',
      fetched: 0,
      normalized: 0,
      saved: 0,
      durationMs: Date.now() - startTime,
      errors: [error],
      warnings: [],
      lastRun: new Date(),
    };
  }

  private createSkippedResult(
    parserId: string,
    parserName: string,
    startTime: number
  ): ParserRunResult {
    return {
      parserId,
      parserName,
      success: false,
      status: 'disabled',
      fetched: 0,
      normalized: 0,
      saved: 0,
      durationMs: Date.now() - startTime,
      errors: ['Skipped: circuit breaker open'],
      warnings: [],
      lastRun: new Date(),
    };
  }
}
