/**
 * Persons Controller - Full API for crypto industry persons
 * Fund managers, founders, executives
 */

import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('intel/persons')
export class PersonsController {
  constructor(
    @InjectModel('intel_persons') private personsModel: Model<any>,
    @InjectModel('intel_funds') private fundsModel: Model<any>,
    @InjectModel('intel_projects') private projectsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // BASIC CRUD
  // ═══════════════════════════════════════════════════════════════

  @Get()
  async listPersons(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    const [persons, total] = await Promise.all([
      this.personsModel
        .find({})
        .skip(parseInt(offset, 10))
        .limit(parseInt(limit, 10))
        .lean(),
      this.personsModel.countDocuments(),
    ]);

    return { ok: true, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10), persons };
  }

  @Get('stats')
  async getPersonsStats() {
    const [total, byRole, byFund] = await Promise.all([
      this.personsModel.countDocuments(),
      this.personsModel.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.personsModel.aggregate([
        { $match: { fund: { $exists: true, $ne: null } } },
        { $group: { _id: '$fund', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

    return {
      ok: true,
      stats: {
        total,
        byRole,
        topFundsByTeamSize: byFund,
      },
    };
  }

  @Get('search')
  async searchPersons(@Query('q') query: string, @Query('limit') limit: string = '20') {
    const regex = new RegExp(query, 'i');
    const persons = await this.personsModel
      .find({ $or: [{ name: regex }, { fund: regex }, { role: regex }] })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: persons.length, persons };
  }

  @Get('roles')
  async getPersonRoles() {
    const roles = await this.personsModel.distinct('role');
    return { ok: true, roles };
  }

  @Get('role/:role')
  async getPersonsByRole(@Param('role') role: string, @Query('limit') limit: string = '50') {
    const persons = await this.personsModel
      .find({ role: new RegExp(role, 'i') })
      .limit(parseInt(limit, 10))
      .lean();
    return { ok: true, count: persons.length, persons };
  }

  // ═══════════════════════════════════════════════════════════════
  // SINGLE PERSON
  // ═══════════════════════════════════════════════════════════════

  @Get(':slug')
  async getPerson(@Param('slug') slug: string) {
    const person = await this.personsModel.findOne({
      $or: [{ slug }, { name: new RegExp(`^${slug}$`, 'i') }],
    }).lean();
    
    if (!person) {
      return { ok: false, error: 'Person not found' };
    }
    return { ok: true, person };
  }

  @Get(':slug/fund')
  async getPersonFund(@Param('slug') slug: string) {
    const person = await this.personsModel.findOne({ slug }).lean();
    if (!person) {
      return { ok: false, error: 'Person not found' };
    }

    const fund = await this.fundsModel.findOne({ name: (person as any).fund }).lean();
    return { ok: true, person: (person as any).name, fund };
  }

  @Get(':slug/investments')
  async getPersonInvestments(@Param('slug') slug: string) {
    const person = await this.personsModel.findOne({ slug }).lean();
    if (!person) {
      return { ok: false, error: 'Person not found' };
    }

    // Get investments through their fund
    const investments = await this.fundraisingModel
      .find({ investors: (person as any).fund })
      .sort({ date: -1 })
      .lean();

    return {
      ok: true,
      person: (person as any).name,
      fund: (person as any).fund,
      totalInvestments: investments.length,
      investments,
    };
  }

  @Get(':slug/connections')
  async getPersonConnections(@Param('slug') slug: string) {
    const person = await this.personsModel.findOne({ slug }).lean();
    if (!person) {
      return { ok: false, error: 'Person not found' };
    }

    // Find colleagues at same fund
    const colleagues = await this.personsModel
      .find({ fund: (person as any).fund, slug: { $ne: slug } })
      .lean();

    // Find co-investors through fund
    const fundInvestments = await this.fundraisingModel
      .find({ investors: (person as any).fund })
      .lean();

    const coInvestors: Record<string, number> = {};
    for (const inv of fundInvestments) {
      for (const name of ((inv as any).investors || [])) {
        if (name !== (person as any).fund) {
          coInvestors[name] = (coInvestors[name] || 0) + 1;
        }
      }
    }

    const sortedCoInvestors = Object.entries(coInvestors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));

    return {
      ok: true,
      person: (person as any).name,
      colleagues,
      coInvestingFunds: sortedCoInvestors,
    };
  }

  @Get(':slug/activity')
  async getPersonActivity(@Param('slug') slug: string, @Query('days') days: string = '90') {
    const person = await this.personsModel.findOne({ slug }).lean();
    if (!person) {
      return { ok: false, error: 'Person not found' };
    }

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));

    const recentActivity = await this.fundraisingModel
      .find({ investors: (person as any).fund, date: { $gte: since } })
      .sort({ date: -1 })
      .lean();

    return {
      ok: true,
      person: (person as any).name,
      period: `${days} days`,
      activity: recentActivity,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // RANKINGS
  // ═══════════════════════════════════════════════════════════════

  @Get('rankings/by-fund-aum')
  async getPersonsByFundAum(@Query('limit') limit: string = '50') {
    // Get top funds by AUM
    const topFunds = await this.fundsModel
      .find({ aum: { $exists: true, $gt: 0 } })
      .sort({ aum: -1 })
      .limit(20)
      .lean();

    const fundNames = topFunds.map((f: any) => f.name);
    
    const persons = await this.personsModel
      .find({ fund: { $in: fundNames } })
      .lean();

    // Add fund AUM to each person
    const personsWithAum = persons.map((p: any) => {
      const fund = topFunds.find((f: any) => f.name === p.fund);
      return { ...p, fundAum: (fund as any)?.aum || 0 };
    });

    personsWithAum.sort((a: any, b: any) => b.fundAum - a.fundAum);

    return {
      ok: true,
      count: personsWithAum.length,
      persons: personsWithAum.slice(0, parseInt(limit, 10)),
    };
  }

  @Get('rankings/founders')
  async getTopFounders(@Query('limit') limit: string = '50') {
    const founders = await this.personsModel
      .find({ role: /founder|ceo|co-founder/i })
      .limit(parseInt(limit, 10))
      .lean();

    return { ok: true, count: founders.length, founders };
  }

  @Get('rankings/partners')
  async getTopPartners(@Query('limit') limit: string = '50') {
    const partners = await this.personsModel
      .find({ role: /partner|general partner|managing partner/i })
      .limit(parseInt(limit, 10))
      .lean();

    return { ok: true, count: partners.length, partners };
  }

  // ═══════════════════════════════════════════════════════════════
  // NETWORK ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  @Get('network/fund/:fundSlug')
  async getFundNetwork(@Param('fundSlug') fundSlug: string) {
    const fund = await this.fundsModel.findOne({ slug: fundSlug }).lean();
    if (!fund) {
      return { ok: false, error: 'Fund not found' };
    }

    const team = await this.personsModel.find({ fund: (fund as any).name }).lean();
    
    return {
      ok: true,
      fund: (fund as any).name,
      teamSize: team.length,
      team,
    };
  }

  @Get('network/connections-map')
  async getConnectionsMap(@Query('limit') limit: string = '100') {
    const persons = await this.personsModel.find({}).limit(parseInt(limit, 10)).lean();
    
    // Build connections based on shared fund
    const connections: any[] = [];
    const fundGroups: Record<string, string[]> = {};
    
    for (const p of persons) {
      const person = p as any;
      if (person.fund) {
        if (!fundGroups[person.fund]) fundGroups[person.fund] = [];
        fundGroups[person.fund].push(person.name);
      }
    }

    for (const [fund, members] of Object.entries(fundGroups)) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          connections.push({
            source: members[i],
            target: members[j],
            type: 'colleague',
            fund,
          });
        }
      }
    }

    return {
      ok: true,
      nodes: persons.map((p: any) => ({ id: p.name, fund: p.fund, role: p.role })),
      edges: connections,
    };
  }
}
