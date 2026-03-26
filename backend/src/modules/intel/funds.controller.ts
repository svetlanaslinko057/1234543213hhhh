/**
 * Funds Controller - Full API for crypto funds/VCs
 * Implements all fund-related endpoints from legacy API
 */

import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('intel/funds')
export class FundsController {
  constructor(
    @InjectModel('intel_funds') private fundsModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_persons') private personsModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // BASIC CRUD
  // ═══════════════════════════════════════════════════════════════

  @Get()
  async listFunds(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
    @Query('sort') sort: string = 'aum',
  ) {
    const sortField: Record<string, any> = {};
    sortField[sort] = -1;

    const [funds, total] = await Promise.all([
      this.fundsModel
        .find({})
        .sort(sortField)
        .skip(parseInt(offset, 10))
        .limit(parseInt(limit, 10))
        .lean(),
      this.fundsModel.countDocuments(),
    ]);

    return { ok: true, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10), funds };
  }

  @Get('stats')
  async getFundsStats() {
    const [total, byType, topByAum] = await Promise.all([
      this.fundsModel.countDocuments(),
      this.fundsModel.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 }, totalAum: { $sum: '$aum' } } },
        { $sort: { count: -1 } },
      ]),
      this.fundsModel.find({}).sort({ aum: -1 }).limit(10).lean(),
    ]);

    return {
      ok: true,
      stats: {
        total,
        byType: byType.reduce((acc, t) => ({ ...acc, [t._id || 'unknown']: { count: t.count, aum: t.totalAum } }), {}),
        topByAum: topByAum.map((f: any) => ({ name: f.name, aum: f.aum })),
      },
    };
  }

  @Get('top')
  async getTopFunds(@Query('limit') limit: string = '20', @Query('by') by: string = 'aum') {
    const sortField: Record<string, any> = {};
    sortField[by] = -1;

    const funds = await this.fundsModel.find({}).sort(sortField).limit(parseInt(limit, 10)).lean();
    return { ok: true, count: funds.length, funds };
  }

  @Get('types')
  async getFundTypes() {
    const types = await this.fundsModel.distinct('type');
    return { ok: true, types };
  }

  @Get('type/:type')
  async getFundsByType(@Param('type') type: string, @Query('limit') limit: string = '50') {
    const funds = await this.fundsModel
      .find({ type: new RegExp(type, 'i') })
      .sort({ aum: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: funds.length, funds };
  }

  @Get('search')
  async searchFunds(@Query('q') query: string, @Query('limit') limit: string = '20') {
    const regex = new RegExp(query, 'i');
    const funds = await this.fundsModel
      .find({ $or: [{ name: regex }, { slug: regex }, { description: regex }] })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: funds.length, funds };
  }

  // ═══════════════════════════════════════════════════════════════
  // SINGLE FUND
  // ═══════════════════════════════════════════════════════════════

  @Get(':slug')
  async getFund(@Param('slug') slug: string) {
    const fund = await this.fundsModel.findOne({
      $or: [{ slug }, { name: new RegExp(`^${slug}$`, 'i') }],
    }).lean();
    
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }
    return { ok: true, fund };
  }

  @Get(':slug/portfolio')
  async getFundPortfolio(@Param('slug') slug: string) {
    const fund = await this.fundsModel.findOne({ slug }).lean();
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }

    const investments = await this.fundraisingModel
      .find({ investors: (fund as any).name })
      .sort({ date: -1 })
      .lean();

    // Group by project
    const projects: Record<string, any> = {};
    for (const inv of investments) {
      const i = inv as any;
      if (!projects[i.project_slug]) {
        projects[i.project_slug] = {
          name: i.project_name || i.project_slug,
          slug: i.project_slug,
          rounds: [],
          totalInvested: 0,
        };
      }
      projects[i.project_slug].rounds.push(i);
      projects[i.project_slug].totalInvested += i.amount || 0;
    }

    return {
      ok: true,
      fund: (fund as any).name,
      totalInvestments: investments.length,
      uniqueProjects: Object.keys(projects).length,
      portfolio: Object.values(projects),
    };
  }

  @Get(':slug/coinvestors')
  async getFundCoinvestors(@Param('slug') slug: string) {
    const fund = await this.fundsModel.findOne({ slug }).lean();
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }

    const investments = await this.fundraisingModel
      .find({ investors: (fund as any).name })
      .lean();

    const coInvestors: Record<string, number> = {};
    for (const inv of investments) {
      for (const name of ((inv as any).investors || [])) {
        if (name !== (fund as any).name) {
          coInvestors[name] = (coInvestors[name] || 0) + 1;
        }
      }
    }

    const sorted = Object.entries(coInvestors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name, count]) => ({ name, count }));

    return { ok: true, fund: (fund as any).name, total: sorted.length, coinvestors: sorted };
  }

  @Get(':slug/team')
  async getFundTeam(@Param('slug') slug: string) {
    const fund = await this.fundsModel.findOne({ slug }).lean();
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }

    // Try to find team members
    const persons = await this.personsModel
      .find({ fund: (fund as any).name })
      .lean();

    return { ok: true, fund: (fund as any).name, team: persons };
  }

  @Get(':slug/activity')
  async getFundActivity(@Param('slug') slug: string, @Query('days') days: string = '90') {
    const fund = await this.fundsModel.findOne({ slug }).lean();
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));

    const recentInvestments = await this.fundraisingModel
      .find({ investors: (fund as any).name, date: { $gte: since } })
      .sort({ date: -1 })
      .lean();

    return {
      ok: true,
      fund: (fund as any).name,
      period: `${days} days`,
      investments: recentInvestments.length,
      activity: recentInvestments,
    };
  }

  @Get(':slug/stages')
  async getFundStageDistribution(@Param('slug') slug: string) {
    const fund = await this.fundsModel.findOne({ slug }).lean();
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }

    const investments = await this.fundraisingModel
      .find({ investors: (fund as any).name })
      .lean();

    const stages: Record<string, number> = {};
    for (const inv of investments) {
      const stage = (inv as any).stage || 'unknown';
      stages[stage] = (stages[stage] || 0) + 1;
    }

    return { ok: true, fund: (fund as any).name, stages };
  }

  @Get(':slug/categories')
  async getFundCategoryDistribution(@Param('slug') slug: string) {
    const fund = await this.fundsModel.findOne({ slug }).lean();
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }

    const investments = await this.fundraisingModel
      .find({ investors: (fund as any).name })
      .lean();

    const categories: Record<string, number> = {};
    for (const inv of investments) {
      const cat = (inv as any).category || 'unknown';
      categories[cat] = (categories[cat] || 0) + 1;
    }

    return { ok: true, fund: (fund as any).name, categories };
  }

  // ═══════════════════════════════════════════════════════════════
  // RANKINGS & ANALYTICS
  // ═══════════════════════════════════════════════════════════════

  @Get('rankings/aum')
  async getRankingsByAum(@Query('limit') limit: string = '50') {
    const funds = await this.fundsModel
      .find({ aum: { $exists: true, $gt: 0 } })
      .sort({ aum: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    return {
      ok: true,
      rankings: funds.map((f: any, i: number) => ({
        rank: i + 1,
        name: f.name,
        slug: f.slug,
        aum: f.aum,
        type: f.type,
      })),
    };
  }

  @Get('rankings/activity')
  async getRankingsByActivity(@Query('days') days: string = '30') {
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));

    const pipeline = await this.fundraisingModel.aggregate([
      { $match: { date: { $gte: since } } },
      { $unwind: '$investors' },
      { $group: { _id: '$investors', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);

    return {
      ok: true,
      period: `${days} days`,
      rankings: pipeline.map((p, i) => ({ rank: i + 1, name: p._id, investments: p.count })),
    };
  }

  @Get('analytics/trends')
  async getFundTrends() {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const lastQuarter = new Date();
    lastQuarter.setMonth(lastQuarter.getMonth() - 3);

    const [thisMonth, lastMonthData, thisQuarter] = await Promise.all([
      this.fundraisingModel.countDocuments({ date: { $gte: lastMonth } }),
      this.fundraisingModel.countDocuments({
        date: { $gte: lastQuarter, $lt: lastMonth },
      }),
      this.fundraisingModel.aggregate([
        { $match: { date: { $gte: lastQuarter } } },
        { $unwind: '$investors' },
        { $group: { _id: '$investors', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return {
      ok: true,
      trends: {
        thisMonthDeals: thisMonth,
        lastMonthDeals: lastMonthData,
        topActiveInvestors: thisQuarter,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPARISONS
  // ═══════════════════════════════════════════════════════════════

  @Get('compare')
  async compareFunds(@Query('funds') fundsParam: string) {
    const fundSlugs = fundsParam.split(',').map((s) => s.trim());

    const funds = await this.fundsModel
      .find({ slug: { $in: fundSlugs } })
      .lean();

    const comparison = await Promise.all(
      funds.map(async (fund: any) => {
        const investments = await this.fundraisingModel
          .find({ investors: fund.name })
          .lean();

        return {
          name: fund.name,
          slug: fund.slug,
          aum: fund.aum,
          type: fund.type,
          totalInvestments: investments.length,
          totalAmount: investments.reduce((sum, i: any) => sum + (i.amount || 0), 0),
        };
      })
    );

    return { ok: true, comparison };
  }
}
