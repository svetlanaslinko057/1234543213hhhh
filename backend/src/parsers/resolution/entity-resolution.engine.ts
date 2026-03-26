/**
 * Entity Resolution Engine
 * 
 * Arkham-level entity resolution for investors:
 * 1. Hard normalization (жёсткая очистка)
 * 2. Fuzzy matching (поиск похожих)
 * 3. Canonical mapping (объединение)
 * 4. Confidence scoring
 * 
 * Цель: 1 инвестор = 1 каноническая сущность
 */

import * as stringSimilarity from 'string-similarity';

// ==============================
// 1. NORMALIZATION (жёсткая чистка)
// ==============================

/**
 * Нормализация имени для matching
 * Удаляет: fund, capital, ventures, vc, labs, dao, llc, inc, etc.
 */
export function normalizeRawName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common suffixes
    .replace(/\s*(fund|capital|ventures|vc|labs|dao|llc|inc|ltd|partners|management|group|crypto|digital|blockchain)\s*/gi, '')
    // Remove special characters
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Нормализация для display name
 */
export function normalizeDisplayName(name: string): string {
  if (!name) return '';
  
  return name
    .trim()
    .replace(/\s+/g, ' '); // collapse whitespace
}

// ==============================
// 2. FUZZY MATCHING ENGINE
// ==============================

const FUZZY_THRESHOLD = 0.92; // INCREASED from 0.88 - safer matching
const FUZZY_REVIEW_THRESHOLD = 0.85; // Below this = skip, 0.85-0.92 = review queue

/**
 * Поиск лучшего match среди кандидатов
 * Returns null if below FUZZY_THRESHOLD
 */
export function findBestMatch(
  name: string, 
  candidates: string[]
): { target: string; rating: number; needsReview: boolean } | null {
  if (!name || !candidates.length) return null;
  
  const result = stringSimilarity.findBestMatch(name, candidates);
  
  if (result.bestMatch.rating >= FUZZY_THRESHOLD) {
    return {
      target: result.bestMatch.target,
      rating: result.bestMatch.rating,
      needsReview: false,
    };
  }
  
  // Review queue - высокий но не уверенный match
  if (result.bestMatch.rating >= FUZZY_REVIEW_THRESHOLD) {
    return {
      target: result.bestMatch.target,
      rating: result.bestMatch.rating,
      needsReview: true, // Flag for manual review
    };
  }
  
  return null;
}

/**
 * Сравнить два имени напрямую
 */
export function compareTwoNames(a: string, b: string): number {
  const normA = normalizeRawName(a);
  const normB = normalizeRawName(b);
  return stringSimilarity.compareTwoStrings(normA, normB);
}

/**
 * Найти все похожие имена в списке
 */
export function findAllMatches(
  name: string, 
  candidates: string[], 
  threshold = FUZZY_THRESHOLD
): Array<{ name: string; rating: number }> {
  const normalized = normalizeRawName(name);
  
  return candidates
    .map(c => ({
      name: c,
      rating: stringSimilarity.compareTwoStrings(normalized, normalizeRawName(c)),
    }))
    .filter(m => m.rating >= threshold)
    .sort((a, b) => b.rating - a.rating);
}

// ==============================
// 3. CANONICAL ENTITY TYPES
// ==============================

export interface CanonicalInvestor {
  canonical_id: string;
  display_name: string;
  normalized: string;
  aliases: string[];
  sources: string[];
  confidence: number;
  
  // Metrics
  metrics: {
    rounds_count: number;
    total_invested: number;
    avg_check: number;
    unique_projects: number;
    first_investment: number | null; // timestamp
    last_investment: number | null;
  };
  
  // Tier (computed from score)
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3' | null;
  score: number;
  
  // Projects
  projects: string[];
  
  // Metadata
  original_keys: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CoinvestRelation {
  investor_a: string;
  investor_b: string;
  count: number;      // сколько раз вместе
  volume: number;     // суммарный объём
  projects: string[]; // какие проекты
  first_together: number | null;
  last_together: number | null;
}

// ==============================
// 4. ENTITY RESOLUTION PIPELINE
// ==============================

export interface EntityResolutionResult {
  entity: CanonicalInvestor | null;
  match_type: 'exact' | 'alias' | 'fuzzy' | 'new';
  match_score: number;
}

/**
 * Основная функция резолвинга инвестора
 */
export function resolveInvestor(
  name: string,
  dbEntities: CanonicalInvestor[]
): EntityResolutionResult {
  const normalized = normalizeRawName(name);
  const nameLower = name.toLowerCase().trim();
  
  // 1. Exact match по normalized
  for (const entity of dbEntities) {
    if (entity.normalized === normalized) {
      return {
        entity,
        match_type: 'exact',
        match_score: 1.0,
      };
    }
  }
  
  // 2. Alias match
  for (const entity of dbEntities) {
    if (entity.aliases.includes(nameLower)) {
      return {
        entity,
        match_type: 'alias',
        match_score: 0.95,
      };
    }
  }
  
  // 3. Fuzzy match
  const normalizedNames = dbEntities.map(e => e.normalized);
  const fuzzyMatch = findBestMatch(normalized, normalizedNames);
  
  if (fuzzyMatch) {
    const matchedEntity = dbEntities.find(e => e.normalized === fuzzyMatch.target);
    if (matchedEntity) {
      return {
        entity: matchedEntity,
        match_type: 'fuzzy',
        match_score: fuzzyMatch.rating,
      };
    }
  }
  
  // 4. No match - return null (новая сущность)
  return {
    entity: null,
    match_type: 'new',
    match_score: 0,
  };
}

// ==============================
// 5. AUTO-MERGE ENGINE
// ==============================

/**
 * Объединить существующую и входящую сущности
 */
export function mergeEntities(
  existing: CanonicalInvestor,
  incoming: {
    name: string;
    source: string;
    rounds_count?: number;
    total_invested?: number;
    projects?: string[];
    key?: string;
  }
): CanonicalInvestor {
  const incomingName = incoming.name.toLowerCase().trim();
  
  // Merge aliases
  const aliases = [...new Set([
    ...existing.aliases,
    incomingName,
    normalizeRawName(incoming.name),
  ])].filter(a => a.length > 0);
  
  // Merge sources
  const sources = [...new Set([
    ...existing.sources,
    incoming.source,
  ])].filter(s => s.length > 0);
  
  // Merge projects
  const projects = [...new Set([
    ...existing.projects,
    ...(incoming.projects || []),
  ])].filter(p => p && p.length > 0);
  
  // Merge original keys
  const originalKeys = [...new Set([
    ...existing.original_keys,
    incoming.key,
  ])].filter(k => k && k.length > 0);
  
  // Update metrics
  const metrics = {
    rounds_count: existing.metrics.rounds_count + (incoming.rounds_count || 0),
    total_invested: existing.metrics.total_invested + (incoming.total_invested || 0),
    avg_check: 0, // will be computed
    unique_projects: projects.length,
    first_investment: existing.metrics.first_investment,
    last_investment: existing.metrics.last_investment,
  };
  
  // Compute avg check
  if (metrics.rounds_count > 0 && metrics.total_invested > 0) {
    metrics.avg_check = Math.round(metrics.total_invested / metrics.rounds_count);
  }
  
  // Bump confidence (cap at 0.99)
  const confidence = Math.min(0.99, existing.confidence + 0.02);
  
  // Compute score and tier
  const score = computeInvestorScore(metrics);
  const tier = getInvestorTier(score);
  
  return {
    ...existing,
    aliases,
    sources,
    projects,
    original_keys: originalKeys,
    metrics,
    confidence,
    score,
    tier,
    updated_at: new Date(),
  };
}

/**
 * Создать новую сущность
 */
export function createNewEntity(
  name: string,
  source: string,
  data: {
    rounds_count?: number;
    total_invested?: number;
    projects?: string[];
    tier?: number;
    key?: string;
  } = {}
): CanonicalInvestor {
  const normalized = normalizeRawName(name);
  const displayName = normalizeDisplayName(name);
  
  const metrics = {
    rounds_count: data.rounds_count || 0,
    total_invested: data.total_invested || 0,
    avg_check: 0,
    unique_projects: data.projects?.length || 0,
    first_investment: null,
    last_investment: null,
  };
  
  if (metrics.rounds_count > 0 && metrics.total_invested > 0) {
    metrics.avg_check = Math.round(metrics.total_invested / metrics.rounds_count);
  }
  
  const score = computeInvestorScore(metrics);
  const tier = getInvestorTier(score);
  
  return {
    canonical_id: normalized || `inv_${Date.now()}`,
    display_name: displayName,
    normalized,
    aliases: [name.toLowerCase().trim(), normalized].filter(a => a.length > 0),
    sources: [source],
    confidence: 0.6, // новые сущности начинают с 0.6
    metrics,
    tier,
    score,
    projects: data.projects || [],
    original_keys: data.key ? [data.key] : [],
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// ==============================
// 6. INVESTOR SCORING & TIER
// ==============================

/**
 * Вычислить score инвестора
 * 
 * score = rounds * 1 + amount/1M + unique_projects * 2
 */
export function computeInvestorScore(metrics: {
  rounds_count: number;
  total_invested: number;
  unique_projects: number;
}): number {
  const roundsScore = metrics.rounds_count * 1;
  const amountScore = metrics.total_invested / 1_000_000;
  const projectsScore = metrics.unique_projects * 2;
  
  return Math.round((roundsScore + amountScore + projectsScore) * 100) / 100;
}

/**
 * Определить tier по score
 */
export function getInvestorTier(score: number): 'TIER_1' | 'TIER_2' | 'TIER_3' {
  if (score >= 100) return 'TIER_1';
  if (score >= 30) return 'TIER_2';
  return 'TIER_3';
}

// ==============================
// 7. COINVEST BUILDER
// ==============================

/**
 * Построить карту co-invest связей
 */
export function buildCoinvestMap(
  rounds: Array<{
    investors: Array<{ name: string } | string>;
    amount?: number;
    project?: string;
    date?: number;
  }>
): Map<string, CoinvestRelation> {
  const map = new Map<string, CoinvestRelation>();
  
  for (const round of rounds) {
    if (!Array.isArray(round.investors) || round.investors.length < 2) {
      continue;
    }
    
    // Normalize investor names
    const investorNames = round.investors
      .map(inv => typeof inv === 'string' ? inv : inv.name)
      .filter(name => name && name.length > 0)
      .map(name => normalizeRawName(name));
    
    // Создаём связи между всеми парами
    for (let i = 0; i < investorNames.length; i++) {
      for (let j = i + 1; j < investorNames.length; j++) {
        const a = investorNames[i];
        const b = investorNames[j];
        
        if (!a || !b || a === b) continue;
        
        // Сортируем чтобы A-B = B-A
        const key = [a, b].sort().join('::');
        
        if (!map.has(key)) {
          map.set(key, {
            investor_a: a < b ? a : b,
            investor_b: a < b ? b : a,
            count: 0,
            volume: 0,
            projects: [],
            first_together: null,
            last_together: null,
          });
        }
        
        const rel = map.get(key)!;
        rel.count += 1;
        rel.volume += round.amount || 0;
        
        if (round.project && !rel.projects.includes(round.project)) {
          rel.projects.push(round.project);
        }
        
        if (round.date) {
          if (!rel.first_together || round.date < rel.first_together) {
            rel.first_together = round.date;
          }
          if (!rel.last_together || round.date > rel.last_together) {
            rel.last_together = round.date;
          }
        }
      }
    }
  }
  
  return map;
}

/**
 * Конвертировать Map в отсортированный массив
 */
export function coinvestMapToArray(
  map: Map<string, CoinvestRelation>,
  minCount = 2
): CoinvestRelation[] {
  return Array.from(map.values())
    .filter(rel => rel.count >= minCount)
    .sort((a, b) => b.count - a.count || b.volume - a.volume);
}

// ==============================
// 8. DATA QUALITY VALIDATORS
// ==============================

export interface DataQualityResult {
  valid: boolean;
  score: number; // 0-100
  penalties: string[];
}

/**
 * Валидация funding round с penalty scoring
 */
export function validateFundingRoundQuality(round: {
  project?: string;
  amount?: number;
  date?: number;
  investors?: any[];
}): DataQualityResult {
  let score = 100;
  const penalties: string[] = [];
  
  // Project name required
  if (!round.project) {
    score -= 50;
    penalties.push('missing_project');
  }
  
  // Amount
  if (!round.amount || round.amount <= 0) {
    score -= 20;
    penalties.push('missing_amount');
  }
  
  // Date
  if (!round.date) {
    score -= 15;
    penalties.push('missing_date');
  } else {
    // Check if date is valid (not in future, not too old)
    const now = Math.floor(Date.now() / 1000);
    const minDate = 1262304000; // 2010-01-01
    if (round.date > now || round.date < minDate) {
      score -= 10;
      penalties.push('invalid_date');
    }
  }
  
  // Investors
  if (!Array.isArray(round.investors) || round.investors.length === 0) {
    score -= 25;
    penalties.push('no_investors');
  } else if (round.investors.length < 2) {
    score -= 5;
    penalties.push('few_investors');
  }
  
  return {
    valid: score >= 50,
    score: Math.max(0, score),
    penalties,
  };
}

/**
 * Валидация инвестора с penalty scoring
 */
export function validateInvestorQuality(investor: {
  name?: string;
  rounds_count?: number;
  tier?: number;
}): DataQualityResult {
  let score = 100;
  const penalties: string[] = [];
  
  // Name required
  if (!investor.name || investor.name.trim().length < 2) {
    score -= 50;
    penalties.push('invalid_name');
  }
  
  // Check for spam patterns
  if (investor.name) {
    const name = investor.name.toLowerCase();
    if (/^\d+$/.test(name) || /^[a-z]$/.test(name)) {
      score -= 30;
      penalties.push('spam_name');
    }
  }
  
  // Rounds count
  if (!investor.rounds_count || investor.rounds_count === 0) {
    score -= 10;
    penalties.push('no_rounds');
  }
  
  return {
    valid: score >= 50,
    score: Math.max(0, score),
    penalties,
  };
}

// ==============================
// 9. BATCH PROCESSING HELPERS
// ==============================

/**
 * Batch resolve investors
 */
export function batchResolve(
  names: string[],
  existingEntities: CanonicalInvestor[]
): Map<string, EntityResolutionResult> {
  const results = new Map<string, EntityResolutionResult>();
  
  for (const name of names) {
    if (!name) continue;
    const result = resolveInvestor(name, existingEntities);
    results.set(name, result);
  }
  
  return results;
}

/**
 * Find potential duplicates in a list
 */
export function findPotentialDuplicates(
  names: string[],
  threshold = 0.85
): Array<{ name_a: string; name_b: string; similarity: number }> {
  const duplicates: Array<{ name_a: string; name_b: string; similarity: number }> = [];
  
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const similarity = compareTwoNames(names[i], names[j]);
      if (similarity >= threshold && similarity < 1.0) {
        duplicates.push({
          name_a: names[i],
          name_b: names[j],
          similarity: Math.round(similarity * 100) / 100,
        });
      }
    }
  }
  
  return duplicates.sort((a, b) => b.similarity - a.similarity);
}
