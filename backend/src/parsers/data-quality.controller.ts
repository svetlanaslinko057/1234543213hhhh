/**
 * Data Quality Controller
 * 
 * API endpoints для:
 * - Normalization pipeline
 * - Data health checks
 * - Co-investor analysis
 */

import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { InvestorNormalizationService } from './normalization/investor-normalization.service';
import { DataValidationService } from './validation/data-validation.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('data-quality')
export class DataQualityController {
  constructor(
    private readonly normalization: InvestorNormalizationService,
    private readonly validation: DataValidationService,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
  ) {}

  /**
   * Run full normalization pipeline
   * Объединяет дубликаты инвесторов
   */
  @Post('normalize/investors')
  async normalizeInvestors() {
    const startTime = Date.now();
    const result = await this.normalization.runNormalizationPipeline();
    
    return {
      status: 'success',
      duration_ms: Date.now() - startTime,
      ...result,
    };
  }

  /**
   * Get normalization stats
   */
  @Get('normalize/stats')
  async getNormalizationStats() {
    return this.normalization.getStats();
  }

  /**
   * Find investor by name (with normalization)
   */
  @Get('investor')
  async findInvestor(@Query('name') name: string) {
    if (!name) {
      return { error: 'Name parameter required' };
    }
    
    const investor = await this.normalization.findByName(name);
    if (!investor) {
      return { error: 'Investor not found', searched_name: name };
    }
    
    return investor;
  }

  /**
   * Find co-investors
   */
  @Get('coinvestors')
  async findCoInvestors(
    @Query('investor') investorName: string,
    @Query('limit') limit?: string,
  ) {
    if (!investorName) {
      return { error: 'Investor parameter required' };
    }
    
    const coInvestors = await this.normalization.findCoInvestors(
      investorName,
      parseInt(limit || '20', 10),
    );
    
    return {
      investor: investorName,
      coinvestors_count: coInvestors.length,
      coinvestors: coInvestors,
    };
  }

  /**
   * Add alias mapping
   */
  @Post('alias')
  async addAlias(@Body() body: { alias: string; canonical_id: string }) {
    if (!body.alias || !body.canonical_id) {
      return { error: 'alias and canonical_id required' };
    }
    
    this.normalization.addAlias(body.alias, body.canonical_id);
    
    return {
      status: 'success',
      alias: body.alias,
      canonical_id: body.canonical_id,
    };
  }

  /**
   * Data health check - проверяет качество данных
   */
  @Get('health')
  async dataHealth() {
    const [fundingHealth, investorHealth] = await Promise.all([
      this.validation.checkDataHealth(this.fundraisingModel, 'funding'),
      this.validation.checkDataHealth(this.investorsModel, 'investor'),
    ]);

    const overallScore = this.calculateHealthScore(fundingHealth, investorHealth);

    return {
      ts: Date.now(),
      overall_health_score: overallScore,
      funding_rounds: fundingHealth,
      investors: investorHealth,
      recommendations: this.getRecommendations(fundingHealth, investorHealth),
    };
  }

  /**
   * Detailed data health by source
   */
  @Get('health/by-source')
  async dataHealthBySource() {
    const [dropstabFunding, cryptorankFunding, dropstabInvestors, cryptorankInvestors] = await Promise.all([
      this.fundraisingModel.aggregate([
        { $match: { source: 'dropstab' } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            with_amount: { $sum: { $cond: [{ $gt: ['$amount', 0] }, 1, 0] } },
            with_date: { $sum: { $cond: [{ $ne: ['$date', null] }, 1, 0] } },
            with_investors: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$investors', []] } }, 0] }, 1, 0] } },
            last_update: { $max: '$updated_at' },
          },
        },
      ]),
      this.fundraisingModel.aggregate([
        { $match: { source: 'cryptorank' } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            with_amount: { $sum: { $cond: [{ $gt: ['$amount', 0] }, 1, 0] } },
            with_date: { $sum: { $cond: [{ $ne: ['$date', null] }, 1, 0] } },
            with_investors: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$investors', []] } }, 0] }, 1, 0] } },
            last_update: { $max: '$updated_at' },
          },
        },
      ]),
      this.investorsModel.aggregate([
        { $match: { source: 'dropstab' } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            with_tier: { $sum: { $cond: [{ $ne: ['$tier', null] }, 1, 0] } },
            last_update: { $max: '$updated_at' },
          },
        },
      ]),
      this.investorsModel.aggregate([
        { $match: { source: { $in: ['cryptorank', 'extracted_from_cryptorank'] } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            with_tier: { $sum: { $cond: [{ $ne: ['$tier', null] }, 1, 0] } },
            last_update: { $max: '$updated_at' },
          },
        },
      ]),
    ]);

    const formatSourceStats = (data: any[], confidence: number) => {
      if (!data[0]) return { total: 0, completeness: 0, confidence, last_update: null };
      const d = data[0];
      const completeness = d.total > 0 
        ? Math.round(((d.with_amount || 0) + (d.with_date || 0) + (d.with_investors || d.with_tier || 0)) / (d.total * 3) * 100)
        : 0;
      return {
        total: d.total,
        completeness: `${completeness}%`,
        confidence,
        last_update: d.last_update,
        details: {
          with_amount: d.with_amount,
          with_date: d.with_date,
          with_investors: d.with_investors,
          with_tier: d.with_tier,
        },
      };
    };

    return {
      ts: Date.now(),
      sources: {
        dropstab: {
          funding: formatSourceStats(dropstabFunding, 0.9),
          investors: formatSourceStats(dropstabInvestors, 0.9),
          status: dropstabFunding[0]?.total > 0 ? 'OK' : 'EMPTY',
        },
        cryptorank: {
          funding: formatSourceStats(cryptorankFunding, 0.8),
          investors: formatSourceStats(cryptorankInvestors, 0.8),
          status: cryptorankFunding[0]?.total > 0 ? 'OK' : 'EMPTY',
        },
      },
    };
  }

  private calculateHealthScore(funding: any, investors: any): string {
    const fundingScore = funding.total > 0 ? (funding.healthy / funding.total) : 0;
    const investorScore = investors.total > 0 ? (investors.healthy / investors.total) : 0;
    const avgScore = (fundingScore + investorScore) / 2 * 100;
    return `${avgScore.toFixed(1)}%`;
  }

  private getRecommendations(funding: any, investors: any): string[] {
    const recommendations: string[] = [];
    
    if (funding.issues.missing_date > funding.total * 0.1) {
      recommendations.push(`${funding.issues.missing_date} funding rounds missing date - run data enrichment`);
    }
    if (funding.issues.missing_amount > funding.total * 0.2) {
      recommendations.push(`${funding.issues.missing_amount} funding rounds missing amount - check data sources`);
    }
    if (funding.issues.empty_investors > funding.total * 0.1) {
      recommendations.push(`${funding.issues.empty_investors} funding rounds have no investors - run investor extraction`);
    }
    if (investors.issues.invalid_tier > 0) {
      recommendations.push(`${investors.issues.invalid_tier} investors have invalid tier - run normalization`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Data quality is good! Consider running normalization pipeline for deduplication.');
    }
    
    return recommendations;
  }
}
