/**
 * Master Parser Orchestrator
 * 
 * Единый runner для ВСЕХ парсеров:
 * - RSS feeds (26+)
 * - Dropstab API
 * - CryptoRank scraper
 * - IcoDrops scraper
 * 
 * Показывает статус каждого источника
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DropstabApiService } from '../dropstab/dropstab.api';
import { CryptoRankRunner } from '../cryptorank/cryptorank.runner';
import { BrowserSessionManager } from '../common/browser-session.manager';

// RSS feed fetcher
const Parser = require('rss-parser');

interface ParserResult {
  name: string;
  type: 'api' | 'scraper' | 'rss';
  status: 'success' | 'partial' | 'failed';
  raw_count: number;
  unique_count: number;
  saved_count: number;
  elapsed_ms: number;
  error?: string;
  details?: any;
}

interface OrchestratorReport {
  ts: number;
  total_parsers: number;
  success_count: number;
  failed_count: number;
  total_items_collected: number;
  total_elapsed_sec: number;
  results: ParserResult[];
  summary: {
    by_type: { api: number; scraper: number; rss: number };
    by_status: { success: number; partial: number; failed: number };
  };
}

// RSS Sources config (simplified)
const RSS_SOURCES = [
  { id: 'coindesk', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'cointelegraph', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { id: 'theblock', name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
  { id: 'decrypt', name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { id: 'blockworks', name: 'Blockworks', url: 'https://blockworks.co/feed/' },
  { id: 'dlnews', name: 'DL News', url: 'https://www.dlnews.com/rss/' },
  { id: 'defiant', name: 'The Defiant', url: 'https://thedefiant.io/feed/' },
  { id: 'incrypted', name: 'Incrypted', url: 'https://incrypted.com/feed/' },
  { id: 'forklog', name: 'Forklog', url: 'https://forklog.com/feed/' },
  { id: 'bitcoinmagazine', name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/.rss/full/' },
  { id: 'cryptoslate', name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
  { id: 'beincrypto', name: 'BeInCrypto', url: 'https://beincrypto.com/feed/' },
  { id: 'newsbtc', name: 'NewsBTC', url: 'https://www.newsbtc.com/feed/' },
  { id: 'cryptopotato', name: 'CryptoPotato', url: 'https://cryptopotato.com/feed/' },
  { id: 'utoday', name: 'U.Today', url: 'https://u.today/rss' },
  { id: 'cryptobriefing', name: 'CryptoBriefing', url: 'https://cryptobriefing.com/feed/' },
  { id: 'bitcoinist', name: 'Bitcoinist', url: 'https://bitcoinist.com/feed/' },
  { id: 'ambcrypto', name: 'AMBCrypto', url: 'https://ambcrypto.com/feed/' },
  { id: 'bits_media', name: 'Bits.media', url: 'https://bits.media/rss/' },
  { id: 'bankless', name: 'Bankless', url: 'https://www.bankless.com/rss/' },
  { id: 'rekt_news', name: 'Rekt News', url: 'https://rekt.news/rss/feed.xml' },
];

@Injectable()
export class MasterOrchestrator {
  private rssParser: any;
  private dropstabApi: DropstabApiService;

  constructor(
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('news_articles') private newsModel: Model<any>,
  ) {
    this.rssParser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 FOMO/2.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    this.dropstabApi = new DropstabApiService();
  }

  /**
   * Run ALL parsers and return detailed report
   */
  async runAll(): Promise<OrchestratorReport> {
    const start = Date.now();
    console.log('\n' + '═'.repeat(60));
    console.log('[MasterOrchestrator] STARTING FULL SYSTEM RUN');
    console.log('═'.repeat(60) + '\n');

    const results: ParserResult[] = [];

    // 1. Run Dropstab API
    console.log('\n▶ DROPSTAB (API)');
    console.log('─'.repeat(40));
    results.push(await this.runDropstabInvestors());
    results.push(await this.runDropstabFundraising());

    // 2. Run CryptoRank scraper
    console.log('\n▶ CRYPTORANK (Scraper)');
    console.log('─'.repeat(40));
    results.push(await this.runCryptoRankFunding());

    // 3. Run ALL RSS feeds
    console.log('\n▶ RSS FEEDS (' + RSS_SOURCES.length + ' sources)');
    console.log('─'.repeat(40));
    for (const source of RSS_SOURCES) {
      results.push(await this.runRssFeed(source));
      await this.sleep(500); // Rate limit
    }

    const elapsed = (Date.now() - start) / 1000;

    // Build report
    const report: OrchestratorReport = {
      ts: Date.now(),
      total_parsers: results.length,
      success_count: results.filter(r => r.status === 'success').length,
      failed_count: results.filter(r => r.status === 'failed').length,
      total_items_collected: results.reduce((sum, r) => sum + r.unique_count, 0),
      total_elapsed_sec: Math.round(elapsed * 100) / 100,
      results,
      summary: {
        by_type: {
          api: results.filter(r => r.type === 'api').reduce((sum, r) => sum + r.unique_count, 0),
          scraper: results.filter(r => r.type === 'scraper').reduce((sum, r) => sum + r.unique_count, 0),
          rss: results.filter(r => r.type === 'rss').reduce((sum, r) => sum + r.unique_count, 0),
        },
        by_status: {
          success: results.filter(r => r.status === 'success').length,
          partial: results.filter(r => r.status === 'partial').length,
          failed: results.filter(r => r.status === 'failed').length,
        },
      },
    };

    // Print summary
    console.log('\n' + '═'.repeat(60));
    console.log('[MasterOrchestrator] RUN COMPLETE');
    console.log('═'.repeat(60));
    console.log(`Total parsers: ${report.total_parsers}`);
    console.log(`Success: ${report.success_count} | Partial: ${report.summary.by_status.partial} | Failed: ${report.failed_count}`);
    console.log(`Total items collected: ${report.total_items_collected}`);
    console.log(`Elapsed: ${elapsed.toFixed(1)}s`);
    console.log('');

    // Print failed ones
    const failed = results.filter(r => r.status === 'failed');
    if (failed.length > 0) {
      console.log('❌ FAILED PARSERS:');
      for (const f of failed) {
        console.log(`   - ${f.name}: ${f.error}`);
      }
    }

    return report;
  }

  /**
   * Run Dropstab investors via API
   */
  private async runDropstabInvestors(): Promise<ParserResult> {
    const start = Date.now();
    const name = 'Dropstab Investors';

    try {
      console.log(`  [${name}] Starting...`);
      const items = await this.dropstabApi.fetchAllInvestors(50); // 50 pages max for quick test
      
      const saved = await this.saveInvestors(items);

      console.log(`  [${name}] ✓ raw=${items.length} unique=${items.length} saved=${saved}`);
      return {
        name,
        type: 'api',
        status: items.length > 0 ? 'success' : 'failed',
        raw_count: items.length,
        unique_count: items.length,
        saved_count: saved,
        elapsed_ms: Date.now() - start,
      };
    } catch (error) {
      console.log(`  [${name}] ✗ ERROR: ${error.message}`);
      return {
        name,
        type: 'api',
        status: 'failed',
        raw_count: 0,
        unique_count: 0,
        saved_count: 0,
        elapsed_ms: Date.now() - start,
        error: error.message,
      };
    }
  }

  /**
   * Run Dropstab fundraising via API
   */
  private async runDropstabFundraising(): Promise<ParserResult> {
    const start = Date.now();
    const name = 'Dropstab Fundraising';

    try {
      console.log(`  [${name}] Starting...`);
      const items = await this.dropstabApi.fetchAllFundraising(100); // 100 pages max for quick test
      
      const saved = await this.saveFundraising(items, 'dropstab');

      console.log(`  [${name}] ✓ raw=${items.length} unique=${items.length} saved=${saved}`);
      return {
        name,
        type: 'api',
        status: items.length > 0 ? 'success' : 'failed',
        raw_count: items.length,
        unique_count: items.length,
        saved_count: saved,
        elapsed_ms: Date.now() - start,
      };
    } catch (error) {
      console.log(`  [${name}] ✗ ERROR: ${error.message}`);
      return {
        name,
        type: 'api',
        status: 'failed',
        raw_count: 0,
        unique_count: 0,
        saved_count: 0,
        elapsed_ms: Date.now() - start,
        error: error.message,
      };
    }
  }

  /**
   * Run CryptoRank funding scraper
   */
  private async runCryptoRankFunding(): Promise<ParserResult> {
    const start = Date.now();
    const name = 'CryptoRank Funding';
    
    const browserManager = new BrowserSessionManager(null, 25, true);
    const runner = new CryptoRankRunner(browserManager);

    try {
      console.log(`  [${name}] Starting browser-based collection...`);
      const result = await runner.collectFundingRounds(10); // 10 pages for test
      
      const saved = await this.saveFundraising(result.items, 'cryptorank');

      console.log(`  [${name}] ✓ raw=${result.totalRaw} unique=${result.totalUnique} saved=${saved}`);
      
      // Show debug info
      if (result.debug?.pagesData) {
        for (const page of result.debug.pagesData.slice(0, 3)) {
          console.log(`    Page ${page.page}: urls=${page.matchedUrls.length} payloads=${page.payloadCount} items=${page.itemsFound}`);
        }
      }

      return {
        name,
        type: 'scraper',
        status: result.totalUnique > 0 ? 'success' : 'failed',
        raw_count: result.totalRaw,
        unique_count: result.totalUnique,
        saved_count: saved,
        elapsed_ms: Date.now() - start,
        details: result.debug,
      };
    } catch (error) {
      console.log(`  [${name}] ✗ ERROR: ${error.message}`);
      return {
        name,
        type: 'scraper',
        status: 'failed',
        raw_count: 0,
        unique_count: 0,
        saved_count: 0,
        elapsed_ms: Date.now() - start,
        error: error.message,
      };
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Run single RSS feed
   */
  private async runRssFeed(source: { id: string; name: string; url: string }): Promise<ParserResult> {
    const start = Date.now();
    const name = `RSS: ${source.name}`;

    try {
      const feed = await this.rssParser.parseURL(source.url);
      const items = feed.items || [];
      
      // Count valid items
      const validItems = items.filter((item: any) => item.link && item.title);
      
      console.log(`  [${name}] ✓ raw=${items.length} valid=${validItems.length}`);
      
      return {
        name,
        type: 'rss',
        status: validItems.length > 0 ? 'success' : (items.length > 0 ? 'partial' : 'failed'),
        raw_count: items.length,
        unique_count: validItems.length,
        saved_count: 0, // Not saving to DB in test mode
        elapsed_ms: Date.now() - start,
      };
    } catch (error) {
      console.log(`  [${name}] ✗ ERROR: ${error.message}`);
      return {
        name,
        type: 'rss',
        status: 'failed',
        raw_count: 0,
        unique_count: 0,
        saved_count: 0,
        elapsed_ms: Date.now() - start,
        error: error.message,
      };
    }
  }

  /**
   * Quick diagnostic - just check all sources without saving
   */
  async diagnose(): Promise<any> {
    console.log('\n' + '═'.repeat(60));
    console.log('[MasterOrchestrator] DIAGNOSTIC MODE');
    console.log('═'.repeat(60) + '\n');

    const results: any[] = [];

    // Check Dropstab API
    console.log('▶ Checking Dropstab API...');
    try {
      const investors = await this.dropstabApi.fetchInvestors(0, 5);
      console.log(`  ✓ Investors API: ${investors.content?.length || 0} items, total: ${investors.totalElements}`);
      results.push({ source: 'dropstab_investors', status: 'ok', sample: investors.content?.length || 0 });
    } catch (e) {
      console.log(`  ✗ Investors API: ${e.message}`);
      results.push({ source: 'dropstab_investors', status: 'error', error: e.message });
    }

    try {
      const funding = await this.dropstabApi.fetchFundraising(0, 5);
      console.log(`  ✓ Fundraising API: ${funding.content?.length || 0} items, total: ${funding.totalElements}`);
      results.push({ source: 'dropstab_fundraising', status: 'ok', sample: funding.content?.length || 0 });
    } catch (e) {
      console.log(`  ✗ Fundraising API: ${e.message}`);
      results.push({ source: 'dropstab_fundraising', status: 'error', error: e.message });
    }

    // Check RSS feeds
    console.log('\n▶ Checking RSS feeds...');
    for (const source of RSS_SOURCES.slice(0, 5)) { // Check first 5 for quick test
      try {
        const feed = await this.rssParser.parseURL(source.url);
        const count = (feed.items || []).length;
        console.log(`  ✓ ${source.name}: ${count} items`);
        results.push({ source: source.id, status: 'ok', sample: count });
      } catch (e) {
        console.log(`  ✗ ${source.name}: ${e.message}`);
        results.push({ source: source.id, status: 'error', error: e.message });
      }
      await this.sleep(300);
    }

    const ok = results.filter(r => r.status === 'ok').length;
    const fail = results.filter(r => r.status === 'error').length;

    console.log('\n' + '─'.repeat(40));
    console.log(`Diagnostic complete: ${ok} OK, ${fail} FAILED`);

    return {
      ts: Date.now(),
      ok_count: ok,
      fail_count: fail,
      results,
    };
  }

  /**
   * Save investors to MongoDB
   */
  private async saveInvestors(items: any[]): Promise<number> {
    let saved = 0;
    for (const item of items) {
      try {
        await this.investorsModel.updateOne(
          { key: item.key },
          { $set: item },
          { upsert: true }
        );
        saved++;
      } catch (e) {
        // Ignore
      }
    }
    return saved;
  }

  /**
   * Save fundraising to MongoDB
   */
  private async saveFundraising(items: any[], source: string): Promise<number> {
    let saved = 0;
    for (const item of items) {
      try {
        await this.fundraisingModel.updateOne(
          { key: item.key },
          { $set: item },
          { upsert: true }
        );
        saved++;
      } catch (e) {
        // Ignore
      }
    }
    return saved;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
