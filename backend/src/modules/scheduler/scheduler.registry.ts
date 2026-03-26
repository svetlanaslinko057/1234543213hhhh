/**
 * Scheduler Registry
 * 
 * Defines all jobs with:
 * - id, kind, priorityTier
 * - cron, enabled
 * - dependencies
 * - concurrencyGroup, maxConcurrency
 * - timeoutMs
 */

import { Injectable, Logger } from '@nestjs/common';

export type PriorityTier = 'T1' | 'T2' | 'T3' | 'T4';
export type JobKind = 'api' | 'rss' | 'html' | 'xhr' | 'browser' | 'graph' | 'rootdata' | 'news' | 'entity' | 'snapshot';
export type ConcurrencyGroup = 'rss_html' | 'browser' | 'graph_build' | 'heavy_sync' | 'default';

export interface ScheduledJob {
  id: string;
  name: string;
  kind: JobKind;
  priorityTier: PriorityTier;
  cron: string;
  enabled: boolean;
  dependencies: string[];
  concurrencyGroup: ConcurrencyGroup;
  maxConcurrency: number;
  timeoutMs: number;
  handler: string; // Service method to call
  description?: string;
}

// Tier intervals
export const TIER_CRONS = {
  T1: '*/10 * * * *',  // Every 10 minutes
  T2: '*/15 * * * *',  // Every 15 minutes
  T3: '*/30 * * * *',  // Every 30 minutes
  T4: '0 */3 * * *',   // Every 3 hours
};

// Concurrency limits per group
export const CONCURRENCY_LIMITS: Record<ConcurrencyGroup, number> = {
  rss_html: 5,
  browser: 2,
  graph_build: 1,
  heavy_sync: 2,
  default: 3,
};

@Injectable()
export class SchedulerRegistry {
  private readonly logger = new Logger(SchedulerRegistry.name);
  private jobs: Map<string, ScheduledJob> = new Map();

  constructor() {
    this.initializeDefaultJobs();
  }

  private initializeDefaultJobs(): void {
    // ═══════════════════════════════════════════════════════════════
    // TIER 1 - Critical (every 10 min)
    // ═══════════════════════════════════════════════════════════════
    
    this.register({
      id: 'dropstab_investors',
      name: 'Dropstab Investors Sync',
      kind: 'api',
      priorityTier: 'T1',
      cron: TIER_CRONS.T1,
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'heavy_sync',
      maxConcurrency: 1,
      timeoutMs: 300000, // 5 min
      handler: 'parsers.syncDropstabInvestors',
    });

    this.register({
      id: 'dropstab_funding',
      name: 'Dropstab Funding Sync',
      kind: 'api',
      priorityTier: 'T1',
      cron: TIER_CRONS.T1,
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'heavy_sync',
      maxConcurrency: 1,
      timeoutMs: 300000,
      handler: 'parsers.syncDropstabFunding',
    });

    this.register({
      id: 'cryptorank_funding',
      name: 'CryptoRank Funding Sync',
      kind: 'api',
      priorityTier: 'T1',
      cron: TIER_CRONS.T1,
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'heavy_sync',
      maxConcurrency: 1,
      timeoutMs: 300000,
      handler: 'parsers.syncCryptoRankFunding',
    });

    // ═══════════════════════════════════════════════════════════════
    // TIER 2 - Important (every 15 min)
    // ═══════════════════════════════════════════════════════════════

    this.register({
      id: 'news_rss_tier_a',
      name: 'News RSS Tier A',
      kind: 'rss',
      priorityTier: 'T2',
      cron: TIER_CRONS.T2,
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'rss_html',
      maxConcurrency: 5,
      timeoutMs: 120000, // 2 min
      handler: 'news.syncTierA',
    });

    this.register({
      id: 'entity_resolution',
      name: 'Entity Resolution',
      kind: 'entity',
      priorityTier: 'T2',
      cron: TIER_CRONS.T2,
      enabled: true,
      dependencies: ['dropstab_investors', 'cryptorank_funding'],
      concurrencyGroup: 'default',
      maxConcurrency: 1,
      timeoutMs: 180000, // 3 min
      handler: 'entities.resolve',
      description: 'Runs after investor/funding sync',
    });

    this.register({
      id: 'smart_money_analysis',
      name: 'Smart Money Analysis',
      kind: 'entity',
      priorityTier: 'T2',
      cron: TIER_CRONS.T2,
      enabled: true,
      dependencies: ['entity_resolution'],
      concurrencyGroup: 'default',
      maxConcurrency: 1,
      timeoutMs: 180000,
      handler: 'smartMoney.analyze',
    });

    // ═══════════════════════════════════════════════════════════════
    // TIER 3 - Medium (every 30 min)
    // ═══════════════════════════════════════════════════════════════

    this.register({
      id: 'news_rss_tier_b',
      name: 'News RSS Tier B',
      kind: 'rss',
      priorityTier: 'T3',
      cron: TIER_CRONS.T3,
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'rss_html',
      maxConcurrency: 5,
      timeoutMs: 120000,
      handler: 'news.syncTierB',
    });

    this.register({
      id: 'icodrops_sync',
      name: 'ICODrops Sync',
      kind: 'html',
      priorityTier: 'T3',
      cron: TIER_CRONS.T3,
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'browser',
      maxConcurrency: 1,
      timeoutMs: 180000,
      handler: 'parsers.syncICODrops',
    });

    this.register({
      id: 'derived_edges_build',
      name: 'Build Derived Edges',
      kind: 'graph',
      priorityTier: 'T3',
      cron: TIER_CRONS.T3,
      enabled: true,
      dependencies: ['entity_resolution', 'smart_money_analysis'],
      concurrencyGroup: 'graph_build',
      maxConcurrency: 1,
      timeoutMs: 600000, // 10 min
      handler: 'graphBuilders.buildDerivedEdges',
      description: 'Builds coinvested_with, shares_investor_with, etc.',
    });

    // ═══════════════════════════════════════════════════════════════
    // TIER 4 - Low (every 3 hours)
    // ═══════════════════════════════════════════════════════════════

    this.register({
      id: 'rootdata_full_sync',
      name: 'RootData Full Sync',
      kind: 'rootdata',
      priorityTier: 'T4',
      cron: TIER_CRONS.T4,
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'heavy_sync',
      maxConcurrency: 1,
      timeoutMs: 900000, // 15 min
      handler: 'rootdata.syncAll',
    });

    this.register({
      id: 'news_rss_tier_c',
      name: 'News RSS Tier C',
      kind: 'rss',
      priorityTier: 'T4',
      cron: TIER_CRONS.T4,
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'rss_html',
      maxConcurrency: 3,
      timeoutMs: 120000,
      handler: 'news.syncTierC',
    });

    this.register({
      id: 'news_entity_extraction',
      name: 'News Entity Extraction',
      kind: 'news',
      priorityTier: 'T4',
      cron: TIER_CRONS.T4,
      enabled: true,
      dependencies: ['news_rss_tier_a', 'news_rss_tier_b'],
      concurrencyGroup: 'default',
      maxConcurrency: 1,
      timeoutMs: 300000,
      handler: 'newsIntelligence.extractEntities',
    });

    this.register({
      id: 'news_clustering',
      name: 'News Clustering',
      kind: 'news',
      priorityTier: 'T4',
      cron: TIER_CRONS.T4,
      enabled: true,
      dependencies: ['news_entity_extraction'],
      concurrencyGroup: 'default',
      maxConcurrency: 1,
      timeoutMs: 180000,
      handler: 'newsIntelligence.cluster',
    });

    this.register({
      id: 'graph_full_rebuild',
      name: 'Graph Full Rebuild',
      kind: 'graph',
      priorityTier: 'T4',
      cron: TIER_CRONS.T4,
      enabled: true,
      dependencies: ['derived_edges_build', 'rootdata_full_sync'],
      concurrencyGroup: 'graph_build',
      maxConcurrency: 1,
      timeoutMs: 1200000, // 20 min
      handler: 'graph.fullRebuild',
    });

    // NEW: Graph Pipeline (Block 5) - replaces individual graph jobs
    this.register({
      id: 'graph_pipeline',
      name: 'Graph Pipeline (Full Build)',
      kind: 'graph',
      priorityTier: 'T2',
      cron: TIER_CRONS.T2,
      enabled: true,
      dependencies: ['entity_resolution'],
      concurrencyGroup: 'graph_build',
      maxConcurrency: 1,
      timeoutMs: 600000, // 10 min
      handler: 'graphPipeline.run',
      description: 'Block 5: Full pipeline with nodes -> edges -> enrich -> rank -> projections -> snapshot',
    });

    // NEW: RSS Feeds (Block 2) - Real-time news ingestion
    this.register({
      id: 'rss_feeds_sync',
      name: 'RSS Feeds Sync (All)',
      kind: 'rss',
      priorityTier: 'T1',
      cron: '*/10 * * * *',
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'rss_html',
      maxConcurrency: 5,
      timeoutMs: 180000, // 3 min
      handler: 'rssFeed.fetchAll',
      description: 'Block 2: Fetch all RSS feeds (CoinDesk, TheBlock, etc.)',
    });

    // NEW: News Intelligence (Block 6) - Process raw articles
    this.register({
      id: 'news_intelligence_process',
      name: 'News Intelligence Processing',
      kind: 'news',
      priorityTier: 'T2',
      cron: TIER_CRONS.T2,
      enabled: true,
      dependencies: ['rss_feeds_sync'],
      concurrencyGroup: 'default',
      maxConcurrency: 1,
      timeoutMs: 300000, // 5 min
      handler: 'newsIntelligence.processRecent',
      description: 'Block 6: Extract, normalize, cluster, rank news',
    });

    this.register({
      id: 'graph_snapshot',
      name: 'Create Graph Snapshot',
      kind: 'snapshot',
      priorityTier: 'T4',
      cron: TIER_CRONS.T4,
      enabled: true,
      dependencies: ['graph_full_rebuild'],
      concurrencyGroup: 'graph_build',
      maxConcurrency: 1,
      timeoutMs: 300000,
      handler: 'graph.createSnapshot',
    });

    this.register({
      id: 'source_reliability_recompute',
      name: 'Recompute Source Reliability',
      kind: 'entity',
      priorityTier: 'T4',
      cron: TIER_CRONS.T4,
      enabled: true,
      dependencies: [],
      concurrencyGroup: 'default',
      maxConcurrency: 1,
      timeoutMs: 120000,
      handler: 'reliability.recompute',
    });

    this.logger.log(`[SchedulerRegistry] Initialized ${this.jobs.size} jobs`);
  }

  // ═══════════════════════════════════════════════════════════════
  // REGISTRY METHODS
  // ═══════════════════════════════════════════════════════════════

  register(job: ScheduledJob): void {
    this.jobs.set(job.id, job);
  }

  get(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  getAll(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  getByTier(tier: PriorityTier): ScheduledJob[] {
    return this.getAll().filter(j => j.priorityTier === tier && j.enabled);
  }

  getByKind(kind: JobKind): ScheduledJob[] {
    return this.getAll().filter(j => j.kind === kind && j.enabled);
  }

  getByConcurrencyGroup(group: ConcurrencyGroup): ScheduledJob[] {
    return this.getAll().filter(j => j.concurrencyGroup === group && j.enabled);
  }

  getEnabled(): ScheduledJob[] {
    return this.getAll().filter(j => j.enabled);
  }

  getDependents(jobId: string): ScheduledJob[] {
    return this.getAll().filter(j => j.dependencies.includes(jobId));
  }

  getDependencyChain(jobId: string): string[] {
    const job = this.get(jobId);
    if (!job) return [];

    const chain: string[] = [];
    const visited = new Set<string>();

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const j = this.get(id);
      if (!j) return;

      for (const dep of j.dependencies) {
        traverse(dep);
      }
      chain.push(id);
    };

    traverse(jobId);
    return chain;
  }

  enable(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = true;
      return true;
    }
    return false;
  }

  disable(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = false;
      return true;
    }
    return false;
  }

  getSummary(): Record<string, any> {
    const all = this.getAll();
    return {
      total: all.length,
      enabled: all.filter(j => j.enabled).length,
      byTier: {
        T1: this.getByTier('T1').length,
        T2: this.getByTier('T2').length,
        T3: this.getByTier('T3').length,
        T4: this.getByTier('T4').length,
      },
      byKind: {
        api: this.getByKind('api').length,
        rss: this.getByKind('rss').length,
        html: this.getByKind('html').length,
        graph: this.getByKind('graph').length,
        news: this.getByKind('news').length,
        entity: this.getByKind('entity').length,
        rootdata: this.getByKind('rootdata').length,
        snapshot: this.getByKind('snapshot').length,
      },
    };
  }
}
