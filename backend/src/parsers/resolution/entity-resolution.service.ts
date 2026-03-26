/**
 * Entity Resolution Service
 * 
 * NestJS сервис для Entity Resolution Engine
 * Выполняет полный pipeline:
 * - Resolution всех инвесторов
 * - Построение coinvest графа с весами
 * - Investor scoring & tiering
 * - Data quality boost
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  normalizeRawName,
  resolveInvestor,
  mergeEntities,
  createNewEntity,
  computeInvestorScore,
  getInvestorTier,
  buildCoinvestMap,
  coinvestMapToArray,
  validateFundingRoundQuality,
  validateInvestorQuality,
  findPotentialDuplicates,
  compareTwoNames,
  CanonicalInvestor,
  CoinvestRelation,
} from './entity-resolution.engine';

@Injectable()
export class EntityResolutionService {
  constructor(
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('canonical_investors') private canonicalModel: Model<any>,
    @InjectModel('coinvest_relations') private coinvestModel: Model<any>,
  ) {}

  /**
   * Полный pipeline entity resolution
   */
  async runFullResolution(): Promise<{
    status: string;
    duration_ms: number;
    raw_investors: number;
    resolved_entities: number;
    fuzzy_matches: number;
    new_entities: number;
    coinvest_relations: number;
    data_quality: {
      before: number;
      after: number;
    };
    top_investors: any[];
  }> {
    const startTime = Date.now();
    console.log('[EntityResolution] Starting full resolution pipeline...');

    // 1. Загружаем существующие canonical entities
    const existingEntities = await this.canonicalModel.find({}).lean() as unknown as CanonicalInvestor[];
    console.log(`[EntityResolution] Loaded ${existingEntities.length} existing entities`);

    // 2. Загружаем всех raw инвесторов
    const rawInvestors = await this.investorsModel.find({}).lean();
    console.log(`[EntityResolution] Processing ${rawInvestors.length} raw investors...`);

    // 3. Resolution с entity map
    const entityMap = new Map<string, CanonicalInvestor>();
    
    // Сначала добавляем существующие
    for (const e of existingEntities) {
      entityMap.set(e.canonical_id, e as CanonicalInvestor);
    }

    let fuzzyMatches = 0;
    let newEntities = 0;

    for (const raw of rawInvestors) {
      if (!raw.name) continue;

      const entities = Array.from(entityMap.values());
      const resolution = resolveInvestor(raw.name, entities);

      if (resolution.entity) {
        // Merge с существующей
        const merged = mergeEntities(resolution.entity, {
          name: raw.name,
          source: raw.source || 'unknown',
          rounds_count: raw.investments_count || raw.rounds_count || 0,
          total_invested: raw.portfolio_value || raw.total_invested || 0,
          projects: raw.projects || [],
          key: raw.key,
        });
        entityMap.set(merged.canonical_id, merged);

        if (resolution.match_type === 'fuzzy') {
          fuzzyMatches++;
        }
      } else {
        // Создаём новую сущность
        const newEntity = createNewEntity(raw.name, raw.source || 'unknown', {
          rounds_count: raw.investments_count || raw.rounds_count || 0,
          total_invested: raw.portfolio_value || raw.total_invested || 0,
          projects: raw.projects || [],
          tier: raw.tier,
          key: raw.key,
        });
        entityMap.set(newEntity.canonical_id, newEntity);
        newEntities++;
      }
    }

    console.log(`[EntityResolution] After investor resolution: ${entityMap.size} entities`);
    console.log(`[EntityResolution] Fuzzy matches: ${fuzzyMatches}, New: ${newEntities}`);

    // 4. Обогащаем из funding rounds
    const allRounds = await this.fundraisingModel.find({}).lean();
    console.log(`[EntityResolution] Enriching from ${allRounds.length} funding rounds...`);

    for (const round of allRounds) {
      if (!Array.isArray(round.investors)) continue;

      for (const inv of round.investors) {
        const invName = typeof inv === 'string' ? inv : inv.name;
        if (!invName) continue;

        const entities = Array.from(entityMap.values());
        const resolution = resolveInvestor(invName, entities);

        if (resolution.entity) {
          // Update existing
          const existing = entityMap.get(resolution.entity.canonical_id)!;
          
          // Add project
          const projectName = round.project || round.coin_name;
          if (projectName && !existing.projects.includes(projectName)) {
            existing.projects.push(projectName);
            existing.metrics.unique_projects = existing.projects.length;
          }
          
          // Update dates
          if (round.date) {
            if (!existing.metrics.first_investment || round.date < existing.metrics.first_investment) {
              existing.metrics.first_investment = round.date;
            }
            if (!existing.metrics.last_investment || round.date > existing.metrics.last_investment) {
              existing.metrics.last_investment = round.date;
            }
          }

          // Recalc score & tier
          existing.score = computeInvestorScore(existing.metrics);
          existing.tier = getInvestorTier(existing.score);
          existing.updated_at = new Date();
        } else {
          // New entity from round
          const projectName = round.project || round.coin_name;
          const newEntity = createNewEntity(invName, `extracted_from_${round.source || 'unknown'}`, {
            rounds_count: 1,
            total_invested: round.amount || 0,
            projects: projectName ? [projectName] : [],
          });
          entityMap.set(newEntity.canonical_id, newEntity);
        }
      }
    }

    console.log(`[EntityResolution] After round enrichment: ${entityMap.size} entities`);

    // 5. Сохраняем canonical entities
    const entities = Array.from(entityMap.values());
    
    const bulkOps = entities.map(e => ({
      updateOne: {
        filter: { canonical_id: e.canonical_id },
        update: { $set: e },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.canonicalModel.bulkWrite(bulkOps);
    }
    console.log(`[EntityResolution] Saved ${entities.length} canonical entities`);

    // 6. Строим coinvest graph
    console.log('[EntityResolution] Building coinvest graph...');
    const coinvestMap = buildCoinvestMap(allRounds as any[]);
    const coinvestRelations = coinvestMapToArray(coinvestMap, 2); // min 2 совместных инвестиций

    // Сохраняем coinvest relations
    await this.coinvestModel.deleteMany({});
    if (coinvestRelations.length > 0) {
      await this.coinvestModel.insertMany(coinvestRelations);
    }
    console.log(`[EntityResolution] Saved ${coinvestRelations.length} coinvest relations`);

    // 7. Вычисляем data quality
    const dataQualityBefore = await this.calculateDataQuality();
    
    // 8. Top investors
    const topInvestors = entities
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(e => ({
        canonical_id: e.canonical_id,
        name: e.display_name,
        tier: e.tier,
        score: e.score,
        rounds: e.metrics.rounds_count,
        total_invested: e.metrics.total_invested,
        projects_count: e.metrics.unique_projects,
        confidence: e.confidence,
      }));

    const duration = Date.now() - startTime;
    console.log(`[EntityResolution] Pipeline complete in ${duration}ms`);

    return {
      status: 'success',
      duration_ms: duration,
      raw_investors: rawInvestors.length,
      resolved_entities: entities.length,
      fuzzy_matches: fuzzyMatches,
      new_entities: newEntities,
      coinvest_relations: coinvestRelations.length,
      data_quality: {
        before: dataQualityBefore,
        after: dataQualityBefore, // TODO: recalc after cleanup
      },
      top_investors: topInvestors,
    };
  }

  /**
   * Получить coinvest связи для инвестора
   */
  async getCoinvestors(
    investorName: string,
    minCount = 2,
    limit = 50
  ): Promise<{
    investor: string;
    canonical_id: string;
    coinvestors: any[];
  }> {
    const normalized = normalizeRawName(investorName);

    // Найти canonical entity
    const entityResult = await this.canonicalModel.findOne({
      $or: [
        { canonical_id: normalized },
        { normalized },
        { aliases: investorName.toLowerCase() },
      ],
    }).lean().exec();

    const entity = entityResult as unknown as CanonicalInvestor | null;

    if (!entity) {
      return {
        investor: investorName,
        canonical_id: normalized,
        coinvestors: [],
      };
    }

    // Найти все coinvest relations
    const relations = await this.coinvestModel.find({
      $or: [
        { investor_a: entity.canonical_id },
        { investor_b: entity.canonical_id },
      ],
      count: { $gte: minCount },
    })
    .sort({ count: -1, volume: -1 })
    .limit(limit)
    .lean();

    // Обогащаем информацией о coinvestor
    const coinvestors = await Promise.all(
      relations.map(async (rel: any) => {
        const coId = rel.investor_a === entity.canonical_id ? rel.investor_b : rel.investor_a;
        const coEntity = await this.canonicalModel.findOne({ canonical_id: coId }).lean() as any;
        
        return {
          canonical_id: coId,
          name: coEntity?.display_name || coId,
          tier: coEntity?.tier,
          count: rel.count,
          volume: rel.volume,
          projects_together: rel.projects?.length || 0,
          sample_projects: rel.projects?.slice(0, 5) || [],
        };
      })
    );

    return {
      investor: entity.display_name,
      canonical_id: entity.canonical_id,
      coinvestors,
    };
  }

  /**
   * Поиск потенциальных дубликатов (ещё не merged) - оптимизированная версия
   */
  async findUnmergedDuplicates(threshold = 0.85, limit = 100): Promise<any[]> {
    // Ограничиваем выборку для производительности
    const entities = await this.canonicalModel
      .find({})
      .sort({ score: -1 }) // Начинаем с топовых
      .limit(500) // Ограничение для производительности
      .lean() as any[];
    
    const duplicates: Array<{
      name_a: string;
      name_b: string;
      similarity: number;
      entity_a_id: string;
      entity_b_id: string;
    }> = [];
    
    // O(n²) но с ограниченным n=500
    for (let i = 0; i < entities.length && duplicates.length < limit; i++) {
      for (let j = i + 1; j < entities.length && duplicates.length < limit; j++) {
        const similarity = compareTwoNames(entities[i].display_name, entities[j].display_name);
        if (similarity >= threshold && similarity < 1.0) {
          duplicates.push({
            name_a: entities[i].display_name,
            name_b: entities[j].display_name,
            similarity: Math.round(similarity * 100) / 100,
            entity_a_id: entities[i].canonical_id,
            entity_b_id: entities[j].canonical_id,
          });
        }
      }
    }
    
    return duplicates.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Ручной merge двух entities
   */
  async manualMerge(
    canonicalIdA: string,
    canonicalIdB: string,
    keepId: 'a' | 'b' = 'a'
  ): Promise<CanonicalInvestor | null> {
    const [entityA, entityB] = await Promise.all([
      this.canonicalModel.findOne({ canonical_id: canonicalIdA }).lean() as any,
      this.canonicalModel.findOne({ canonical_id: canonicalIdB }).lean() as any,
    ]);

    if (!entityA || !entityB) {
      return null;
    }

    const [primary, secondary] = keepId === 'a' ? [entityA, entityB] : [entityB, entityA];

    // Merge
    const merged: CanonicalInvestor = {
      ...primary,
      aliases: [...new Set([...primary.aliases, ...secondary.aliases, secondary.display_name.toLowerCase()])],
      sources: [...new Set([...primary.sources, ...secondary.sources])],
      projects: [...new Set([...primary.projects, ...secondary.projects])],
      original_keys: [...new Set([...primary.original_keys, ...secondary.original_keys])],
      metrics: {
        rounds_count: primary.metrics.rounds_count + secondary.metrics.rounds_count,
        total_invested: primary.metrics.total_invested + secondary.metrics.total_invested,
        avg_check: 0,
        unique_projects: 0,
        first_investment: Math.min(
          primary.metrics.first_investment || Infinity,
          secondary.metrics.first_investment || Infinity
        ) || null,
        last_investment: Math.max(
          primary.metrics.last_investment || 0,
          secondary.metrics.last_investment || 0
        ) || null,
      },
      confidence: Math.min(0.99, Math.max(primary.confidence, secondary.confidence) + 0.05),
      updated_at: new Date(),
    };

    // Recalc
    merged.metrics.unique_projects = merged.projects.length;
    if (merged.metrics.rounds_count > 0) {
      merged.metrics.avg_check = Math.round(merged.metrics.total_invested / merged.metrics.rounds_count);
    }
    merged.score = computeInvestorScore(merged.metrics);
    merged.tier = getInvestorTier(merged.score);

    // Save & delete secondary
    await this.canonicalModel.updateOne(
      { canonical_id: primary.canonical_id },
      { $set: merged }
    );
    await this.canonicalModel.deleteOne({ canonical_id: secondary.canonical_id });

    return merged;
  }

  /**
   * Вычислить data quality score
   */
  async calculateDataQuality(): Promise<number> {
    const [fundingTotal, fundingWithAmount, fundingWithDate, fundingWithInvestors] = await Promise.all([
      this.fundraisingModel.countDocuments({}),
      this.fundraisingModel.countDocuments({ amount: { $gt: 0 } }),
      this.fundraisingModel.countDocuments({ date: { $ne: null } }),
      this.fundraisingModel.countDocuments({ 
        investors: { $exists: true, $not: { $size: 0 } } 
      }),
    ]);

    if (fundingTotal === 0) return 0;

    // Weighted average: amount 30%, date 20%, investors 50%
    const amountScore = (fundingWithAmount / fundingTotal) * 30;
    const dateScore = (fundingWithDate / fundingTotal) * 20;
    const investorsScore = (fundingWithInvestors / fundingTotal) * 50;

    return Math.round(amountScore + dateScore + investorsScore);
  }

  /**
   * Получить investor leaderboard
   */
  async getLeaderboard(
    tier?: string,
    limit = 50
  ): Promise<any[]> {
    const filter: any = {};
    if (tier) {
      filter.tier = tier;
    }

    const investors = await this.canonicalModel
      .find(filter)
      .sort({ score: -1 })
      .limit(limit)
      .lean();

    return investors.map((inv: any, index: number) => ({
      rank: index + 1,
      canonical_id: inv.canonical_id,
      name: inv.display_name,
      tier: inv.tier,
      score: inv.score,
      rounds: inv.metrics?.rounds_count || 0,
      total_invested: inv.metrics?.total_invested || 0,
      avg_check: inv.metrics?.avg_check || 0,
      projects_count: inv.metrics?.unique_projects || 0,
      confidence: inv.confidence,
      aliases_count: inv.aliases?.length || 0,
    }));
  }

  /**
   * Stats summary
   */
  async getResolutionStats(): Promise<any> {
    const [
      canonicalCount,
      rawCount,
      coinvestCount,
      tierStats,
      sourceStats,
    ] = await Promise.all([
      this.canonicalModel.countDocuments({}),
      this.investorsModel.countDocuments({}),
      this.coinvestModel.countDocuments({}),
      this.canonicalModel.aggregate([
        { $group: { _id: '$tier', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      this.canonicalModel.aggregate([
        { $unwind: '$sources' },
        { $group: { _id: '$sources', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const dataQuality = await this.calculateDataQuality();

    return {
      canonical_investors: canonicalCount,
      raw_investors: rawCount,
      resolution_ratio: rawCount > 0 ? `${Math.round((1 - canonicalCount / rawCount) * 100)}% deduplicated` : '0%',
      coinvest_relations: coinvestCount,
      data_quality_score: `${dataQuality}%`,
      by_tier: tierStats,
      by_source: sourceStats,
    };
  }
}
