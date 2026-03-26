/**
 * Graph Pipeline Service
 * 
 * BLOCK 5: PRODUCTION-READY Graph Build Pipeline
 * 
 * Architecture:
 * - Stage-based execution (state machine)
 * - Shared context (no Mongo queries mid-pipeline)
 * - Source Reliability integration (getBestSource)
 * - RootData integration
 * - Enrich/Rank/Project stages for intelligence
 * - Snapshots + Build Logs
 * 
 * Pipeline stages:
 * 1. LOAD_INPUTS - Load all data into context
 * 2. BUILD_NODES - Create graph nodes
 * 3. BUILD_BASE_EDGES - Create direct edges (invested_in, works_at)
 * 4. BUILD_DERIVED_EDGES - Create intelligence edges (coinvested_with)
 * 5. BUILD_NEWS_EDGES - Create news mention edges
 * 6. ENRICH_EDGES - Add confidence/recency/source factors
 * 7. RANK_NODES - PageRank-like scoring
 * 8. BUILD_PROJECTIONS - Pre-computed views for UI
 * 9. CREATE_SNAPSHOT - Persist to MongoDB
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';

import {
  GraphBuildContext,
  GraphBuildStage,
  GraphBuildStats,
  GraphSnapshot,
  GraphBuildLog,
  PipelineResult,
  BuildWindow,
  GraphNode,
  GraphEdge,
} from './graph-pipeline.types';

import { GraphSnapshotRepository } from './graph-snapshot.repository';
import { GraphBuildLogRepository } from './graph-build-log.repository';

import { NodeBuilder } from './builders/node.builder';
import { BaseEdgeBuilder } from './builders/base-edge.builder';
import { DerivedEdgeBuilder } from './builders/derived-edge.builder';
import { NewsEdgeBuilder } from './builders/news-edge.builder';
import { EdgeEnrichmentBuilder } from './builders/edge-enrichment.builder';
import { NodeRankingBuilder } from './builders/node-ranking.builder';
import { ProjectionBuilder } from './builders/projection.builder';

import { SourceReliabilityService } from '../source-reliability/source-reliability.service';
import { RootDataService } from '../rootdata/rootdata.service';

const PIPELINE_VERSION = '2.0.0';

@Injectable()
export class GraphPipelineService {
  private readonly logger = new Logger(GraphPipelineService.name);
  private isRunning = false;

  constructor(
    // Repositories
    private readonly snapshotRepo: GraphSnapshotRepository,
    private readonly buildLogRepo: GraphBuildLogRepository,

    // Builders
    private readonly nodeBuilder: NodeBuilder,
    private readonly baseEdgeBuilder: BaseEdgeBuilder,
    private readonly derivedEdgeBuilder: DerivedEdgeBuilder,
    private readonly newsEdgeBuilder: NewsEdgeBuilder,
    private readonly edgeEnrichmentBuilder: EdgeEnrichmentBuilder,
    private readonly nodeRankingBuilder: NodeRankingBuilder,
    private readonly projectionBuilder: ProjectionBuilder,

    // External services
    private readonly sourceReliability: SourceReliabilityService,
    private readonly rootDataService: RootDataService,

    // MongoDB models for data loading
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_projects') private projectsModel: Model<any>,
    @InjectModel('coinvest_relations') private coinvestModel: Model<any>,
    @InjectModel('canonical_entities') private entitiesModel: Model<any>,
    @InjectModel('rootdata_projects') private rootDataProjectsModel: Model<any>,
    @InjectModel('rootdata_funds') private rootDataFundsModel: Model<any>,
    @InjectModel('rootdata_people') private rootDataPeopleModel: Model<any>,
    @InjectModel('rootdata_links') private rootDataLinksModel: Model<any>,
    @InjectModel('news_articles') private newsArticlesModel: Model<any>,
    @InjectModel('news_events') private newsEventsModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // MAIN PIPELINE
  // ═══════════════════════════════════════════════════════════════

  async run(
    window: BuildWindow = '30d',
    triggeredBy: 'scheduler' | 'manual' | 'api' = 'manual',
  ): Promise<PipelineResult> {
    if (this.isRunning) {
      throw new Error('Pipeline is already running');
    }

    this.isRunning = true;
    const ctx = this.createContext(window);

    this.logger.log(`[Pipeline] Starting build ${ctx.buildId} (window=${window})`);

    try {
      // ─────────────────────────────────────────────────────────────
      // Stage 1: LOAD_INPUTS
      // ─────────────────────────────────────────────────────────────
      await this.runStage(GraphBuildStage.LOAD_INPUTS, ctx, async () => {
        await this.loadInputs(ctx);
        return {
          entities: ctx.entities.length,
          fundingRounds: ctx.fundingRounds.length,
          coinvestRelations: ctx.coinvestRelations.length,
          rootDataProjects: ctx.rootDataProjects.length,
          rootDataFunds: ctx.rootDataFunds.length,
          rootDataPeople: ctx.rootDataPeople.length,
          newsArticles: ctx.newsArticles.length,
        };
      });

      // ─────────────────────────────────────────────────────────────
      // Stage 2: BUILD_NODES
      // ─────────────────────────────────────────────────────────────
      await this.runStage(GraphBuildStage.BUILD_NODES, ctx, async () => {
        ctx.nodes = this.nodeBuilder.build(ctx);
        ctx.stats.nodeCount = ctx.nodes.size;
        this.countNodesByType(ctx);
        return { nodeCount: ctx.nodes.size };
      });

      // ─────────────────────────────────────────────────────────────
      // Stage 3: BUILD_BASE_EDGES
      // ─────────────────────────────────────────────────────────────
      await this.runStage(GraphBuildStage.BUILD_BASE_EDGES, ctx, async () => {
        ctx.baseEdges = this.baseEdgeBuilder.build(ctx);
        ctx.stats.baseEdgeCount = ctx.baseEdges.size;
        return { baseEdgeCount: ctx.baseEdges.size };
      });

      // ─────────────────────────────────────────────────────────────
      // Stage 4: BUILD_DERIVED_EDGES
      // ─────────────────────────────────────────────────────────────
      await this.runStage(GraphBuildStage.BUILD_DERIVED_EDGES, ctx, async () => {
        ctx.derivedEdges = this.derivedEdgeBuilder.build(ctx);
        ctx.stats.derivedEdgeCount = ctx.derivedEdges.size;
        return { derivedEdgeCount: ctx.derivedEdges.size };
      });

      // ─────────────────────────────────────────────────────────────
      // Stage 5: BUILD_NEWS_EDGES
      // ─────────────────────────────────────────────────────────────
      await this.runStage(GraphBuildStage.BUILD_NEWS_EDGES, ctx, async () => {
        ctx.newsEdges = this.newsEdgeBuilder.build(ctx);
        ctx.stats.newsEdgeCount = ctx.newsEdges.size;
        return { newsEdgeCount: ctx.newsEdges.size };
      });

      // ─────────────────────────────────────────────────────────────
      // Stage 6: ENRICH_EDGES
      // ─────────────────────────────────────────────────────────────
      await this.runStage(GraphBuildStage.ENRICH_EDGES, ctx, async () => {
        // Combine all edges
        const allEdgesArray = [
          ...ctx.baseEdges.values(),
          ...ctx.derivedEdges.values(),
          ...ctx.newsEdges.values(),
        ];

        // Enrich
        const enrichedEdges = this.edgeEnrichmentBuilder.enrich(ctx, allEdgesArray);

        // Store in Map
        ctx.allEdges = new Map();
        for (const edge of enrichedEdges) {
          ctx.allEdges.set(edge.key, edge);
        }

        ctx.stats.totalEdgeCount = ctx.allEdges.size;
        this.countEdgesByType(ctx);
        return { totalEdgeCount: ctx.allEdges.size };
      });

      // ─────────────────────────────────────────────────────────────
      // Stage 7: RANK_NODES
      // ─────────────────────────────────────────────────────────────
      await this.runStage(GraphBuildStage.RANK_NODES, ctx, async () => {
        ctx.rankedNodes = this.nodeRankingBuilder.rank(ctx, ctx.nodes, ctx.allEdges);
        ctx.stats.avgConnections = this.calculateAvgConnections(ctx.rankedNodes);
        return { rankedNodeCount: ctx.rankedNodes.length };
      });

      // ─────────────────────────────────────────────────────────────
      // Stage 8: BUILD_PROJECTIONS
      // ─────────────────────────────────────────────────────────────
      await this.runStage(GraphBuildStage.BUILD_PROJECTIONS, ctx, async () => {
        ctx.projections = this.projectionBuilder.build(ctx);
        return { projectionCount: ctx.projections.length };
      });

      // ─────────────────────────────────────────────────────────────
      // Stage 9: CREATE_SNAPSHOT
      // ─────────────────────────────────────────────────────────────
      await this.runStage(GraphBuildStage.CREATE_SNAPSHOT, ctx, async () => {
        await this.createSnapshot(ctx);
        return { snapshotId: ctx.buildId };
      });

      // ─────────────────────────────────────────────────────────────
      // Finalize
      // ─────────────────────────────────────────────────────────────
      ctx.stats.durationMs = Date.now() - ctx.startedAt.getTime();
      ctx.stats.density = this.calculateDensity(ctx.stats.nodeCount, ctx.stats.totalEdgeCount);

      // Create build log
      await this.createBuildLog(ctx, true, triggeredBy);

      this.logger.log(
        `[Pipeline] Complete in ${ctx.stats.durationMs}ms. ` +
          `Nodes: ${ctx.stats.nodeCount}, Edges: ${ctx.stats.totalEdgeCount}`
      );

      return this.buildResult(ctx, true);
    } catch (error: any) {
      ctx.errors.push(error.message);
      ctx.stats.durationMs = Date.now() - ctx.startedAt.getTime();

      await this.createBuildLog(ctx, false, triggeredBy);

      this.logger.error(`[Pipeline] Failed: ${error.message}`);
      return this.buildResult(ctx, false);
    } finally {
      this.isRunning = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE EXECUTION
  // ═══════════════════════════════════════════════════════════════

  private async runStage(
    stage: GraphBuildStage,
    ctx: GraphBuildContext,
    task: () => Promise<any>,
  ): Promise<void> {
    const start = Date.now();
    this.logger.log(`[Pipeline] Stage: ${stage}`);

    try {
      const result = await task();
      const duration = Date.now() - start;
      ctx.stageTimings.set(stage, duration);

      this.logger.log(`[Pipeline] Stage ${stage} complete in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - start;
      ctx.stageTimings.set(stage, duration);
      ctx.errors.push(`Stage ${stage} failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LOAD INPUTS (CRITICAL - Uses Source Reliability)
  // ═══════════════════════════════════════════════════════════════

  private async loadInputs(ctx: GraphBuildContext): Promise<void> {
    const windowDays = this.windowToDays(ctx.window);
    const cutoffDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // ─────────────────────────────────────────────────────────────
    // 1. Select best sources using Source Reliability
    // ─────────────────────────────────────────────────────────────
    try {
      ctx.sources.fundingSourceId = await this.sourceReliability.getBestSource('funding');
      ctx.sources.newsSourceId = await this.sourceReliability.getBestSource('news');
      ctx.sources.rootDataSourceId = await this.sourceReliability.getBestSource('funding');
      
      this.logger.log(`[Pipeline] Selected sources: funding=${ctx.sources.fundingSourceId}, news=${ctx.sources.newsSourceId}`);
    } catch (e: any) {
      ctx.warnings.push(`Source selection fallback: ${e.message}`);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Load canonical entities
    // ─────────────────────────────────────────────────────────────
    try {
      ctx.entities = await this.entitiesModel.find({}).lean();
    } catch {
      ctx.entities = [];
      ctx.warnings.push('Failed to load canonical entities');
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Load funding rounds (filtered by window)
    // ─────────────────────────────────────────────────────────────
    const fundingFilter: any = {};
    if (ctx.window !== 'all') {
      fundingFilter.$or = [
        { date: { $gte: cutoffDate.toISOString() } },
        { date: { $gte: cutoffDate } },
        { createdAt: { $gte: cutoffDate } },
      ];
    }
    ctx.fundingRounds = await this.fundraisingModel.find(fundingFilter).lean();
    ctx.stats.fundingRoundsProcessed = ctx.fundingRounds.length;

    // ─────────────────────────────────────────────────────────────
    // 4. Load coinvest_relations (THE GOLD - 138k+ records)
    // ─────────────────────────────────────────────────────────────
    ctx.coinvestRelations = await this.coinvestModel.find({}).lean();
    ctx.stats.coinvestRelationsProcessed = ctx.coinvestRelations.length;

    // ─────────────────────────────────────────────────────────────
    // 5. Load RootData
    // ─────────────────────────────────────────────────────────────
    const [rootDataExport] = await Promise.all([
      this.loadRootData(),
    ]);

    ctx.rootDataProjects = rootDataExport.projects;
    ctx.rootDataFunds = rootDataExport.funds;
    ctx.rootDataPeople = rootDataExport.people;
    ctx.rootDataLinks = rootDataExport.links;

    // ─────────────────────────────────────────────────────────────
    // 6. Load news data
    // ─────────────────────────────────────────────────────────────
    const newsFilter: any = {};
    if (ctx.window !== 'all') {
      newsFilter.$or = [
        { published_at: { $gte: cutoffDate.toISOString() } },
        { publishedAt: { $gte: cutoffDate } },
      ];
    }

    try {
      ctx.newsArticles = await this.newsArticlesModel
        .find(newsFilter)
        .sort({ published_at: -1 })
        .limit(10000)
        .lean();
    } catch {
      ctx.newsArticles = [];
    }

    try {
      ctx.newsEvents = await this.newsEventsModel.find({}).lean();
    } catch {
      ctx.newsEvents = [];
    }
    ctx.stats.newsArticlesProcessed = ctx.newsArticles.length;

    this.logger.log(
      `[Pipeline] Loaded inputs: ` +
        `entities=${ctx.entities.length}, ` +
        `funding=${ctx.fundingRounds.length}, ` +
        `coinvest=${ctx.coinvestRelations.length}, ` +
        `rootdata_projects=${ctx.rootDataProjects.length}, ` +
        `rootdata_funds=${ctx.rootDataFunds.length}, ` +
        `news=${ctx.newsArticles.length}`
    );
  }

  private async loadRootData(): Promise<{
    funds: any[];
    projects: any[];
    people: any[];
    links: any[];
  }> {
    try {
      const [funds, projects, people, links] = await Promise.all([
        this.rootDataFundsModel.find({}).lean(),
        this.rootDataProjectsModel.find({}).lean(),
        this.rootDataPeopleModel.find({}).lean(),
        this.rootDataLinksModel.find({}).lean(),
      ]);
      return { funds, projects, people, links };
    } catch (e: any) {
      this.logger.warn(`[Pipeline] RootData load failed: ${e.message}`);
      return { funds: [], projects: [], people: [], links: [] };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CREATE SNAPSHOT
  // ═══════════════════════════════════════════════════════════════

  private async createSnapshot(ctx: GraphBuildContext): Promise<void> {
    const topNodes = ctx.rankedNodes.slice(0, 100);
    const topEdges = [...ctx.allEdges.values()]
      .sort((a, b) => b.weight * b.confidence - a.weight * a.confidence)
      .slice(0, 200);

    const snapshot: GraphSnapshot = {
      buildId: ctx.buildId,
      window: ctx.window,
      createdAt: new Date(),

      nodes: ctx.rankedNodes,
      edges: [...ctx.allEdges.values()],
      projections: ctx.projections,

      topNodes,
      topEdges,

      stats: ctx.stats,

      metadata: {
        fundingSourceId: ctx.sources.fundingSourceId,
        newsSourceId: ctx.sources.newsSourceId,
        rootDataSourceId: ctx.sources.rootDataSourceId,
        warnings: ctx.warnings,
        version: PIPELINE_VERSION,
      },
    };

    await this.snapshotRepo.create(snapshot);
  }

  // ═══════════════════════════════════════════════════════════════
  // CREATE BUILD LOG
  // ═══════════════════════════════════════════════════════════════

  private async createBuildLog(
    ctx: GraphBuildContext,
    success: boolean,
    triggeredBy: 'scheduler' | 'manual' | 'api',
  ): Promise<void> {
    const stageResults: GraphBuildLog['stageResults'] = [];

    for (const stage of Object.values(GraphBuildStage)) {
      const duration = ctx.stageTimings.get(stage);
      if (duration !== undefined) {
        const failed = ctx.errors.some(e => e.includes(stage));
        stageResults.push({
          stage,
          status: failed ? 'failed' : 'success',
          durationMs: duration,
        });
      }
    }

    const log: GraphBuildLog = {
      buildId: ctx.buildId,
      success,
      startedAt: ctx.startedAt,
      finishedAt: new Date(),
      window: ctx.window,
      stats: ctx.stats,
      stageResults,
      warnings: ctx.warnings,
      errors: ctx.errors,
      triggeredBy,
      snapshotId: success ? ctx.buildId : undefined,
    };

    await this.buildLogRepo.create(log);
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTEXT & HELPERS
  // ═══════════════════════════════════════════════════════════════

  private createContext(window: BuildWindow): GraphBuildContext {
    return {
      buildId: randomUUID(),
      window,
      startedAt: new Date(),

      sources: {},

      entities: [],
      fundingRounds: [],
      coinvestRelations: [],
      rootDataProjects: [],
      rootDataFunds: [],
      rootDataPeople: [],
      rootDataLinks: [],
      newsArticles: [],
      newsEvents: [],

      nodes: new Map(),
      baseEdges: new Map(),
      derivedEdges: new Map(),
      newsEdges: new Map(),
      allEdges: new Map(),

      rankedNodes: [],
      projections: [],

      stats: {
        nodeCount: 0,
        nodesByType: {},
        baseEdgeCount: 0,
        derivedEdgeCount: 0,
        newsEdgeCount: 0,
        totalEdgeCount: 0,
        edgesByType: {},
        density: 0,
        avgConnections: 0,
        durationMs: 0,
        fundingRoundsProcessed: 0,
        coinvestRelationsProcessed: 0,
        newsArticlesProcessed: 0,
      },

      warnings: [],
      errors: [],
      stageTimings: new Map(),
    };
  }

  private windowToDays(window: BuildWindow): number {
    switch (window) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case 'all': return 365 * 10; // 10 years
      default: return 30;
    }
  }

  private countNodesByType(ctx: GraphBuildContext): void {
    const byType: Record<string, number> = {};
    for (const node of ctx.nodes.values()) {
      byType[node.type] = (byType[node.type] || 0) + 1;
    }
    ctx.stats.nodesByType = byType;
  }

  private countEdgesByType(ctx: GraphBuildContext): void {
    const byType: Record<string, number> = {};
    for (const edge of ctx.allEdges.values()) {
      byType[edge.type] = (byType[edge.type] || 0) + 1;
    }
    ctx.stats.edgesByType = byType;
  }

  private calculateDensity(nodeCount: number, edgeCount: number): number {
    if (nodeCount < 2) return 0;
    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    return Math.round((edgeCount / maxEdges) * 10000) / 10000;
  }

  private calculateAvgConnections(nodes: GraphNode[]): number {
    if (nodes.length === 0) return 0;
    const total = nodes.reduce((sum, n) => sum + (n.connections?.total || 0), 0);
    return Math.round((total / nodes.length) * 100) / 100;
  }

  private buildResult(ctx: GraphBuildContext, success: boolean): PipelineResult {
    const stages: PipelineResult['stages'] = [];

    for (const stage of Object.values(GraphBuildStage)) {
      const duration = ctx.stageTimings.get(stage);
      if (duration !== undefined) {
        const failed = ctx.errors.some(e => e.includes(stage));
        stages.push({
          stage,
          status: failed ? 'failed' : 'success',
          durationMs: duration,
        });
      }
    }

    return {
      success,
      buildId: ctx.buildId,
      snapshotId: success ? ctx.buildId : undefined,
      stats: ctx.stats,
      stages,
      totalDurationMs: ctx.stats.durationMs,
      warnings: ctx.warnings,
      errors: ctx.errors,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC QUERY API
  // ═══════════════════════════════════════════════════════════════

  isRunningPipeline(): boolean {
    return this.isRunning;
  }

  async getLatestSnapshot(): Promise<GraphSnapshot | null> {
    return this.snapshotRepo.latest();
  }

  async getSnapshotById(buildId: string): Promise<GraphSnapshot | null> {
    return this.snapshotRepo.getById(buildId);
  }

  async listSnapshots(limit = 10): Promise<GraphSnapshot[]> {
    return this.snapshotRepo.list({ limit });
  }

  async getBuildLog(buildId: string): Promise<GraphBuildLog | null> {
    return this.buildLogRepo.getById(buildId);
  }

  async listBuildLogs(limit = 20): Promise<GraphBuildLog[]> {
    return this.buildLogRepo.list({ limit });
  }

  async getBuildStats(hours = 24): Promise<any> {
    return this.buildLogRepo.getStats(hours);
  }

  async getGraphOverview(): Promise<Record<string, any>> {
    const latest = await this.snapshotRepo.latest();
    if (!latest) {
      return { error: 'No snapshot available. Run the pipeline first.' };
    }

    return {
      buildId: latest.buildId,
      createdAt: latest.createdAt,
      window: latest.window,
      stats: latest.stats,
      topInvestors: latest.topNodes.filter(n => n.type === 'fund').slice(0, 10),
      topProjects: latest.topNodes.filter(n => n.type === 'project').slice(0, 10),
      topCoinvestors: latest.topEdges
        .filter(e => e.type === 'coinvested_with')
        .slice(0, 10),
      projectionsAvailable: latest.projections.map(p => p.key),
    };
  }
}
