/**
 * Entity Normalizer Service
 * 
 * BLOCK 6: Normalizes extracted entities to canonical IDs
 * - Matches against known entities in DB
 * - Handles aliases and variations
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

    // Try cache first
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

    // Try DB lookup
    const canonicalId = await this.lookupInDB(name, slug, type);

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
}
