/**
 * Investor Extraction Service
 * 
 * Extracts and aggregates investor data from funding rounds.
 * This eliminates the need for separate investor API endpoints.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

interface ExtractedInvestor {
  key: string;
  name: string;
  slug?: string;
  source: string;
  tier?: number;
  type?: string;
  category?: string;
  rounds_count: number;
  total_invested: number;
  projects: string[];
  first_seen: Date;
  last_seen: Date;
  updated_at: Date;
}

@Injectable()
export class InvestorExtractionService {
  constructor(
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
  ) {}

  /**
   * Extract all investors from funding rounds and save to investors collection
   */
  async extractAndSaveInvestors(): Promise<{
    total: number;
    saved: number;
    sources: Record<string, number>;
  }> {
    console.log('[InvestorExtraction] Starting extraction from funding rounds...');

    const investorMap = new Map<string, ExtractedInvestor>();
    
    // Process CryptoRank funding rounds
    const crRounds = await this.fundraisingModel.find({
      source: 'cryptorank',
      'investors.0': { $exists: true }
    }).lean();
    
    console.log(`[InvestorExtraction] Processing ${crRounds.length} CryptoRank rounds...`);
    this.processRounds(crRounds, 'cryptorank', investorMap);

    // Process Dropstab funding rounds  
    const dsRounds = await this.fundraisingModel.find({
      source: 'dropstab',
      'investors.0': { $exists: true }
    }).lean();
    
    console.log(`[InvestorExtraction] Processing ${dsRounds.length} Dropstab rounds...`);
    this.processRounds(dsRounds, 'dropstab', investorMap);

    // Save to MongoDB
    console.log(`[InvestorExtraction] Saving ${investorMap.size} unique investors...`);
    
    let saved = 0;
    const sourceCounts: Record<string, number> = {};

    for (const investor of investorMap.values()) {
      try {
        await this.investorsModel.updateOne(
          { key: investor.key },
          { 
            $set: {
              ...investor,
              investments_count: investor.rounds_count,
            }
          },
          { upsert: true }
        );
        saved++;
        sourceCounts[investor.source] = (sourceCounts[investor.source] || 0) + 1;
      } catch (e) {
        console.error(`[InvestorExtraction] Error saving ${investor.name}:`, e.message);
      }
    }

    console.log(`[InvestorExtraction] Complete: ${saved} investors saved`);

    return {
      total: investorMap.size,
      saved,
      sources: sourceCounts,
    };
  }

  /**
   * Process funding rounds and extract investors
   */
  private processRounds(
    rounds: any[], 
    source: string, 
    investorMap: Map<string, ExtractedInvestor>
  ): void {
    for (const round of rounds) {
      const investors = round.investors || [];
      const projectName = round.project || round.project_key || 'unknown';
      const roundDate = round.date ? new Date(round.date * 1000) : new Date();
      const amount = round.amount || 0;

      for (const inv of investors) {
        // Handle both object and string formats
        const name = typeof inv === 'string' ? inv : inv.name;
        if (!name) continue;

        const slug = typeof inv === 'object' ? (inv.slug || inv.key) : null;
        const key = `extracted:${source}:${this.slugify(name)}`;

        if (investorMap.has(key)) {
          // Update existing
          const existing = investorMap.get(key)!;
          existing.rounds_count++;
          existing.total_invested += amount;
          if (!existing.projects.includes(projectName)) {
            existing.projects.push(projectName);
          }
          if (roundDate < existing.first_seen) {
            existing.first_seen = roundDate;
          }
          if (roundDate > existing.last_seen) {
            existing.last_seen = roundDate;
          }
          // Update tier/type if better info available
          if (typeof inv === 'object') {
            if (inv.tier && (!existing.tier || inv.tier < existing.tier)) {
              existing.tier = inv.tier;
            }
            if (inv.type && !existing.type) {
              existing.type = inv.type;
            }
            if (inv.category && !existing.category) {
              existing.category = typeof inv.category === 'object' ? inv.category.name : inv.category;
            }
          }
        } else {
          // Create new
          investorMap.set(key, {
            key,
            name,
            slug: slug || this.slugify(name),
            source: `extracted_from_${source}`,
            tier: typeof inv === 'object' ? inv.tier : undefined,
            type: typeof inv === 'object' ? inv.type : undefined,
            category: typeof inv === 'object' 
              ? (typeof inv.category === 'object' ? inv.category?.name : inv.category) 
              : undefined,
            rounds_count: 1,
            total_invested: amount,
            projects: [projectName],
            first_seen: roundDate,
            last_seen: roundDate,
            updated_at: new Date(),
          });
        }
      }
    }
  }

  /**
   * Get extraction stats without modifying data
   */
  async getExtractionStats(): Promise<{
    potential_investors: number;
    rounds_with_investors: number;
    current_investors: number;
    sources: Record<string, number>;
  }> {
    const investorMap = new Map<string, boolean>();
    const sourceCounts: Record<string, number> = {};

    // Count from CryptoRank
    const crRounds = await this.fundraisingModel.find({
      source: 'cryptorank',
      'investors.0': { $exists: true }
    }, { investors: 1 }).lean();

    for (const round of crRounds) {
      for (const inv of round.investors || []) {
        const name = typeof inv === 'string' ? inv : inv.name;
        if (name) {
          const key = `cryptorank:${this.slugify(name)}`;
          if (!investorMap.has(key)) {
            investorMap.set(key, true);
            sourceCounts['cryptorank'] = (sourceCounts['cryptorank'] || 0) + 1;
          }
        }
      }
    }

    // Count from Dropstab
    const dsRounds = await this.fundraisingModel.find({
      source: 'dropstab',
      'investors.0': { $exists: true }
    }, { investors: 1 }).lean();

    for (const round of dsRounds) {
      for (const inv of round.investors || []) {
        const name = typeof inv === 'string' ? inv : inv.name;
        if (name) {
          const key = `dropstab:${this.slugify(name)}`;
          if (!investorMap.has(key)) {
            investorMap.set(key, true);
            sourceCounts['dropstab'] = (sourceCounts['dropstab'] || 0) + 1;
          }
        }
      }
    }

    const currentInvestors = await this.investorsModel.countDocuments();

    return {
      potential_investors: investorMap.size,
      rounds_with_investors: crRounds.length + dsRounds.length,
      current_investors: currentInvestors,
      sources: sourceCounts,
    };
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
