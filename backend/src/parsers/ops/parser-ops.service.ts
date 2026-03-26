/**
 * Parser Ops Service
 * 
 * Orchestration layer for manual parser operations:
 * - Rerun single parser
 * - Rerun all failed
 * - Recover from quarantine
 * - Enable/disable parsers
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ParserRuntimeStateService, RunResult, ActiveMode } from './parser-runtime-state.service';
import { ParserLogService, ParserRunLog } from './parser-log.service';
import { ParserReportService } from './parser-report.service';
import { DISCOVERY_PARSERS, ParserDefinition } from '../registry/parser.registry';
import { NEWS_SOURCES, SourceConfig } from '../fallback/source.config';

// Import existing services for actual parsing
// We'll integrate with the existing StableParserOrchestrator

@Injectable()
export class ParserOpsService implements OnModuleInit {
  private readonly logger = new Logger(ParserOpsService.name);
  private runningParsers: Set<string> = new Set();
  private maxConcurrency = 3;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly runtimeState: ParserRuntimeStateService,
    private readonly logService: ParserLogService,
    private readonly reportService: ParserReportService,
  ) {}

  async onModuleInit() {
    // Initialize runtime state for all registered parsers
    await this.initializeAllParsers();
  }

  /**
   * Initialize all parsers from registry into runtime state
   */
  private async initializeAllParsers(): Promise<void> {
    // Initialize API/scraper parsers
    for (const parser of DISCOVERY_PARSERS) {
      await this.runtimeState.initializeParser({
        parserId: parser.id,
        parserName: parser.name,
        sourceKind: parser.kind,
        priority: 'medium',
        entityType: parser.entityType,
        defaultMode: parser.kind as ActiveMode,
      });
    }

    // Initialize news sources
    for (const source of NEWS_SOURCES) {
      await this.runtimeState.initializeParser({
        parserId: source.id,
        parserName: source.name,
        sourceKind: 'rss',
        priority: source.tier === 'A' ? 'high' : source.tier === 'B' ? 'medium' : 'low',
        entityType: 'news',
        defaultMode: 'rss',
      });
    }

    this.logger.log(`Initialized ${this.runtimeState.getAll().length} parsers in runtime state`);
  }

  /**
   * Get full status of all parsers
   */
  async getStatus(): Promise<{
    ts: number;
    summary: ReturnType<typeof this.runtimeState.getSummary>;
    parsers: Array<{
      parserId: string;
      parserName: string;
      status: string;
      activeMode: string;
      lastRunAt: string | null;
      lastSuccessAt: string | null;
      lastItemCount: number;
      consecutiveFailures: number;
      lastError: string | null;
      fallbackInUse: boolean;
      sourceKind: string;
    }>;
    running: string[];
  }> {
    const states = this.runtimeState.getAll();
    
    return {
      ts: Date.now(),
      summary: this.runtimeState.getSummary(),
      parsers: states.map(s => ({
        parserId: s.parserId,
        parserName: s.parserName,
        status: s.status,
        activeMode: s.activeMode,
        lastRunAt: s.lastRunAt?.toISOString() || null,
        lastSuccessAt: s.lastSuccessAt?.toISOString() || null,
        lastItemCount: s.lastItemCount,
        consecutiveFailures: s.consecutiveFailures,
        lastError: s.lastError || null,
        fallbackInUse: s.fallbackInUse,
        sourceKind: s.sourceKind,
      })),
      running: Array.from(this.runningParsers),
    };
  }

  /**
   * Get logs for a specific parser
   */
  async getLogs(parserId: string, limit = 50): Promise<ParserRunLog[]> {
    return this.logService.getByParser(parserId, limit);
  }

  /**
   * Get daily report
   */
  async getDailyReport() {
    return this.reportService.generateDailyReport();
  }

  /**
   * Get source quality scores
   */
  async getQualityScores() {
    return this.reportService.getSourceQualityScores();
  }

  /**
   * Rerun a single parser
   */
  async rerunOne(parserId: string): Promise<{
    success: boolean;
    message: string;
    result?: RunResult;
  }> {
    // Check if parser exists
    const state = this.runtimeState.getById(parserId);
    if (!state) {
      return { success: false, message: `Parser ${parserId} not found` };
    }

    // Check if can run
    const canRunCheck = this.runtimeState.canRun(parserId);
    if (!canRunCheck.canRun) {
      return { success: false, message: canRunCheck.reason || 'Cannot run parser' };
    }

    // Check if already running
    if (this.runningParsers.has(parserId)) {
      return { success: false, message: `Parser ${parserId} is already running` };
    }

    // Execute the parser
    return this.executeParser(parserId);
  }

  /**
   * Rerun all failed/degraded parsers
   */
  async rerunFailed(): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
    results: Array<{ parserId: string; success: boolean; message: string }>;
  }> {
    const failedParsers = this.runtimeState.getFailedOrDegraded();
    const results: Array<{ parserId: string; success: boolean; message: string }> = [];
    
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    // Process with limited concurrency
    for (const parser of failedParsers) {
      // Wait if at max concurrency
      while (this.runningParsers.size >= this.maxConcurrency) {
        await this.sleep(1000);
      }

      const canRun = this.runtimeState.canRun(parser.parserId);
      if (!canRun.canRun) {
        skipped++;
        results.push({
          parserId: parser.parserId,
          success: false,
          message: canRun.reason || 'Skipped',
        });
        continue;
      }

      const result = await this.executeParser(parser.parserId);
      results.push({
        parserId: parser.parserId,
        success: result.success,
        message: result.message,
      });

      if (result.success) succeeded++;
      else failed++;
    }

    return {
      attempted: failedParsers.length,
      succeeded,
      failed,
      skipped,
      results,
    };
  }

  /**
   * Get quarantined parsers
   */
  async getQuarantine(): Promise<Array<{
    parserId: string;
    parserName: string;
    quarantinedUntil: string;
    lastError: string | null;
    consecutiveFailures: number;
  }>> {
    const quarantined = this.runtimeState.getQuarantined();
    return quarantined.map(s => ({
      parserId: s.parserId,
      parserName: s.parserName,
      quarantinedUntil: s.circuitOpenUntil?.toISOString() || 'unknown',
      lastError: s.lastError || null,
      consecutiveFailures: s.consecutiveFailures,
    }));
  }

  /**
   * Recover a parser from quarantine
   */
  async recover(parserId: string): Promise<{ success: boolean; message: string }> {
    const state = this.runtimeState.getById(parserId);
    if (!state) {
      return { success: false, message: `Parser ${parserId} not found` };
    }

    if (state.status !== 'quarantined') {
      return { success: false, message: `Parser ${parserId} is not quarantined` };
    }

    await this.runtimeState.clearQuarantine(parserId);
    this.logger.log(`Recovered parser ${parserId} from quarantine`);
    
    return { success: true, message: `Parser ${parserId} recovered from quarantine` };
  }

  /**
   * Disable a parser
   */
  async disable(parserId: string): Promise<{ success: boolean; message: string }> {
    const state = this.runtimeState.getById(parserId);
    if (!state) {
      return { success: false, message: `Parser ${parserId} not found` };
    }

    await this.runtimeState.markDisabled(parserId);
    this.logger.log(`Disabled parser ${parserId}`);
    
    return { success: true, message: `Parser ${parserId} disabled` };
  }

  /**
   * Enable a parser
   */
  async enable(parserId: string): Promise<{ success: boolean; message: string }> {
    const state = this.runtimeState.getById(parserId);
    if (!state) {
      return { success: false, message: `Parser ${parserId} not found` };
    }

    await this.runtimeState.markEnabled(parserId);
    this.logger.log(`Enabled parser ${parserId}`);
    
    return { success: true, message: `Parser ${parserId} enabled` };
  }

  /**
   * Execute a parser - integrates with actual parsing logic
   * This is a wrapper that will be extended to call actual parsers
   */
  private async executeParser(parserId: string): Promise<{
    success: boolean;
    message: string;
    result?: RunResult;
  }> {
    const state = this.runtimeState.getById(parserId);
    if (!state) {
      return { success: false, message: 'Parser not found' };
    }

    this.runningParsers.add(parserId);
    await this.runtimeState.markRunStarted(parserId);
    
    const startTime = Date.now();
    let result: RunResult;

    try {
      // Determine parser type and execute
      if (state.sourceKind === 'rss') {
        result = await this.executeRssParser(parserId, state);
      } else if (state.sourceKind === 'api') {
        result = await this.executeApiParser(parserId, state);
      } else {
        result = await this.executeGenericParser(parserId, state);
      }

      // Update state
      await this.runtimeState.markRunResult(parserId, result);

      // Log the run
      const log: ParserRunLog = {
        parserId,
        parserName: state.parserName,
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        success: result.success,
        fetched: result.itemsFetched,
        normalized: result.itemsFetched,
        deduped: result.itemsFetched - result.itemsSaved,
        saved: result.itemsSaved,
        durationMs: result.durationMs,
        status: result.success ? (result.itemsSaved > 0 ? 'ok' : 'degraded') : 'failed',
        modeUsed: result.modeUsed,
        fallbackUsed: result.fallbackUsed,
        errors: result.error ? [result.error] : [],
        warnings: result.warnings || [],
      };
      await this.logService.create(log);

      return {
        success: result.success,
        message: result.success 
          ? `Parser ${parserId} completed: ${result.itemsSaved} items saved`
          : `Parser ${parserId} failed: ${result.error}`,
        result,
      };
    } catch (error: any) {
      const failResult: RunResult = {
        success: false,
        itemsFetched: 0,
        itemsSaved: 0,
        durationMs: Date.now() - startTime,
        modeUsed: state.activeMode,
        fallbackUsed: false,
        error: error.message || 'Unknown error',
      };

      await this.runtimeState.markRunResult(parserId, failResult);

      // Log the failed run
      const log: ParserRunLog = {
        parserId,
        parserName: state.parserName,
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        success: false,
        fetched: 0,
        normalized: 0,
        deduped: 0,
        saved: 0,
        durationMs: failResult.durationMs,
        status: 'failed',
        modeUsed: state.activeMode,
        fallbackUsed: false,
        errors: [error.message || 'Unknown error'],
        warnings: [],
      };
      await this.logService.create(log);

      return {
        success: false,
        message: `Parser ${parserId} error: ${error.message}`,
      };
    } finally {
      this.runningParsers.delete(parserId);
    }
  }

  /**
   * Execute RSS parser with fallback chain
   */
  private async executeRssParser(parserId: string, state: any): Promise<RunResult> {
    const source = NEWS_SOURCES.find(s => s.id === parserId);
    if (!source) {
      return {
        success: false,
        itemsFetched: 0,
        itemsSaved: 0,
        durationMs: 0,
        modeUsed: 'rss',
        fallbackUsed: false,
        error: 'Source not found in config',
      };
    }

    const startTime = Date.now();
    const newsCollection = this.connection.collection('news_articles');

    // Try RSS first
    try {
      const RssParser = require('rss-parser');
      const parser = new RssParser({
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
      });

      const feed = await parser.parseURL(source.rssUrl);
      const items = feed.items || [];

      if (items.length > 0) {
        let saved = 0;
        for (const item of items) {
          const article = {
            id: `${parserId}:${Buffer.from(item.link || item.guid || '').toString('base64').slice(0, 40)}`,
            source_id: parserId,
            source_name: source.name,
            url: item.link,
            title: item.title?.trim(),
            summary: item.contentSnippet || item.content || '',
            published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
            collected_at: new Date(),
          };

          // Quality check
          if (!article.title || article.title.length < 10) continue;
          if (article.title.includes('<img')) continue; // Filter garbage

          try {
            await newsCollection.updateOne(
              { id: article.id },
              { $set: article },
              { upsert: true }
            );
            saved++;
          } catch (e) {
            // Duplicate, skip
          }
        }

        return {
          success: true,
          itemsFetched: items.length,
          itemsSaved: saved,
          durationMs: Date.now() - startTime,
          modeUsed: 'rss',
          fallbackUsed: false,
        };
      }
    } catch (rssError: any) {
      this.logger.warn(`RSS failed for ${parserId}: ${rssError.message}`);
    }

    // Try HTML fallback
    if (source.fallback.mode === 'html' && source.fallback.htmlUrl) {
      try {
        const result = await this.executeHtmlFallback(parserId, source, newsCollection);
        return {
          ...result,
          durationMs: Date.now() - startTime,
          fallbackUsed: true,
        };
      } catch (htmlError: any) {
        this.logger.warn(`HTML fallback failed for ${parserId}: ${htmlError.message}`);
      }
    }

    // Try browser fallback
    if (source.fallback.mode === 'browser' && source.fallback.htmlUrl) {
      try {
        const result = await this.executeBrowserFallback(parserId, source, newsCollection);
        return {
          ...result,
          durationMs: Date.now() - startTime,
          fallbackUsed: true,
        };
      } catch (browserError: any) {
        this.logger.warn(`Browser fallback failed for ${parserId}: ${browserError.message}`);
      }
    }

    return {
      success: false,
      itemsFetched: 0,
      itemsSaved: 0,
      durationMs: Date.now() - startTime,
      modeUsed: 'rss',
      fallbackUsed: false,
      error: 'All methods failed',
    };
  }

  /**
   * HTML fallback with improved extraction
   */
  private async executeHtmlFallback(parserId: string, source: SourceConfig, collection: any): Promise<RunResult> {
    const axios = require('axios');
    const cheerio = require('cheerio');

    const response = await axios.get(source.fallback.htmlUrl, {
      timeout: 45000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const $ = cheerio.load(response.data);
    const articles: any[] = [];

    // Source-specific selectors
    const selectors = source.fallback.selectors || {
      container: 'article, .post-card, .news-item, .article-item',
      title: 'h2, h3, .title, .headline',
      link: 'a',
    };

    $(selectors.container).each((_: number, el: any) => {
      const $el = $(el);
      
      // Get title - avoid img tags
      let title = '';
      const titleEl = $el.find(selectors.title).first();
      if (titleEl.length) {
        // Get text only, no HTML
        title = titleEl.text().trim();
      }

      // Skip if title is garbage
      if (!title || title.length < 20) return;
      if (title.startsWith('<')) return;
      if (title.includes('src=')) return;

      // Get link
      let link = $el.find(selectors.link).first().attr('href');
      if (!link) return;
      
      // Normalize link
      if (link.startsWith('/')) {
        const baseUrl = new URL(source.fallback.htmlUrl!);
        link = `${baseUrl.origin}${link}`;
      }
      if (!link.startsWith('http')) return;

      // Dedupe check
      if (articles.find(a => a.link === link)) return;

      articles.push({
        title,
        link,
        summary: $el.find('p, .excerpt, .summary').first().text().trim().slice(0, 500),
      });
    });

    // Save to DB
    let saved = 0;
    for (const article of articles) {
      const doc = {
        id: `${parserId}:${Buffer.from(article.link).toString('base64').slice(0, 40)}`,
        source_id: parserId,
        source_name: source.name,
        url: article.link,
        title: article.title,
        summary: article.summary,
        published_at: new Date(),
        collected_at: new Date(),
        extraction_mode: 'html',
      };

      try {
        await collection.updateOne(
          { id: doc.id },
          { $set: doc },
          { upsert: true }
        );
        saved++;
      } catch (e) {
        // Skip duplicates
      }
    }

    return {
      success: true,
      itemsFetched: articles.length,
      itemsSaved: saved,
      durationMs: 0,
      modeUsed: 'html',
      fallbackUsed: true,
    };
  }

  /**
   * Browser fallback with puppeteer-stealth
   */
  private async executeBrowserFallback(parserId: string, source: SourceConfig, collection: any): Promise<RunResult> {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
      });

      const page = await browser.newPage();
      
      // Set random viewport
      await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100),
      });

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      // Navigate
      await page.goto(source.fallback.htmlUrl!, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      // Wait a bit for dynamic content
      await page.waitForTimeout(2000 + Math.random() * 1000);

      // Scroll to trigger lazy loading
      await page.evaluate(() => {
        window.scrollBy(0, 500);
      });
      await page.waitForTimeout(1000);

      // Extract articles
      const selectors = source.fallback.selectors || {
        container: 'article, .post-card, .news-item',
        title: 'h2, h3',
        link: 'a',
      };

      const articles = await page.evaluate((sel: any) => {
        const items: any[] = [];
        const containers = document.querySelectorAll(sel.container);
        
        containers.forEach(el => {
          const titleEl = el.querySelector(sel.title);
          const linkEl = el.querySelector(sel.link) as HTMLAnchorElement;
          
          if (!titleEl || !linkEl) return;
          
          const title = titleEl.textContent?.trim() || '';
          const link = linkEl.href;
          
          if (title.length < 20) return;
          if (title.startsWith('<')) return;
          if (!link || !link.startsWith('http')) return;
          
          items.push({ title, link });
        });
        
        return items;
      }, selectors);

      // Save to DB
      let saved = 0;
      for (const article of articles) {
        const doc = {
          id: `${parserId}:${Buffer.from(article.link).toString('base64').slice(0, 40)}`,
          source_id: parserId,
          source_name: source.name,
          url: article.link,
          title: article.title,
          summary: '',
          published_at: new Date(),
          collected_at: new Date(),
          extraction_mode: 'browser',
        };

        try {
          await collection.updateOne(
            { id: doc.id },
            { $set: doc },
            { upsert: true }
          );
          saved++;
        } catch (e) {
          // Skip duplicates
        }
      }

      return {
        success: true,
        itemsFetched: articles.length,
        itemsSaved: saved,
        durationMs: 0,
        modeUsed: 'browser',
        fallbackUsed: true,
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Execute API parser (Dropstab, CryptoRank)
   */
  private async executeApiParser(parserId: string, state: any): Promise<RunResult> {
    // This will integrate with existing Dropstab/CryptoRank APIs
    // For now, return a placeholder that indicates we need to call the actual service
    return {
      success: true,
      itemsFetched: 0,
      itemsSaved: 0,
      durationMs: 0,
      modeUsed: 'api',
      fallbackUsed: false,
      warnings: ['API parser execution delegated to main orchestrator'],
    };
  }

  /**
   * Execute generic parser
   */
  private async executeGenericParser(parserId: string, state: any): Promise<RunResult> {
    return {
      success: true,
      itemsFetched: 0,
      itemsSaved: 0,
      durationMs: 0,
      modeUsed: state.activeMode,
      fallbackUsed: false,
      warnings: ['Generic parser execution delegated'],
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
