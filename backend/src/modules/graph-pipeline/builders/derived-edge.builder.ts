/**
 * Derived Edge Builder
 * 
 * BLOCK 5: Builds intelligence edges from relationships
 * 
 * Edge types:
 * - coinvested_with: Fund <-> Fund (from coinvest_relations + funding)
 * - shares_investor_with: Project <-> Project (common investors)
 * - shares_founder_with: Project <-> Project (common founders)
 * - worked_together: Person <-> Person (same organization)
 */

import { Injectable, Logger } from '@nestjs/common';
import { GraphBuildContext, GraphEdge } from '../graph-pipeline.types';

@Injectable()
export class DerivedEdgeBuilder {
  private readonly logger = new Logger(DerivedEdgeBuilder.name);

  /**
   * Build derived edges from pre-computed relations + funding data
   */
  build(ctx: GraphBuildContext): Map<string, GraphEdge> {
    const edges = new Map<string, GraphEdge>();

    // ─────────────────────────────────────────────────────────────
    // 1. coinvested_with from coinvest_relations (138k+ records!)
    // ─────────────────────────────────────────────────────────────
    this.buildCoinvestedEdges(ctx, edges);

    // ─────────────────────────────────────────────────────────────
    // 2. shares_investor_with from funding rounds
    // ─────────────────────────────────────────────────────────────
    this.buildSharesInvestorEdges(ctx, edges);

    // ─────────────────────────────────────────────────────────────
    // 3. shares_founder_with from RootData links
    // ─────────────────────────────────────────────────────────────
    this.buildSharesFounderEdges(ctx, edges);

    // ─────────────────────────────────────────────────────────────
    // 4. worked_together from RootData links
    // ─────────────────────────────────────────────────────────────
    this.buildWorkedTogetherEdges(ctx, edges);

    this.logger.log(`[DerivedEdgeBuilder] Built ${edges.size} derived edges`);
    this.logEdgeStats(edges);

    return edges;
  }

  // ═══════════════════════════════════════════════════════════════
  // COINVESTED_WITH (Fund <-> Fund)
  // Uses pre-computed coinvest_relations for speed
  // ═══════════════════════════════════════════════════════════════

  private buildCoinvestedEdges(ctx: GraphBuildContext, edges: Map<string, GraphEdge>): void {
    for (const rel of ctx.coinvestRelations) {
      const fundA = `fund:${rel.investor_a}`;
      const fundB = `fund:${rel.investor_b}`;
      const key = this.makeEdgeKey(fundA, fundB, 'coinvested_with');

      // Calculate confidence
      const recencyFactor = this.calculateRecencyFactor(rel.last_together);
      const countFactor = Math.min(1.0, (rel.count || 1) / 50);
      const qualityFactor = ((rel.quality_score || 50) / 100);
      const confidence = Math.min(
        0.99,
        0.3 + countFactor * 0.3 + recencyFactor * 0.2 + qualityFactor * 0.2
      );

      edges.set(key, {
        id: key,
        key,
        from: fundA,
        to: fundB,
        type: 'coinvested_with',
        directed: false,
        weight: rel.count || 1,
        confidence: Math.round(confidence * 1000) / 1000,
        evidenceCount: rel.count || 1,
        firstSeenAt: rel.first_together ? new Date(rel.first_together * 1000) : new Date(),
        lastSeenAt: rel.last_together ? new Date(rel.last_together * 1000) : new Date(),
        sourceIds: ['coinvest_relations'],
        metadata: {
          sharedProjects: (rel.projects || []).slice(0, 50),
          totalProjects: (rel.projects || []).length,
          totalVolumeUsd: rel.volume || 0,
          qualityScore: rel.quality_score,
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SHARES_INVESTOR_WITH (Project <-> Project)
  // Projects that share common investors
  // ═══════════════════════════════════════════════════════════════

  private buildSharesInvestorEdges(ctx: GraphBuildContext, edges: Map<string, GraphEdge>): void {
    // Build investor -> projects map
    const investorToProjects = new Map<string, Set<string>>();

    for (const round of ctx.fundingRounds) {
      const projectSlug = round.project_key || round.project;
      if (!projectSlug) continue;

      for (const inv of round.investors || []) {
        const invSlug = inv.slug || inv.key || this.slugify(inv.name || inv.fundName);
        if (!invSlug) continue;

        if (!investorToProjects.has(invSlug)) {
          investorToProjects.set(invSlug, new Set());
        }
        investorToProjects.get(invSlug)!.add(projectSlug);
      }
    }

    // Create pairwise edges for projects with shared investors
    for (const [investorSlug, projects] of investorToProjects.entries()) {
      if (projects.size < 2) continue;

      const projectList = Array.from(projects).slice(0, 100); // Limit to avoid explosion

      for (let i = 0; i < projectList.length; i++) {
        for (let j = i + 1; j < projectList.length; j++) {
          const projA = `project:${projectList[i]}`;
          const projB = `project:${projectList[j]}`;
          const key = this.makeEdgeKey(projA, projB, 'shares_investor_with');

          if (edges.has(key)) {
            // Increment shared investor count
            const existing = edges.get(key)!;
            existing.evidenceCount++;
            existing.weight++;
            existing.confidence = Math.min(0.95, 0.5 + existing.evidenceCount * 0.03);
            if (!existing.metadata!.sharedInvestors) {
              existing.metadata!.sharedInvestors = [];
            }
            if (!existing.metadata!.sharedInvestors.includes(investorSlug)) {
              existing.metadata!.sharedInvestors.push(investorSlug);
            }
          } else {
            edges.set(key, {
              id: key,
              key,
              from: projA,
              to: projB,
              type: 'shares_investor_with',
              directed: false,
              weight: 1,
              confidence: 0.5,
              evidenceCount: 1,
              firstSeenAt: new Date(),
              lastSeenAt: new Date(),
              sourceIds: ['funding'],
              metadata: {
                sharedInvestors: [investorSlug],
              },
            });
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SHARES_FOUNDER_WITH (Project <-> Project)
  // Projects founded by same person
  // ═══════════════════════════════════════════════════════════════

  private buildSharesFounderEdges(ctx: GraphBuildContext, edges: Map<string, GraphEdge>): void {
    // Build founder -> projects map
    const founderToProjects = new Map<string, Set<string>>();

    for (const link of ctx.rootDataLinks) {
      if (link.type !== 'founded') continue;

      const founderId = link.from_id;
      const projectId = link.to_id;
      if (!founderId || !projectId) continue;

      if (!founderToProjects.has(founderId)) {
        founderToProjects.set(founderId, new Set());
      }
      founderToProjects.get(founderId)!.add(projectId);
    }

    // Create pairwise edges
    for (const [founderId, projects] of founderToProjects.entries()) {
      if (projects.size < 2) continue;

      const projectList = Array.from(projects);

      for (let i = 0; i < projectList.length; i++) {
        for (let j = i + 1; j < projectList.length; j++) {
          const projA = `project:${projectList[i]}`;
          const projB = `project:${projectList[j]}`;
          const key = this.makeEdgeKey(projA, projB, 'shares_founder_with');

          if (edges.has(key)) {
            const existing = edges.get(key)!;
            existing.evidenceCount++;
            existing.weight++;
            if (!existing.metadata!.sharedFounders.includes(founderId)) {
              existing.metadata!.sharedFounders.push(founderId);
            }
          } else {
            edges.set(key, {
              id: key,
              key,
              from: projA,
              to: projB,
              type: 'shares_founder_with',
              directed: false,
              weight: 1,
              confidence: 0.7, // High confidence for founder links
              evidenceCount: 1,
              firstSeenAt: new Date(),
              lastSeenAt: new Date(),
              sourceIds: ['rootdata'],
              metadata: {
                sharedFounders: [founderId],
              },
            });
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WORKED_TOGETHER (Person <-> Person)
  // People who worked at the same organization
  // ═══════════════════════════════════════════════════════════════

  private buildWorkedTogetherEdges(ctx: GraphBuildContext, edges: Map<string, GraphEdge>): void {
    // Build org -> people map
    const orgToPeople = new Map<string, Set<string>>();

    for (const link of ctx.rootDataLinks) {
      if (!['works_at', 'founded', 'employed_at'].includes(link.type)) continue;
      if (link.from_type !== 'person') continue;

      const personId = link.from_id;
      const orgId = link.to_id;
      if (!personId || !orgId) continue;

      if (!orgToPeople.has(orgId)) {
        orgToPeople.set(orgId, new Set());
      }
      orgToPeople.get(orgId)!.add(personId);
    }

    // Also from rootdata_people organizations field
    for (const person of ctx.rootDataPeople) {
      for (const org of person.organizations || []) {
        const orgSlug = org.slug || this.slugify(org.name);
        if (!orgSlug) continue;

        if (!orgToPeople.has(orgSlug)) {
          orgToPeople.set(orgSlug, new Set());
        }
        orgToPeople.get(orgSlug)!.add(person.slug);
      }
    }

    // Create pairwise edges
    for (const [orgId, people] of orgToPeople.entries()) {
      if (people.size < 2) continue;

      const peopleList = Array.from(people).slice(0, 50); // Limit

      for (let i = 0; i < peopleList.length; i++) {
        for (let j = i + 1; j < peopleList.length; j++) {
          const personA = `person:${peopleList[i]}`;
          const personB = `person:${peopleList[j]}`;
          const key = this.makeEdgeKey(personA, personB, 'worked_together');

          if (edges.has(key)) {
            const existing = edges.get(key)!;
            existing.evidenceCount++;
            existing.weight++;
            if (!existing.metadata!.sharedOrgs.includes(orgId)) {
              existing.metadata!.sharedOrgs.push(orgId);
            }
          } else {
            edges.set(key, {
              id: key,
              key,
              from: personA,
              to: personB,
              type: 'worked_together',
              directed: false,
              weight: 1,
              confidence: 0.6,
              evidenceCount: 1,
              firstSeenAt: new Date(),
              lastSeenAt: new Date(),
              sourceIds: ['rootdata'],
              metadata: {
                sharedOrgs: [orgId],
              },
            });
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private makeEdgeKey(from: string, to: string, type: string): string {
    const sorted = [from, to].sort();
    return `${type}:${sorted[0]}:${sorted[1]}`;
  }

  private calculateRecencyFactor(timestamp?: number): number {
    if (!timestamp) return 0.5;

    const now = Date.now() / 1000;
    const ageInDays = (now - timestamp) / (60 * 60 * 24);

    if (ageInDays <= 30) return 1.0;
    if (ageInDays <= 180) return 0.9;
    if (ageInDays <= 365) return 0.7;
    if (ageInDays <= 730) return 0.5;
    return 0.3;
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
    this.logger.debug(`[DerivedEdgeBuilder] By type: ${JSON.stringify(byType)}`);
  }
}
