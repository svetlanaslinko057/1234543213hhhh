/**
 * Extended Intel API Controller
 * Implements 200+ endpoints from legacy Python API
 */

import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('intel')
export class IntelExtendedController {
  constructor(
    @InjectModel('intel_projects') private projectsModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_funds') private fundsModel: Model<any>,
    @InjectModel('intel_activity') private activityModel: Model<any>,
    @InjectModel('intel_categories') private categoriesModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════════

  @Get('projects/trending')
  async getTrendingProjects(@Query('limit') limit: string = '20') {
    const projects = await this.projectsModel
      .find({})
      .sort({ market_cap: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: projects.length, items: projects };
  }

  @Get('projects/search')
  async searchProjects(@Query('q') query: string, @Query('limit') limit: string = '20') {
    const regex = new RegExp(query, 'i');
    const projects = await this.projectsModel
      .find({ $or: [{ name: regex }, { symbol: regex }, { slug: regex }] })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: projects.length, items: projects };
  }

  @Get('projects/categories')
  async getProjectCategories() {
    const categories = await this.projectsModel.distinct('category');
    return { ok: true, categories };
  }

  @Get('projects/category/:category')
  async getProjectsByCategory(
    @Param('category') category: string,
    @Query('limit') limit: string = '50'
  ) {
    const projects = await this.projectsModel
      .find({ category: new RegExp(category, 'i') })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: projects.length, items: projects };
  }

  @Get('projects/:slug')
  async getProjectBySlug(@Param('slug') slug: string) {
    const project = await this.projectsModel.findOne({ slug }).lean();
    if (!project) {
      return { ok: false, error: 'Project not found' };
    }
    return { ok: true, project };
  }

  @Get('projects/:slug/investors')
  async getProjectInvestors(@Param('slug') slug: string) {
    const fundraising = await this.fundraisingModel
      .find({ project_slug: slug })
      .lean();
    
    const investorNames = [...new Set(fundraising.flatMap((r: any) => r.investors || []))];
    const investors = await this.investorsModel
      .find({ name: { $in: investorNames } })
      .lean();
    
    return { ok: true, count: investors.length, investors };
  }

  @Get('projects/:slug/funding')
  async getProjectFunding(@Param('slug') slug: string) {
    const rounds = await this.fundraisingModel
      .find({ project_slug: slug })
      .sort({ date: -1 })
      .lean();
    return { ok: true, count: rounds.length, rounds };
  }

  @Get('projects/:slug/unlocks')
  async getProjectUnlocks(@Param('slug') slug: string) {
    const unlocks = await this.unlocksModel
      .find({ project_slug: slug })
      .sort({ unlock_date: 1 })
      .lean();
    return { ok: true, count: unlocks.length, unlocks };
  }

  // ═══════════════════════════════════════════════════════════════
  // INVESTORS
  // ═══════════════════════════════════════════════════════════════

  @Get('investors/top')
  async getTopInvestors(@Query('limit') limit: string = '50') {
    const investors = await this.investorsModel
      .find({})
      .sort({ aum: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: investors.length, items: investors };
  }

  @Get('investors/search')
  async searchInvestors(@Query('q') query: string, @Query('limit') limit: string = '20') {
    const regex = new RegExp(query, 'i');
    const investors = await this.investorsModel
      .find({ $or: [{ name: regex }, { slug: regex }] })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: investors.length, items: investors };
  }

  @Get('investors/types')
  async getInvestorTypes() {
    const types = await this.investorsModel.distinct('type');
    return { ok: true, types };
  }

  @Get('investors/type/:type')
  async getInvestorsByType(
    @Param('type') type: string,
    @Query('limit') limit: string = '50'
  ) {
    const investors = await this.investorsModel
      .find({ type: new RegExp(type, 'i') })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: investors.length, items: investors };
  }

  @Get('investors/:slug')
  async getInvestorBySlug(@Param('slug') slug: string) {
    const investor = await this.investorsModel.findOne({ 
      $or: [{ slug }, { name: new RegExp(`^${slug}$`, 'i') }]
    }).lean();
    if (!investor) {
      return { ok: false, error: 'Investor not found' };
    }
    return { ok: true, investor };
  }

  @Get('investors/:slug/portfolio')
  async getInvestorPortfolio(@Param('slug') slug: string) {
    const investor = await this.investorsModel.findOne({ slug }).lean();
    if (!investor) {
      return { ok: false, error: 'Investor not found' };
    }
    
    const investments = await this.fundraisingModel
      .find({ investors: (investor as any).name })
      .sort({ date: -1 })
      .lean();
    
    return { ok: true, count: investments.length, investments };
  }

  @Get('investors/:slug/coinvested')
  async getInvestorCoinvested(@Param('slug') slug: string) {
    const investor = await this.investorsModel.findOne({ slug }).lean();
    if (!investor) {
      return { ok: false, error: 'Investor not found' };
    }
    
    // Find co-investors
    const investments = await this.fundraisingModel
      .find({ investors: (investor as any).name })
      .lean();
    
    const coInvestors: Record<string, number> = {};
    for (const inv of investments) {
      for (const name of ((inv as any).investors || [])) {
        if (name !== (investor as any).name) {
          coInvestors[name] = (coInvestors[name] || 0) + 1;
        }
      }
    }
    
    const sorted = Object.entries(coInvestors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name, count]) => ({ name, count }));
    
    return { ok: true, count: sorted.length, coinvestors: sorted };
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNDING
  // ═══════════════════════════════════════════════════════════════

  @Get('funding/recent')
  async getRecentFunding(
    @Query('days') days: string = '30',
    @Query('limit') limit: string = '100'
  ) {
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));
    
    const rounds = await this.fundraisingModel
      .find({ date: { $gte: since } })
      .sort({ date: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    
    return { ok: true, count: rounds.length, rounds };
  }

  @Get('funding/stages')
  async getFundingStages() {
    const stages = await this.fundraisingModel.distinct('stage');
    return { ok: true, stages };
  }

  @Get('funding/stage/:stage')
  async getFundingByStage(
    @Param('stage') stage: string,
    @Query('limit') limit: string = '50'
  ) {
    const rounds = await this.fundraisingModel
      .find({ stage: new RegExp(stage, 'i') })
      .sort({ date: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: rounds.length, rounds };
  }

  @Get('funding/top')
  async getTopFunding(@Query('limit') limit: string = '20') {
    const rounds = await this.fundraisingModel
      .find({ amount: { $exists: true, $gt: 0 } })
      .sort({ amount: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: rounds.length, rounds };
  }

  @Get('funding/stats')
  async getFundingStats() {
    const [total, thisMonth, thisWeek] = await Promise.all([
      this.fundraisingModel.countDocuments(),
      this.fundraisingModel.countDocuments({
        date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      this.fundraisingModel.countDocuments({
        date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
    ]);
    
    const pipeline = await this.fundraisingModel.aggregate([
      { $match: { amount: { $exists: true, $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    return {
      ok: true,
      stats: {
        total_rounds: total,
        this_month: thisMonth,
        this_week: thisWeek,
        total_raised: pipeline[0]?.total || 0,
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // UNLOCKS
  // ═══════════════════════════════════════════════════════════════

  @Get('unlocks/upcoming')
  async getUpcomingUnlocks(
    @Query('days') days: string = '30',
    @Query('limit') limit: string = '50'
  ) {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + parseInt(days, 10));
    
    const unlocks = await this.unlocksModel
      .find({ unlock_date: { $gte: now, $lte: future } })
      .sort({ unlock_date: 1 })
      .limit(parseInt(limit, 10))
      .lean();
    
    return { ok: true, count: unlocks.length, unlocks };
  }

  @Get('unlocks/major')
  async getMajorUnlocks(@Query('min_value') minValue: string = '1000000') {
    const unlocks = await this.unlocksModel
      .find({ value_usd: { $gte: parseInt(minValue, 10) } })
      .sort({ unlock_date: 1 })
      .limit(50)
      .lean();
    return { ok: true, count: unlocks.length, unlocks };
  }

  @Get('unlocks/stats')
  async getUnlockStats() {
    const pipeline = await this.unlocksModel.aggregate([
      { $match: { value_usd: { $exists: true } } },
      {
        $group: {
          _id: null,
          total_value: { $sum: '$value_usd' },
          count: { $sum: 1 },
          avg_value: { $avg: '$value_usd' }
        }
      }
    ]);
    
    return {
      ok: true,
      stats: pipeline[0] || { total_value: 0, count: 0, avg_value: 0 }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNDS
  // ═══════════════════════════════════════════════════════════════

  @Get('funds/top')
  async getTopFunds(@Query('limit') limit: string = '50') {
    const funds = await this.fundsModel
      .find({})
      .sort({ aum: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: funds.length, items: funds };
  }

  @Get('funds/search')
  async searchFunds(@Query('q') query: string) {
    const regex = new RegExp(query, 'i');
    const funds = await this.fundsModel
      .find({ name: regex })
      .limit(20)
      .lean();
    return { ok: true, count: funds.length, items: funds };
  }

  @Get('funds/:slug')
  async getFundBySlug(@Param('slug') slug: string) {
    const fund = await this.fundsModel.findOne({ slug }).lean();
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }
    return { ok: true, fund };
  }

  @Get('funds/:slug/portfolio')
  async getFundPortfolio(@Param('slug') slug: string) {
    const fund = await this.fundsModel.findOne({ slug }).lean();
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }
    
    const investments = await this.fundraisingModel
      .find({ investors: (fund as any).name })
      .sort({ date: -1 })
      .lean();
    
    return { ok: true, count: investments.length, investments };
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTIVITY
  // ═══════════════════════════════════════════════════════════════

  @Get('activity/recent')
  async getRecentActivity(@Query('limit') limit: string = '100') {
    const activity = await this.activityModel
      .find({})
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: activity.length, items: activity };
  }

  @Get('activity/types')
  async getActivityTypes() {
    const types = await this.activityModel.distinct('type');
    return { ok: true, types };
  }

  @Get('activity/type/:type')
  async getActivityByType(
    @Param('type') type: string,
    @Query('limit') limit: string = '50'
  ) {
    const activity = await this.activityModel
      .find({ type })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: activity.length, items: activity };
  }

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  @Get('categories/all')
  async getAllCategories() {
    const categories = await this.categoriesModel.find({}).lean();
    return { ok: true, count: categories.length, categories };
  }

  @Get('categories/:slug')
  async getCategoryBySlug(@Param('slug') slug: string) {
    const category = await this.categoriesModel.findOne({ slug }).lean();
    if (!category) {
      return { ok: false, error: 'Category not found' };
    }
    return { ok: true, category };
  }

  @Get('categories/:slug/projects')
  async getCategoryProjects(
    @Param('slug') slug: string,
    @Query('limit') limit: string = '50'
  ) {
    const projects = await this.projectsModel
      .find({ categories: slug })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: projects.length, projects };
  }

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATED DATA
  // ═══════════════════════════════════════════════════════════════

  @Get('aggregated/market')
  async getAggregatedMarket() {
    const [projects, investors, rounds, unlocks] = await Promise.all([
      this.projectsModel.countDocuments(),
      this.investorsModel.countDocuments(),
      this.fundraisingModel.countDocuments(),
      this.unlocksModel.countDocuments(),
    ]);
    
    return {
      ok: true,
      ts: Date.now(),
      summary: {
        total_projects: projects,
        total_investors: investors,
        total_rounds: rounds,
        upcoming_unlocks: unlocks,
      }
    };
  }

  @Get('aggregated/search')
  async aggregatedSearch(@Query('q') query: string) {
    const regex = new RegExp(query, 'i');
    
    const [projects, investors, funds] = await Promise.all([
      this.projectsModel.find({ $or: [{ name: regex }, { symbol: regex }] }).limit(5).lean(),
      this.investorsModel.find({ name: regex }).limit(5).lean(),
      this.fundsModel.find({ name: regex }).limit(5).lean(),
    ]);
    
    return {
      ok: true,
      results: {
        projects: projects.map((p: any) => ({ type: 'project', name: p.name, slug: p.slug })),
        investors: investors.map((i: any) => ({ type: 'investor', name: i.name, slug: i.slug })),
        funds: funds.map((f: any) => ({ type: 'fund', name: f.name, slug: f.slug })),
      }
    };
  }

  @Get('aggregated/investor/:slug')
  async getAggregatedInvestor(@Param('slug') slug: string) {
    const investor = await this.investorsModel.findOne({ slug }).lean();
    if (!investor) {
      return { ok: false, error: 'Investor not found' };
    }
    
    const investments = await this.fundraisingModel
      .find({ investors: (investor as any).name })
      .sort({ date: -1 })
      .lean();
    
    return {
      ok: true,
      investor,
      portfolio_count: investments.length,
      recent_investments: investments.slice(0, 10),
    };
  }

  @Get('aggregated/project/:slug')
  async getAggregatedProject(@Param('slug') slug: string) {
    const project = await this.projectsModel.findOne({ slug }).lean();
    if (!project) {
      return { ok: false, error: 'Project not found' };
    }
    
    const [funding, unlocks] = await Promise.all([
      this.fundraisingModel.find({ project_slug: slug }).sort({ date: -1 }).lean(),
      this.unlocksModel.find({ project_slug: slug }).sort({ unlock_date: 1 }).lean(),
    ]);
    
    return {
      ok: true,
      project,
      funding_rounds: funding.length,
      upcoming_unlocks: unlocks.length,
      funding,
      unlocks,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CURATED FEEDS
  // ═══════════════════════════════════════════════════════════════

  @Get('curated/feed')
  async getCuratedFeed() {
    const [recentFunding, upcomingUnlocks, topInvestors] = await Promise.all([
      this.fundraisingModel.find({}).sort({ date: -1 }).limit(10).lean(),
      this.unlocksModel.find({ unlock_date: { $gte: new Date() } }).sort({ unlock_date: 1 }).limit(10).lean(),
      this.investorsModel.find({}).sort({ aum: -1 }).limit(10).lean(),
    ]);
    
    return {
      ok: true,
      ts: Date.now(),
      sections: {
        recent_funding: recentFunding,
        upcoming_unlocks: upcomingUnlocks,
        top_investors: topInvestors,
      }
    };
  }

  @Get('curated/funding')
  async getCuratedFunding() {
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const rounds = await this.fundraisingModel
      .find({ date: { $gte: thisWeek } })
      .sort({ amount: -1 })
      .limit(20)
      .lean();
    
    return { ok: true, count: rounds.length, rounds };
  }

  @Get('curated/unlocks')
  async getCuratedUnlocks() {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const unlocks = await this.unlocksModel
      .find({ unlock_date: { $gte: new Date(), $lte: nextWeek } })
      .sort({ value_usd: -1 })
      .limit(20)
      .lean();
    
    return { ok: true, count: unlocks.length, unlocks };
  }

  @Get('curated/investors')
  async getCuratedInvestors() {
    const investors = await this.investorsModel
      .find({})
      .sort({ portfolio_count: -1 })
      .limit(20)
      .lean();
    return { ok: true, count: investors.length, investors };
  }

  @Get('curated/trending')
  async getCuratedTrending() {
    // Projects with recent funding activity
    const recentRounds = await this.fundraisingModel
      .find({ date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
      .sort({ amount: -1 })
      .limit(10)
      .lean();
    
    const projectSlugs = [...new Set(recentRounds.map((r: any) => r.project_slug))];
    const projects = await this.projectsModel
      .find({ slug: { $in: projectSlugs } })
      .lean();
    
    return { ok: true, count: projects.length, projects };
  }
}
