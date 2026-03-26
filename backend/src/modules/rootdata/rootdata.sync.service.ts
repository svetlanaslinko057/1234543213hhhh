/**
 * RootData Sync Service V2
 * 
 * BLOCK 2: Full RootData parity with Python
 * 
 * Features:
 * - Full pagination sync
 * - Upsert logic (update existing, mark stale)
 * - Diff detection
 * - Entity mapping to canonical
 * - Reliability integration
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RootDataClient, RootDataProject, RootDataFund, RootDataPerson, RootDataRound } from './rootdata.client';

export interface SyncResult {
  source: string;
  success: boolean;
  projects: { total: number; created: number; updated: number; unchanged: number };
  funds: { total: number; created: number; updated: number; unchanged: number };
  people: { total: number; created: number; updated: number; unchanged: number };
  rounds: { total: number; created: number; updated: number; unchanged: number };
  links: number;
  entityMappings: number;
  errors: string[];
  duration_ms: number;
}

interface UpsertStats {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
}

@Injectable()
export class RootDataSyncService {
  private readonly logger = new Logger(RootDataSyncService.name);

  constructor(
    private readonly client: RootDataClient,
    @InjectModel('rootdata_projects') private projectsModel: Model<any>,
    @InjectModel('rootdata_funds') private fundsModel: Model<any>,
    @InjectModel('rootdata_people') private peopleModel: Model<any>,
    @InjectModel('rootdata_rounds') private roundsModel: Model<any>,
    @InjectModel('rootdata_links') private linksModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // FULL SYNC V2
  // ═══════════════════════════════════════════════════════════════

  async syncAll(maxPages = 50): Promise<SyncResult> {
    const start = Date.now();
    const result: SyncResult = {
      source: 'rootdata',
      success: true,
      projects: { total: 0, created: 0, updated: 0, unchanged: 0 },
      funds: { total: 0, created: 0, updated: 0, unchanged: 0 },
      people: { total: 0, created: 0, updated: 0, unchanged: 0 },
      rounds: { total: 0, created: 0, updated: 0, unchanged: 0 },
      links: 0,
      entityMappings: 0,
      errors: [],
      duration_ms: 0,
    };

    try {
      // Mark all as potentially stale before sync
      await this.markAllStale();

      // Sync in order: funds → projects → people → rounds
      result.funds = await this.syncFundsV2(maxPages);
      result.projects = await this.syncProjectsV2(maxPages);
      result.people = await this.syncPeopleV2(maxPages);
      result.rounds = await this.syncRoundsV2(maxPages);
      
      // Build graph links
      result.links = await this.buildLinks();
      
      // Map to canonical entities
      result.entityMappings = await this.mapToCanonicalEntities();
      
      // Clean up stale records (not seen in this sync)
      await this.cleanupStale();
      
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      this.logger.error(`[RootData] Sync failed: ${error.message}`);
    }

    result.duration_ms = Date.now() - start;
    
    this.logger.log(
      `[RootData] Sync complete in ${result.duration_ms}ms: ` +
      `funds=${result.funds.total} (${result.funds.created} new), ` +
      `projects=${result.projects.total}, people=${result.people.total}, ` +
      `rounds=${result.rounds.total}, links=${result.links}, mappings=${result.entityMappings}`
    );

    return result;
  }

  private async markAllStale(): Promise<void> {
    const now = new Date();
    await Promise.all([
      this.projectsModel.updateMany({}, { $set: { _stale: true, _stale_check_at: now } }),
      this.fundsModel.updateMany({}, { $set: { _stale: true, _stale_check_at: now } }),
      this.peopleModel.updateMany({}, { $set: { _stale: true, _stale_check_at: now } }),
      this.roundsModel.updateMany({}, { $set: { _stale: true, _stale_check_at: now } }),
    ]);
  }

  private async cleanupStale(): Promise<void> {
    // Don't delete, just mark as inactive
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    await Promise.all([
      this.projectsModel.updateMany(
        { _stale: true, _stale_check_at: { $lt: cutoff } },
        { $set: { _active: false } }
      ),
      this.fundsModel.updateMany(
        { _stale: true, _stale_check_at: { $lt: cutoff } },
        { $set: { _active: false } }
      ),
    ]);
  }

  // ═══════════════════════════════════════════════════════════════
  // V2 SYNC METHODS (with diff detection)
  // ═══════════════════════════════════════════════════════════════

  async syncFundsV2(maxPages = 50): Promise<UpsertStats> {
    const stats: UpsertStats = { total: 0, created: 0, updated: 0, unchanged: 0 };
    const now = new Date();

    for (let page = 1; page <= maxPages; page++) {
      const funds = await this.client.fetchFunds(page, 50);
      if (funds.length === 0) break;

      for (const fund of funds) {
        try {
          const existing = await this.fundsModel.findOne({ rootdata_id: fund.id }).lean() as any;
          const doc = this.normalizeFund(fund, now);
          doc._stale = false;
          doc._active = true;

          if (!existing) {
            await this.fundsModel.create(doc);
            stats.created++;
          } else if (this.hasChanges(existing, doc)) {
            doc._previous = {
              name: existing.name,
              portfolio_count: existing.portfolio_count,
              updated_at: existing.updated_at,
            };
            await this.fundsModel.updateOne({ rootdata_id: fund.id }, { $set: doc });
            stats.updated++;
          } else {
            await this.fundsModel.updateOne(
              { rootdata_id: fund.id },
              { $set: { _stale: false, _last_seen_at: now } }
            );
            stats.unchanged++;
          }
          stats.total++;
        } catch (error: any) {
          this.logger.warn(`[RootData] Fund ${fund.id}: ${error.message}`);
        }
      }

      if (page % 10 === 0) {
        this.logger.log(`[RootData] Funds page ${page}: ${stats.total} processed`);
      }
    }

    return stats;
  }

  async syncProjectsV2(maxPages = 50): Promise<UpsertStats> {
    const stats: UpsertStats = { total: 0, created: 0, updated: 0, unchanged: 0 };
    const now = new Date();

    for (let page = 1; page <= maxPages; page++) {
      const projects = await this.client.fetchProjects(page, 50);
      if (projects.length === 0) break;

      for (const project of projects) {
        try {
          const existing = await this.projectsModel.findOne({ rootdata_id: project.id }).lean();
          const doc = this.normalizeProject(project, now);
          doc._stale = false;
          doc._active = true;

          if (!existing) {
            await this.projectsModel.create(doc);
            stats.created++;
          } else if (this.hasChanges(existing, doc)) {
            await this.projectsModel.updateOne({ rootdata_id: project.id }, { $set: doc });
            stats.updated++;
          } else {
            await this.projectsModel.updateOne(
              { rootdata_id: project.id },
              { $set: { _stale: false, _last_seen_at: now } }
            );
            stats.unchanged++;
          }
          stats.total++;
        } catch (error: any) {
          this.logger.warn(`[RootData] Project ${project.id}: ${error.message}`);
        }
      }

      if (page % 10 === 0) {
        this.logger.log(`[RootData] Projects page ${page}: ${stats.total} processed`);
      }
    }

    return stats;
  }

  async syncPeopleV2(maxPages = 50): Promise<UpsertStats> {
    const stats: UpsertStats = { total: 0, created: 0, updated: 0, unchanged: 0 };
    const now = new Date();

    for (let page = 1; page <= maxPages; page++) {
      const people = await this.client.fetchPeople(page, 50);
      if (people.length === 0) break;

      for (const person of people) {
        try {
          const existing = await this.peopleModel.findOne({ rootdata_id: person.id }).lean();
          const doc = this.normalizePerson(person, now);
          doc._stale = false;
          doc._active = true;

          if (!existing) {
            await this.peopleModel.create(doc);
            stats.created++;
          } else if (this.hasChanges(existing, doc)) {
            await this.peopleModel.updateOne({ rootdata_id: person.id }, { $set: doc });
            stats.updated++;
          } else {
            await this.peopleModel.updateOne(
              { rootdata_id: person.id },
              { $set: { _stale: false, _last_seen_at: now } }
            );
            stats.unchanged++;
          }
          stats.total++;
        } catch (error: any) {
          this.logger.warn(`[RootData] Person ${person.id}: ${error.message}`);
        }
      }

      if (page % 10 === 0) {
        this.logger.log(`[RootData] People page ${page}: ${stats.total} processed`);
      }
    }

    return stats;
  }

  async syncRoundsV2(maxPages = 50): Promise<UpsertStats> {
    const stats: UpsertStats = { total: 0, created: 0, updated: 0, unchanged: 0 };
    const now = new Date();

    for (let page = 1; page <= maxPages; page++) {
      const rounds = await this.client.fetchFundingRounds(page, 50);
      if (rounds.length === 0) break;

      for (const round of rounds) {
        try {
          const existing = await this.roundsModel.findOne({ rootdata_id: round.id }).lean();
          const doc = this.normalizeRound(round, now);
          doc._stale = false;

          if (!existing) {
            await this.roundsModel.create(doc);
            stats.created++;
          } else if (this.hasChanges(existing, doc)) {
            await this.roundsModel.updateOne({ rootdata_id: round.id }, { $set: doc });
            stats.updated++;
          } else {
            stats.unchanged++;
          }
          stats.total++;
        } catch (error: any) {
          this.logger.warn(`[RootData] Round ${round.id}: ${error.message}`);
        }
      }

      if (page % 10 === 0) {
        this.logger.log(`[RootData] Rounds page ${page}: ${stats.total} processed`);
      }
    }

    return stats;
  }

  private hasChanges(existing: any, newDoc: any): boolean {
    // Compare key fields
    const fieldsToCompare = ['name', 'description', 'portfolio_count', 'aum', 'total_funding'];
    for (const field of fieldsToCompare) {
      if (existing[field] !== newDoc[field] && newDoc[field] !== undefined) {
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // ENTITY MAPPING TO CANONICAL
  // ═══════════════════════════════════════════════════════════════

  async mapToCanonicalEntities(): Promise<number> {
    let mapped = 0;

    // Get canonical_investors collection
    const db = this.fundsModel.db;
    const canonicalCollection = db.collection('canonical_investors');
    const intelInvestorsCollection = db.collection('intel_investors');

    // Map RootData funds to canonical by slug/name
    const funds = await this.fundsModel.find({ _active: true }).lean();
    
    for (const fund of funds) {
      try {
        // Find matching canonical by slug or normalized name
        const canonical = await canonicalCollection.findOne({
          $or: [
            { slug: fund.slug },
            { name_lower: fund.name?.toLowerCase() },
            { aliases: fund.slug },
          ],
        });

        if (canonical) {
          // Link rootdata to canonical
          await this.fundsModel.updateOne(
            { rootdata_id: fund.rootdata_id },
            {
              $set: {
                canonical_id: canonical._id.toString(),
                canonical_slug: canonical.slug,
                _mapped_at: new Date(),
              },
            }
          );
          mapped++;
        } else {
          // Try to find in intel_investors
          const intelInvestor = await intelInvestorsCollection.findOne({
            $or: [
              { slug: fund.slug },
              { name: { $regex: new RegExp(`^${fund.name}$`, 'i') } },
            ],
          });

          if (intelInvestor) {
            await this.fundsModel.updateOne(
              { rootdata_id: fund.rootdata_id },
              {
                $set: {
                  intel_investor_id: intelInvestor._id.toString(),
                  _mapped_at: new Date(),
                },
              }
            );
            mapped++;
          }
        }
      } catch (error: any) {
        // Skip mapping errors
      }
    }

    // Map RootData people to intel_persons if exists
    const people = await this.peopleModel.find({ _active: true }).lean();
    const intelPersonsCollection = db.collection('intel_persons');

    for (const person of people) {
      try {
        const intelPerson = await intelPersonsCollection.findOne({
          $or: [
            { slug: person.slug },
            { name: { $regex: new RegExp(`^${person.name}$`, 'i') } },
          ],
        });

        if (intelPerson) {
          await this.peopleModel.updateOne(
            { rootdata_id: person.rootdata_id },
            {
              $set: {
                intel_person_id: intelPerson._id.toString(),
                _mapped_at: new Date(),
              },
            }
          );
          mapped++;
        }
      } catch (error: any) {
        // Skip
      }
    }

    this.logger.log(`[RootData] Mapped ${mapped} entities to canonical`);
    return mapped;
  }

  // ═══════════════════════════════════════════════════════════════
  // LEGACY SYNC METHODS (kept for compatibility)
  // ═══════════════════════════════════════════════════════════════

  async syncProjects(maxPages = 10): Promise<number> {
    const result = await this.syncProjectsV2(maxPages);
    return result.total;
  }

  async syncFunds(maxPages = 10): Promise<number> {
    const result = await this.syncFundsV2(maxPages);
    return result.total;
  }

  async syncRounds(maxPages = 10): Promise<number> {
    let count = 0;
    const now = new Date();

    for (let page = 1; page <= maxPages; page++) {
      const rounds = await this.client.fetchFundingRounds(page, 50);
      
      if (rounds.length === 0) break;

      for (const round of rounds) {
        try {
          const doc = this.normalizeRound(round, now);
          
          await this.roundsModel.updateOne(
            { rootdata_id: round.id },
            { $set: doc },
            { upsert: true }
          );
          count++;
        } catch (error: any) {
          this.logger.warn(`[RootData] Failed to save round ${round.id}: ${error.message}`);
        }
      }

      this.logger.debug(`[RootData] Synced rounds page ${page}: ${rounds.length} items`);
    }

    return count;
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD LINKS (for graph)
  // ═══════════════════════════════════════════════════════════════

  async buildLinks(): Promise<number> {
    let count = 0;
    const now = new Date();

    // 1. Fund → Project (invested_in) from rounds
    const rounds = await this.roundsModel.find({}).lean();
    
    for (const round of rounds) {
      const projectSlug = round.project_slug;
      
      for (const investor of (round.investors || [])) {
        try {
          const link = {
            type: 'invested_in',
            from_type: 'fund',
            from_id: investor.slug || this.slugify(investor.name),
            from_name: investor.name,
            to_type: 'project',
            to_id: projectSlug,
            to_name: round.project_name,
            metadata: {
              round: round.round,
              amount: round.amount,
              date: round.date,
              lead: investor.lead,
            },
            source: 'rootdata',
            source_id: round.rootdata_id,
            updated_at: now,
          };

          await this.linksModel.updateOne(
            { 
              type: 'invested_in',
              from_id: link.from_id,
              to_id: link.to_id,
              'metadata.round': round.round,
            },
            { $set: link },
            { upsert: true }
          );
          count++;
        } catch (error: any) {
          this.logger.warn(`[RootData] Failed to create investment link: ${error.message}`);
        }
      }
    }

    // 2. Person → Fund/Project (works_at/founded) from people
    const people = await this.peopleModel.find({}).lean();
    
    for (const person of people) {
      for (const org of (person.organizations || [])) {
        try {
          const link = {
            type: org.role?.toLowerCase().includes('founder') ? 'founded' : 'works_at',
            from_type: 'person',
            from_id: person.slug,
            from_name: person.name,
            to_type: 'fund', // Could also be project - needs lookup
            to_id: this.slugify(org.name),
            to_name: org.name,
            metadata: {
              role: org.role,
              current: org.current,
            },
            source: 'rootdata',
            source_id: person.rootdata_id,
            updated_at: now,
          };

          await this.linksModel.updateOne(
            {
              type: link.type,
              from_id: link.from_id,
              to_id: link.to_id,
            },
            { $set: link },
            { upsert: true }
          );
          count++;
        } catch (error: any) {
          this.logger.warn(`[RootData] Failed to create person link: ${error.message}`);
        }
      }
    }

    this.logger.log(`[RootData] Built ${count} links for graph`);
    return count;
  }

  // ═══════════════════════════════════════════════════════════════
  // NORMALIZERS
  // ═══════════════════════════════════════════════════════════════

  private normalizeProject(raw: RootDataProject, now: Date): Record<string, any> {
    return {
      rootdata_id: raw.id,
      name: raw.name,
      slug: raw.slug,
      logo: raw.logo,
      description: raw.description,
      category: raw.category,
      website: raw.website,
      twitter: raw.twitter,
      total_funding: raw.total_funding,
      team_size: raw.team_size,
      founded_date: raw.founded_date,
      source: 'rootdata',
      updated_at: now,
    };
  }

  private normalizeFund(raw: RootDataFund, now: Date): Record<string, any> {
    return {
      rootdata_id: raw.id,
      name: raw.name,
      slug: raw.slug,
      logo: raw.logo,
      description: raw.description,
      type: raw.type || 'vc',
      aum: raw.aum,
      portfolio_count: raw.portfolio_count,
      website: raw.website,
      twitter: raw.twitter,
      founded_year: raw.founded_year,
      source: 'rootdata',
      updated_at: now,
    };
  }

  private normalizePerson(raw: RootDataPerson, now: Date): Record<string, any> {
    return {
      rootdata_id: raw.id,
      name: raw.name,
      slug: raw.slug,
      avatar: raw.avatar,
      title: raw.title,
      bio: raw.bio,
      twitter: raw.twitter,
      linkedin: raw.linkedin,
      organizations: raw.organizations?.map(org => ({
        id: org.id,
        name: org.name,
        slug: this.slugify(org.name),
        role: org.role,
        current: org.current,
      })) || [],
      source: 'rootdata',
      updated_at: now,
    };
  }

  private normalizeRound(raw: RootDataRound, now: Date): Record<string, any> {
    return {
      rootdata_id: raw.id,
      project_id: raw.project_id,
      project_name: raw.project_name,
      project_slug: this.slugify(raw.project_name),
      round: raw.round,
      amount: raw.amount,
      valuation: raw.valuation,
      date: raw.date ? new Date(raw.date) : null,
      date_unix: raw.date ? Math.floor(new Date(raw.date).getTime() / 1000) : null,
      investors: raw.investors?.map(inv => ({
        id: inv.id,
        name: inv.name,
        slug: this.slugify(inv.name),
        lead: inv.lead || false,
      })) || [],
      investors_count: raw.investors?.length || 0,
      source: 'rootdata',
      updated_at: now,
    };
  }

  private slugify(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // ═══════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════

  async getStats(): Promise<Record<string, number>> {
    const [projects, funds, people, rounds, links] = await Promise.all([
      this.projectsModel.countDocuments({}),
      this.fundsModel.countDocuments({}),
      this.peopleModel.countDocuments({}),
      this.roundsModel.countDocuments({}),
      this.linksModel.countDocuments({}),
    ]);

    return { projects, funds, people, rounds, links };
  }
}
