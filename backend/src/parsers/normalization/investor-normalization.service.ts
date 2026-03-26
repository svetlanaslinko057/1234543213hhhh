/**
 * Investor Normalization Service
 * 
 * Решает проблему дубликатов:
 * - a16z, Andreessen Horowitz, a16z crypto → один entity
 * - Нормализация имён
 * - Alias mapping
 * - Entity merging
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// Известные алиасы инвесторов (расширяемый список)
const INVESTOR_ALIASES: Record<string, string> = {
  // a16z группа
  'a16z': 'andreessen_horowitz',
  'a16zcrypto': 'andreessen_horowitz',
  'andreessenhorowitz': 'andreessen_horowitz',
  'andreessenhorowitzcrypto': 'andreessen_horowitz',
  'a16zventures': 'andreessen_horowitz',
  
  // Paradigm
  'paradigmvc': 'paradigm',
  'paradigmcapital': 'paradigm',
  'paradigmxyz': 'paradigm',
  
  // Sequoia
  'sequoiacapital': 'sequoia',
  'sequoiaventures': 'sequoia',
  'sequoiacapitalindia': 'sequoia',
  'sequoiacapitachina': 'sequoia',
  
  // Binance Labs
  'binanbelabs': 'binance_labs',
  'binanceventures': 'binance_labs',
  'binancefund': 'binance_labs',
  
  // Coinbase
  'coinbaseventures': 'coinbase_ventures',
  'coinbasecrypto': 'coinbase_ventures',
  
  // Polychain
  'polychaincapital': 'polychain',
  'polychainvc': 'polychain',
  
  // Pantera
  'panteracapital': 'pantera',
  'panteravc': 'pantera',
  
  // Galaxy Digital
  'galaxydigital': 'galaxy',
  'galaxydigitalventures': 'galaxy',
  'galaxyventures': 'galaxy',
  
  // Jump
  'jumpcrypto': 'jump',
  'jumptrading': 'jump',
  'jumpcapital': 'jump',
  
  // Dragonfly
  'dragonflycapital': 'dragonfly',
  'dragonflyvc': 'dragonfly',
  
  // Three Arrows (3AC)
  'threearrowscapital': 'three_arrows_capital',
  '3ac': 'three_arrows_capital',
  '3arrowscapital': 'three_arrows_capital',
  
  // Framework Ventures
  'frameworkventures': 'framework',
  'frameworkvc': 'framework',
  
  // Multicoin
  'multicoincapital': 'multicoin',
  'multicoinvc': 'multicoin',
  
  // Electric Capital
  'electriccapital': 'electric',
  'electricvc': 'electric',
  
  // Tiger Global
  'tigerglobal': 'tiger_global',
  'tigerglobalmanagement': 'tiger_global',
  
  // Softbank
  'softbankvisiondfund': 'softbank',
  'softbankvisionffund2': 'softbank',
  'softbankventures': 'softbank',
  
  // Animoca
  'animocabrands': 'animoca',
  'animocaventures': 'animoca',
  
  // DeFiance
  'defiancecapital': 'defiance',
  'defiancevc': 'defiance',
  
  // Delphi
  'delphidigital': 'delphi',
  'delphiventures': 'delphi',
  
  // Hack VC
  'hackvc': 'hack_vc',
  'hackventurecapital': 'hack_vc',
  
  // Y Combinator
  'ycombinator': 'y_combinator',
  'yc': 'y_combinator',
};

// Canonical names для display
const CANONICAL_NAMES: Record<string, string> = {
  'andreessen_horowitz': 'Andreessen Horowitz (a16z)',
  'paradigm': 'Paradigm',
  'sequoia': 'Sequoia Capital',
  'binance_labs': 'Binance Labs',
  'coinbase_ventures': 'Coinbase Ventures',
  'polychain': 'Polychain Capital',
  'pantera': 'Pantera Capital',
  'galaxy': 'Galaxy Digital',
  'jump': 'Jump Crypto',
  'dragonfly': 'Dragonfly Capital',
  'three_arrows_capital': 'Three Arrows Capital',
  'framework': 'Framework Ventures',
  'multicoin': 'Multicoin Capital',
  'electric': 'Electric Capital',
  'tiger_global': 'Tiger Global',
  'softbank': 'SoftBank',
  'animoca': 'Animoca Brands',
  'defiance': 'DeFiance Capital',
  'delphi': 'Delphi Digital',
  'hack_vc': 'Hack VC',
  'y_combinator': 'Y Combinator',
};

// Confidence по источнику
const SOURCE_CONFIDENCE: Record<string, number> = {
  'dropstab': 0.9,
  'cryptorank': 0.8,
  'extracted_from_dropstab': 0.85,
  'extracted_from_cryptorank': 0.75,
  'manual': 1.0,
};

export interface NormalizedInvestorEntity {
  canonical_id: string;
  canonical_name: string;
  aliases: string[];
  sources: string[];
  rounds_count: number;
  total_invested: number;
  projects: string[];
  tier: number | null;
  confidence: number;
  original_records: string[]; // keys из базы
  updated_at: Date;
}

@Injectable()
export class InvestorNormalizationService {
  constructor(
    @InjectModel('intel_investors') private investorsModel: Model<any>,
    @InjectModel('intel_fundraising') private fundraisingModel: Model<any>,
    @InjectModel('normalized_investors') private normalizedModel: Model<any>,
  ) {}

  /**
   * Нормализация имени инвестора
   */
  normalizeName(name: string): string {
    if (!name) return '';
    
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // удаляем всё кроме букв и цифр
      .trim();
  }

  /**
   * Получить canonical ID из имени
   */
  getCanonicalId(name: string): string {
    const normalized = this.normalizeName(name);
    
    // Проверяем alias map
    if (INVESTOR_ALIASES[normalized]) {
      return INVESTOR_ALIASES[normalized];
    }
    
    // Иначе используем normalized name как ID
    return normalized;
  }

  /**
   * Получить display name
   */
  getCanonicalName(canonicalId: string, originalName: string): string {
    return CANONICAL_NAMES[canonicalId] || originalName;
  }

  /**
   * Вычислить confidence для записи
   */
  getConfidence(source: string): number {
    return SOURCE_CONFIDENCE[source] || 0.5;
  }

  /**
   * Merge два investor records
   */
  mergeInvestors(a: NormalizedInvestorEntity, b: any): NormalizedInvestorEntity {
    // Выбираем лучший tier (меньше = лучше, 1 = топ)
    let tier = a.tier;
    if (b.tier) {
      if (tier === null || (b.tier < tier)) {
        tier = b.tier;
      }
    }

    // Merge projects
    const projects = [...new Set([
      ...a.projects,
      ...(b.projects || []),
    ])];

    // Merge sources
    const sources = [...new Set([
      ...a.sources,
      b.source || 'unknown',
    ])];

    // Merge aliases
    const aliases = [...new Set([
      ...a.aliases,
      b.name,
      b.slug,
    ].filter(Boolean))];

    // Merge original records
    const originalRecords = [...new Set([
      ...a.original_records,
      b.key || b._id?.toString(),
    ].filter(Boolean))];

    // Confidence = max из всех источников
    const newConfidence = this.getConfidence(b.source);
    const confidence = Math.max(a.confidence, newConfidence);

    return {
      ...a,
      aliases,
      sources,
      rounds_count: a.rounds_count + (b.rounds_count || b.investments_count || 0),
      total_invested: a.total_invested + (b.total_invested || b.portfolio_value || 0),
      projects,
      tier,
      confidence,
      original_records: originalRecords,
      updated_at: new Date(),
    };
  }

  /**
   * Полный pipeline нормализации и дедупликации
   */
  async runNormalizationPipeline(): Promise<{
    total_raw: number;
    total_normalized: number;
    duplicates_merged: number;
    top_investors: any[];
  }> {
    console.log('[Normalization] Starting investor normalization pipeline...');

    // 1. Получаем всех инвесторов
    const allInvestors = await this.investorsModel.find({}).lean();
    console.log(`[Normalization] Found ${allInvestors.length} raw investors`);

    // 2. Группируем по canonical_id
    const entityMap = new Map<string, NormalizedInvestorEntity>();

    for (const inv of allInvestors) {
      const canonicalId = this.getCanonicalId(inv.name);
      
      if (entityMap.has(canonicalId)) {
        // Merge с существующим
        const existing = entityMap.get(canonicalId)!;
        entityMap.set(canonicalId, this.mergeInvestors(existing, inv));
      } else {
        // Создаём новый entity
        const entity: NormalizedInvestorEntity = {
          canonical_id: canonicalId,
          canonical_name: this.getCanonicalName(canonicalId, inv.name),
          aliases: [inv.name, inv.slug].filter(Boolean),
          sources: [inv.source || 'unknown'],
          rounds_count: inv.rounds_count || inv.investments_count || 0,
          total_invested: inv.total_invested || inv.portfolio_value || 0,
          projects: inv.projects || [],
          tier: inv.tier || null,
          confidence: this.getConfidence(inv.source),
          original_records: [inv.key || inv._id?.toString()].filter(Boolean),
          updated_at: new Date(),
        };
        entityMap.set(canonicalId, entity);
      }
    }

    console.log(`[Normalization] Reduced to ${entityMap.size} unique entities`);

    // 3. Дополняем из fundraising rounds
    const allRounds = await this.fundraisingModel.find({}).lean();
    console.log(`[Normalization] Processing ${allRounds.length} funding rounds for investor data...`);

    for (const round of allRounds) {
      if (!Array.isArray(round.investors)) continue;
      
      for (const inv of round.investors) {
        const invName = typeof inv === 'string' ? inv : inv.name;
        if (!invName) continue;

        const canonicalId = this.getCanonicalId(invName);
        
        if (entityMap.has(canonicalId)) {
          const existing = entityMap.get(canonicalId)!;
          
          // Добавляем проект
          const projectName = round.project || round.coin_name;
          if (projectName && !existing.projects.includes(projectName)) {
            existing.projects.push(projectName);
          }
          
          // Добавляем alias
          if (!existing.aliases.includes(invName)) {
            existing.aliases.push(invName);
          }
        } else {
          // Новый инвестор из funding round
          const entity: NormalizedInvestorEntity = {
            canonical_id: canonicalId,
            canonical_name: this.getCanonicalName(canonicalId, invName),
            aliases: [invName],
            sources: [`extracted_from_${round.source || 'unknown'}`],
            rounds_count: 1,
            total_invested: round.amount || 0,
            projects: [round.project || round.coin_name].filter(Boolean),
            tier: typeof inv === 'object' ? inv.tier : null,
            confidence: this.getConfidence(`extracted_from_${round.source || 'unknown'}`),
            original_records: [],
            updated_at: new Date(),
          };
          entityMap.set(canonicalId, entity);
        }
      }
    }

    console.log(`[Normalization] After funding round extraction: ${entityMap.size} entities`);

    // 4. Сохраняем в normalized_investors коллекцию
    const entities = Array.from(entityMap.values());
    
    // Сортируем по rounds_count
    entities.sort((a, b) => b.rounds_count - a.rounds_count);

    // Bulk upsert
    const bulkOps = entities.map(entity => ({
      updateOne: {
        filter: { canonical_id: entity.canonical_id },
        update: { $set: entity },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.normalizedModel.bulkWrite(bulkOps);
    }

    const duplicatesMerged = allInvestors.length - entityMap.size;

    console.log(`[Normalization] Pipeline complete!`);
    console.log(`  - Raw records: ${allInvestors.length}`);
    console.log(`  - Normalized entities: ${entityMap.size}`);
    console.log(`  - Duplicates merged: ${duplicatesMerged}`);

    // Топ-20 инвесторов
    const topInvestors = entities.slice(0, 20).map(e => ({
      canonical_id: e.canonical_id,
      name: e.canonical_name,
      rounds: e.rounds_count,
      projects_count: e.projects.length,
      tier: e.tier,
      confidence: e.confidence,
      sources: e.sources,
    }));

    return {
      total_raw: allInvestors.length,
      total_normalized: entityMap.size,
      duplicates_merged: duplicatesMerged,
      top_investors: topInvestors,
    };
  }

  /**
   * Получить нормализованного инвестора по имени
   */
  async findByName(name: string): Promise<NormalizedInvestorEntity | null> {
    const canonicalId = this.getCanonicalId(name);
    const result = await this.normalizedModel.findOne({ canonical_id: canonicalId }).lean().exec();
    if (!result) return null;
    return result as unknown as NormalizedInvestorEntity;
  }

  /**
   * Поиск co-investors
   */
  async findCoInvestors(investorName: string, limit = 20): Promise<any[]> {
    const canonicalId = this.getCanonicalId(investorName);
    const result = await this.normalizedModel.findOne({ canonical_id: canonicalId }).lean().exec();
    const investor = result as unknown as NormalizedInvestorEntity | null;
    
    if (!investor || !investor.projects || !investor.projects.length) {
      return [];
    }

    const investorProjects = investor.projects;

    // Найти всех инвесторов, которые инвестировали в те же проекты
    const coInvestors = await this.normalizedModel.aggregate([
      {
        $match: {
          canonical_id: { $ne: canonicalId },
          projects: { $in: investorProjects },
        },
      },
      {
        $addFields: {
          common_projects: {
            $size: {
              $setIntersection: ['$projects', investorProjects],
            },
          },
        },
      },
      { $sort: { common_projects: -1 } },
      { $limit: limit },
      {
        $project: {
          canonical_id: 1,
          canonical_name: 1,
          common_projects: 1,
          rounds_count: 1,
          tier: 1,
        },
      },
    ]);

    return coInvestors;
  }

  /**
   * Статистика нормализации
   */
  async getStats(): Promise<any> {
    const [rawCount, normalizedCount, bySource, byTier] = await Promise.all([
      this.investorsModel.countDocuments({}),
      this.normalizedModel.countDocuments({}),
      this.normalizedModel.aggregate([
        { $unwind: '$sources' },
        { $group: { _id: '$sources', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.normalizedModel.aggregate([
        { $match: { tier: { $ne: null } } },
        { $group: { _id: '$tier', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      raw_investors: rawCount,
      normalized_investors: normalizedCount,
      dedup_ratio: rawCount > 0 ? ((rawCount - normalizedCount) / rawCount * 100).toFixed(1) + '%' : '0%',
      by_source: bySource,
      by_tier: byTier,
    };
  }

  /**
   * Добавить новый alias
   */
  addAlias(alias: string, canonicalId: string): void {
    const normalized = this.normalizeName(alias);
    INVESTOR_ALIASES[normalized] = canonicalId;
    console.log(`[Normalization] Added alias: ${alias} → ${canonicalId}`);
  }
}
