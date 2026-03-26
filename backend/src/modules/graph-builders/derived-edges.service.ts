/**
 * Derived Edges Service V2
 * 
 * CRITICAL: Builds DENSE intelligence edges for the graph
 * 
 * Uses REAL data sources:
 * - coinvest_relations (138k+ existing relations!)
 * - intel_fundraising (16k+ rounds)
 * - intel_investors (18k+ investors)
 * 
 * Derived edge types:
 * - coinvested_with: Funds that invested together (from coinvest_relations)
 * - shares_investor_with: Projects with common investors (from fundraising)
 * - worked_together: People who worked at same org
 * - shares_founder_with: Projects with common founders
 * 
 * V2: Removed strict filters, uses global aggregation
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface DerivedEdge {
  id: string;
  key: string; // sorted(from, to) + type for dedup
  from_node_id: string;
  to_node_id: string;
  relation_type: string;
  weight: number;
  volume: number;
  confidence: number;
  evidence_count: number;
  projects: string[];
  first_seen_at: Date;
  last_seen_at: Date;
  metadata: Record<string, any>;
}

export interface BuildResult {
  type: string;
  created: number;
  updated: number;
  skipped: number;
  duration_ms: number;
}

@Injectable()
export class DerivedEdgesService {
  private readonly logger = new Logger(DerivedEdgesService.name);

  constructor(
    @InjectModel('graph_nodes') private nodesModel: Model<any>,
    @InjectModel('graph_edges') private edgesModel: Model<any>,
    @InjectModel('graph_derived_edges') private derivedEdgesModel: Model<any>,
    @InjectModel('graph_snapshots') private snapshotsModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_projects') private projectsModel: Model<any>,
    @InjectModel('rootdata_links') private linksModel: Model<any>,
    @InjectModel('rootdata_people') private peopleModel: Model<any>,
    @InjectModel('coinvest_relations') private coinvestModel: Model<any>,
    @InjectModel('canonical_investors') private canonicalModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // FULL BUILD
  // ═══════════════════════════════════════════════════════════════

  async buildAllDerivedEdges(): Promise<BuildResult[]> {
    const results: BuildResult[] = [];

    // Clear old derived edges for fresh rebuild
    await this.derivedEdgesModel.deleteMany({});
    this.logger.log('[DerivedEdges] Cleared old derived edges for fresh rebuild');

    // Build in order - using REAL data sources
    results.push(await this.buildCoinvestedEdgesV2());
    results.push(await this.buildSharedInvestorEdgesV2());
    results.push(await this.buildWorkedTogetherEdges());
    results.push(await this.buildSharedFounderEdges());

    // Create snapshot
    await this.createSnapshot(results);

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // COINVESTED_WITH V2 - Uses coinvest_relations (138k+ records!)
  // ═══════════════════════════════════════════════════════════════

  async buildCoinvestedEdgesV2(): Promise<BuildResult> {
    const start = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const batchSize = 1000;

    // Use pre-computed coinvest_relations - this is the GOLD!
    const totalRelations = await this.coinvestModel.countDocuments({});
    this.logger.log(`[DerivedEdges] Processing ${totalRelations} coinvest relations...`);

    // Process in batches
    let processed = 0;
    const bulkOps: any[] = [];

    const cursor = this.coinvestModel.find({}).lean().cursor();

    for await (const relation of cursor) {
      const key = this.makeEdgeKey(relation.investor_a, relation.investor_b, 'coinvested_with');
      
      // Calculate confidence based on:
      // - count (how many times together)
      // - quality_score (if available)
      // - recency (last_together)
      const recencyFactor = this.calculateRecencyFactor(relation.last_together);
      const countFactor = Math.min(1.0, relation.count / 50); // Cap at 50 for normalization
      const qualityFactor = (relation.quality_score || 50) / 100;
      
      const confidence = Math.min(0.99, 0.3 + (countFactor * 0.3) + (recencyFactor * 0.2) + (qualityFactor * 0.2));

      const edge = {
        id: uuidv4(),
        key,
        from_node_id: `fund:${relation.investor_a}`,
        to_node_id: `fund:${relation.investor_b}`,
        relation_type: 'coinvested_with',
        weight: relation.count,
        volume: relation.volume || 0,
        confidence: Math.round(confidence * 1000) / 1000,
        evidence_count: relation.count,
        projects: (relation.projects || []).slice(0, 50), // Keep top 50 projects
        first_seen_at: relation.first_together ? new Date(relation.first_together * 1000) : new Date(),
        last_seen_at: relation.last_together ? new Date(relation.last_together * 1000) : new Date(),
        metadata: {
          quality_score: relation.quality_score,
          total_projects: (relation.projects || []).length,
        },
      };

      bulkOps.push({
        updateOne: {
          filter: { key },
          update: { $set: edge },
          upsert: true,
        },
      });

      processed++;

      // Execute batch
      if (bulkOps.length >= batchSize) {
        const result = await this.derivedEdgesModel.bulkWrite(bulkOps);
        created += result.upsertedCount || 0;
        updated += result.modifiedCount || 0;
        bulkOps.length = 0;
        
        if (processed % 10000 === 0) {
          this.logger.log(`[DerivedEdges] coinvested_with: processed ${processed}/${totalRelations}`);
        }
      }
    }

    // Final batch
    if (bulkOps.length > 0) {
      const result = await this.derivedEdgesModel.bulkWrite(bulkOps);
      created += result.upsertedCount || 0;
      updated += result.modifiedCount || 0;
    }

    this.logger.log(`[DerivedEdges] coinvested_with: ${created} created, ${updated} updated from ${totalRelations} relations`);

    return {
      type: 'coinvested_with',
      created,
      updated,
      skipped,
      duration_ms: Date.now() - start,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SHARES_INVESTOR_WITH V2 - Uses intel_fundraising directly
  // Projects that share common investors
  // ═══════════════════════════════════════════════════════════════

  async buildSharedInvestorEdgesV2(): Promise<BuildResult> {
    const start = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Build investor -> projects map from fundraising data
    const rounds = await this.fundraisingModel
      .find({ investors_count: { $gte: 1 } })
      .lean();

    this.logger.log(`[DerivedEdges] Processing ${rounds.length} funding rounds for shared investors...`);

    // investor_slug -> Set<project_slug>
    const investorToProjects: Map<string, Set<string>> = new Map();

    for (const round of rounds) {
      const projectSlug = round.project_key || round.project || 'unknown';
      if (projectSlug === 'unknown') continue;

      for (const inv of (round.investors || [])) {
        const invSlug = inv.slug || inv.key || this.slugify(inv.name || inv.fundName);
        if (!invSlug) continue;

        if (!investorToProjects.has(invSlug)) {
          investorToProjects.set(invSlug, new Set());
        }
        investorToProjects.get(invSlug)!.add(projectSlug);
      }
    }

    // Find investors with 2+ projects and create edges between projects
    const bulkOps: any[] = [];
    let processed = 0;

    for (const [investorSlug, projects] of investorToProjects.entries()) {
      if (projects.size < 2) continue;

      const projectList = Array.from(projects);
      
      // Create pairwise edges (limit to top 100 projects per investor to avoid explosion)
      const limitedProjects = projectList.slice(0, 100);
      
      for (let i = 0; i < limitedProjects.length; i++) {
        for (let j = i + 1; j < limitedProjects.length; j++) {
          const key = this.makeEdgeKey(limitedProjects[i], limitedProjects[j], 'shares_investor_with');
          
          bulkOps.push({
            updateOne: {
              filter: { key },
              update: {
                $set: {
                  id: uuidv4(),
                  key,
                  from_node_id: `project:${limitedProjects[i]}`,
                  to_node_id: `project:${limitedProjects[j]}`,
                  relation_type: 'shares_investor_with',
                  last_seen_at: new Date(),
                },
                $inc: { weight: 1, evidence_count: 1 },
                $addToSet: { shared_investors: investorSlug },
                $setOnInsert: {
                  confidence: 0.5,
                  volume: 0,
                  projects: [],
                  first_seen_at: new Date(),
                },
              },
              upsert: true,
            },
          });

          processed++;

          if (bulkOps.length >= 1000) {
            const result = await this.derivedEdgesModel.bulkWrite(bulkOps);
            created += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
            bulkOps.length = 0;
          }
        }
      }
    }

    // Final batch
    if (bulkOps.length > 0) {
      const result = await this.derivedEdgesModel.bulkWrite(bulkOps);
      created += result.upsertedCount || 0;
      updated += result.modifiedCount || 0;
    }

    this.logger.log(`[DerivedEdges] shares_investor_with: ${created} created, ${updated} updated`);

    return {
      type: 'shares_investor_with',
      created,
      updated,
      skipped,
      duration_ms: Date.now() - start,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // WORKED_TOGETHER - People who worked at the same organization
  // ═══════════════════════════════════════════════════════════════

  async buildWorkedTogetherEdges(): Promise<BuildResult> {
    const start = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Get people with organizations from intel_investors (type = Person/Angel)
    const people = await this.investorsModel
      .find({ type: { $in: ['Person', 'Angel', 'Advisor'] } })
      .lean();

    this.logger.log(`[DerivedEdges] Processing ${people.length} people for worked_together...`);

    // Also get from rootdata_people if exists
    const rootdataPeople = await this.peopleModel.find({}).lean();

    // Build org -> people map
    const orgToPeople: Map<string, Array<{ slug: string; name: string }>> = new Map();

    // From intel_investors - group by common investments
    const investorToProjects: Map<string, Set<string>> = new Map();
    
    const rounds = await this.fundraisingModel.find({}).lean();
    for (const round of rounds) {
      for (const inv of (round.investors || [])) {
        if (inv.type === 'Person' || inv.type === 'Angel') {
          const invSlug = inv.slug || this.slugify(inv.name);
          if (!investorToProjects.has(invSlug)) {
            investorToProjects.set(invSlug, new Set());
          }
          investorToProjects.get(invSlug)!.add(round.project_key || round.project);
        }
      }
    }

    // From rootdata_people - group by organization
    for (const person of rootdataPeople) {
      for (const org of (person.organizations || [])) {
        const orgSlug = org.slug || this.slugify(org.name);
        if (!orgToPeople.has(orgSlug)) {
          orgToPeople.set(orgSlug, []);
        }
        orgToPeople.get(orgSlug)!.push({
          slug: person.slug,
          name: person.name,
        });
      }
    }

    const bulkOps: any[] = [];

    // Create edges for people at same org
    for (const [orgSlug, orgPeople] of orgToPeople.entries()) {
      if (orgPeople.length < 2) continue;

      for (let i = 0; i < Math.min(orgPeople.length, 50); i++) {
        for (let j = i + 1; j < Math.min(orgPeople.length, 50); j++) {
          const key = this.makeEdgeKey(orgPeople[i].slug, orgPeople[j].slug, 'worked_together');
          
          bulkOps.push({
            updateOne: {
              filter: { key },
              update: {
                $set: {
                  id: uuidv4(),
                  key,
                  from_node_id: `person:${orgPeople[i].slug}`,
                  to_node_id: `person:${orgPeople[j].slug}`,
                  relation_type: 'worked_together',
                  last_seen_at: new Date(),
                },
                $inc: { weight: 1, evidence_count: 1 },
                $addToSet: { shared_orgs: orgSlug },
                $setOnInsert: {
                  confidence: 0.6,
                  volume: 0,
                  projects: [],
                  first_seen_at: new Date(),
                },
              },
              upsert: true,
            },
          });

          if (bulkOps.length >= 1000) {
            const result = await this.derivedEdgesModel.bulkWrite(bulkOps);
            created += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
            bulkOps.length = 0;
          }
        }
      }
    }

    // Final batch
    if (bulkOps.length > 0) {
      const result = await this.derivedEdgesModel.bulkWrite(bulkOps);
      created += result.upsertedCount || 0;
      updated += result.modifiedCount || 0;
    }

    this.logger.log(`[DerivedEdges] worked_together: ${created} created, ${updated} updated`);

    return {
      type: 'worked_together',
      created,
      updated,
      skipped,
      duration_ms: Date.now() - start,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SHARES_FOUNDER_WITH
  // Projects with common founders
  // ═══════════════════════════════════════════════════════════════

  async buildSharedFounderEdges(): Promise<BuildResult> {
    const start = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Get founder relationships from rootdata_links
    const foundedLinks = await this.linksModel.find({ type: 'founded' }).lean();

    this.logger.log(`[DerivedEdges] Processing ${foundedLinks.length} founder links...`);

    // founder -> projects
    const founderToProjects: Map<string, Set<string>> = new Map();

    for (const link of foundedLinks) {
      const founderId = link.from_id;
      const projectId = link.to_id;

      if (!founderToProjects.has(founderId)) {
        founderToProjects.set(founderId, new Set());
      }
      founderToProjects.get(founderId)!.add(projectId);
    }

    const bulkOps: any[] = [];

    for (const [founderId, projects] of founderToProjects.entries()) {
      if (projects.size < 2) continue;

      const projectList = Array.from(projects);

      for (let i = 0; i < projectList.length; i++) {
        for (let j = i + 1; j < projectList.length; j++) {
          const key = this.makeEdgeKey(projectList[i], projectList[j], 'shares_founder_with');
          
          bulkOps.push({
            updateOne: {
              filter: { key },
              update: {
                $set: {
                  id: uuidv4(),
                  key,
                  from_node_id: `project:${projectList[i]}`,
                  to_node_id: `project:${projectList[j]}`,
                  relation_type: 'shares_founder_with',
                  last_seen_at: new Date(),
                },
                $inc: { weight: 1, evidence_count: 1 },
                $addToSet: { shared_founders: founderId },
                $setOnInsert: {
                  confidence: 0.7,
                  volume: 0,
                  projects: [],
                  first_seen_at: new Date(),
                },
              },
              upsert: true,
            },
          });

          if (bulkOps.length >= 1000) {
            const result = await this.derivedEdgesModel.bulkWrite(bulkOps);
            created += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
            bulkOps.length = 0;
          }
        }
      }
    }

    // Final batch
    if (bulkOps.length > 0) {
      const result = await this.derivedEdgesModel.bulkWrite(bulkOps);
      created += result.upsertedCount || 0;
      updated += result.modifiedCount || 0;
    }

    this.logger.log(`[DerivedEdges] shares_founder_with: ${created} created, ${updated} updated`);

    return {
      type: 'shares_founder_with',
      created,
      updated,
      skipped,
      duration_ms: Date.now() - start,
    };
  }

  // Legacy method - kept for backward compatibility
  async buildCoinvestedEdges(): Promise<BuildResult> {
    return this.buildCoinvestedEdgesV2();
  }

  // Legacy method
  async buildSharedInvestorEdges(): Promise<BuildResult> {
    return this.buildSharedInvestorEdgesV2();
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create normalized edge key for deduplication
   * Key = sorted(from, to) + type
   */
  private makeEdgeKey(from: string, to: string, type: string): string {
    const sorted = [from, to].sort();
    return `${type}:${sorted[0]}:${sorted[1]}`;
  }

  /**
   * Calculate recency factor (0.0 to 1.0)
   * More recent = higher score
   */
  private calculateRecencyFactor(timestamp?: number): number {
    if (!timestamp) return 0.5;
    
    const now = Date.now() / 1000;
    const ageInDays = (now - timestamp) / (60 * 60 * 24);
    
    // 0 days = 1.0, 365 days = 0.5, 730+ days = 0.2
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

  private async createSnapshot(results: BuildResult[]): Promise<void> {
    const nodeCount = await this.nodesModel.countDocuments({});
    const edgeCount = await this.edgesModel.countDocuments({});
    const derivedCount = await this.derivedEdgesModel.countDocuments({});

    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

    await this.snapshotsModel.create({
      snapshot_id: `derived_${Date.now()}`,
      snapshot_type: 'derived_edges_build',
      node_count: nodeCount,
      edge_count: edgeCount,
      derived_edge_count: derivedCount,
      build_results: results,
      total_created: totalCreated,
      total_updated: totalUpdated,
      total_duration_ms: totalDuration,
      created_at: new Date(),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // STATS & QUERIES
  // ═══════════════════════════════════════════════════════════════

  async getStats(): Promise<Record<string, any>> {
    const pipeline = [
      {
        $group: {
          _id: '$relation_type',
          count: { $sum: 1 },
          avg_evidence: { $avg: '$evidence_count' },
          avg_weight: { $avg: '$weight' },
        },
      },
    ];

    const byType = await this.derivedEdgesModel.aggregate(pipeline);
    const total = await this.derivedEdgesModel.countDocuments({});

    return {
      total_derived_edges: total,
      by_type: byType,
    };
  }

  async getDerivedEdgesForNode(nodeId: string): Promise<any[]> {
    return this.derivedEdgesModel
      .find({
        $or: [{ from_node_id: nodeId }, { to_node_id: nodeId }],
      })
      .lean();
  }

  async getRelatedNodes(nodeId: string, relationType?: string): Promise<string[]> {
    const filter: any = {
      $or: [{ from_node_id: nodeId }, { to_node_id: nodeId }],
    };

    if (relationType) {
      filter.relation_type = relationType;
    }

    const edges = await this.derivedEdgesModel.find(filter).lean();

    const relatedIds = new Set<string>();
    for (const edge of edges) {
      if (edge.from_node_id === nodeId) {
        relatedIds.add(edge.to_node_id);
      } else {
        relatedIds.add(edge.from_node_id);
      }
    }

    return Array.from(relatedIds);
  }
}
