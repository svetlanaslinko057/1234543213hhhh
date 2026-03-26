/**
 * Graph Pipeline Service
 * 
 * BLOCK 5: Unified graph build pipeline with snapshots
 * 
 * Pipeline:
 * 1. Build nodes
 * 2. Build base edges
 * 3. Build derived edges
 * 4. Build news edges
 * 5. Rank nodes
 * 6. Create projections
 * 7. Create snapshots
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface GraphSnapshot {
  snapshot_id: string;
  created_at: Date;
  window: string;
  stats: {
    total_nodes: number;
    total_edges: number;
    derived_edges: number;
    nodes_by_type: Record<string, number>;
    edges_by_type: Record<string, number>;
  };
  top_nodes: Array<{
    id: string;
    type: string;
    label: string;
    score: number;
    connections: number;
  }>;
  top_edges: Array<{
    from: string;
    to: string;
    type: string;
    weight: number;
  }>;
  metadata: Record<string, any>;
}

export interface PipelineResult {
  success: boolean;
  snapshot_id?: string;
  stages: Array<{
    name: string;
    status: 'success' | 'failed' | 'skipped';
    duration_ms: number;
    items_processed?: number;
    error?: string;
  }>;
  total_duration_ms: number;
}

@Injectable()
export class GraphPipelineService {
  private readonly logger = new Logger(GraphPipelineService.name);

  constructor(
    @InjectModel('graph_nodes') private nodesModel: Model<any>,
    @InjectModel('graph_edges') private edgesModel: Model<any>,
    @InjectModel('graph_derived_edges') private derivedEdgesModel: Model<any>,
    @InjectModel('graph_snapshots') private snapshotsModel: Model<any>,
    @InjectModel('graph_build_logs') private buildLogsModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_projects') private projectsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // FULL PIPELINE
  // ═══════════════════════════════════════════════════════════════

  async runFullPipeline(): Promise<PipelineResult> {
    const result: PipelineResult = {
      success: true,
      stages: [],
      total_duration_ms: 0,
    };
    const pipelineStart = Date.now();

    this.logger.log('[GraphPipeline] Starting full pipeline...');

    // Stage 1: Build Nodes
    result.stages.push(await this.runStage('build_nodes', () => this.buildNodes()));

    // Stage 2: Build Base Edges
    result.stages.push(await this.runStage('build_base_edges', () => this.buildBaseEdges()));

    // Stage 3: Build Derived Edges (external call)
    result.stages.push(await this.runStage('build_derived_edges', () => this.triggerDerivedEdges()));

    // Stage 4: Rank Nodes
    result.stages.push(await this.runStage('rank_nodes', () => this.rankNodes()));

    // Stage 5: Create Projections
    result.stages.push(await this.runStage('create_projections', () => this.createProjections()));

    // Stage 6: Create Snapshot
    const snapshotStage = await this.runStage('create_snapshot', () => this.createSnapshot());
    result.stages.push(snapshotStage);
    result.snapshot_id = snapshotStage.result?.snapshot_id;

    result.total_duration_ms = Date.now() - pipelineStart;
    result.success = result.stages.every(s => s.status !== 'failed');

    // Log the build
    await this.buildLogsModel.create({
      pipeline_id: uuidv4(),
      started_at: new Date(pipelineStart),
      completed_at: new Date(),
      success: result.success,
      stages: result.stages,
      total_duration_ms: result.total_duration_ms,
      snapshot_id: result.snapshot_id,
    });

    this.logger.log(
      `[GraphPipeline] Complete in ${result.total_duration_ms}ms. ` +
      `Success: ${result.success}. Snapshot: ${result.snapshot_id}`
    );

    return result;
  }

  private async runStage(
    name: string,
    fn: () => Promise<any>,
  ): Promise<{ name: string; status: 'success' | 'failed'; duration_ms: number; items_processed?: number; error?: string; result?: any }> {
    const start = Date.now();
    try {
      this.logger.log(`[GraphPipeline] Stage: ${name}`);
      const result = await fn();
      return {
        name,
        status: 'success',
        duration_ms: Date.now() - start,
        items_processed: result?.count || result?.items || 0,
        result,
      };
    } catch (error: any) {
      this.logger.error(`[GraphPipeline] Stage ${name} failed: ${error.message}`);
      return {
        name,
        status: 'failed',
        duration_ms: Date.now() - start,
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 1: BUILD NODES
  // ═══════════════════════════════════════════════════════════════

  async buildNodes(): Promise<{ count: number }> {
    let count = 0;
    const now = new Date();

    // Build fund nodes from investors
    const investors = await this.investorsModel.find({}).lean();
    for (const inv of investors) {
      const nodeId = `fund:${inv.slug || inv.key}`;
      await this.nodesModel.updateOne(
        { id: nodeId },
        {
          $set: {
            id: nodeId,
            type: 'fund',
            label: inv.name,
            metadata: {
              tier: inv.tier,
              portfolio_value: inv.portfolio_value,
              investments_count: inv.investments_count,
              image: inv.image || inv.logo,
            },
            updated_at: now,
          },
          $setOnInsert: { created_at: now },
        },
        { upsert: true }
      );
      count++;
    }

    // Build project nodes
    const projects = await this.projectsModel.find({}).lean();
    for (const proj of projects) {
      const nodeId = `project:${proj.slug || proj.key}`;
      await this.nodesModel.updateOne(
        { id: nodeId },
        {
          $set: {
            id: nodeId,
            type: 'project',
            label: proj.name,
            metadata: {
              category: proj.category,
              symbol: proj.symbol,
            },
            updated_at: now,
          },
          $setOnInsert: { created_at: now },
        },
        { upsert: true }
      );
      count++;
    }

    return { count };
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 2: BUILD BASE EDGES
  // ═══════════════════════════════════════════════════════════════

  async buildBaseEdges(): Promise<{ count: number }> {
    let count = 0;
    const now = new Date();

    // Build invested_in edges from fundraising
    const rounds = await this.fundraisingModel.find({}).lean();
    
    for (const round of rounds) {
      const projectId = `project:${round.project_key || round.project}`;
      
      for (const inv of (round.investors || [])) {
        const fundId = `fund:${inv.slug || inv.key || this.slugify(inv.name)}`;
        const edgeId = `${fundId}:invested_in:${projectId}:${round.round || 'unknown'}`;
        
        await this.edgesModel.updateOne(
          { id: edgeId },
          {
            $set: {
              id: edgeId,
              from_node_id: fundId,
              to_node_id: projectId,
              relation_type: 'invested_in',
              metadata: {
                round: round.round,
                amount: round.amount || round.raise,
                date: round.date,
                lead: inv.lead,
              },
              updated_at: now,
            },
            $setOnInsert: { created_at: now },
          },
          { upsert: true }
        );
        count++;
      }
    }

    return { count };
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 3: TRIGGER DERIVED EDGES
  // ═══════════════════════════════════════════════════════════════

  async triggerDerivedEdges(): Promise<{ items: number }> {
    // Call the derived edges builder via internal HTTP
    try {
      const axios = (await import('axios')).default;
      const response = await axios.post(
        'http://localhost:3001/api/graph-builders/derived/build-all',
        {},
        { timeout: 600000 }
      );
      
      const results = response.data;
      const total = results.reduce((sum: number, r: any) => sum + (r.created || 0) + (r.updated || 0), 0);
      return { items: total };
    } catch (error: any) {
      this.logger.warn(`[GraphPipeline] Derived edges call failed: ${error.message}`);
      return { items: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 4: RANK NODES
  // ═══════════════════════════════════════════════════════════════

  async rankNodes(): Promise<{ count: number }> {
    // Calculate PageRank-like score based on connections
    const nodes = await this.nodesModel.find({}).lean();
    let count = 0;

    for (const node of nodes) {
      // Count incoming/outgoing edges
      const [incomingCount, outgoingCount, derivedCount] = await Promise.all([
        this.edgesModel.countDocuments({ to_node_id: node.id }),
        this.edgesModel.countDocuments({ from_node_id: node.id }),
        this.derivedEdgesModel.countDocuments({
          $or: [{ from_node_id: node.id }, { to_node_id: node.id }],
        }),
      ]);

      // Simple ranking: weighted sum of connections
      const score = (incomingCount * 2) + outgoingCount + (derivedCount * 0.5);

      await this.nodesModel.updateOne(
        { id: node.id },
        {
          $set: {
            rank_score: Math.round(score * 100) / 100,
            connections: {
              incoming: incomingCount,
              outgoing: outgoingCount,
              derived: derivedCount,
              total: incomingCount + outgoingCount + derivedCount,
            },
          },
        }
      );
      count++;
    }

    return { count };
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 5: CREATE PROJECTIONS
  // ═══════════════════════════════════════════════════════════════

  async createProjections(): Promise<{ count: number }> {
    // Create pre-computed views for different entity types
    const projections = {
      investors: await this.createInvestorProjection(),
      projects: await this.createProjectProjection(),
      top_coinvestors: await this.createTopCoinvestorsProjection(),
    };

    // Store projections
    const db = this.nodesModel.db;
    await db.collection('graph_projections').updateOne(
      { projection_type: 'all' },
      {
        $set: {
          ...projections,
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );

    return { count: Object.keys(projections).length };
  }

  private async createInvestorProjection(): Promise<any[]> {
    return this.nodesModel
      .find({ type: 'fund' })
      .sort({ rank_score: -1 })
      .limit(100)
      .lean();
  }

  private async createProjectProjection(): Promise<any[]> {
    return this.nodesModel
      .find({ type: 'project' })
      .sort({ rank_score: -1 })
      .limit(100)
      .lean();
  }

  private async createTopCoinvestorsProjection(): Promise<any[]> {
    return this.derivedEdgesModel
      .find({ relation_type: 'coinvested_with' })
      .sort({ weight: -1 })
      .limit(100)
      .lean();
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 6: CREATE SNAPSHOT
  // ═══════════════════════════════════════════════════════════════

  async createSnapshot(): Promise<{ snapshot_id: string }> {
    const snapshotId = `snapshot_${Date.now()}`;
    const now = new Date();

    // Gather stats
    const [nodeCount, edgeCount, derivedCount] = await Promise.all([
      this.nodesModel.countDocuments({}),
      this.edgesModel.countDocuments({}),
      this.derivedEdgesModel.countDocuments({}),
    ]);

    // Nodes by type
    const nodesByType = await this.nodesModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    // Edges by type
    const edgesByType = await this.edgesModel.aggregate([
      { $group: { _id: '$relation_type', count: { $sum: 1 } } },
    ]);

    const derivedByType = await this.derivedEdgesModel.aggregate([
      { $group: { _id: '$relation_type', count: { $sum: 1 } } },
    ]);

    // Top nodes
    const topNodes = await this.nodesModel
      .find({})
      .sort({ rank_score: -1 })
      .limit(50)
      .lean();

    // Top edges
    const topEdges = await this.derivedEdgesModel
      .find({})
      .sort({ weight: -1 })
      .limit(50)
      .lean();

    const snapshot: GraphSnapshot = {
      snapshot_id: snapshotId,
      created_at: now,
      window: '24h',
      stats: {
        total_nodes: nodeCount,
        total_edges: edgeCount,
        derived_edges: derivedCount,
        nodes_by_type: Object.fromEntries(nodesByType.map(n => [n._id, n.count])),
        edges_by_type: {
          ...Object.fromEntries(edgesByType.map(e => [e._id, e.count])),
          ...Object.fromEntries(derivedByType.map(e => [`derived:${e._id}`, e.count])),
        },
      },
      top_nodes: topNodes.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        score: n.rank_score || 0,
        connections: n.connections?.total || 0,
      })),
      top_edges: topEdges.map(e => ({
        from: e.from_node_id,
        to: e.to_node_id,
        type: e.relation_type,
        weight: e.weight,
      })),
      metadata: {
        build_time: new Date().toISOString(),
      },
    };

    await this.snapshotsModel.create(snapshot);

    this.logger.log(
      `[GraphPipeline] Snapshot created: ${snapshotId} ` +
      `(${nodeCount} nodes, ${edgeCount} edges, ${derivedCount} derived)`
    );

    return { snapshot_id: snapshotId };
  }

  // ═══════════════════════════════════════════════════════════════
  // QUERY LAYER
  // ═══════════════════════════════════════════════════════════════

  async getLatestSnapshot(): Promise<GraphSnapshot | null> {
    return this.snapshotsModel
      .findOne({})
      .sort({ created_at: -1 })
      .lean() as any;
  }

  async getSnapshotById(snapshotId: string): Promise<GraphSnapshot | null> {
    return this.snapshotsModel.findOne({ snapshot_id: snapshotId }).lean() as any;
  }

  async listSnapshots(limit = 10): Promise<GraphSnapshot[]> {
    return this.snapshotsModel
      .find({})
      .sort({ created_at: -1 })
      .limit(limit)
      .lean() as any;
  }

  async getGraphOverview(): Promise<Record<string, any>> {
    const latest = await this.getLatestSnapshot();
    if (!latest) {
      return { error: 'No snapshot available' };
    }

    return {
      snapshot_id: latest.snapshot_id,
      created_at: latest.created_at,
      stats: latest.stats,
      top_investors: latest.top_nodes.filter(n => n.type === 'fund').slice(0, 10),
      top_projects: latest.top_nodes.filter(n => n.type === 'project').slice(0, 10),
      top_coinvestors: latest.top_edges.filter(e => e.type === 'coinvested_with').slice(0, 10),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private slugify(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
