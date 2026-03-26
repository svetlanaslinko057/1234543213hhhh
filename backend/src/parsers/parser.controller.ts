/**
 * Parser Controller - HTTP endpoints for new parser system
 */

import { Controller, Get, Post, Query } from '@nestjs/common';
import { ParserOrchestrator } from './application/parser.orchestrator';
import { MasterOrchestrator } from './application/master.orchestrator';
import { InvestorExtractionService } from './extraction/investor-extraction.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('parsers')
export class ParserController {
  constructor(
    private readonly orchestrator: ParserOrchestrator,
    private readonly master: MasterOrchestrator,
    private readonly investorExtraction: InvestorExtractionService,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_unlocks') private unlocksModel: Model<any>,
  ) {}

  /**
   * Parser Status - health check for all parsers
   */
  @Get('status')
  async getStatus() {
    const [
      dsInvestors,
      dsInvestorsCount,
      crInvestorsCount,
      extractedDsCount,
      extractedCrCount,
      dsFunding,
      dsFundingCount,
      crFunding,
      crFundingCount,
      dsUnlocks,
      crUnlocks,
    ] = await Promise.all([
      this.investorsModel.findOne({ source: 'dropstab' }, { updated_at: 1 }).sort({ updated_at: -1 }),
      this.investorsModel.countDocuments({ source: 'dropstab' }),
      this.investorsModel.countDocuments({ source: 'cryptorank' }),
      this.investorsModel.countDocuments({ source: 'extracted_from_dropstab' }),
      this.investorsModel.countDocuments({ source: 'extracted_from_cryptorank' }),
      this.fundraisingModel.findOne({ source: 'dropstab' }, { updated_at: 1 }).sort({ updated_at: -1 }),
      this.fundraisingModel.countDocuments({ source: 'dropstab' }),
      this.fundraisingModel.findOne({ source: 'cryptorank' }, { updated_at: 1 }).sort({ updated_at: -1 }),
      this.fundraisingModel.countDocuments({ source: 'cryptorank' }),
      this.unlocksModel.countDocuments({ source: 'dropstab' }),
      this.unlocksModel.countDocuments({ source: 'cryptorank' }),
    ]);

    const getStatus = (count: number, minExpected: number) => {
      if (count >= minExpected) return 'OK';
      if (count > 0) return 'PARTIAL';
      return 'BROKEN';
    };

    const totalInvestors = dsInvestorsCount + crInvestorsCount + extractedDsCount + extractedCrCount;

    return {
      ts: Date.now(),
      parsers: {
        dropstab: {
          status: getStatus(dsInvestorsCount + dsFundingCount, 5000),
          investors: {
            api: dsInvestorsCount,
            extracted: extractedDsCount,
            total: dsInvestorsCount + extractedDsCount,
            status: getStatus(dsInvestorsCount + extractedDsCount, 1000),
            lastUpdate: dsInvestors?.updated_at,
          },
          funding: {
            count: dsFundingCount,
            status: getStatus(dsFundingCount, 1000),
            lastUpdate: dsFunding?.updated_at,
          },
          unlocks: {
            count: dsUnlocks,
            status: dsUnlocks > 0 ? 'OK' : 'UNAVAILABLE',
          },
        },
        cryptorank: {
          status: getStatus(extractedCrCount + crFundingCount, 500),
          investors: {
            api: crInvestorsCount,
            extracted: extractedCrCount,
            total: crInvestorsCount + extractedCrCount,
            status: getStatus(crInvestorsCount + extractedCrCount, 100),
            lastUpdate: crFunding?.updated_at,
          },
          funding: {
            count: crFundingCount,
            status: getStatus(crFundingCount, 100),
            lastUpdate: crFunding?.updated_at,
          },
          unlocks: {
            count: crUnlocks,
            status: crUnlocks > 0 ? 'OK' : 'UNAVAILABLE',
          },
        },
      },
      totals: {
        investors: totalInvestors,
        funding: dsFundingCount + crFundingCount,
        unlocks: dsUnlocks + crUnlocks,
      },
    };
  }

  /**
   * Discovery mode - analyze what API calls a page makes
   */
  @Get('discovery/dropstab')
  async discoverDropstab(@Query('url') url?: string) {
    return this.orchestrator.discoverDropstab(url);
  }

  @Get('discovery/cryptorank')
  async discoverCryptoRank(@Query('url') url?: string) {
    return this.orchestrator.discoverCryptoRank(url);
  }

  /**
   * Sync endpoints - Dropstab
   */
  @Post('sync/dropstab/investors')
  async syncDropstabInvestors(@Query('pages') pages?: string) {
    const maxPages = parseInt(pages || '20', 10);
    const result = await this.orchestrator.syncDropstabInvestors(maxPages);
    return {
      success: !result.error && result.saved > 0,
      ...result,
    };
  }

  @Post('sync/dropstab/fundraising')
  async syncDropstabFundraising(@Query('pages') pages?: string) {
    const maxPages = parseInt(pages || '50', 10);
    const result = await this.orchestrator.syncDropstabFundraising(maxPages);
    return {
      success: !result.error && result.saved > 0,
      ...result,
    };
  }

  @Post('sync/dropstab/unlocks')
  async syncDropstabUnlocks() {
    const result = await this.orchestrator.syncDropstabUnlocks();
    return {
      success: !result.error && result.saved > 0,
      ...result,
    };
  }

  /**
   * Sync endpoints - CryptoRank
   */
  @Post('sync/cryptorank/funding')
  async syncCryptoRankFunding(@Query('pages') pages?: string) {
    const maxPages = parseInt(pages || '50', 10);
    const result = await this.orchestrator.syncCryptoRankFunding(maxPages);
    return {
      success: !result.error && result.saved > 0,
      ...result,
    };
  }

  @Post('sync/cryptorank/investors')
  async syncCryptoRankInvestors(@Query('pages') pages?: string) {
    const maxPages = parseInt(pages || '30', 10);
    const result = await this.orchestrator.syncCryptoRankInvestors(maxPages);
    return {
      success: !result.error && result.saved > 0,
      ...result,
    };
  }

  @Post('sync/cryptorank/unlocks')
  async syncCryptoRankUnlocks(@Query('pages') pages?: string) {
    const maxPages = parseInt(pages || '20', 10);
    const result = await this.orchestrator.syncCryptoRankUnlocks(maxPages);
    return {
      success: !result.error && result.saved > 0,
      ...result,
    };
  }

  @Post('sync/cryptorank/categories')
  async syncCryptoRankCategories() {
    const result = await this.orchestrator.syncCryptoRankCategories();
    return {
      success: !result.error && result.saved > 0,
      ...result,
    };
  }

  /**
   * Full sync - all sources and entities
   */
  @Post('sync/all')
  async syncAll() {
    return this.orchestrator.syncAll();
  }

  /**
   * MASTER ORCHESTRATOR - run ALL parsers with detailed report
   */
  @Post('master/run')
  async masterRun(): Promise<any> {
    return this.master.runAll();
  }

  /**
   * Quick diagnostic - check all sources
   */
  @Get('master/diagnose')
  async masterDiagnose(): Promise<any> {
    return this.master.diagnose();
  }

  /**
   * Extract investors from funding rounds
   * This aggregates investor data from all funding rounds
   */
  @Post('extract/investors')
  async extractInvestors() {
    return this.investorExtraction.extractAndSaveInvestors();
  }

  /**
   * Get extraction stats without modifying data
   */
  @Get('extract/investors/stats')
  async getExtractionStats() {
    return this.investorExtraction.getExtractionStats();
  }
}
