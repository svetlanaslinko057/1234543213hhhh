/**
 * Unlocks Controller - Full API for token unlocks/vesting
 */

import { Controller, Get, Query, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('intel/unlocks')
export class UnlocksController {
  constructor(
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
    @InjectModel('intel_projects') private projectsModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // BASIC
  // ═══════════════════════════════════════════════════════════════

  @Get()
  async listUnlocks(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    const [unlocks, total] = await Promise.all([
      this.unlocksModel
        .find({})
        .sort({ unlock_date: 1 })
        .skip(parseInt(offset, 10))
        .limit(parseInt(limit, 10))
        .lean(),
      this.unlocksModel.countDocuments(),
    ]);

    return { ok: true, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10), unlocks };
  }

  @Get('stats')
  async getUnlockStats() {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [total, thisWeek, thisMonth, totalValue] = await Promise.all([
      this.unlocksModel.countDocuments(),
      this.unlocksModel.countDocuments({ unlock_date: { $gte: now, $lte: nextWeek } }),
      this.unlocksModel.countDocuments({ unlock_date: { $gte: now, $lte: nextMonth } }),
      this.unlocksModel.aggregate([
        { $match: { value_usd: { $exists: true } } },
        { $group: { _id: null, total: { $sum: '$value_usd' } } },
      ]),
    ]);

    return {
      ok: true,
      stats: {
        total,
        upcomingThisWeek: thisWeek,
        upcomingThisMonth: thisMonth,
        totalValueUsd: totalValue[0]?.total || 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // UPCOMING
  // ═══════════════════════════════════════════════════════════════

  @Get('upcoming')
  async getUpcomingUnlocks(
    @Query('days') days: string = '30',
    @Query('limit') limit: string = '100',
  ) {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + parseInt(days, 10));

    const unlocks = await this.unlocksModel
      .find({ unlock_date: { $gte: now, $lte: future } })
      .sort({ unlock_date: 1 })
      .limit(parseInt(limit, 10))
      .lean();

    return { ok: true, period: `${days} days`, count: unlocks.length, unlocks };
  }

  @Get('upcoming/today')
  async getTodayUnlocks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const unlocks = await this.unlocksModel
      .find({ unlock_date: { $gte: today, $lt: tomorrow } })
      .sort({ value_usd: -1 })
      .lean();

    return { ok: true, date: today.toISOString().split('T')[0], count: unlocks.length, unlocks };
  }

  @Get('upcoming/week')
  async getWeekUnlocks() {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const unlocks = await this.unlocksModel
      .find({ unlock_date: { $gte: now, $lte: nextWeek } })
      .sort({ unlock_date: 1 })
      .lean();

    // Group by day
    const byDay: Record<string, any[]> = {};
    for (const u of unlocks) {
      const day = new Date((u as any).unlock_date).toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(u);
    }

    return { ok: true, count: unlocks.length, byDay };
  }

  @Get('upcoming/month')
  async getMonthUnlocks() {
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const unlocks = await this.unlocksModel
      .find({ unlock_date: { $gte: now, $lte: nextMonth } })
      .sort({ unlock_date: 1 })
      .lean();

    // Group by week
    const byWeek: Record<string, any[]> = {};
    for (const u of unlocks) {
      const date = new Date((u as any).unlock_date);
      const weekNum = Math.ceil((date.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const weekKey = `week_${weekNum}`;
      if (!byWeek[weekKey]) byWeek[weekKey] = [];
      byWeek[weekKey].push(u);
    }

    return { ok: true, count: unlocks.length, byWeek };
  }

  // ═══════════════════════════════════════════════════════════════
  // MAJOR UNLOCKS
  // ═══════════════════════════════════════════════════════════════

  @Get('major')
  async getMajorUnlocks(
    @Query('min_value') minValue: string = '1000000',
    @Query('days') days: string = '30',
  ) {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + parseInt(days, 10));

    const unlocks = await this.unlocksModel
      .find({
        unlock_date: { $gte: now, $lte: future },
        value_usd: { $gte: parseInt(minValue, 10) },
      })
      .sort({ value_usd: -1 })
      .lean();

    return {
      ok: true,
      minValue: parseInt(minValue, 10),
      period: `${days} days`,
      count: unlocks.length,
      unlocks,
    };
  }

  @Get('major/top')
  async getTopUnlocks(@Query('limit') limit: string = '20') {
    const now = new Date();

    const unlocks = await this.unlocksModel
      .find({ unlock_date: { $gte: now }, value_usd: { $exists: true } })
      .sort({ value_usd: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    return { ok: true, count: unlocks.length, unlocks };
  }

  // ═══════════════════════════════════════════════════════════════
  // BY PROJECT
  // ═══════════════════════════════════════════════════════════════

  @Get('project/:slug')
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
      summary: {
        total: unlocks.length,
        upcoming: upcoming.length,
        past: past.length,
        totalValue: unlocks.reduce((sum, u: any) => sum + (u.value_usd || 0), 0),
      },
      upcoming,
      past,
    };
  }

  @Get('project/:slug/next')
  async getProjectNextUnlock(@Param('slug') slug: string) {
    const now = new Date();
    const nextUnlock = await this.unlocksModel
      .findOne({ project_slug: slug, unlock_date: { $gte: now } })
      .sort({ unlock_date: 1 })
      .lean();

    if (!nextUnlock) {
      return { ok: false, error: 'No upcoming unlocks found' };
    }

    return { ok: true, project: slug, nextUnlock };
  }

  // ═══════════════════════════════════════════════════════════════
  // CALENDAR
  // ═══════════════════════════════════════════════════════════════

  @Get('calendar')
  async getUnlockCalendar(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = parseInt(year, 10) || new Date().getFullYear();
    const m = parseInt(month, 10) || new Date().getMonth() + 1;

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const unlocks = await this.unlocksModel
      .find({ unlock_date: { $gte: startDate, $lte: endDate } })
      .sort({ unlock_date: 1 })
      .lean();

    // Group by day
    const calendar: Record<string, any[]> = {};
    for (const u of unlocks) {
      const day = new Date((u as any).unlock_date).getDate().toString();
      if (!calendar[day]) calendar[day] = [];
      calendar[day].push(u);
    }

    return {
      ok: true,
      year: y,
      month: m,
      totalUnlocks: unlocks.length,
      calendar,
    };
  }

  @Get('calendar/range')
  async getUnlockRange(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const unlocks = await this.unlocksModel
      .find({ unlock_date: { $gte: fromDate, $lte: toDate } })
      .sort({ unlock_date: 1 })
      .lean();

    return {
      ok: true,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      count: unlocks.length,
      unlocks,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════

  @Get('analytics/by-project')
  async getUnlocksByProject(@Query('limit') limit: string = '20') {
    const pipeline = await this.unlocksModel.aggregate([
      { $match: { unlock_date: { $gte: new Date() } } },
      { $group: { _id: '$project_slug', count: { $sum: 1 }, totalValue: { $sum: '$value_usd' } } },
      { $sort: { totalValue: -1 } },
      { $limit: parseInt(limit, 10) },
    ]);

    return {
      ok: true,
      projects: pipeline.map((p) => ({
        slug: p._id,
        unlockCount: p.count,
        totalValue: p.totalValue,
      })),
    };
  }

  @Get('analytics/value-distribution')
  async getValueDistribution() {
    const pipeline = await this.unlocksModel.aggregate([
      { $match: { value_usd: { $exists: true }, unlock_date: { $gte: new Date() } } },
      {
        $bucket: {
          groupBy: '$value_usd',
          boundaries: [0, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000],
          default: 'over_100m',
          output: { count: { $sum: 1 }, totalValue: { $sum: '$value_usd' } },
        },
      },
    ]);

    return { ok: true, distribution: pipeline };
  }

  @Get('analytics/monthly-trend')
  async getMonthlyTrend(@Query('months') months: string = '6') {
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - parseInt(months, 10));

    const pipeline = await this.unlocksModel.aggregate([
      { $match: { unlock_date: { $gte: monthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$unlock_date' },
            month: { $month: '$unlock_date' },
          },
          count: { $sum: 1 },
          totalValue: { $sum: '$value_usd' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return {
      ok: true,
      period: `${months} months`,
      trend: pipeline.map((p) => ({
        month: `${p._id.year}-${p._id.month.toString().padStart(2, '0')}`,
        count: p.count,
        totalValue: p.totalValue,
      })),
    };
  }
}
