/**
 * UNIFIED PARSER ORCHESTRATOR
 * 
 * Centralized orchestration for all discovery parsers.
 * Provides:
 * - Run all parsers
 * - Run by type/kind
 * - Health dashboard
 * - Standardized results
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  DISCOVERY_PARSERS,
  ParserDefinition,
  ParserRunResult,
  ParserStatus,
  getEnabledParsers,
  getApiParsers,
  getRssParsers,
  getScraperParsers,
  getRegistrySummary,
  ParserKind,
  EntityType,
} from './parser.registry';

// Import existing services
import { DropstabApiService } from '../dropstab/dropstab.api';
import { CryptoRankDirectApiService } from '../cryptorank/cryptorank.direct-api';

// RSS Parser
import * as Parser from 'rss-parser';

@Injectable()
export class UnifiedParserOrchestrator {
  private rssParser: Parser;
  private dropstabApi: DropstabApiService;
  private cryptoRankApi: CryptoRankDirectApiService;
  
  // Runtime status storage
  private parserStatus: Map<string, ParserRunResult> = new Map();

  constructor(
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('intel_categories') private categoriesModel: Model<any>,
    @InjectModel('intel_icos') private icosModel: Model<any>,
    @InjectModel('news_articles') private newsModel: Model<any>,
  ) {
    this.rssParser = new Parser({
      timeout: 15000,
      headers: {
        'User-Agent': 'FOMO Intelligence Bot/2.0',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });
    this.dropstabApi = new DropstabApiService();
    this.cryptoRankApi = new CryptoRankDirectApiService();
  }

  // ==============================
  // MAIN ORCHESTRATION
  // ==============================

  /**
   * Run ALL enabled parsers and return comprehensive report
   */
  async runAll(): Promise<{
    summary: any;
    results: ParserRunResult[];
    errors: string[];
    durationMs: number;
  }> {
    const startTime = Date.now();
    console.log('[UnifiedOrchestrator] Starting FULL parser run...');
    
    const results: ParserRunResult[] = [];
    const errors: string[] = [];

    // Run API parsers first (most reliable)
    console.log('[UnifiedOrchestrator] Running API parsers...');
    const apiResults = await this.runApiParsers();
    results.push(...apiResults);

    // Run scrapers
    console.log('[UnifiedOrchestrator] Running HTML/XHR scrapers...');
    const scraperResults = await this.runScraperParsers();
    results.push(...scraperResults);

    // Run RSS parsers
    console.log('[UnifiedOrchestrator] Running RSS parsers...');
    const rssResults = await this.runRssParsers();
    results.push(...rssResults);

    // Collect errors
    for (const r of results) {
      if (!r.success) {
        errors.push(`${r.parserId}: ${r.errors.join(', ')}`);
      }
    }

    const durationMs = Date.now() - startTime;
    const summary = this.buildSummary(results);

    console.log(`[UnifiedOrchestrator] Full run complete in ${durationMs}ms`);
    console.log(`[UnifiedOrchestrator] Summary:`, JSON.stringify(summary, null, 2));

    return {
      summary,
      results,
      errors,
      durationMs,
    };
  }

  /**
   * Run only API parsers (Dropstab + CryptoRank Direct API)
   */
  async runApiParsers(): Promise<ParserRunResult[]> {
    const results: ParserRunResult[] = [];

    // Dropstab Investors
    results.push(await this.runDropstabInvestors());
    
    // Dropstab Fundraising
    results.push(await this.runDropstabFundraising());
    
    // Dropstab Unlocks
    results.push(await this.runDropstabUnlocks());

    // CryptoRank Funding
    results.push(await this.runCryptoRankFunding());
    
    // CryptoRank Investors
    results.push(await this.runCryptoRankInvestors());
    
    // CryptoRank Unlocks
    results.push(await this.runCryptoRankUnlocks());

    return results;
  }

  /**
   * Run HTML/XHR scrapers (ICODrops, etc.)
   */
  async runScraperParsers(): Promise<ParserRunResult[]> {
    // For now, ICODrops is placeholder - needs browser service
    return [];
  }

  /**
   * Run all RSS parsers
   */
  async runRssParsers(): Promise<ParserRunResult[]> {
    const rssParsers = getRssParsers();
    const results: ParserRunResult[] = [];

    for (const parser of rssParsers) {
      const result = await this.runRssParser(parser);
      results.push(result);
      this.parserStatus.set(parser.id, result);
    }

    return results;
  }

  // ==============================
  // INDIVIDUAL PARSER RUNNERS
  // ==============================

  private async runDropstabInvestors(): Promise<ParserRunResult> {
    const parserId = 'dropstab_investors';
    const startTime = Date.now();
    
    try {
      const items = await this.dropstabApi.fetchAllInvestors(200);
      
      let saved = 0;
      for (const item of items) {
        await this.investorsModel.updateOne(
          { key: item.key },
          { $set: item },
          { upsert: true }
        );
        saved++;
      }

      const result: ParserRunResult = {
        parserId,
        parserName: 'Dropstab Investors',
        success: true,
        status: 'active',
        fetched: items.length,
        normalized: items.length,
        saved,
        durationMs: Date.now() - startTime,
        errors: [],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
      
    } catch (error) {
      const result: ParserRunResult = {
        parserId,
        parserName: 'Dropstab Investors',
        success: false,
        status: 'broken',
        fetched: 0,
        normalized: 0,
        saved: 0,
        durationMs: Date.now() - startTime,
        errors: [error.message],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
    }
  }

  private async runDropstabFundraising(): Promise<ParserRunResult> {
    const parserId = 'dropstab_fundraising';
    const startTime = Date.now();
    
    try {
      const items = await this.dropstabApi.fetchAllFundraising(400);
      
      let saved = 0;
      for (const item of items) {
        await this.fundraisingModel.updateOne(
          { key: item.key },
          { $set: item },
          { upsert: true }
        );
        saved++;
      }

      const result: ParserRunResult = {
        parserId,
        parserName: 'Dropstab Fundraising',
        success: true,
        status: 'active',
        fetched: items.length,
        normalized: items.length,
        saved,
        durationMs: Date.now() - startTime,
        errors: [],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
      
    } catch (error) {
      const result: ParserRunResult = {
        parserId,
        parserName: 'Dropstab Fundraising',
        success: false,
        status: 'broken',
        fetched: 0,
        normalized: 0,
        saved: 0,
        durationMs: Date.now() - startTime,
        errors: [error.message],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
    }
  }

  private async runDropstabUnlocks(): Promise<ParserRunResult> {
    const parserId = 'dropstab_unlocks';
    const startTime = Date.now();
    
    try {
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

      const result: ParserRunResult = {
        parserId,
        parserName: 'Dropstab Unlocks',
        success: true,
        status: items.length > 0 ? 'active' : 'unknown',
        fetched: items.length,
        normalized: items.length,
        saved,
        durationMs: Date.now() - startTime,
        errors: [],
        warnings: items.length === 0 ? ['No unlocks data returned'] : [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
      
    } catch (error) {
      const result: ParserRunResult = {
        parserId,
        parserName: 'Dropstab Unlocks',
        success: false,
        status: 'broken',
        fetched: 0,
        normalized: 0,
        saved: 0,
        durationMs: Date.now() - startTime,
        errors: [error.message],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
    }
  }

  private async runCryptoRankFunding(): Promise<ParserRunResult> {
    const parserId = 'cryptorank_funding';
    const startTime = Date.now();
    
    try {
      const items = await this.cryptoRankApi.fetchAllFundingRounds(10000);
      
      let saved = 0;
      for (const item of items) {
        await this.fundraisingModel.updateOne(
          { key: item.key },
          { $set: item },
          { upsert: true }
        );
        saved++;
      }

      const result: ParserRunResult = {
        parserId,
        parserName: 'CryptoRank Funding',
        success: true,
        status: 'active',
        fetched: items.length,
        normalized: items.length,
        saved,
        durationMs: Date.now() - startTime,
        errors: [],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
      
    } catch (error) {
      const result: ParserRunResult = {
        parserId,
        parserName: 'CryptoRank Funding',
        success: false,
        status: 'broken',
        fetched: 0,
        normalized: 0,
        saved: 0,
        durationMs: Date.now() - startTime,
        errors: [error.message],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
    }
  }

  private async runCryptoRankInvestors(): Promise<ParserRunResult> {
    const parserId = 'cryptorank_investors';
    const startTime = Date.now();
    
    try {
      const items = await this.cryptoRankApi.fetchAllInvestors(3000);
      
      let saved = 0;
      for (const item of items) {
        await this.investorsModel.updateOne(
          { key: item.key },
          { $set: item },
          { upsert: true }
        );
        saved++;
      }

      const result: ParserRunResult = {
        parserId,
        parserName: 'CryptoRank Investors',
        success: true,
        status: 'active',
        fetched: items.length,
        normalized: items.length,
        saved,
        durationMs: Date.now() - startTime,
        errors: [],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
      
    } catch (error) {
      const result: ParserRunResult = {
        parserId,
        parserName: 'CryptoRank Investors',
        success: false,
        status: 'broken',
        fetched: 0,
        normalized: 0,
        saved: 0,
        durationMs: Date.now() - startTime,
        errors: [error.message],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
    }
  }

  private async runCryptoRankUnlocks(): Promise<ParserRunResult> {
    const parserId = 'cryptorank_unlocks';
    const startTime = Date.now();
    
    try {
      const items = await this.cryptoRankApi.fetchAllUnlocks(1000);
      
      let saved = 0;
      for (const item of items) {
        await this.unlocksModel.updateOne(
          { key: item.key },
          { $set: item },
          { upsert: true }
        );
        saved++;
      }

      const result: ParserRunResult = {
        parserId,
        parserName: 'CryptoRank Unlocks',
        success: true,
        status: items.length > 0 ? 'active' : 'unknown',
        fetched: items.length,
        normalized: items.length,
        saved,
        durationMs: Date.now() - startTime,
        errors: [],
        warnings: items.length === 0 ? ['No unlocks data returned'] : [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
      
    } catch (error) {
      const result: ParserRunResult = {
        parserId,
        parserName: 'CryptoRank Unlocks',
        success: false,
        status: 'broken',
        fetched: 0,
        normalized: 0,
        saved: 0,
        durationMs: Date.now() - startTime,
        errors: [error.message],
        warnings: [],
        lastRun: new Date(),
      };
      
      this.parserStatus.set(parserId, result);
      return result;
    }
  }

  /**
   * Run single RSS parser
   */
  private async runRssParser(parser: ParserDefinition): Promise<ParserRunResult> {
    const startTime = Date.now();
    
    try {
      const feed = await this.rssParser.parseURL(parser.sourceUrl);
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

      const result: ParserRunResult = {
        parserId: parser.id,
        parserName: parser.name,
        success: true,
        status: 'active',
        fetched: items.length,
        normalized: items.length,
        saved,
        durationMs: Date.now() - startTime,
        errors: [],
        warnings: [],
        lastRun: new Date(),
      };
      
      return result;
      
    } catch (error) {
      const result: ParserRunResult = {
        parserId: parser.id,
        parserName: parser.name,
        success: false,
        status: 'broken',
        fetched: 0,
        normalized: 0,
        saved: 0,
        durationMs: Date.now() - startTime,
        errors: [error.message],
        warnings: [],
        lastRun: new Date(),
      };
      
      return result;
    }
  }

  private generateArticleId(item: any, sourceId: string): string {
    const guid = item.guid || item.id || item.link;
    if (guid) {
      return `${sourceId}:${Buffer.from(guid).toString('base64').substring(0, 40)}`;
    }
    const hash = Buffer.from(item.title || '').toString('base64').substring(0, 20);
    return `${sourceId}:${hash}:${Date.now()}`;
  }

  // ==============================
  // HEALTH & STATUS
  // ==============================

  /**
   * Get health dashboard for all parsers
   */
  async getHealthDashboard(): Promise<{
    registry: any;
    status: any[];
    summary: any;
  }> {
    const registry = getRegistrySummary();
    const status = Array.from(this.parserStatus.entries()).map(([id, result]) => ({
      parserId: id,
      parserName: result.parserName,
      status: result.status,
      lastRun: result.lastRun,
      fetched: result.fetched,
      saved: result.saved,
      durationMs: result.durationMs,
      success: result.success,
      errors: result.errors,
    }));

    // Get current counts from DB
    const [investorsCount, fundraisingCount, unlocksCount, newsCount] = await Promise.all([
      this.investorsModel.countDocuments({}),
      this.fundraisingModel.countDocuments({}),
      this.unlocksModel.countDocuments({}),
      this.newsModel.countDocuments({}),
    ]);

    const summary = {
      totalParsers: registry.total,
      enabledParsers: registry.enabled,
      activeParsers: status.filter(s => s.status === 'active').length,
      brokenParsers: status.filter(s => s.status === 'broken').length,
      collections: {
        intel_investors: investorsCount,
        intel_fundraising: fundraisingCount,
        intel_unlocks: unlocksCount,
        news_articles: newsCount,
      },
    };

    return { registry, status, summary };
  }

  /**
   * Get status of specific parser
   */
  getParserStatus(parserId: string): ParserRunResult | undefined {
    return this.parserStatus.get(parserId);
  }

  // ==============================
  // HELPERS
  // ==============================

  private buildSummary(results: ParserRunResult[]): any {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    let totalFetched = 0;
    let totalSaved = 0;
    
    for (const r of results) {
      totalFetched += r.fetched;
      totalSaved += r.saved;
    }

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      totalFetched,
      totalSaved,
      failedParsers: failed.map(f => f.parserId),
    };
  }
}
