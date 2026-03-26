/**
 * Base Edge Builder
 * 
 * BLOCK 5: Builds direct edges from funding data
 * 
 * Edge types:
 * - invested_in: Fund -> Project
 * - founded: Person -> Project
 * - works_at: Person -> Fund/Project
 */

import { Injectable, Logger } from '@nestjs/common';
import { GraphBuildContext, GraphEdge, EdgeType } from '../graph-pipeline.types';

@Injectable()
export class BaseEdgeBuilder {
  private readonly logger = new Logger(BaseEdgeBuilder.name);

  /**
   * Build base edges from funding rounds and RootData links
   */
  build(ctx: GraphBuildContext): Map<string, GraphEdge> {
    const edges = new Map<string, GraphEdge>();

    // ─────────────────────────────────────────────────────────────
    // 1. invested_in edges from funding rounds
    // ─────────────────────────────────────────────────────────────
    this.buildInvestedInEdges(ctx, edges);

    // ─────────────────────────────────────────────────────────────
    // 2. Person relationships from RootData links
    // ─────────────────────────────────────────────────────────────
    this.buildPersonEdges(ctx, edges);

    this.logger.log(`[BaseEdgeBuilder] Built ${edges.size} base edges`);
    this.logEdgeStats(edges);

    return edges;
  }

  // ═══════════════════════════════════════════════════════════════
  // INVESTED_IN EDGES
  // ═══════════════════════════════════════════════════════════════

  private buildInvestedInEdges(ctx: GraphBuildContext, edges: Map<string, GraphEdge>): void {
    for (const round of ctx.fundingRounds) {
      const projectSlug = round.project_key || round.project || round.projectSlug;
      if (!projectSlug) continue;

      const projectId = `project:${projectSlug}`;
      const roundDate = round.date ? new Date(round.date) : new Date();
      const roundAmount = round.amount || round.raise || round.amountUsd || 0;

      for (const inv of round.investors || []) {
        const invSlug = inv.slug || inv.key || this.slugify(inv.name || inv.fundName);
        if (!invSlug) continue;

        const fundId = `fund:${invSlug}`;
        const key = this.makeEdgeKey(fundId, projectId, 'invested_in', round.round || round.id);

        if (edges.has(key)) {
          // Update existing edge (same investor, same project, same round)
          const existing = edges.get(key)!;
          existing.evidenceCount++;
          if (roundDate > (existing.lastSeenAt || new Date(0))) {
            existing.lastSeenAt = roundDate;
          }
          continue;
        }

        // Calculate weight based on amount
        const weight = this.calculateInvestmentWeight(roundAmount, inv.lead);

        edges.set(key, {
          id: `${fundId}:invested_in:${projectId}:${round.round || round.id || Date.now()}`,
          key,
          from: fundId,
          to: projectId,
          type: 'invested_in',
          directed: true,
          weight,
          confidence: this.calculateRoundConfidence(round),
          evidenceCount: 1,
          firstSeenAt: roundDate,
          lastSeenAt: roundDate,
          sourceIds: [round.source || 'funding'],
          metadata: {
            roundId: round.id,
            roundType: round.round || round.roundType,
            amountUsd: roundAmount,
            lead: inv.lead || false,
            date: round.date,
          },
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PERSON EDGES (founded, works_at)
  // ═══════════════════════════════════════════════════════════════

  private buildPersonEdges(ctx: GraphBuildContext, edges: Map<string, GraphEdge>): void {
    for (const link of ctx.rootDataLinks) {
      const type = this.mapLinkType(link.type);
      if (!type) continue;

      const fromId = this.resolveNodeId(link.from_type, link.from_id);
      const toId = this.resolveNodeId(link.to_type, link.to_id);
      if (!fromId || !toId) continue;

      const key = this.makeEdgeKey(fromId, toId, type);
      if (edges.has(key)) continue;

      edges.set(key, {
        id: `${fromId}:${type}:${toId}`,
        key,
        from: fromId,
        to: toId,
        type,
        directed: true,
        weight: 1.0,
        confidence: 0.85, // RootData is reliable
        evidenceCount: 1,
        firstSeenAt: link.created_at ? new Date(link.created_at) : new Date(),
        lastSeenAt: link.updated_at ? new Date(link.updated_at) : new Date(),
        sourceIds: ['rootdata'],
        metadata: {
          role: link.role,
          rootdata_link_id: link.id,
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private makeEdgeKey(from: string, to: string, type: string, suffix?: string): string {
    const baseParts = [type, from, to].sort();
    return suffix ? `${baseParts.join(':')}:${suffix}` : baseParts.join(':');
  }

  private calculateInvestmentWeight(amountUsd: number, isLead: boolean): number {
    // Weight based on investment size
    // Lead investors get a 1.5x boost
    let weight = 0.5; // Default

    if (amountUsd > 0) {
      if (amountUsd >= 100_000_000) weight = 1.0;
      else if (amountUsd >= 50_000_000) weight = 0.9;
      else if (amountUsd >= 20_000_000) weight = 0.8;
      else if (amountUsd >= 10_000_000) weight = 0.7;
      else if (amountUsd >= 5_000_000) weight = 0.6;
      else if (amountUsd >= 1_000_000) weight = 0.5;
      else weight = 0.4;
    }

    if (isLead) {
      weight = Math.min(1.0, weight * 1.5);
    }

    return Math.round(weight * 1000) / 1000;
  }

  private calculateRoundConfidence(round: any): number {
    let confidence = 0.7;

    // Higher confidence for known sources
    if (round.source === 'cryptorank' || round.source === 'rootdata') {
      confidence += 0.1;
    }

    // Higher confidence if we have amount
    if (round.amount > 0 || round.raise > 0) {
      confidence += 0.05;
    }

    // Higher confidence if we have date
    if (round.date) {
      confidence += 0.05;
    }

    return Math.min(0.95, Math.round(confidence * 1000) / 1000);
  }

  private mapLinkType(linkType: string): EdgeType | null {
    const typeMap: Record<string, EdgeType> = {
      invested_in: 'invested_in',
      founded: 'founded',
      works_at: 'works_at',
      employed_at: 'works_at',
      advisor: 'works_at',
    };
    return typeMap[linkType?.toLowerCase()] || null;
  }

  private resolveNodeId(entityType: string, entityId: string): string | null {
    if (!entityType || !entityId) return null;

    const typeMap: Record<string, string> = {
      fund: 'fund',
      investor: 'fund',
      project: 'project',
      person: 'person',
      people: 'person',
    };

    const mappedType = typeMap[entityType.toLowerCase()];
    return mappedType ? `${mappedType}:${entityId}` : null;
  }

  private slugify(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private logEdgeStats(edges: Map<string, GraphEdge>): void {
    const byType: Record<string, number> = {};
    for (const edge of edges.values()) {
      byType[edge.type] = (byType[edge.type] || 0) + 1;
    }
    this.logger.debug(`[BaseEdgeBuilder] By type: ${JSON.stringify(byType)}`);
  }
}
