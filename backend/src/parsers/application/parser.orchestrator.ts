/**
 * Parser Orchestrator - Main entry point for running parsers
 * 
 * Coordinates runners, saves to MongoDB, provides metrics
 * With retry/fallback for resilience
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BrowserSessionManager } from '../common/browser-session.manager';
import { DropstabRunner } from '../dropstab/dropstab.runner';
import { DropstabApiService } from '../dropstab/dropstab.api';
import { CryptoRankRunner } from '../cryptorank/cryptorank.runner';
import { CryptoRankApiService } from '../cryptorank/cryptorank.api';
import { CryptoRankDirectApiService } from '../cryptorank/cryptorank.direct-api';
import { CollectionSummary } from '../common/parser.types';
import { withRetry, withFallback, CircuitBreaker, retryPredicates } from '../common/retry-fallback';

// Circuit breakers for each source
const circuitBreakers = {
  dropstab: new CircuitBreaker('dropstab', { failureThreshold: 3, resetTimeout: 120000 }),
  cryptorank: new CircuitBreaker('cryptorank', { failureThreshold: 3, resetTimeout: 120000 }),
};

@Injectable()
export class ParserOrchestrator {
  private dropstabRunner: DropstabRunner | null = null;
  private cryptoRankRunner: CryptoRankRunner | null = null;
  private dropstabApi: DropstabApiService;
  private cryptoRankApi: CryptoRankApiService;
  private cryptoRankDirectApi: CryptoRankDirectApiService;

  constructor(
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('intel_categories') private categoriesModel: Model<any>,
  ) {
    this.dropstabApi = new DropstabApiService();
    this.cryptoRankApi = new CryptoRankApiService();
    this.cryptoRankDirectApi = new CryptoRankDirectApiService();
  }

  /**
   * Create fresh browser manager and runners
   */
  private createRunners() {
    const browserManager = new BrowserSessionManager(null, 25, true);
    return {
      dropstab: new DropstabRunner(browserManager),
      cryptorank: new CryptoRankRunner(new BrowserSessionManager(null, 25, true)),
    };
  }

  /**
   * Run discovery mode for Dropstab
   */
  async discoverDropstab(url?: string): Promise<any> {
    const browserManager = new BrowserSessionManager(null, 25, true);
    const runner = new DropstabRunner(browserManager);
    
    try {
      const targetUrl = url || 'https://dropstab.com/investors';
      return await runner.runDiscovery(targetUrl);
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Run discovery mode for CryptoRank
   */
  async discoverCryptoRank(url?: string): Promise<any> {
    const browserManager = new BrowserSessionManager(null, 25, true);
    const runner = new CryptoRankRunner(browserManager);
    
    try {
      const targetUrl = url || 'https://cryptorank.io/funding-rounds';
      return await runner.runDiscovery(targetUrl);
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Sync Dropstab investors to MongoDB (using direct API with retry)
   */
  async syncDropstabInvestors(maxPages = 100): Promise<any> {
    console.log('[Orchestrator] Syncing Dropstab investors via API...');

    try {
      return await circuitBreakers.dropstab.execute(async () => {
        const items = await withRetry(
          () => this.dropstabApi.fetchAllInvestors(maxPages),
          {
            maxAttempts: 3,
            initialDelay: 2000,
            retryOn: retryPredicates.onTransientError,
          }
        );
        
        if (items.length === 0) {
          return { source: 'dropstab', entity: 'investors', saved: 0, total: 0, note: 'No items collected' };
        }

        let saved = 0;
        for (const item of items) {
          await this.investorsModel.updateOne(
            { key: item.key },
            { $set: item },
            { upsert: true }
          );
          saved++;
        }

        console.log(`[Orchestrator] Dropstab investors: ${saved} saved`);
        return {
          source: 'dropstab',
          entity: 'investors',
          method: 'direct_api',
          saved,
          total: items.length,
        };
      });
    } catch (error) {
      console.error('[Orchestrator] Dropstab investors sync failed:', error.message);
      return { source: 'dropstab', entity: 'investors', saved: 0, error: error.message };
    }
  }

  /**
   * Sync Dropstab fundraising to MongoDB (using direct API with retry)
   */
  async syncDropstabFundraising(maxPages = 200): Promise<any> {
    console.log('[Orchestrator] Syncing Dropstab fundraising via API...');

    try {
      return await circuitBreakers.dropstab.execute(async () => {
        const items = await withRetry(
          () => this.dropstabApi.fetchAllFundraising(maxPages),
          {
            maxAttempts: 3,
            initialDelay: 2000,
            retryOn: retryPredicates.onTransientError,
          }
        );
        
        if (items.length === 0) {
          return { source: 'dropstab', entity: 'fundraising', saved: 0, total: 0, note: 'No items collected' };
        }

        let saved = 0;
        for (const item of items) {
          await this.fundraisingModel.updateOne(
            { key: item.key },
            { $set: item },
            { upsert: true }
          );
          saved++;
        }

        console.log(`[Orchestrator] Dropstab fundraising: ${saved} saved`);
        return {
          source: 'dropstab',
          entity: 'fundraising',
          method: 'direct_api',
          saved,
          total: items.length,
        };
      });
    } catch (error) {
      console.error('[Orchestrator] Dropstab fundraising sync failed:', error.message);
      return { source: 'dropstab', entity: 'fundraising', saved: 0, error: error.message };
    }
  }

  /**
   * Sync Dropstab unlocks to MongoDB (using direct API)
   */
  async syncDropstabUnlocks(): Promise<any> {
    console.log('[Orchestrator] Syncing Dropstab unlocks via API...');

    try {
      const items = await this.dropstabApi.fetchUnlocks();
      
      if (items.length === 0) {
        return { source: 'dropstab', entity: 'unlocks', saved: 0, total: 0, note: 'No items collected' };
      }

      let saved = 0;
      for (const item of items) {
        await this.unlocksModel.updateOne(
          { key: item.key },
          { $set: item },
          { upsert: true }
        );
        saved++;
      }

      console.log(`[Orchestrator] Dropstab unlocks: ${saved} saved`);
      return {
        source: 'dropstab',
        entity: 'unlocks',
        method: 'direct_api',
        saved,
        total: items.length,
      };
    } catch (error) {
      console.error('[Orchestrator] Dropstab unlocks sync failed:', error.message);
      return { source: 'dropstab', entity: 'unlocks', saved: 0, error: error.message };
    }
  }

  /**
   * Sync CryptoRank funding rounds to MongoDB (using Direct API v0 with retry/fallback)
   * 
   * Uses discovered endpoint: POST https://api.cryptorank.io/v0/funding-rounds-v2
   * With pagination: { "limit": N, "skip": N }
   */
  async syncCryptoRankFunding(maxRecords = 5000): Promise<any> {
    console.log('[Orchestrator] Syncing CryptoRank funding via Direct API v0...');

    try {
      return await circuitBreakers.cryptorank.execute(async () => {
        // Try Direct API with retry, fallback to browser
        const { result: items, usedFallback, error } = await withFallback(
          // Primary: Direct API
          () => withRetry(
            () => this.cryptoRankDirectApi.fetchAllFundingRounds(maxRecords),
            { maxAttempts: 3, initialDelay: 2000, retryOn: retryPredicates.onTransientError }
          ),
          // Fallback: Browser scraping (if available)
          async () => {
            console.log('[Orchestrator] Trying browser fallback for CryptoRank...');
            const browserManager = new BrowserSessionManager(null, 25, true);
            const runner = new CryptoRankRunner(browserManager);
            try {
              const result = await runner.collectFundingRounds(50);
              return result.items;
            } finally {
              await browserManager.close();
            }
          },
          {
            primaryName: 'CryptoRank Direct API',
            fallbackName: 'Browser Scraping',
            validateResult: (items) => Array.isArray(items) && items.length > 0,
          }
        );
        
        if (items.length === 0) {
          return { source: 'cryptorank', entity: 'funding', saved: 0, total: 0, note: 'No items from API' };
        }

        let saved = 0;
        for (const item of items) {
          const doc = { ...item };
          delete (doc as any).raw;
          
          await this.fundraisingModel.updateOne(
            { key: doc.key },
            { $set: doc },
            { upsert: true }
          );
          saved++;
        }

        console.log(`[Orchestrator] CryptoRank funding: ${saved} saved`);
        return {
          source: 'cryptorank',
          entity: 'funding',
          method: usedFallback ? 'browser_fallback' : 'direct_api_v0',
          saved,
          total: items.length,
          fallback_used: usedFallback,
          primary_error: error,
        };
      });
    } catch (error) {
      console.error('[Orchestrator] CryptoRank funding sync failed:', error.message);
      return { source: 'cryptorank', entity: 'funding', saved: 0, error: error.message };
    }
  }

  /**
   * Browser-based fallback for CryptoRank funding (deprecated - use Direct API)
   */
  private async syncCryptoRankFundingBrowser(maxPages = 50): Promise<any> {
    console.log('[Orchestrator] Syncing CryptoRank funding via browser (deprecated)...');
    const browserManager = new BrowserSessionManager(null, 25, true);
    const runner = new CryptoRankRunner(browserManager);

    try {
      const result = await runner.collectFundingRounds(maxPages);
      
      if (result.items.length === 0) {
        return { source: 'cryptorank', entity: 'funding', saved: 0, total: 0, note: 'No items collected' };
      }

      let saved = 0;
      for (const item of result.items) {
        const doc = { ...item };
        delete doc.raw;
        
        await this.fundraisingModel.updateOne(
          { key: doc.key },
          { $set: doc },
          { upsert: true }
        );
        saved++;
      }

      console.log(`[Orchestrator] CryptoRank funding (browser): ${saved} saved`);
      return {
        source: 'cryptorank',
        entity: 'funding',
        method: 'browser_fallback',
        saved,
        total: result.totalUnique,
        pages: result.totalPages,
      };
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Sync CryptoRank investors to MongoDB (using Direct API v0)
   */
  async syncCryptoRankInvestors(maxRecords = 2000): Promise<any> {
    console.log('[Orchestrator] Syncing CryptoRank investors via Direct API v0...');

    try {
      const items = await this.cryptoRankDirectApi.fetchAllInvestors(maxRecords);
      
      if (items.length === 0) {
        console.log('[Orchestrator] Direct API returned 0 items');
        return { source: 'cryptorank', entity: 'investors', saved: 0, total: 0, note: 'No items from API' };
      }

      let saved = 0;
      for (const item of items) {
        const doc = { ...item };
        delete (doc as any).raw;
        
        await this.investorsModel.updateOne(
          { key: doc.key },
          { $set: doc },
          { upsert: true }
        );
        saved++;
      }

      console.log(`[Orchestrator] CryptoRank investors (Direct API): ${saved} saved`);
      return {
        source: 'cryptorank',
        entity: 'investors',
        method: 'direct_api_v0',
        saved,
        total: items.length,
      };
    } catch (error) {
      console.error('[Orchestrator] CryptoRank Direct API failed:', error.message);
      return { source: 'cryptorank', entity: 'investors', saved: 0, error: error.message };
    }
  }

  /**
   * Browser-based fallback for CryptoRank investors (deprecated)
   */
  private async syncCryptoRankInvestorsBrowser(maxPages = 30): Promise<any> {
    console.log('[Orchestrator] Syncing CryptoRank investors via browser (deprecated)...');
    const browserManager = new BrowserSessionManager(null, 25, true);
    const runner = new CryptoRankRunner(browserManager);

    try {
      const result = await runner.collectInvestors(maxPages);
      
      if (result.items.length === 0) {
        return { source: 'cryptorank', entity: 'investors', saved: 0, total: 0, note: 'No items collected' };
      }

      let saved = 0;
      for (const item of result.items) {
        const doc = { ...item };
        delete doc.raw;
        
        await this.investorsModel.updateOne(
          { key: doc.key },
          { $set: doc },
          { upsert: true }
        );
        saved++;
      }

      console.log(`[Orchestrator] CryptoRank investors (browser): ${saved} saved`);
      return {
        source: 'cryptorank',
        entity: 'investors',
        method: 'browser_fallback',
        saved,
        total: result.totalUnique,
        pages: result.totalPages,
      };
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Sync CryptoRank unlocks to MongoDB (using Direct API v0)
   */
  async syncCryptoRankUnlocks(maxRecords = 500): Promise<any> {
    console.log('[Orchestrator] Syncing CryptoRank unlocks via Direct API v0...');

    try {
      const items = await this.cryptoRankDirectApi.fetchAllUnlocks(maxRecords);
      
      if (items.length === 0) {
        console.log('[Orchestrator] Direct API returned 0 items');
        return { source: 'cryptorank', entity: 'unlocks', saved: 0, total: 0, note: 'No items from API' };
      }

      let saved = 0;
      for (const item of items) {
        const doc = { ...item };
        delete (doc as any).raw;
        
        await this.unlocksModel.updateOne(
          { key: doc.key },
          { $set: doc },
          { upsert: true }
        );
        saved++;
      }

      console.log(`[Orchestrator] CryptoRank unlocks (Direct API): ${saved} saved`);
      return {
        source: 'cryptorank',
        entity: 'unlocks',
        method: 'direct_api_v0',
        saved,
        total: items.length,
      };
    } catch (error) {
      console.error('[Orchestrator] CryptoRank Direct API failed:', error.message);
      return { source: 'cryptorank', entity: 'unlocks', saved: 0, error: error.message };
    }
  }

  /**
   * Browser-based fallback for CryptoRank unlocks (deprecated)
   */
  private async syncCryptoRankUnlocksBrowser(maxPages = 20): Promise<any> {
    console.log('[Orchestrator] Syncing CryptoRank unlocks via browser (deprecated)...');
    const browserManager = new BrowserSessionManager(null, 25, true);
    const runner = new CryptoRankRunner(browserManager);

    try {
      const result = await runner.collectUnlocks(maxPages);
      
      if (result.items.length === 0) {
        return { source: 'cryptorank', entity: 'unlocks', saved: 0, total: 0, note: 'No items collected' };
      }

      let saved = 0;
      for (const item of result.items) {
        const doc = { ...item };
        delete doc.raw;
        
        await this.unlocksModel.updateOne(
          { key: doc.key },
          { $set: doc },
          { upsert: true }
        );
        saved++;
      }

      console.log(`[Orchestrator] CryptoRank unlocks (browser): ${saved} saved`);
      return {
        source: 'cryptorank',
        entity: 'unlocks',
        method: 'browser_fallback',
        saved,
        total: result.totalUnique,
        pages: result.totalPages,
      };
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Sync CryptoRank categories to MongoDB
   */
  async syncCryptoRankCategories(): Promise<any> {
    console.log('[Orchestrator] Syncing CryptoRank categories...');
    const browserManager = new BrowserSessionManager(null, 25, true);
    const runner = new CryptoRankRunner(browserManager);

    try {
      const result = await runner.collectCategories();
      
      if (result.items.length === 0) {
        return { source: 'cryptorank', entity: 'categories', saved: 0, total: 0, note: 'No items collected' };
      }

      let saved = 0;
      for (const item of result.items) {
        await this.categoriesModel.updateOne(
          { key: item.key },
          { $set: item },
          { upsert: true }
        );
        saved++;
      }

      console.log(`[Orchestrator] CryptoRank categories: ${saved} saved`);
      return {
        source: 'cryptorank',
        entity: 'categories',
        saved,
        total: result.totalUnique,
      };
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Full sync - all sources and entities
   */
  async syncAll(): Promise<any> {
    console.log('[Orchestrator] Starting FULL sync...');
    const start = Date.now();

    const results: any = {
      ts: Date.now(),
      method: 'network_interception',
      syncs: {},
      errors: [],
    };

    const tasks = [
      ['dropstab_investors', () => this.syncDropstabInvestors(30)],
      ['dropstab_fundraising', () => this.syncDropstabFundraising(50)],
      ['dropstab_unlocks', () => this.syncDropstabUnlocks()],
      ['cryptorank_funding', () => this.syncCryptoRankFunding(50)],
      ['cryptorank_investors', () => this.syncCryptoRankInvestors(30)],
      ['cryptorank_unlocks', () => this.syncCryptoRankUnlocks(20)],
      ['cryptorank_categories', () => this.syncCryptoRankCategories()],
    ] as const;

    for (const [name, fn] of tasks) {
      try {
        console.log(`[Orchestrator] Running: ${name}...`);
        results.syncs[name] = await fn();
      } catch (error) {
        console.error(`[Orchestrator] ${name} failed:`, error.message);
        results.syncs[name] = { error: error.message };
        results.errors.push({ task: name, error: error.message });
      }
    }

    const elapsed = (Date.now() - start) / 1000;
    results.elapsed_sec = Math.round(elapsed * 100) / 100;

    // Summary
    let totalSaved = 0;
    for (const key of Object.keys(results.syncs)) {
      totalSaved += results.syncs[key]?.saved || 0;
    }
    results.totalSaved = totalSaved;

    console.log(`[Orchestrator] Full sync complete in ${elapsed.toFixed(1)}s, total saved: ${totalSaved}`);
    return results;
  }
}
