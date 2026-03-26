/**
 * RSS FALLBACK ENGINE
 * 
 * Main orchestrator for RSS → HTML → Browser → Replace fallback chain
 */

import { Injectable } from '@nestjs/common';
import * as Parser from 'rss-parser';
import { ResilientFetchService } from '../antiblock/resilient-fetch.service';
import { HttpFingerprintService } from '../antiblock/http-fingerprint.service';
import { ParserHealthService } from '../antiblock/parser-health.service';
import { CircuitBreakerService } from '../antiblock/circuit-breaker.service';
import { withRetry } from '../antiblock/retry.util';
import { HtmlParserService, ParsedArticle } from './html-parser.service';
import { SourceConfig, getEnabledSources, getSourceById } from './source.config';

// Error classification
type ErrorType = 'BLOCKED' | 'NOT_FOUND' | 'INVALID_XML' | 'EMPTY' | 'TIMEOUT' | 'UNKNOWN';

interface RunResult {
  sourceId: string;
  sourceName: string;
  success: boolean;
  method: 'rss' | 'html' | 'browser' | 'replace' | 'failed';
  articles: ParsedArticle[];
  error?: string;
  errorType?: ErrorType;
  durationMs: number;
}

@Injectable()
export class RssFallbackEngine {
  private rssParser: Parser;

  constructor(
    private readonly fetchService: ResilientFetchService,
    private readonly htmlParser: HtmlParserService,
    private readonly fingerprint: HttpFingerprintService,
    private readonly parserHealth: ParserHealthService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    this.rssParser = new Parser({
      timeout: 20000,
      headers: this.fingerprint.buildHeaders({ kind: 'rss' }),
    });
  }

  // ==============================
  // MAIN ENTRY POINT
  // ==============================

  /**
   * Run single source with full fallback chain
   */
  async runSource(source: SourceConfig): Promise<RunResult> {
    const startTime = Date.now();
    
    // Check circuit breaker
    if (!this.circuitBreaker.canExecute(source.id)) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        success: false,
        method: 'failed',
        articles: [],
        error: 'Circuit breaker open',
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // 1. Try RSS first
      const rssResult = await this.tryRss(source);
      
      if (rssResult.success && rssResult.articles.length > 0) {
        this.recordSuccess(source.id, source.name, rssResult.articles.length);
        return {
          ...rssResult,
          durationMs: Date.now() - startTime,
        };
      }

      // 2. RSS failed or empty → run fallback
      console.log(`[FallbackEngine] ${source.name}: RSS failed, trying fallback`);
      const fallbackResult = await this.runFallback(source, rssResult.errorType);
      
      if (fallbackResult.success && fallbackResult.articles.length > 0) {
        this.recordSuccess(source.id, source.name, fallbackResult.articles.length, 'fallback');
        return {
          ...fallbackResult,
          durationMs: Date.now() - startTime,
        };
      }

      // 3. All failed
      const error = fallbackResult.error || rssResult.error || 'All methods failed';
      this.recordFailure(source.id, source.name, error);
      
      return {
        sourceId: source.id,
        sourceName: source.name,
        success: false,
        method: 'failed',
        articles: [],
        error,
        errorType: fallbackResult.errorType || rssResult.errorType,
        durationMs: Date.now() - startTime,
      };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.recordFailure(source.id, source.name, error);
      
      return {
        sourceId: source.id,
        sourceName: source.name,
        success: false,
        method: 'failed',
        articles: [],
        error,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run all enabled sources
   */
  async runAllSources(): Promise<{
    total: number;
    successful: number;
    byMethod: Record<string, number>;
    results: RunResult[];
  }> {
    const sources = getEnabledSources();
    const results: RunResult[] = [];

    console.log(`[FallbackEngine] Running ${sources.length} sources...`);

    for (const source of sources) {
      const result = await this.runSource(source);
      results.push(result);
      
      // Small delay between sources
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    }

    const successful = results.filter(r => r.success);
    const byMethod: Record<string, number> = {};
    
    for (const r of results) {
      byMethod[r.method] = (byMethod[r.method] || 0) + 1;
    }

    console.log(`[FallbackEngine] Complete: ${successful.length}/${results.length} successful`);

    return {
      total: results.length,
      successful: successful.length,
      byMethod,
      results,
    };
  }

  // ==============================
  // PRIMARY: RSS
  // ==============================

  private async tryRss(source: SourceConfig): Promise<Omit<RunResult, 'durationMs'>> {
    try {
      // Create fresh parser with rotated headers
      const parser = new Parser({
        timeout: 20000,
        headers: this.fingerprint.buildHeaders({ kind: 'rss' }),
      });

      const feed = await withRetry(
        () => parser.parseURL(source.rssUrl),
        { retries: 2, baseDelayMs: 1000 }
      );

      const items = feed.items || [];
      
      if (items.length === 0) {
        return {
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          method: 'rss',
          articles: [],
          error: 'Empty RSS feed',
          errorType: 'EMPTY',
        };
      }

      const articles: ParsedArticle[] = items.map(item => ({
        title: item.title || '',
        url: item.link || '',
        summary: item.contentSnippet?.substring(0, 300),
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        source: source.id,
        method: 'rss' as const,
      })).filter(a => a.title && a.url);

      return {
        sourceId: source.id,
        sourceName: source.name,
        success: true,
        method: 'rss',
        articles,
      };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const errorType = this.classifyError(error);

      return {
        sourceId: source.id,
        sourceName: source.name,
        success: false,
        method: 'rss',
        articles: [],
        error,
        errorType,
      };
    }
  }

  // ==============================
  // FALLBACK CHAIN
  // ==============================

  private async runFallback(
    source: SourceConfig, 
    errorType?: ErrorType
  ): Promise<Omit<RunResult, 'durationMs'>> {
    
    const mode = source.fallback.mode;
    
    // Smart strategy based on error type
    if (errorType === 'BLOCKED' && mode !== 'browser') {
      // Override: 403 needs browser
      return this.tryBrowser(source);
    }
    
    switch (mode) {
      case 'html':
        return this.tryHtml(source);
        
      case 'browser':
        return this.tryBrowser(source);
        
      case 'replace':
        return this.tryReplacement(source);
        
      case 'none':
      default:
        return {
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          method: 'failed',
          articles: [],
          error: 'No fallback configured',
        };
    }
  }

  private async tryHtml(source: SourceConfig): Promise<Omit<RunResult, 'durationMs'>> {
    try {
      const articles = await this.htmlParser.parseHtml(source);
      
      if (articles.length === 0) {
        return {
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          method: 'html',
          articles: [],
          error: 'No articles found in HTML',
          errorType: 'EMPTY',
        };
      }

      return {
        sourceId: source.id,
        sourceName: source.name,
        success: true,
        method: 'html',
        articles,
      };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        sourceId: source.id,
        sourceName: source.name,
        success: false,
        method: 'html',
        articles: [],
        error,
        errorType: this.classifyError(error),
      };
    }
  }

  private async tryReplacement(source: SourceConfig): Promise<Omit<RunResult, 'durationMs'>> {
    try {
      const articles = await this.htmlParser.parseReplacement(source);
      
      if (articles.length === 0) {
        return {
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          method: 'replace',
          articles: [],
          error: 'No articles in replacement URL',
          errorType: 'EMPTY',
        };
      }

      return {
        sourceId: source.id,
        sourceName: source.name,
        success: true,
        method: 'replace',
        articles,
      };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        sourceId: source.id,
        sourceName: source.name,
        success: false,
        method: 'replace',
        articles: [],
        error,
        errorType: this.classifyError(error),
      };
    }
  }

  private async tryBrowser(source: SourceConfig): Promise<Omit<RunResult, 'durationMs'>> {
    // Browser fallback is heavy - mark as needs browser
    // For now, fall back to HTML with a note
    console.log(`[FallbackEngine] ${source.name}: Browser fallback needed (not implemented)`);
    
    try {
      // Try HTML anyway as best effort
      return await this.tryHtml(source);
    } catch {
      return {
        sourceId: source.id,
        sourceName: source.name,
        success: false,
        method: 'browser',
        articles: [],
        error: 'Browser fallback not available, HTML also failed',
        errorType: 'BLOCKED',
      };
    }
  }

  // ==============================
  // HELPERS
  // ==============================

  private classifyError(error: string): ErrorType {
    const msg = error.toLowerCase();
    
    if (msg.includes('403') || msg.includes('forbidden')) return 'BLOCKED';
    if (msg.includes('404') || msg.includes('not found')) return 'NOT_FOUND';
    if (msg.includes('xml') || msg.includes('parse')) return 'INVALID_XML';
    if (msg.includes('empty') || msg.includes('no items')) return 'EMPTY';
    if (msg.includes('timeout') || msg.includes('abort')) return 'TIMEOUT';
    
    return 'UNKNOWN';
  }

  private recordSuccess(
    sourceId: string, 
    sourceName: string, 
    fetched: number,
    via?: 'fallback'
  ) {
    this.circuitBreaker.recordSuccess(sourceId);
    this.parserHealth.markSuccess(sourceId, {
      parserName: sourceName,
      fetched,
    });
  }

  private recordFailure(sourceId: string, sourceName: string, error: string) {
    this.circuitBreaker.recordFailure(sourceId);
    this.parserHealth.markFailure(sourceId, error, {
      parserName: sourceName,
    });
  }
}
