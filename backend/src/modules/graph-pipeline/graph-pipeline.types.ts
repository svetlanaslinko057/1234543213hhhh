/**
 * Graph Pipeline Types
 * 
 * BLOCK 5: Core type definitions for the unified graph build pipeline
 * 
 * Key concepts:
 * - Stage-based execution (state machine)
 * - Shared context (no Mongo queries mid-pipeline)
 * - Enrich/Rank/Project stages for intelligence
 */

// ═══════════════════════════════════════════════════════════════
// BUILD STAGES (STATE MACHINE)
// ═══════════════════════════════════════════════════════════════

export enum GraphBuildStage {
  LOAD_INPUTS = 'LOAD_INPUTS',
  BUILD_NODES = 'BUILD_NODES',
  BUILD_BASE_EDGES = 'BUILD_BASE_EDGES',
  BUILD_DERIVED_EDGES = 'BUILD_DERIVED_EDGES',
  BUILD_NEWS_EDGES = 'BUILD_NEWS_EDGES',
  ENRICH_EDGES = 'ENRICH_EDGES',
  RANK_NODES = 'RANK_NODES',
  BUILD_PROJECTIONS = 'BUILD_PROJECTIONS',
  CREATE_SNAPSHOT = 'CREATE_SNAPSHOT',
}

export type BuildWindow = '7d' | '30d' | '90d' | 'all';

// ═══════════════════════════════════════════════════════════════
// GRAPH NODE
// ═══════════════════════════════════════════════════════════════

export interface GraphNode {
  id: string;
  type: 'fund' | 'project' | 'person' | 'token' | 'exchange' | 'entity';
  label: string;
  slug?: string;
  
  // Scoring
  score?: number;
  confidence?: number;
  rank?: number;
  
  // Connections (filled in RANK stage)
  connections?: {
    incoming: number;
    outgoing: number;
    derived: number;
    total: number;
  };
  
  // Metadata
  tier?: number;
  category?: string;
  metadata?: Record<string, any>;
  
  // Timestamps
  firstSeenAt?: Date;
  lastSeenAt?: Date;
}

// ═══════════════════════════════════════════════════════════════
// GRAPH EDGE
// ═══════════════════════════════════════════════════════════════

export interface GraphEdge {
  id: string;
  key: string; // For deduplication: type:sorted(from,to)
  
  from: string;
  to: string;
  type: EdgeType;
  
  directed: boolean;
  weight: number;
  confidence: number;
  evidenceCount: number;
  
  // Timestamps
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  
  // Cross-source validation
  sourceIds: string[];
  
  // Enrichment factors (filled in ENRICH stage)
  recencyFactor?: number;
  sourceFactor?: number;
  evidenceFactor?: number;
  
  metadata?: Record<string, any>;
}

export type EdgeType = 
  | 'invested_in'
  | 'coinvested_with'
  | 'shares_investor_with'
  | 'shares_founder_with'
  | 'worked_together'
  | 'mentioned_in_news'
  | 'has_token'
  | 'traded_on'
  | 'founded'
  | 'works_at';

// ═══════════════════════════════════════════════════════════════
// GRAPH PROJECTION (PRE-COMPUTED VIEWS)
// ═══════════════════════════════════════════════════════════════

export interface GraphProjection {
  key: 'investor_view' | 'project_view' | 'person_view' | 'full_view';
  nodeIds: string[];
  edgeKeys: string[];
  topNodes: GraphNode[];
  topEdges: GraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
  };
  metadata?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════
// BUILD CONTEXT (CRITICAL - SHARED STATE)
// ═══════════════════════════════════════════════════════════════

export interface GraphBuildContext {
  // Build metadata
  buildId: string;
  window: BuildWindow;
  startedAt: Date;
  
  // Source selection (from SourceReliability)
  sources: {
    fundingSourceId?: string;
    newsSourceId?: string;
    rootDataSourceId?: string;
  };
  
  // ─────────────────────────────────────────────────────────────
  // RAW INPUTS (loaded in LOAD_INPUTS stage)
  // ─────────────────────────────────────────────────────────────
  
  // Canonical entities
  entities: any[];
  
  // Funding data
  fundingRounds: any[];
  coinvestRelations: any[];
  
  // RootData
  rootDataProjects: any[];
  rootDataFunds: any[];
  rootDataPeople: any[];
  rootDataLinks: any[];
  
  // News
  newsArticles: any[];
  newsEvents: any[];
  
  // ─────────────────────────────────────────────────────────────
  // BUILT GRAPH (constructed during pipeline)
  // ─────────────────────────────────────────────────────────────
  
  // Nodes
  nodes: Map<string, GraphNode>;
  
  // Edges by category
  baseEdges: Map<string, GraphEdge>;
  derivedEdges: Map<string, GraphEdge>;
  newsEdges: Map<string, GraphEdge>;
  
  // Combined & enriched
  allEdges: Map<string, GraphEdge>;
  
  // Ranked nodes
  rankedNodes: GraphNode[];
  
  // Projections
  projections: GraphProjection[];
  
  // ─────────────────────────────────────────────────────────────
  // STATS & METRICS
  // ─────────────────────────────────────────────────────────────
  
  stats: GraphBuildStats;
  
  // Logs
  warnings: string[];
  errors: string[];
  stageTimings: Map<GraphBuildStage, number>;
}

export interface GraphBuildStats {
  nodeCount: number;
  nodesByType: Record<string, number>;
  
  baseEdgeCount: number;
  derivedEdgeCount: number;
  newsEdgeCount: number;
  totalEdgeCount: number;
  edgesByType: Record<string, number>;
  
  // Graph metrics
  density: number;
  avgConnections: number;
  
  // Build metrics
  durationMs: number;
  
  // Input counts
  fundingRoundsProcessed: number;
  coinvestRelationsProcessed: number;
  newsArticlesProcessed: number;
}

// ═══════════════════════════════════════════════════════════════
// SNAPSHOT (STORED IN MONGO)
// ═══════════════════════════════════════════════════════════════

export interface GraphSnapshot {
  buildId: string;
  window: BuildWindow;
  createdAt: Date;
  
  // Full graph (can be large!)
  nodes: GraphNode[];
  edges: GraphEdge[];
  
  // Projections for fast UI
  projections: GraphProjection[];
  
  // Top entities for dashboard
  topNodes: GraphNode[];
  topEdges: GraphEdge[];
  
  // Statistics
  stats: GraphBuildStats;
  
  // Metadata
  metadata: {
    fundingSourceId?: string;
    newsSourceId?: string;
    rootDataSourceId?: string;
    warnings: string[];
    version: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// BUILD LOG (STORED IN MONGO)
// ═══════════════════════════════════════════════════════════════

export interface GraphBuildLog {
  buildId: string;
  success: boolean;
  
  startedAt: Date;
  finishedAt: Date;
  
  window: BuildWindow;
  
  stats: GraphBuildStats;
  
  stageResults: Array<{
    stage: GraphBuildStage;
    status: 'success' | 'failed' | 'skipped';
    durationMs: number;
    itemsProcessed?: number;
    error?: string;
  }>;
  
  warnings: string[];
  errors: string[];
  
  triggeredBy: 'scheduler' | 'manual' | 'api';
  snapshotId?: string;
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE RESULT
// ═══════════════════════════════════════════════════════════════

export interface PipelineResult {
  success: boolean;
  buildId: string;
  snapshotId?: string;
  
  stats: GraphBuildStats;
  
  stages: Array<{
    stage: GraphBuildStage;
    status: 'success' | 'failed' | 'skipped';
    durationMs: number;
    itemsProcessed?: number;
    error?: string;
  }>;
  
  totalDurationMs: number;
  warnings: string[];
  errors: string[];
}
