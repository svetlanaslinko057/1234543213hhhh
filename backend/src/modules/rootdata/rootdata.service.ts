/**
 * RootData Service
 * 
 * High-level service for RootData queries
 * Links to canonical entities for graph building
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RootDataClient } from './rootdata.client';

@Injectable()
export class RootDataService {
  private readonly logger = new Logger(RootDataService.name);

  constructor(
    private readonly client: RootDataClient,
    @InjectModel('rootdata_projects') private projectsModel: Model<any>,
    @InjectModel('rootdata_funds') private fundsModel: Model<any>,
    @InjectModel('rootdata_people') private peopleModel: Model<any>,
    @InjectModel('rootdata_rounds') private roundsModel: Model<any>,
    @InjectModel('rootdata_links') private linksModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════

  async getProjects(limit = 50, skip = 0): Promise<any[]> {
    return this.projectsModel
      .find({})
      .sort({ total_funding: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async getProjectBySlug(slug: string): Promise<any | null> {
    return this.projectsModel.findOne({ slug }).lean();
  }

  async getFunds(limit = 50, skip = 0): Promise<any[]> {
    return this.fundsModel
      .find({})
      .sort({ portfolio_count: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async getFundBySlug(slug: string): Promise<any | null> {
    return this.fundsModel.findOne({ slug }).lean();
  }

  async getPeople(limit = 50, skip = 0): Promise<any[]> {
    return this.peopleModel
      .find({})
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async getPersonBySlug(slug: string): Promise<any | null> {
    return this.peopleModel.findOne({ slug }).lean();
  }

  async getRounds(limit = 50, skip = 0): Promise<any[]> {
    return this.roundsModel
      .find({})
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  // ═══════════════════════════════════════════════════════════════
  // GRAPH LINKS
  // ═══════════════════════════════════════════════════════════════

  async getLinksForEntity(entityType: string, entityId: string): Promise<any[]> {
    return this.linksModel
      .find({
        $or: [
          { from_type: entityType, from_id: entityId },
          { to_type: entityType, to_id: entityId },
        ],
      })
      .lean();
  }

  async getInvestmentsForFund(fundSlug: string): Promise<any[]> {
    return this.linksModel
      .find({
        type: 'invested_in',
        from_id: fundSlug,
      })
      .lean();
  }

  async getInvestorsForProject(projectSlug: string): Promise<any[]> {
    return this.linksModel
      .find({
        type: 'invested_in',
        to_id: projectSlug,
      })
      .lean();
  }

  async getTeamForProject(projectSlug: string): Promise<any[]> {
    return this.linksModel
      .find({
        type: { $in: ['works_at', 'founded'] },
        to_id: projectSlug,
      })
      .lean();
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT FOR GRAPH BUILDER
  // ═══════════════════════════════════════════════════════════════

  async exportForGraph(): Promise<{
    funds: any[];
    projects: any[];
    people: any[];
    links: any[];
  }> {
    const [funds, projects, people, links] = await Promise.all([
      this.fundsModel.find({}).lean(),
      this.projectsModel.find({}).lean(),
      this.peopleModel.find({}).lean(),
      this.linksModel.find({}).lean(),
    ]);

    return { funds, projects, people, links };
  }

  // ═══════════════════════════════════════════════════════════════
  // HEALTH
  // ═══════════════════════════════════════════════════════════════

  async healthCheck(): Promise<{ ok: boolean; api: any; db: any }> {
    const apiHealth = await this.client.healthCheck();
    
    const dbCounts = await Promise.all([
      this.projectsModel.countDocuments({}),
      this.fundsModel.countDocuments({}),
      this.peopleModel.countDocuments({}),
    ]);

    return {
      ok: apiHealth.ok && dbCounts.every(c => c >= 0),
      api: apiHealth,
      db: {
        projects: dbCounts[0],
        funds: dbCounts[1],
        people: dbCounts[2],
      },
    };
  }
}
