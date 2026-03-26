/**
 * Node Ranking Builder
 * 
 * BLOCK 5: PageRank-like scoring for nodes
 * 
 * Ranking considers:
 * - Incoming edge count
 * - Outgoing edge count
 * - Edge weights
 * - Edge confidence
 * - Node tier
 */

import { Injectable, Logger } from '@nestjs/common';
import { GraphBuildContext, GraphNode, GraphEdge } from '../graph-pipeline.types';

@Injectable()
export class NodeRankingBuilder {
  private readonly logger = new Logger(NodeRankingBuilder.name);

  /**
   * Rank all nodes based on their connections
   */
  rank(
    ctx: GraphBuildContext,
    nodes: Map<string, GraphNode>,
    edges: Map<string, GraphEdge>,
  ): GraphNode[] {
    const scoreMap = new Map<string, number>();
    const connectionsMap = new Map<string, { incoming: number; outgoing: number; derived: number }>();

    // Initialize
    for (const nodeId of nodes.keys()) {
      scoreMap.set(nodeId, 0);
      connectionsMap.set(nodeId, { incoming: 0, outgoing: 0, derived: 0 });
    }

    // ─────────────────────────────────────────────────────────────
    // Calculate scores based on edges
    // ─────────────────────────────────────────────────────────────
    for (const edge of edges.values()) {
      const edgeScore = edge.weight * edge.confidence;

      // From node (outgoing)
      if (nodes.has(edge.from)) {
        const current = scoreMap.get(edge.from) || 0;
        scoreMap.set(edge.from, current + edgeScore * 0.8);

        const conns = connectionsMap.get(edge.from)!;
        conns.outgoing++;
        if (!edge.directed) {
          conns.derived++;
        }
      }

      // To node (incoming - more valuable)
      if (nodes.has(edge.to)) {
        const current = scoreMap.get(edge.to) || 0;
        scoreMap.set(edge.to, current + edgeScore * 1.2);

        const conns = connectionsMap.get(edge.to)!;
        conns.incoming++;
        if (!edge.directed) {
          conns.derived++;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Apply tier boost
    // ─────────────────────────────────────────────────────────────
    for (const [nodeId, node] of nodes.entries()) {
      if (node.tier) {
        const tierBoost = this.getTierBoost(node.tier);
        const current = scoreMap.get(nodeId) || 0;
        scoreMap.set(nodeId, current * tierBoost);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Build ranked list
    // ─────────────────────────────────────────────────────────────
    const rankedNodes: GraphNode[] = [];

    for (const [nodeId, node] of nodes.entries()) {
      const score = scoreMap.get(nodeId) || 0;
      const conns = connectionsMap.get(nodeId) || { incoming: 0, outgoing: 0, derived: 0 };

      rankedNodes.push({
        ...node,
        score: Math.round(score * 100) / 100,
        connections: {
          incoming: conns.incoming,
          outgoing: conns.outgoing,
          derived: conns.derived,
          total: conns.incoming + conns.outgoing,
        },
      });
    }

    // Sort by score descending
    rankedNodes.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Assign rank
    for (let i = 0; i < rankedNodes.length; i++) {
      rankedNodes[i].rank = i + 1;
    }

    this.logger.log(
      `[NodeRankingBuilder] Ranked ${rankedNodes.length} nodes. ` +
        `Top: ${rankedNodes[0]?.label} (${rankedNodes[0]?.score})`
    );

    return rankedNodes;
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Tier boost multiplier
   * Tier 1 = 1.5x, Tier 2 = 1.2x, Tier 3 = 1.0x
   */
  private getTierBoost(tier: number): number {
    if (tier === 1) return 1.5;
    if (tier === 2) return 1.2;
    if (tier === 3) return 1.0;
    return 0.9; // Unknown tier gets slight penalty
  }
}
