/**
 * Projects Controller - Full API for crypto projects
 */

import { Controller, Get, Query, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('intel/projects')
export class ProjectsController {
  constructor(
    @InjectModel('intel_projects') private projectsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // BASIC CRUD
  // ═══════════════════════════════════════════════════════════════

  @Get()
  async listProjects(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
    @Query('sort') sort: string = 'name',
  ) {
    const sortField: Record<string, any> = {};
    sortField[sort] = sort === 'name' ? 1 : -1;

    const [projects, total] = await Promise.all([
      this.projectsModel
        .find({})
        .sort(sortField)
        .skip(parseInt(offset, 10))
        .limit(parseInt(limit, 10))
        .lean(),
      this.projectsModel.countDocuments(),
    ]);

    return { ok: true, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10), projects };
  }

  @Get('stats')
  async getProjectsStats() {
    const [total, byCategory, recentlyFunded] = await Promise.all([
      this.projectsModel.countDocuments(),
      this.projectsModel.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      this.fundraisingModel.countDocuments({
        date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    return {
      ok: true,
      stats: { total, byCategory, recentlyFundedCount: recentlyFunded },
    };
  }

  @Get('search')
  async searchProjects(@Query('q') query: string, @Query('limit') limit: string = '20') {
    const regex = new RegExp(query, 'i');
    const projects = await this.projectsModel
      .find({ $or: [{ name: regex }, { symbol: regex }, { slug: regex }, { description: regex }] })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: projects.length, projects };
  }

  @Get('trending')
  async getTrendingProjects(@Query('limit') limit: string = '20') {
    // Projects with recent funding activity
    const recentRounds = await this.fundraisingModel
      .find({ date: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } })
      .sort({ amount: -1 })
      .lean();

    const projectSlugs = [...new Set(recentRounds.map((r: any) => r.project_slug))];
    const projects = await this.projectsModel
      .find({ slug: { $in: projectSlugs } })
      .limit(parseInt(limit, 10))
      .lean();

    return { ok: true, count: projects.length, projects };
  }

  @Get('categories')
  async getCategories() {
    const categories = await this.projectsModel.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return { ok: true, categories };
  }

  @Get('category/:category')
  async getProjectsByCategory(
    @Param('category') category: string,
    @Query('limit') limit: string = '50',
  ) {
    const projects = await this.projectsModel
      .find({ category: new RegExp(category, 'i') })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, category, count: projects.length, projects };
  }

  // ═══════════════════════════════════════════════════════════════
  // SINGLE PROJECT
  // ═══════════════════════════════════════════════════════════════

  @Get(':slug')
  async getProject(@Param('slug') slug: string) {
    const project = await this.projectsModel.findOne({ slug }).lean();
    if (!project) {
      return { ok: false, error: 'Project not found' };
    }
    return { ok: true, project };
  }

  @Get(':slug/full')
  async getProjectFull(@Param('slug') slug: string) {
    const [project, funding, unlocks] = await Promise.all([
      this.projectsModel.findOne({ slug }).lean(),
      this.fundraisingModel.find({ project_slug: slug }).sort({ date: -1 }).lean(),
      this.unlocksModel.find({ project_slug: slug }).sort({ unlock_date: 1 }).lean(),
    ]);

    if (!project) {
      return { ok: false, error: 'Project not found' };
    }

    // Get unique investors
    const investorNames = [...new Set(funding.flatMap((r: any) => r.investors || []))];

    return {
      ok: true,
      project,
      funding: {
        total_rounds: funding.length,
        total_raised: funding.reduce((sum, r: any) => sum + (r.amount || 0), 0),
        rounds: funding,
      },
      unlocks: {
        total: unlocks.length,
        upcoming: unlocks.filter((u: any) => new Date(u.unlock_date) > new Date()).length,
        unlocks,
      },
      investors: {
        total: investorNames.length,
        names: investorNames,
      },
    };
  }

  @Get(':slug/investors')
  async getProjectInvestors(@Param('slug') slug: string) {
    const funding = await this.fundraisingModel.find({ project_slug: slug }).lean();
    
    const investorCounts: Record<string, { rounds: number; totalInvested: number }> = {};
    for (const round of funding) {
      const r = round as any;
      for (const name of (r.investors || [])) {
        if (!investorCounts[name]) {
          investorCounts[name] = { rounds: 0, totalInvested: 0 };
        }
        investorCounts[name].rounds++;
        investorCounts[name].totalInvested += (r.amount || 0) / (r.investors?.length || 1);
      }
    }

    const investors = Object.entries(investorCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.rounds - a.rounds);

    return { ok: true, project: slug, total: investors.length, investors };
  }

  @Get(':slug/funding')
  async getProjectFunding(@Param('slug') slug: string) {
    const rounds = await this.fundraisingModel
      .find({ project_slug: slug })
      .sort({ date: -1 })
      .lean();

    const totalRaised = rounds.reduce((sum, r: any) => sum + (r.amount || 0), 0);
    const stages: Record<string, number> = {};
    for (const r of rounds) {
      const stage = (r as any).stage || 'unknown';
      stages[stage] = (stages[stage] || 0) + 1;
    }

    return {
      ok: true,
      project: slug,
      summary: { total_rounds: rounds.length, total_raised: totalRaised, stages },
      rounds,
    };
  }

  @Get(':slug/unlocks')
  async getProjectUnlocks(@Param('slug') slug: string) {
    const unlocks = await this.unlocksModel
      .find({ project_slug: slug })
      .sort({ unlock_date: 1 })
      .lean();

    const now = new Date();
    const upcoming = unlocks.filter((u: any) => new Date(u.unlock_date) > now);
    const past = unlocks.filter((u: any) => new Date(u.unlock_date) <= now);

    return {
      ok: true,
      project: slug,
      summary: { total: unlocks.length, upcoming: upcoming.length, past: past.length },
      upcoming,
      past,
    };
  }

  @Get(':slug/similar')
  async getSimilarProjects(@Param('slug') slug: string, @Query('limit') limit: string = '10') {
    const project = await this.projectsModel.findOne({ slug }).lean();
    if (!project) {
      return { ok: false, error: 'Project not found' };
    }

    // Find projects in same category
    const similar = await this.projectsModel
      .find({ category: (project as any).category, slug: { $ne: slug } })
      .limit(parseInt(limit, 10))
      .lean();

    return { ok: true, project: slug, category: (project as any).category, similar };
  }

  @Get(':slug/competitors')
  async getProjectCompetitors(@Param('slug') slug: string) {
    const project = await this.projectsModel.findOne({ slug }).lean();
    if (!project) {
      return { ok: false, error: 'Project not found' };
    }

    // Find projects with same investors
    const funding = await this.fundraisingModel.find({ project_slug: slug }).lean();
    const investors = [...new Set(funding.flatMap((r: any) => r.investors || []))];

    const competitorFunding = await this.fundraisingModel
      .find({ investors: { $in: investors }, project_slug: { $ne: slug } })
      .lean();

    const competitorCounts: Record<string, number> = {};
    for (const r of competitorFunding) {
      const projectSlug = (r as any).project_slug;
      competitorCounts[projectSlug] = (competitorCounts[projectSlug] || 0) + 1;
    }

    const competitors = Object.entries(competitorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([slug, sharedInvestors]) => ({ slug, sharedInvestors }));

    return { ok: true, project: slug, competitors };
  }

  // ═══════════════════════════════════════════════════════════════
  // RANKINGS
  // ═══════════════════════════════════════════════════════════════

  @Get('rankings/most-funded')
  async getMostFundedProjects(@Query('limit') limit: string = '20') {
    const pipeline = await this.fundraisingModel.aggregate([
      { $group: { _id: '$project_slug', totalRaised: { $sum: '$amount' }, rounds: { $sum: 1 } } },
      { $sort: { totalRaised: -1 } },
      { $limit: parseInt(limit, 10) },
    ]);

    return {
      ok: true,
      rankings: pipeline.map((p, i) => ({
        rank: i + 1,
        slug: p._id,
        totalRaised: p.totalRaised,
        rounds: p.rounds,
      })),
    };
  }

  @Get('rankings/most-investors')
  async getMostInvestorsProjects(@Query('limit') limit: string = '20') {
    const pipeline = await this.fundraisingModel.aggregate([
      { $unwind: '$investors' },
      { $group: { _id: '$project_slug', uniqueInvestors: { $addToSet: '$investors' } } },
      { $project: { _id: 1, investorCount: { $size: '$uniqueInvestors' } } },
      { $sort: { investorCount: -1 } },
      { $limit: parseInt(limit, 10) },
    ]);

    return {
      ok: true,
      rankings: pipeline.map((p, i) => ({
        rank: i + 1,
        slug: p._id,
        investorCount: p.investorCount,
      })),
    };
  }

  @Get('rankings/upcoming-unlocks')
  async getProjectsWithUpcomingUnlocks(@Query('days') days: string = '30') {
    const future = new Date();
    future.setDate(future.getDate() + parseInt(days, 10));

    const pipeline = await this.unlocksModel.aggregate([
      { $match: { unlock_date: { $gte: new Date(), $lte: future } } },
      { $group: { _id: '$project_slug', unlockCount: { $sum: 1 }, totalValue: { $sum: '$value_usd' } } },
      { $sort: { totalValue: -1 } },
      { $limit: 20 },
    ]);

    return {
      ok: true,
      period: `${days} days`,
      rankings: pipeline.map((p, i) => ({
        rank: i + 1,
        slug: p._id,
        unlockCount: p.unlockCount,
        totalValue: p.totalValue,
      })),
    };
  }
}
