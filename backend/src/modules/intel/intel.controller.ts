import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('intel')
export class IntelController {
  constructor(
    @InjectModel('intel_projects') private projectsModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_funds') private fundsModel: Model<any>,
    @InjectModel('intel_activity') private activityModel: Model<any>,
    @InjectModel('intel_categories') private categoriesModel: Model<any>,
  ) {}

  @Get('stats')
  async getStats() {
    const [
      projects,
      investors,
      unlocks,
      fundraising,
      funds,
      activity,
      categories,
    ] = await Promise.all([
      this.projectsModel.countDocuments(),
      this.investorsModel.countDocuments(),
      this.unlocksModel.countDocuments(),
      this.fundraisingModel.countDocuments(),
      this.fundsModel.countDocuments(),
      this.activityModel.countDocuments(),
      this.categoriesModel.countDocuments(),
    ]);

    return {
      ts: Date.now(),
      collections: {
        projects,
        investors,
        unlocks,
        fundraising,
        funds,
        activity,
        categories,
      },
    };
  }

  @Get('projects')
  async getProjects() {
    const projects = await this.projectsModel
      .find({})
      .sort({ market_cap_rank: 1 })
      .limit(100)
      .lean();
    return {
      ok: true,
      count: projects.length,
      data: projects.map(p => ({ ...p, _id: undefined })),
    };
  }

  @Get('investors')
  async getInvestors() {
    const investors = await this.investorsModel
      .find({})
      .sort({ tier: 1, investments_count: -1 })
      .limit(100)
      .lean();
    return {
      ok: true,
      count: investors.length,
      data: investors.map(i => ({ ...i, _id: undefined })),
    };
  }

  @Get('unlocks')
  async getUnlocks() {
    const unlocks = await this.unlocksModel
      .find({})
      .sort({ unlock_date: 1 })
      .limit(100)
      .lean();
    return {
      ok: true,
      count: unlocks.length,
      data: unlocks.map(u => ({ ...u, _id: undefined })),
    };
  }

  @Get('fundraising')
  async getFundraising() {
    const fundraising = await this.fundraisingModel
      .find({})
      .sort({ date: -1 })
      .limit(100)
      .lean();
    return {
      ok: true,
      count: fundraising.length,
      data: fundraising.map(f => ({ ...f, _id: undefined })),
    };
  }

  @Get('funds')
  async getFunds() {
    const funds = await this.fundsModel
      .find({})
      .sort({ tier: 1 })
      .limit(100)
      .lean();
    return {
      ok: true,
      count: funds.length,
      data: funds.map(f => ({ ...f, _id: undefined })),
    };
  }
}
