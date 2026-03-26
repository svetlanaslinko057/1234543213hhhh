/**
 * Smart Money Intelligence Engine
 * 
 * Финальный 20% который даёт 80% ценности:
 * - Early Investor Score (кто заходит первым)
 * - Follow Pattern Detection (кто за кем идёт)
 * - Leader Detection (кто ведёт раунды)
 * - Enhanced Tier Scoring (recency, leads, tier1 partners)
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { normalizeRawName } from './entity-resolution.engine';

// ==============================
// TYPES
// ==============================

export interface SmartMoneyProfile {
  canonical_id: string;
  display_name: string;
  
  // Smart Money Metrics
  smart_money_score: number;
  smart_money_tier: 'ALPHA' | 'SMART' | 'FOLLOWER' | 'RETAIL';
  
  // Early Investor
  early_investor_score: number;
  seed_rounds_count: number;
  pre_seed_count: number;
  series_a_count: number;
  early_ratio: number; // seed+preseed / total
  
  // Leader Metrics
  leader_score: number;
  lead_rounds_count: number;
  lead_ratio: number;
  
  // Follow Patterns
  follow_score: number;
  follows_tier1: number; // сколько раз зашёл после TIER_1
  followed_by_tier1: number; // сколько раз TIER_1 зашёл после него
  
  // Recency
  recency_score: number;
  last_investment_date: number | null;
  investments_last_90_days: number;
  investments_last_year: number;
  
  // Enhanced Tier
  enhanced_score: number;
  base_score: number;
  tier: string;
  
  // Co-invest quality
  tier1_coinvest_count: number;
  avg_coinvest_tier: number;
  
  updated_at: Date;
}

export interface FollowRelation {
  leader_id: string;
  follower_id: string;
  follow_count: number;
  follow_ratio: number; // % раундов где follower идёт за leader
  avg_delay_days: number;
  sample_projects: string[];
}

export interface CoinvestClean {
  investor_a: string;
  investor_b: string;
  count: number;
  volume: number;
  projects: string[];
  quality_score: number; // NEW: quality metric
}

// ==============================
// CONSTANTS
// ==============================

const COINVEST_MIN_COUNT = 3;
const COINVEST_MIN_VOLUME = 1_000_000; // $1M
const FUZZY_THRESHOLD = 0.92; // Increased from 0.88

const STAGE_WEIGHTS: Record<string, number> = {
  'pre-seed': 5,
  'preseed': 5,
  'seed': 4,
  'seed round': 4,
  'series a': 3,
  'series-a': 3,
  'series b': 2,
  'series-b': 2,
  'private': 2,
  'strategic': 1,
  'series c': 1,
  'series d': 0.5,
  'ipo': 0,
  'public': 0,
};

// Recency weights (days ago)
const RECENCY_WEIGHTS = {
  30: 5,   // last 30 days
  90: 3,   // last 90 days
  180: 2,  // last 6 months
  365: 1,  // last year
};

@Injectable()
export class SmartMoneyService {
  constructor(
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('canonical_investors') private canonicalModel: Model<any>,
    @InjectModel('coinvest_relations') private coinvestModel: Model<any>,
    @InjectModel('smart_money_profiles') private smartMoneyModel: Model<any>,
    @InjectModel('follow_relations') private followModel: Model<any>,
  ) {}

  // ==============================
  // 1. COINVEST CLEANUP
  // ==============================

  /**
   * Очистить coinvest от шума
   * count < 3 → удалить
   * volume < 1M → удалить
   */
  async cleanupCoinvest(): Promise<{
    before: number;
    after: number;
    removed: number;
    quality_distribution: any;
  }> {
    console.log('[SmartMoney] Cleaning up coinvest relations...');
    
    const before = await this.coinvestModel.countDocuments({});
    
    // Удаляем слабые связи
    const deleteResult = await this.coinvestModel.deleteMany({
      $or: [
        { count: { $lt: COINVEST_MIN_COUNT } },
        { volume: { $lt: COINVEST_MIN_VOLUME } },
      ],
    });

    // Добавляем quality score к оставшимся
    const remaining = await this.coinvestModel.find({}).lean();
    
    for (const rel of remaining) {
      const qualityScore = this.calculateCoinvestQuality(rel);
      await this.coinvestModel.updateOne(
        { _id: rel._id },
        { $set: { quality_score: qualityScore } }
      );
    }

    const after = await this.coinvestModel.countDocuments({});
    
    // Quality distribution
    const distribution = await this.coinvestModel.aggregate([
      {
        $bucket: {
          groupBy: '$quality_score',
          boundaries: [0, 25, 50, 75, 100, Infinity],
          default: 'unknown',
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    console.log(`[SmartMoney] Coinvest cleanup: ${before} → ${after} (removed ${before - after})`);

    return {
      before,
      after,
      removed: before - after,
      quality_distribution: distribution,
    };
  }

  private calculateCoinvestQuality(rel: any): number {
    // Quality = f(count, volume, projects diversity)
    const countScore = Math.min(rel.count / 20, 1) * 40; // max 40 points
    const volumeScore = Math.min(rel.volume / 100_000_000, 1) * 30; // max 30 points for $100M+
    const projectsScore = Math.min((rel.projects?.length || 0) / 10, 1) * 30; // max 30 points
    
    return Math.round(countScore + volumeScore + projectsScore);
  }

  // ==============================
  // 2. ENHANCED TIER SCORING
  // ==============================

  /**
   * Усиленная формула scoring
   * 
   * enhanced_score = base_score + recency + leads + tier1_partners
   */
  async calculateEnhancedScores(): Promise<{
    updated: number;
    tier_distribution: any;
    top_smart_money: any[];
  }> {
    console.log('[SmartMoney] Calculating enhanced scores...');
    
    const investors = await this.canonicalModel.find({}).lean() as any[];
    const allRounds = await this.fundraisingModel.find({}).lean();
    
    // Pre-compute round participation
    const investorRounds = new Map<string, any[]>();
    
    for (const round of allRounds) {
      if (!Array.isArray(round.investors)) continue;
      
      for (const inv of round.investors) {
        const invName = typeof inv === 'string' ? inv : inv?.name;
        if (!invName) continue;
        
        const normalized = normalizeRawName(invName);
        if (!investorRounds.has(normalized)) {
          investorRounds.set(normalized, []);
        }
        investorRounds.get(normalized)!.push(round);
      }
    }

    // Get TIER_1 list for co-invest quality
    const tier1Ids = new Set(
      investors.filter(i => i.tier === 'TIER_1').map(i => i.canonical_id)
    );

    let updated = 0;
    const smartMoneyProfiles: SmartMoneyProfile[] = [];

    for (const investor of investors) {
      const rounds = investorRounds.get(investor.normalized) || [];
      
      // Early Investor Score
      const earlyMetrics = this.calculateEarlyScore(rounds);
      
      // Leader Score
      const leaderMetrics = this.calculateLeaderScore(rounds, investor);
      
      // Recency Score
      const recencyMetrics = this.calculateRecencyScore(rounds);
      
      // Tier1 Coinvest
      const tier1CoinvestCount = await this.countTier1Coinvest(investor.canonical_id, tier1Ids);
      
      // Enhanced Score
      const baseScore = investor.score || 0;
      const enhancedScore = 
        baseScore +
        (recencyMetrics.score * 3) +      // Recency bonus
        (leaderMetrics.score * 5) +        // Lead rounds bonus
        (tier1CoinvestCount * 2) +         // Tier1 partners bonus
        (earlyMetrics.score * 4);          // Early investor bonus

      // Smart Money Tier
      const smartMoneyScore = earlyMetrics.score + leaderMetrics.score + recencyMetrics.score;
      const smartMoneyTier = this.getSmartMoneyTier(smartMoneyScore, tier1CoinvestCount);

      const profile: SmartMoneyProfile = {
        canonical_id: investor.canonical_id,
        display_name: investor.display_name,
        
        smart_money_score: Math.round(smartMoneyScore * 100) / 100,
        smart_money_tier: smartMoneyTier,
        
        early_investor_score: earlyMetrics.score,
        seed_rounds_count: earlyMetrics.seedCount,
        pre_seed_count: earlyMetrics.preSeedCount,
        series_a_count: earlyMetrics.seriesACount,
        early_ratio: earlyMetrics.ratio,
        
        leader_score: leaderMetrics.score,
        lead_rounds_count: leaderMetrics.leadCount,
        lead_ratio: leaderMetrics.ratio,
        
        follow_score: 0, // Will be calculated separately
        follows_tier1: 0,
        followed_by_tier1: 0,
        
        recency_score: recencyMetrics.score,
        last_investment_date: recencyMetrics.lastDate,
        investments_last_90_days: recencyMetrics.last90Days,
        investments_last_year: recencyMetrics.lastYear,
        
        enhanced_score: Math.round(enhancedScore * 100) / 100,
        base_score: baseScore,
        tier: investor.tier,
        
        tier1_coinvest_count: tier1CoinvestCount,
        avg_coinvest_tier: 0,
        
        updated_at: new Date(),
      };

      smartMoneyProfiles.push(profile);

      // Update canonical investor with enhanced score
      await this.canonicalModel.updateOne(
        { canonical_id: investor.canonical_id },
        { 
          $set: { 
            enhanced_score: enhancedScore,
            smart_money_tier: smartMoneyTier,
            recency_score: recencyMetrics.score,
            early_score: earlyMetrics.score,
            leader_score: leaderMetrics.score,
          } 
        }
      );
      
      updated++;
    }

    // Bulk save smart money profiles
    const bulkOps = smartMoneyProfiles.map(p => ({
      updateOne: {
        filter: { canonical_id: p.canonical_id },
        update: { $set: p },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.smartMoneyModel.bulkWrite(bulkOps);
    }

    // Tier distribution
    const tierDist = await this.smartMoneyModel.aggregate([
      { $group: { _id: '$smart_money_tier', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Top smart money
    const topSmartMoney = await this.smartMoneyModel
      .find({})
      .sort({ smart_money_score: -1 })
      .limit(20)
      .lean();

    console.log(`[SmartMoney] Updated ${updated} investor profiles`);

    return {
      updated,
      tier_distribution: tierDist,
      top_smart_money: topSmartMoney.map((p: any) => ({
        name: p.display_name,
        smart_money_tier: p.smart_money_tier,
        smart_money_score: p.smart_money_score,
        early_score: p.early_investor_score,
        leader_score: p.leader_score,
        recency_score: p.recency_score,
        tier1_partners: p.tier1_coinvest_count,
      })),
    };
  }

  private calculateEarlyScore(rounds: any[]): {
    score: number;
    seedCount: number;
    preSeedCount: number;
    seriesACount: number;
    ratio: number;
  } {
    let seedCount = 0;
    let preSeedCount = 0;
    let seriesACount = 0;
    
    for (const round of rounds) {
      const stage = (round.round || round.stage || '').toLowerCase();
      
      if (stage.includes('pre-seed') || stage.includes('preseed')) {
        preSeedCount++;
      } else if (stage.includes('seed')) {
        seedCount++;
      } else if (stage.includes('series a') || stage.includes('series-a')) {
        seriesACount++;
      }
    }

    const earlyCount = preSeedCount + seedCount + seriesACount;
    const ratio = rounds.length > 0 ? earlyCount / rounds.length : 0;
    
    // Score: weighted by stage
    const score = (preSeedCount * 5) + (seedCount * 4) + (seriesACount * 3);

    return {
      score: Math.round(score * 10) / 10,
      seedCount,
      preSeedCount,
      seriesACount,
      ratio: Math.round(ratio * 100) / 100,
    };
  }

  private calculateLeaderScore(rounds: any[], investor: any): {
    score: number;
    leadCount: number;
    ratio: number;
  } {
    let leadCount = 0;
    
    for (const round of rounds) {
      const leadInvestors = round.lead_investors || [];
      const investorName = investor.display_name?.toLowerCase() || '';
      const investorNormalized = investor.normalized || '';
      
      // Check if investor is lead
      for (const lead of leadInvestors) {
        const leadNorm = normalizeRawName(typeof lead === 'string' ? lead : lead?.name || '');
        if (leadNorm === investorNormalized || (lead && lead.toLowerCase?.() === investorName)) {
          leadCount++;
          break;
        }
      }
    }

    const ratio = rounds.length > 0 ? leadCount / rounds.length : 0;
    const score = leadCount * 2; // 2 points per lead round

    return {
      score: Math.round(score * 10) / 10,
      leadCount,
      ratio: Math.round(ratio * 100) / 100,
    };
  }

  private calculateRecencyScore(rounds: any[]): {
    score: number;
    lastDate: number | null;
    last90Days: number;
    lastYear: number;
  } {
    const now = Math.floor(Date.now() / 1000);
    let lastDate: number | null = null;
    let last30Days = 0;
    let last90Days = 0;
    let last180Days = 0;
    let lastYear = 0;

    for (const round of rounds) {
      if (!round.date) continue;
      
      const date = round.date;
      const daysAgo = (now - date) / 86400;
      
      if (!lastDate || date > lastDate) {
        lastDate = date;
      }
      
      if (daysAgo <= 30) last30Days++;
      if (daysAgo <= 90) last90Days++;
      if (daysAgo <= 180) last180Days++;
      if (daysAgo <= 365) lastYear++;
    }

    // Score weighted by recency
    const score = 
      (last30Days * RECENCY_WEIGHTS[30]) +
      (last90Days * RECENCY_WEIGHTS[90]) +
      (last180Days * RECENCY_WEIGHTS[180]) +
      (lastYear * RECENCY_WEIGHTS[365]);

    return {
      score: Math.round(score * 10) / 10,
      lastDate,
      last90Days,
      lastYear,
    };
  }

  private async countTier1Coinvest(investorId: string, tier1Ids: Set<string>): Promise<number> {
    const relations = await this.coinvestModel.find({
      $or: [
        { investor_a: investorId },
        { investor_b: investorId },
      ],
    }).lean();

    let count = 0;
    for (const rel of relations) {
      const partnerId = rel.investor_a === investorId ? rel.investor_b : rel.investor_a;
      if (tier1Ids.has(partnerId)) {
        count++;
      }
    }

    return count;
  }

  private getSmartMoneyTier(score: number, tier1Partners: number): 'ALPHA' | 'SMART' | 'FOLLOWER' | 'RETAIL' {
    if (score >= 100 && tier1Partners >= 10) return 'ALPHA';
    if (score >= 50 || tier1Partners >= 5) return 'SMART';
    if (score >= 20 || tier1Partners >= 2) return 'FOLLOWER';
    return 'RETAIL';
  }

  // ==============================
  // 3. FOLLOW PATTERN DETECTION
  // ==============================

  /**
   * Detect who follows whom
   */
  async detectFollowPatterns(): Promise<{
    relations_found: number;
    top_leaders: any[];
    top_followers: any[];
  }> {
    console.log('[SmartMoney] Detecting follow patterns...');
    
    const allRounds = await this.fundraisingModel
      .find({ date: { $exists: true, $ne: null } })
      .sort({ date: 1 })
      .lean();

    // Track first appearance per project
    const projectFirstInvestors = new Map<string, Map<string, number>>(); // project -> investor -> date
    
    for (const round of allRounds) {
      const project = round.project || round.coin_name;
      if (!project || !Array.isArray(round.investors)) continue;
      
      if (!projectFirstInvestors.has(project)) {
        projectFirstInvestors.set(project, new Map());
      }
      
      const projectMap = projectFirstInvestors.get(project)!;
      
      for (const inv of round.investors) {
        const invNorm = normalizeRawName(typeof inv === 'string' ? inv : inv?.name || '');
        if (!invNorm) continue;
        
        if (!projectMap.has(invNorm)) {
          projectMap.set(invNorm, round.date);
        }
      }
    }

    // Build follow relations
    const followMap = new Map<string, { count: number; projects: string[] }>();
    
    for (const [project, investorDates] of projectFirstInvestors) {
      const sorted = Array.from(investorDates.entries())
        .sort((a, b) => a[1] - b[1]);
      
      // First investor is the "leader" for this project
      if (sorted.length < 2) continue;
      
      const [leaderId] = sorted[0];
      
      for (let i = 1; i < sorted.length; i++) {
        const [followerId] = sorted[i];
        const key = `${leaderId}::${followerId}`;
        
        if (!followMap.has(key)) {
          followMap.set(key, { count: 0, projects: [] });
        }
        
        const rel = followMap.get(key)!;
        rel.count++;
        if (rel.projects.length < 10) {
          rel.projects.push(project);
        }
      }
    }

    // Save significant follow relations (count >= 3)
    await this.followModel.deleteMany({});
    
    const followRelations: FollowRelation[] = [];
    for (const [key, data] of followMap) {
      if (data.count < 3) continue;
      
      const [leaderId, followerId] = key.split('::');
      followRelations.push({
        leader_id: leaderId,
        follower_id: followerId,
        follow_count: data.count,
        follow_ratio: 0, // Will be computed
        avg_delay_days: 0,
        sample_projects: data.projects,
      });
    }

    if (followRelations.length > 0) {
      await this.followModel.insertMany(followRelations);
    }

    // Aggregate leader/follower stats
    const leaderStats = await this.followModel.aggregate([
      { $group: { _id: '$leader_id', total_followers: { $sum: '$follow_count' } } },
      { $sort: { total_followers: -1 } },
      { $limit: 20 },
    ]);

    const followerStats = await this.followModel.aggregate([
      { $group: { _id: '$follower_id', total_follows: { $sum: '$follow_count' } } },
      { $sort: { total_follows: -1 } },
      { $limit: 20 },
    ]);

    // Enrich with names
    const enrichWithNames = async (stats: any[]) => {
      return Promise.all(stats.map(async (s) => {
        const entity = await this.canonicalModel.findOne({ canonical_id: s._id }).lean() as any;
        return {
          canonical_id: s._id,
          name: entity?.display_name || s._id,
          count: s.total_followers || s.total_follows,
        };
      }));
    };

    console.log(`[SmartMoney] Found ${followRelations.length} follow relations`);

    return {
      relations_found: followRelations.length,
      top_leaders: await enrichWithNames(leaderStats),
      top_followers: await enrichWithNames(followerStats),
    };
  }

  // ==============================
  // 4. SMART MONEY API
  // ==============================

  /**
   * Get smart money profile for investor
   */
  async getSmartMoneyProfile(investorName: string): Promise<SmartMoneyProfile | null> {
    const normalized = normalizeRawName(investorName);
    
    const profile = await this.smartMoneyModel.findOne({
      $or: [
        { canonical_id: normalized },
        { display_name: { $regex: new RegExp(investorName, 'i') } },
      ],
    }).lean().exec();

    if (!profile) return null;
    return profile as unknown as SmartMoneyProfile;
  }

  /**
   * Get smart money leaderboard
   */
  async getSmartMoneyLeaderboard(tier?: string, limit = 50): Promise<any[]> {
    const filter: any = {};
    if (tier) {
      filter.smart_money_tier = tier;
    }

    return this.smartMoneyModel
      .find(filter)
      .sort({ smart_money_score: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get follow relations for investor
   */
  async getFollowRelations(investorName: string): Promise<{
    leads: any[];
    follows: any[];
  }> {
    const normalized = normalizeRawName(investorName);
    
    const [leads, follows] = await Promise.all([
      this.followModel.find({ leader_id: normalized }).sort({ follow_count: -1 }).limit(20).lean(),
      this.followModel.find({ follower_id: normalized }).sort({ follow_count: -1 }).limit(20).lean(),
    ]);

    const enrichRelations = async (rels: any[], idField: string) => {
      return Promise.all(rels.map(async (r) => {
        const id = r[idField];
        const entity = await this.canonicalModel.findOne({ canonical_id: id }).lean() as any;
        return {
          ...r,
          name: entity?.display_name || id,
          tier: entity?.tier,
        };
      }));
    };

    return {
      leads: await enrichRelations(follows, 'leader_id'),
      follows: await enrichRelations(leads, 'follower_id'),
    };
  }

  /**
   * Full smart money pipeline
   */
  async runFullPipeline(): Promise<any> {
    const startTime = Date.now();
    console.log('[SmartMoney] Starting full smart money pipeline...');
    
    // 1. Cleanup coinvest
    const coinvestCleanup = await this.cleanupCoinvest();
    
    // 2. Enhanced scoring
    const enhancedScores = await this.calculateEnhancedScores();
    
    // 3. Follow patterns
    const followPatterns = await this.detectFollowPatterns();
    
    const duration = Date.now() - startTime;
    console.log(`[SmartMoney] Pipeline complete in ${duration}ms`);

    return {
      status: 'success',
      duration_ms: duration,
      coinvest_cleanup: coinvestCleanup,
      enhanced_scores: {
        updated: enhancedScores.updated,
        tier_distribution: enhancedScores.tier_distribution,
      },
      follow_patterns: {
        relations_found: followPatterns.relations_found,
      },
      top_smart_money: enhancedScores.top_smart_money.slice(0, 10),
      top_leaders: followPatterns.top_leaders.slice(0, 5),
    };
  }

  /**
   * Stats
   */
  async getStats(): Promise<any> {
    const [
      profilesCount,
      coinvestCount,
      followCount,
      tierDist,
    ] = await Promise.all([
      this.smartMoneyModel.countDocuments({}),
      this.coinvestModel.countDocuments({}),
      this.followModel.countDocuments({}),
      this.smartMoneyModel.aggregate([
        { $group: { _id: '$smart_money_tier', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      smart_money_profiles: profilesCount,
      coinvest_relations_clean: coinvestCount,
      follow_relations: followCount,
      tier_distribution: tierDist,
    };
  }
}
