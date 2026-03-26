/**
 * Entity Normalizer Service
 * 
 * BLOCK 6: Normalizes extracted entities to canonical IDs
 * - Matches against known entities in DB
 * - Handles aliases and variations
 * - IMPROVED: Fuzzy matching + known aliases
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractedEntities } from '../extractors/entity-extractor.service';

export interface NormalizedEntity {
  name: string;
  canonicalId: string;
  type: 'project' | 'fund' | 'token' | 'person';
  confidence: number;
  matched: boolean;
}

export interface NormalizedEntities {
  projects: NormalizedEntity[];
  funds: NormalizedEntity[];
  tokens: NormalizedEntity[];
  persons: NormalizedEntity[];
  all: NormalizedEntity[];
}

// KNOWN ALIASES - Critical for match rate improvement
const KNOWN_ALIASES: Record<string, string> = {
  // Funds
  'a16z': 'andreessen-horowitz',
  'andreessen': 'andreessen-horowitz',
  'andreessen horowitz': 'andreessen-horowitz',
  'a16zcrypto': 'andreessen-horowitz',
  'paradigm': 'paradigm',
  'paradigm capital': 'paradigm',
  'polychain': 'polychain-capital',
  'polychain capital': 'polychain-capital',
  'multicoin': 'multicoin-capital',
  'multicoin capital': 'multicoin-capital',
  'pantera': 'pantera-capital',
  'pantera capital': 'pantera-capital',
  'sequoia': 'sequoia-capital',
  'sequoia capital': 'sequoia-capital',
  'dragonfly': 'dragonfly-capital',
  'dragonfly capital': 'dragonfly-capital',
  'jump': 'jump-crypto',
  'jump crypto': 'jump-crypto',
  'jump trading': 'jump-crypto',
  'binance': 'binance-labs',
  'binance labs': 'binance-labs',
  'coinbase': 'coinbase-ventures',
  'coinbase ventures': 'coinbase-ventures',
  'framework': 'framework-ventures',
  'framework ventures': 'framework-ventures',
  'variant': 'variant-fund',
  'variant fund': 'variant-fund',
  'electric': 'electric-capital',
  'electric capital': 'electric-capital',
  'galaxy': 'galaxy-digital',
  'galaxy digital': 'galaxy-digital',
  'fenbushi': 'fenbushi-capital',
  'fenbushi capital': 'fenbushi-capital',
  'digital currency group': 'dcg',
  'dcg': 'dcg',
  'grayscale': 'grayscale-investments',
  
  // Projects
  'ethereum': 'ethereum',
  'eth': 'ethereum',
  'bitcoin': 'bitcoin',
  'btc': 'bitcoin',
  'solana': 'solana',
  'sol': 'solana',
  'polygon': 'polygon',
  'matic': 'polygon',
  'arbitrum': 'arbitrum',
  'arb': 'arbitrum',
  'optimism': 'optimism',
  'op': 'optimism',
  'base': 'base',
  'avalanche': 'avalanche',
  'avax': 'avalanche',
  'near': 'near-protocol',
  'near protocol': 'near-protocol',
  'cosmos': 'cosmos',
  'atom': 'cosmos',
  'uniswap': 'uniswap',
  'uni': 'uniswap',
  'aave': 'aave',
  'compound': 'compound',
  'comp': 'compound',
  'chainlink': 'chainlink',
  'link': 'chainlink',
  'opensea': 'opensea',
  'blur': 'blur',
  'worldcoin': 'worldcoin',
  'layerzero': 'layerzero',
  'eigenlayer': 'eigenlayer',
  'celestia': 'celestia',
  'starknet': 'starknet',
  'starkware': 'starknet',
  'zksync': 'zksync',
  'matter labs': 'zksync',
};

@Injectable()
export class EntityNormalizerService {
  private readonly logger = new Logger(EntityNormalizerService.name);

  // Cache for entity lookups
  private projectCache = new Map<string, string>();
  private fundCache = new Map<string, string>();
  private lastCacheRefresh = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectModel('canonical_entities') private entitiesModel: Model<any>,
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_projects') private projectsModel: Model<any>,
  ) {}

  /**
   * Normalize extracted entities to canonical IDs
   */
  async normalize(extracted: ExtractedEntities): Promise<NormalizedEntities> {
    await this.refreshCacheIfNeeded();

    const projects = await this.normalizeList(extracted.projects, 'project');
    const funds = await this.normalizeList(extracted.funds, 'fund');
    const tokens = await this.normalizeList(extracted.tokens, 'token');
    const persons = await this.normalizeList(extracted.persons, 'person');

    const all = [...projects, ...funds, ...tokens, ...persons];

    return { projects, funds, tokens, persons, all };
  }

  /**
   * Normalize a list of entity names
   */
  private async normalizeList(
    names: string[],
    type: 'project' | 'fund' | 'token' | 'person',
  ): Promise<NormalizedEntity[]> {
    const results: NormalizedEntity[] = [];

    for (const name of names) {
      const normalized = await this.normalizeOne(name, type);
      results.push(normalized);
    }

    return results;
  }

  /**
   * Normalize a single entity name
   */
  private async normalizeOne(
    name: string,
    type: 'project' | 'fund' | 'token' | 'person',
  ): Promise<NormalizedEntity> {
    const slug = this.slugify(name);
    const lowerName = name.toLowerCase();

    // 1. Check known aliases FIRST (highest confidence)
    if (KNOWN_ALIASES[lowerName]) {
      return {
        name,
        canonicalId: KNOWN_ALIASES[lowerName],
        type,
        confidence: 0.98,
        matched: true,
      };
    }

    // Also check slug form
    if (KNOWN_ALIASES[slug]) {
      return {
        name,
        canonicalId: KNOWN_ALIASES[slug],
        type,
        confidence: 0.97,
        matched: true,
      };
    }

    // 2. Try cache
    if (type === 'fund' && this.fundCache.has(slug)) {
      return {
        name,
        canonicalId: this.fundCache.get(slug)!,
        type,
        confidence: 0.95,
        matched: true,
      };
    }

    if (type === 'project' && this.projectCache.has(slug)) {
      return {
        name,
        canonicalId: this.projectCache.get(slug)!,
        type,
        confidence: 0.95,
        matched: true,
      };
    }

    // 3. Try DB lookup
    const canonicalId = await this.lookupInDB(name, slug, type);

    // 4. Try fuzzy matching if no exact match
    if (!canonicalId) {
      const fuzzyMatch = await this.fuzzyMatch(name, type);
      if (fuzzyMatch) {
        return {
          name,
          canonicalId: fuzzyMatch.id,
          type,
          confidence: fuzzyMatch.confidence,
          matched: true,
        };
      }
    }

    if (canonicalId) {
      // Update cache
      if (type === 'fund') {
        this.fundCache.set(slug, canonicalId);
      } else if (type === 'project') {
        this.projectCache.set(slug, canonicalId);
      }

      return {
        name,
        canonicalId,
        type,
        confidence: 0.9,
        matched: true,
      };
    }

    // No match found - use slug as ID
    return {
      name,
      canonicalId: `${type}:${slug}`,
      type,
      confidence: 0.6, // Lower confidence for unmatched
      matched: false,
    };
  }

  /**
   * Lookup entity in database
   */
  private async lookupInDB(
    name: string,
    slug: string,
    type: string,
  ): Promise<string | null> {
    try {
      // Try canonical entities first
      const canonical = await this.entitiesModel.findOne({
        $or: [
          { slug },
          { name: { $regex: new RegExp(`^${name}$`, 'i') } },
          { aliases: { $in: [name, slug] } },
        ],
      }).lean() as any;

      if (canonical) {
        return canonical.canonical_id || canonical.slug;
      }

      // Try type-specific collections
      if (type === 'fund') {
        const investor = await this.investorsModel.findOne({
          $or: [
            { slug },
            { name: { $regex: new RegExp(`^${name}$`, 'i') } },
          ],
        }).lean() as any;

        if (investor) {
          return investor.slug;
        }
      }

      if (type === 'project') {
        const project = await this.projectsModel.findOne({
          $or: [
            { slug },
            { name: { $regex: new RegExp(`^${name}$`, 'i') } },
          ],
        }).lean() as any;

        if (project) {
          return project.slug;
        }
      }
    } catch (e: any) {
      this.logger.warn(`[EntityNormalizer] DB lookup failed: ${e.message}`);
    }

    return null;
  }

  /**
   * Refresh cache if needed
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheRefresh < this.CACHE_TTL) {
      return;
    }

    try {
      // Load top funds
      const funds = await this.investorsModel
        .find({})
        .select('slug name')
        .limit(5000)
        .lean();

      this.fundCache.clear();
      for (const f of funds) {
        if (f.slug) {
          this.fundCache.set(f.slug, f.slug);
          if (f.name) {
            this.fundCache.set(this.slugify(f.name), f.slug);
          }
        }
      }

      // Load top projects
      const projects = await this.projectsModel
        .find({})
        .select('slug name')
        .limit(5000)
        .lean();

      this.projectCache.clear();
      for (const p of projects) {
        if (p.slug) {
          this.projectCache.set(p.slug, p.slug);
          if (p.name) {
            this.projectCache.set(this.slugify(p.name), p.slug);
          }
        }
      }

      this.lastCacheRefresh = now;
      this.logger.debug(
        `[EntityNormalizer] Cache refreshed: ${this.fundCache.size} funds, ${this.projectCache.size} projects`
      );
    } catch (e: any) {
      this.logger.warn(`[EntityNormalizer] Cache refresh failed: ${e.message}`);
    }
  }

  /**
   * Slugify a name
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // ═══════════════════════════════════════════════════════════════
  // FUZZY MATCHING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fuzzy match against cache
   */
  private async fuzzyMatch(
    name: string,
    type: string,
  ): Promise<{ id: string; confidence: number } | null> {
    const slug = this.slugify(name);
    const cache = type === 'fund' ? this.fundCache : this.projectCache;

    let bestMatch: { id: string; similarity: number } | null = null;

    for (const [key, id] of cache.entries()) {
      const similarity = this.stringSimilarity(slug, key);
      
      if (similarity > 0.85 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { id, similarity };
      }
    }

    if (bestMatch) {
      return {
        id: bestMatch.id,
        confidence: Math.round(bestMatch.similarity * 100) / 100,
      };
    }

    return null;
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   */
  private stringSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Check if one is substring of other
    if (s1.includes(s2) || s2.includes(s1)) {
      const minLen = Math.min(s1.length, s2.length);
      const maxLen = Math.max(s1.length, s2.length);
      return minLen / maxLen;
    }

    // Levenshtein distance
    const matrix: number[][] = [];
    
    for (let i = 0; i <= s1.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    const distance = matrix[s1.length][s2.length];
    const maxLen = Math.max(s1.length, s2.length);
    
    return 1 - distance / maxLen;
  }
}
