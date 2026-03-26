/**
 * Node Builder
 * 
 * BLOCK 5: Builds graph nodes from all data sources
 * 
 * Sources:
 * - intel_investors (funds)
 * - intel_projects (projects)
 * - rootdata_funds, rootdata_projects, rootdata_people
 * - Canonical entities
 */

import { Injectable, Logger } from '@nestjs/common';
import { GraphBuildContext, GraphNode } from '../graph-pipeline.types';

@Injectable()
export class NodeBuilder {
  private readonly logger = new Logger(NodeBuilder.name);

  /**
   * Build nodes from all sources in context
   * Returns Map<nodeId, GraphNode> for O(1) lookups
   */
  build(ctx: GraphBuildContext): Map<string, GraphNode> {
    const nodes = new Map<string, GraphNode>();
    const now = new Date();

    // ─────────────────────────────────────────────────────────────
    // 1. Build from canonical entities (highest priority)
    // ─────────────────────────────────────────────────────────────
    for (const entity of ctx.entities) {
      const id = this.resolveEntityId(entity);
      if (!id) continue;

      const type = this.mapEntityType(entity.type);
      const nodeId = `${type}:${id}`;

      nodes.set(nodeId, {
        id: nodeId,
        type,
        label: entity.display_name || entity.name || id,
        slug: entity.slug || id,
        confidence: entity.confidence ?? 0.85,
        tier: entity.tier,
        metadata: {
          aliases: entity.aliases || [],
          canonical_id: entity.canonical_id,
          sources: entity.sources || [],
        },
        firstSeenAt: entity.first_seen_at ? new Date(entity.first_seen_at) : now,
        lastSeenAt: entity.last_seen_at ? new Date(entity.last_seen_at) : now,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Build from funding rounds (extract investors & projects)
    // ─────────────────────────────────────────────────────────────
    for (const round of ctx.fundingRounds) {
      // Project node
      const projectSlug = round.project_key || round.project || round.projectSlug;
      if (projectSlug) {
        const projectId = `project:${projectSlug}`;
        if (!nodes.has(projectId)) {
          nodes.set(projectId, {
            id: projectId,
            type: 'project',
            label: round.project_name || round.name || projectSlug,
            slug: projectSlug,
            confidence: 0.8,
            metadata: {
              category: round.category,
              source: round.source,
            },
            firstSeenAt: round.date ? new Date(round.date) : now,
            lastSeenAt: round.date ? new Date(round.date) : now,
          });
        }
      }

      // Investor nodes
      for (const inv of round.investors || []) {
        const invSlug = inv.slug || inv.key || this.slugify(inv.name || inv.fundName);
        if (!invSlug) continue;

        const invId = `fund:${invSlug}`;
        if (!nodes.has(invId)) {
          nodes.set(invId, {
            id: invId,
            type: 'fund',
            label: inv.name || inv.fundName || invSlug,
            slug: invSlug,
            confidence: 0.8,
            tier: inv.tier,
            metadata: {
              image: inv.image || inv.logo,
              type: inv.type, // VC, Angel, etc.
            },
            firstSeenAt: round.date ? new Date(round.date) : now,
            lastSeenAt: round.date ? new Date(round.date) : now,
          });
        } else {
          // Update lastSeenAt
          const existing = nodes.get(invId)!;
          const roundDate = round.date ? new Date(round.date) : now;
          if (!existing.lastSeenAt || roundDate > existing.lastSeenAt) {
            existing.lastSeenAt = roundDate;
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Build from RootData funds
    // ─────────────────────────────────────────────────────────────
    for (const fund of ctx.rootDataFunds) {
      const fundId = `fund:${fund.slug}`;
      if (!nodes.has(fundId)) {
        nodes.set(fundId, {
          id: fundId,
          type: 'fund',
          label: fund.name || fund.slug,
          slug: fund.slug,
          confidence: 0.9, // RootData is high quality
          tier: fund.tier || 2,
          metadata: {
            portfolio_count: fund.portfolio_count,
            aum: fund.aum,
            website: fund.website,
            logo: fund.logo,
            rootdata_id: fund.id,
          },
          firstSeenAt: fund.created_at ? new Date(fund.created_at) : now,
          lastSeenAt: fund.updated_at ? new Date(fund.updated_at) : now,
        });
      } else {
        // Merge rootdata metadata (it's higher quality)
        const existing = nodes.get(fundId)!;
        existing.confidence = Math.max(existing.confidence || 0, 0.9);
        existing.metadata = {
          ...existing.metadata,
          portfolio_count: fund.portfolio_count,
          aum: fund.aum,
          rootdata_id: fund.id,
        };
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Build from RootData projects
    // ─────────────────────────────────────────────────────────────
    for (const proj of ctx.rootDataProjects) {
      const projId = `project:${proj.slug}`;
      if (!nodes.has(projId)) {
        nodes.set(projId, {
          id: projId,
          type: 'project',
          label: proj.name || proj.slug,
          slug: proj.slug,
          confidence: 0.9,
          category: proj.category,
          metadata: {
            total_funding: proj.total_funding,
            rounds_count: proj.rounds_count,
            website: proj.website,
            logo: proj.logo,
            rootdata_id: proj.id,
          },
          firstSeenAt: proj.created_at ? new Date(proj.created_at) : now,
          lastSeenAt: proj.updated_at ? new Date(proj.updated_at) : now,
        });
      } else {
        // Merge rootdata metadata
        const existing = nodes.get(projId)!;
        existing.confidence = Math.max(existing.confidence || 0, 0.9);
        existing.metadata = {
          ...existing.metadata,
          total_funding: proj.total_funding,
          rounds_count: proj.rounds_count,
          rootdata_id: proj.id,
        };
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Build from RootData people
    // ─────────────────────────────────────────────────────────────
    for (const person of ctx.rootDataPeople) {
      const personId = `person:${person.slug}`;
      if (!nodes.has(personId)) {
        nodes.set(personId, {
          id: personId,
          type: 'person',
          label: person.name || person.slug,
          slug: person.slug,
          confidence: 0.85,
          metadata: {
            title: person.title,
            organizations: person.organizations,
            twitter: person.twitter,
            linkedin: person.linkedin,
            rootdata_id: person.id,
          },
          firstSeenAt: person.created_at ? new Date(person.created_at) : now,
          lastSeenAt: person.updated_at ? new Date(person.updated_at) : now,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Build from coinvest_relations (extract fund slugs)
    // ─────────────────────────────────────────────────────────────
    for (const rel of ctx.coinvestRelations) {
      for (const slug of [rel.investor_a, rel.investor_b]) {
        const fundId = `fund:${slug}`;
        if (!nodes.has(fundId)) {
          nodes.set(fundId, {
            id: fundId,
            type: 'fund',
            label: slug, // No name available, use slug
            slug: slug,
            confidence: 0.7,
            metadata: {
              source: 'coinvest_relations',
            },
            firstSeenAt: rel.first_together ? new Date(rel.first_together * 1000) : now,
            lastSeenAt: rel.last_together ? new Date(rel.last_together * 1000) : now,
          });
        }
      }
    }

    this.logger.log(`[NodeBuilder] Built ${nodes.size} nodes`);
    this.logNodeStats(nodes);

    return nodes;
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private resolveEntityId(entity: any): string | null {
    return entity.canonical_id || entity.id || entity.slug || null;
  }

  private mapEntityType(type: string): GraphNode['type'] {
    const typeMap: Record<string, GraphNode['type']> = {
      fund: 'fund',
      investor: 'fund',
      vc: 'fund',
      project: 'project',
      person: 'person',
      people: 'person',
      angel: 'person',
      token: 'token',
      exchange: 'exchange',
    };
    return typeMap[type?.toLowerCase()] || 'entity';
  }

  private slugify(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private logNodeStats(nodes: Map<string, GraphNode>): void {
    const byType: Record<string, number> = {};
    for (const node of nodes.values()) {
      byType[node.type] = (byType[node.type] || 0) + 1;
    }
    this.logger.debug(`[NodeBuilder] By type: ${JSON.stringify(byType)}`);
  }
}
