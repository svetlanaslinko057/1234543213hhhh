/**
 * Smart Money Controller
 * 
 * API endpoints for Smart Money Intelligence
 */

import { Controller, Get, Post, Query } from '@nestjs/common';
import { SmartMoneyService } from './smart-money.service';

@Controller('smart-money')
export class SmartMoneyController {
  constructor(private readonly smartMoney: SmartMoneyService) {}

  /**
   * Run full smart money pipeline
   * - Cleanup coinvest
   * - Enhanced scoring
   * - Follow pattern detection
   */
  @Post('analyze')
  async runAnalysis() {
    return this.smartMoney.runFullPipeline();
  }

  /**
   * Get smart money stats
   */
  @Get('stats')
  async getStats() {
    return this.smartMoney.getStats();
  }

  /**
   * Get smart money leaderboard
   */
  @Get('leaderboard')
  async getLeaderboard(
    @Query('tier') tier?: string,
    @Query('limit') limit?: string,
  ) {
    const results = await this.smartMoney.getSmartMoneyLeaderboard(
      tier,
      parseInt(limit || '50', 10)
    );

    return results.map((p: any, index: number) => ({
      rank: index + 1,
      name: p.display_name,
      smart_money_tier: p.smart_money_tier,
      smart_money_score: p.smart_money_score,
      early_score: p.early_investor_score,
      leader_score: p.leader_score,
      recency_score: p.recency_score,
      tier1_partners: p.tier1_coinvest_count,
      enhanced_score: p.enhanced_score,
    }));
  }

  /**
   * Get smart money profile for specific investor
   * Accepts both ?investor= and ?name= parameters
   */
  @Get('profile')
  async getProfile(
    @Query('investor') investor: string,
    @Query('name') name: string,
  ) {
    const searchTerm = investor || name;
    if (!searchTerm) {
      return { error: 'investor or name parameter required' };
    }

    const profile = await this.smartMoney.getSmartMoneyProfile(searchTerm);
    if (!profile) {
      return { error: 'Investor not found', searched: searchTerm };
    }

    return profile;
  }

  /**
   * Get follow relations for investor
   * Shows who they follow and who follows them
   */
  @Get('follow')
  async getFollowRelations(@Query('investor') investor: string) {
    if (!investor) {
      return { error: 'investor parameter required' };
    }

    const relations = await this.smartMoney.getFollowRelations(investor);
    
    return {
      investor,
      leaders_they_follow: relations.leads.map((r: any) => ({
        name: r.name,
        tier: r.tier,
        follow_count: r.follow_count,
        sample_projects: r.sample_projects?.slice(0, 5),
      })),
      followers: relations.follows.map((r: any) => ({
        name: r.name,
        tier: r.tier,
        follow_count: r.follow_count,
        sample_projects: r.sample_projects?.slice(0, 5),
      })),
    };
  }

  /**
   * Cleanup coinvest relations only
   */
  @Post('cleanup-coinvest')
  async cleanupCoinvest() {
    return this.smartMoney.cleanupCoinvest();
  }
}
