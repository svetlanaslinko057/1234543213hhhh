/**
 * Edge Enrichment Builder
 * 
 * BLOCK 5: CRITICAL - Adds intelligence to edges
 * 
 * Enrichment factors:
 * - recencyFactor: More recent = higher score
 * - sourceFactor: More sources = higher confidence
 * - evidenceFactor: More evidence = higher confidence
 * - Cross-source validation
 */

import { Injectable, Logger } from '@nestjs/common';
import { GraphBuildContext, GraphEdge } from '../graph-pipeline.types';

@Injectable()
export class EdgeEnrichmentBuilder {
  private readonly logger = new Logger(EdgeEnrichmentBuilder.name);

  /**
   * Enrich all edges with intelligence factors
   */
  enrich(ctx: GraphBuildContext, edges: GraphEdge[]): GraphEdge[] {
    const enriched: GraphEdge[] = [];

    for (const edge of edges) {
      enriched.push(this.enrichEdge(edge, ctx));
    }

    this.logger.log(`[EdgeEnrichmentBuilder] Enriched ${enriched.length} edges`);
    return enriched;
  }

  /**
   * Enrich a single edge
   */
  private enrichEdge(edge: GraphEdge, ctx: GraphBuildContext): GraphEdge {
    // ─────────────────────────────────────────────────────────────
    // 1. Recency Factor (0.0 to 1.0)
    // ─────────────────────────────────────────────────────────────
    const recencyFactor = this.computeRecencyFactor(edge.lastSeenAt);

    // ─────────────────────────────────────────────────────────────
    // 2. Source Factor (cross-source validation)
    // ─────────────────────────────────────────────────────────────
    const sourceFactor = this.computeSourceFactor(edge.sourceIds);

    // ─────────────────────────────────────────────────────────────
    // 3. Evidence Factor
    // ─────────────────────────────────────────────────────────────
    const evidenceFactor = this.computeEvidenceFactor(edge.evidenceCount);

    // ─────────────────────────────────────────────────────────────
    // 4. Node Existence Factor (do both nodes exist?)
    // ─────────────────────────────────────────────────────────────
    const nodeExistenceFactor = this.computeNodeExistenceFactor(edge, ctx);

    // ─────────────────────────────────────────────────────────────
    // 5. Final Confidence Calculation
    // ─────────────────────────────────────────────────────────────
    // Weighted combination of all factors
    const baseConfidence = edge.confidence || 0.5;
    const enrichedConfidence = Math.min(
      0.99,
      baseConfidence * 0.4 +
        recencyFactor * 0.2 +
        sourceFactor * 0.15 +
        evidenceFactor * 0.15 +
        nodeExistenceFactor * 0.1
    );

    // ─────────────────────────────────────────────────────────────
    // 6. Weight Adjustment
    // ─────────────────────────────────────────────────────────────
    // Boost weight based on enrichment
    const enrichmentMultiplier = 1 + (recencyFactor - 0.5) * 0.2;
    const enrichedWeight = Math.round(edge.weight * enrichmentMultiplier * 1000) / 1000;

    return {
      ...edge,
      confidence: Math.round(enrichedConfidence * 1000) / 1000,
      weight: enrichedWeight,
      recencyFactor: Math.round(recencyFactor * 1000) / 1000,
      sourceFactor: Math.round(sourceFactor * 1000) / 1000,
      evidenceFactor: Math.round(evidenceFactor * 1000) / 1000,
      metadata: {
        ...edge.metadata,
        enriched: true,
        enrichedAt: new Date().toISOString(),
        nodeExistenceFactor: Math.round(nodeExistenceFactor * 1000) / 1000,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FACTOR CALCULATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Recency factor: More recent edges are more relevant
   * 0 days = 1.0, 365 days = 0.5, 730+ days = 0.3
   */
  private computeRecencyFactor(date?: Date): number {
    if (!date) return 0.5;

    const now = Date.now();
    const edgeTime = new Date(date).getTime();
    const daysOld = (now - edgeTime) / (1000 * 60 * 60 * 24);

    if (daysOld <= 7) return 1.0;
    if (daysOld <= 30) return 0.95;
    if (daysOld <= 90) return 0.85;
    if (daysOld <= 180) return 0.75;
    if (daysOld <= 365) return 0.6;
    if (daysOld <= 730) return 0.45;
    return 0.3;
  }

  /**
   * Source factor: Multiple sources = higher confidence
   * 1 source = 0.7, 2 = 0.85, 3+ = 0.95
   */
  private computeSourceFactor(sourceIds: string[]): number {
    const uniqueSources = new Set(sourceIds || []).size;

    if (uniqueSources === 0) return 0.5;
    if (uniqueSources === 1) return 0.7;
    if (uniqueSources === 2) return 0.85;
    return Math.min(1.0, 0.85 + (uniqueSources - 2) * 0.05);
  }

  /**
   * Evidence factor: More evidence = higher confidence
   */
  private computeEvidenceFactor(evidenceCount: number): number {
    if (!evidenceCount || evidenceCount <= 0) return 0.5;
    if (evidenceCount === 1) return 0.6;
    if (evidenceCount === 2) return 0.7;
    if (evidenceCount <= 5) return 0.8;
    if (evidenceCount <= 10) return 0.85;
    if (evidenceCount <= 25) return 0.9;
    return Math.min(1.0, 0.9 + (evidenceCount - 25) * 0.001);
  }

  /**
   * Node existence factor: Do both nodes exist in the graph?
   */
  private computeNodeExistenceFactor(edge: GraphEdge, ctx: GraphBuildContext): number {
    const fromExists = ctx.nodes.has(edge.from);
    const toExists = ctx.nodes.has(edge.to);

    if (fromExists && toExists) return 1.0;
    if (fromExists || toExists) return 0.7;
    return 0.4; // Dangling edge
  }
}
