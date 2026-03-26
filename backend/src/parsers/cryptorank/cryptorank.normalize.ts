/**
 * CryptoRank normalizers - transform raw data to standard format
 */

import { NormalizedInvestor, NormalizedFunding, NormalizedUnlock } from '../common/parser.types';

/**
 * Normalize investor/fund from CryptoRank payload
 */
export function normalizeCryptoRankInvestor(item: any): NormalizedInvestor | null {
  if (!item) return null;

  const name = item.name;
  const slug = item.slug || item.key;
  if (!name || !slug) return null;

  const externalId = item.id?.toString() || slug;
  const key = `cryptorank:investor:${slug}`;

  return {
    key,
    externalId,
    source: 'cryptorank',
    name,
    slug,
    tier: item.tier,
    type: item.type,
    category: item.category?.name || null,
    image: item.logo || item.image,
    investments_count: item.count || item.totalInvestments || 0,
    portfolio_value: item.portfolioValue,
    website: item.website,
    twitter: item.twitter,
    description: item.description,
    updated_at: new Date(),
    raw: item,
  };
}

/**
 * Normalize funding round from CryptoRank payload
 */
export function normalizeCryptoRankFunding(item: any): NormalizedFunding | null {
  if (!item) return null;

  // CryptoRank uses 'key' as project identifier
  const projectKey = item.key || item.slug;
  const project = item.name || item.projectName;
  if (!projectKey && !project) return null;

  const symbol = item.symbol || '';
  const stage = item.stage || item.round || 'unknown';
  const date = parseTimestamp(item.date || item.fundingDate);
  const dateStr = date || 'nodate';

  const externalId = item.id?.toString() || `${projectKey || project}-${stage}-${dateStr}`;
  const key = `cryptorank:funding:${externalId}`.toLowerCase();

  // Parse investors from funds array
  const investors: any[] = [];
  const leadInvestors: string[] = [];

  const fundSources = [item.funds, item.investors, item.leadInvestors].filter(Boolean);
  
  for (const funds of fundSources) {
    if (!Array.isArray(funds)) continue;
    
    for (const fund of funds) {
      const fundName = fund.name;
      if (!fundName) continue;
      if (investors.find(i => i.name === fundName)) continue;

      const inv = {
        name: fundName,
        key: fund.key,
        slug: fund.slug,
        tier: fund.tier,
        type: fund.type,
        category: fund.category?.name || null,
        total_investments: fund.totalInvestments,
      };
      investors.push(inv);

      if (fund.tier === 1 || fund.lead) {
        leadInvestors.push(fundName);
      }
    }
  }

  return {
    key,
    externalId,
    source: 'cryptorank',
    project: project || projectKey,
    project_key: projectKey || project?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    symbol: symbol.toUpperCase() || undefined,
    round: stage,
    date,
    amount: item.raise || item.amount,
    valuation: item.valuation,
    investors,
    investors_count: investors.length,
    lead_investors: leadInvestors,
    category: item.category?.name || item.category,
    updated_at: new Date(),
  };
}

/**
 * Normalize unlock from CryptoRank payload
 */
export function normalizeCryptoRankUnlock(item: any): NormalizedUnlock | null {
  if (!item) return null;

  const projectKey = item.key;
  const symbol = item.symbol || '';
  if (!projectKey) return null;

  const unlockDate = item.unlockDate || item.date;
  const externalId = item.id?.toString() || `${projectKey}-${unlockDate || 'unknown'}`;
  const key = `cryptorank:unlock:${externalId}`;

  return {
    key,
    externalId,
    source: 'cryptorank',
    project_key: projectKey,
    symbol: symbol.toUpperCase(),
    name: item.name,
    unlock_date: unlockDate,
    unlock_usd: item.unlockUsd,
    tokens_percent: item.tokensPercent,
    allocation: item.allocation || item.type,
    updated_at: new Date(),
    raw: item,
  };
}

/**
 * Extract items from CryptoRank response payload
 */
export function extractCryptoRankItems(payload: any, entity: string): any[] {
  if (!payload) return [];

  // Direct data array
  if (payload.data && Array.isArray(payload.data)) {
    return payload.data;
  }

  // Array directly
  if (Array.isArray(payload)) {
    return payload;
  }

  // From _next/data format - check pageProps first
  if (payload.pageProps) {
    const pageProps = payload.pageProps;
    
    // For funding rounds
    if (entity === 'funding' || entity === 'funding_rounds') {
      // fallbackRounds can be array directly or object with data
      const fallbackRounds = pageProps.fallbackRounds;
      if (Array.isArray(fallbackRounds)) {
        return fallbackRounds;
      }
      if (fallbackRounds?.data && Array.isArray(fallbackRounds.data)) {
        return fallbackRounds.data;
      }
    }
    
    const paths: Record<string, string[]> = {
      funding: ['fallbackRounds', 'fallbackRounds.data', 'rounds', 'data'],
      investors: ['fallbackFunds', 'fallbackFunds.data', 'fallbackInvestors', 'funds', 'data'],
      unlocks: ['fallbackUnlocks', 'fallbackUnlocks.data', 'unlocks', 'data'],
      categories: ['fallbackCategories', 'categories', 'data'],
      launchpads: ['fallbackLaunchpads', 'launchpads', 'data'],
    };

    for (const path of (paths[entity] || paths.funding)) {
      const value = getNestedValue(pageProps, path);
      if (Array.isArray(value) && value.length > 0) {
        return value;
      }
    }
  }

  // Check direct fallbackRounds (can happen at root level too)
  if (payload.fallbackRounds) {
    if (Array.isArray(payload.fallbackRounds)) {
      return payload.fallbackRounds;
    }
    if (payload.fallbackRounds.data && Array.isArray(payload.fallbackRounds.data)) {
      return payload.fallbackRounds.data;
    }
  }

  // Try rows
  if (payload.rows && Array.isArray(payload.rows)) {
    return payload.rows;
  }

  return [];
}

/**
 * Get nested value by dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Parse timestamp to Unix seconds
 */
function parseTimestamp(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return value < 1e12 ? value : Math.floor(value / 1000);
  }
  if (typeof value === 'string') {
    try {
      const dt = new Date(value);
      return Math.floor(dt.getTime() / 1000);
    } catch {
      return null;
    }
  }
  return null;
}
