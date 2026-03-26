/**
 * Projection Builder
 * 
 * BLOCK 5: Pre-computed graph views for fast UI rendering
 * 
 * Projections:
 * - investor_view: Fund-centric graph
 * - project_view: Project-centric graph
 * - person_view: People network
 * - full_view: Everything
 */

import { Injectable, Logger } from '@nestjs/common';
import { GraphBuildContext, GraphProjection, GraphNode, GraphEdge } from '../graph-pipeline.types';

@Injectable()
export class ProjectionBuilder {
  private readonly logger = new Logger(ProjectionBuilder.name);

  /**
   * Build all projections from ranked nodes and enriched edges
   */
  build(ctx: GraphBuildContext): GraphProjection[] {
    const projections: GraphProjection[] = [];

    // ─────────────────────────────────────────────────────────────
    // 1. Investor View (Funds + coinvested_with + invested_in)
    // ─────────────────────────────────────────────────────────────
    projections.push(this.buildInvestorView(ctx));

    // ─────────────────────────────────────────────────────────────
    // 2. Project View (Projects + invested_in + shares_investor_with)
    // ─────────────────────────────────────────────────────────────
    projections.push(this.buildProjectView(ctx));

    // ─────────────────────────────────────────────────────────────
    // 3. Person View (People + worked_together + shares_founder_with)
    // ─────────────────────────────────────────────────────────────
    projections.push(this.buildPersonView(ctx));

    // ─────────────────────────────────────────────────────────────
    // 4. Full View (Top 200 nodes + all edge types)
    // ─────────────────────────────────────────────────────────────
    projections.push(this.buildFullView(ctx));

    this.logger.log(`[ProjectionBuilder] Built ${projections.length} projections`);
    return projections;
  }

  // ═══════════════════════════════════════════════════════════════
  // INVESTOR VIEW
  // ═══════════════════════════════════════════════════════════════

  private buildInvestorView(ctx: GraphBuildContext): GraphProjection {
    const fundNodes = ctx.rankedNodes.filter(n => n.type === 'fund');
    const topFunds = fundNodes.slice(0, 100);
    const topFundIds = new Set(topFunds.map(n => n.id));

    // Get relevant edges
    const relevantEdgeTypes = ['coinvested_with', 'invested_in', 'shares_investor_with'];
    const relevantEdges: GraphEdge[] = [];
    const edgeKeys: string[] = [];

    for (const edge of ctx.allEdges.values()) {
      if (!relevantEdgeTypes.includes(edge.type)) continue;

      // At least one endpoint must be a top fund
      if (topFundIds.has(edge.from) || topFundIds.has(edge.to)) {
        relevantEdges.push(edge);
        edgeKeys.push(edge.key);
      }
    }

    // Sort edges by weight * confidence
    relevantEdges.sort((a, b) => (b.weight * b.confidence) - (a.weight * a.confidence));
    const topEdges = relevantEdges.slice(0, 200);

    return {
      key: 'investor_view',
      nodeIds: topFunds.map(n => n.id),
      edgeKeys: edgeKeys.slice(0, 500),
      topNodes: topFunds.slice(0, 50),
      topEdges: topEdges.slice(0, 100),
      stats: {
        nodeCount: topFunds.length,
        edgeCount: relevantEdges.length,
      },
      metadata: {
        description: 'Fund-centric view with coinvestment relationships',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PROJECT VIEW
  // ═══════════════════════════════════════════════════════════════

  private buildProjectView(ctx: GraphBuildContext): GraphProjection {
    const projectNodes = ctx.rankedNodes.filter(n => n.type === 'project');
    const topProjects = projectNodes.slice(0, 100);
    const topProjectIds = new Set(topProjects.map(n => n.id));

    const relevantEdgeTypes = ['invested_in', 'shares_investor_with', 'mentioned_in_news'];
    const relevantEdges: GraphEdge[] = [];
    const edgeKeys: string[] = [];

    for (const edge of ctx.allEdges.values()) {
      if (!relevantEdgeTypes.includes(edge.type)) continue;

      if (topProjectIds.has(edge.from) || topProjectIds.has(edge.to)) {
        relevantEdges.push(edge);
        edgeKeys.push(edge.key);
      }
    }

    relevantEdges.sort((a, b) => (b.weight * b.confidence) - (a.weight * a.confidence));
    const topEdges = relevantEdges.slice(0, 200);

    return {
      key: 'project_view',
      nodeIds: topProjects.map(n => n.id),
      edgeKeys: edgeKeys.slice(0, 500),
      topNodes: topProjects.slice(0, 50),
      topEdges: topEdges.slice(0, 100),
      stats: {
        nodeCount: topProjects.length,
        edgeCount: relevantEdges.length,
      },
      metadata: {
        description: 'Project-centric view with investor relationships',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PERSON VIEW
  // ═══════════════════════════════════════════════════════════════

  private buildPersonView(ctx: GraphBuildContext): GraphProjection {
    const personNodes = ctx.rankedNodes.filter(n => n.type === 'person');
    const topPeople = personNodes.slice(0, 100);
    const topPeopleIds = new Set(topPeople.map(n => n.id));

    const relevantEdgeTypes = ['worked_together', 'shares_founder_with', 'works_at', 'founded'];
    const relevantEdges: GraphEdge[] = [];
    const edgeKeys: string[] = [];

    for (const edge of ctx.allEdges.values()) {
      if (!relevantEdgeTypes.includes(edge.type)) continue;

      if (topPeopleIds.has(edge.from) || topPeopleIds.has(edge.to)) {
        relevantEdges.push(edge);
        edgeKeys.push(edge.key);
      }
    }

    relevantEdges.sort((a, b) => (b.weight * b.confidence) - (a.weight * a.confidence));
    const topEdges = relevantEdges.slice(0, 200);

    return {
      key: 'person_view',
      nodeIds: topPeople.map(n => n.id),
      edgeKeys: edgeKeys.slice(0, 500),
      topNodes: topPeople.slice(0, 50),
      topEdges: topEdges.slice(0, 100),
      stats: {
        nodeCount: topPeople.length,
        edgeCount: relevantEdges.length,
      },
      metadata: {
        description: 'People network with collaboration relationships',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FULL VIEW
  // ═══════════════════════════════════════════════════════════════

  private buildFullView(ctx: GraphBuildContext): GraphProjection {
    const topNodes = ctx.rankedNodes.slice(0, 200);
    const topNodeIds = new Set(topNodes.map(n => n.id));

    const relevantEdges: GraphEdge[] = [];
    const edgeKeys: string[] = [];

    for (const edge of ctx.allEdges.values()) {
      if (topNodeIds.has(edge.from) || topNodeIds.has(edge.to)) {
        relevantEdges.push(edge);
        edgeKeys.push(edge.key);
      }
    }

    relevantEdges.sort((a, b) => (b.weight * b.confidence) - (a.weight * a.confidence));
    const topEdges = relevantEdges.slice(0, 500);

    return {
      key: 'full_view',
      nodeIds: topNodes.map(n => n.id),
      edgeKeys: edgeKeys.slice(0, 1000),
      topNodes: topNodes.slice(0, 100),
      topEdges: topEdges.slice(0, 200),
      stats: {
        nodeCount: topNodes.length,
        edgeCount: relevantEdges.length,
      },
      metadata: {
        description: 'Full graph view with top entities across all types',
      },
    };
  }
}
