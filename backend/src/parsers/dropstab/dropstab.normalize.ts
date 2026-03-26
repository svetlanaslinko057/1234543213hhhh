/**
 * Dropstab normalizers - transform raw data to standard format
 */

import { NormalizedInvestor, NormalizedFunding, NormalizedUnlock } from '../common/parser.types';

/**
 * Normalize investor from Dropstab payload
 */
export function normalizeDropstabInvestor(item: any): NormalizedInvestor | null {
  if (!item) return null;

  const name = item.name || item.title || item.fundName;
  if (!name) return null;

  const slug = item.investorSlug || item.slug || item.id?.toString() || 
               name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const externalId = item.id?.toString() || slug;
  const key = `dropstab:investor:${slug}`;

  // Extract twitter from links array
  let twitter = item.twitterUrl || item.twitter;
  if (!twitter && Array.isArray(item.links)) {
    const twitterLink = item.links.find((l: any) => 
      l.link?.includes('twitter') || l.link?.includes('x.com')
    );
    twitter = twitterLink?.link;
  }

  return {
    key,
    externalId,
    source: 'dropstab',
    name,
    slug,
    tier: item.rating || item.tier || item.rank,
    type: item.ventureType || item.type,
    category: item.category,
    image: item.logo || item.image || item.logoUrl,
    investments_count: item.investmentsCount || item.investments || item.projectsCount || 0,
    portfolio_value: item.portfolioValue || item.aum,
    website: item.websiteUrl || item.website,
    twitter,
    description: item.description || item.bio,
    updated_at: new Date(),
    raw: item,
  };
}

/**
 * Normalize funding round from Dropstab payload
 */
export function normalizeDropstabFunding(item: any): NormalizedFunding | null {
  if (!item) return null;

  const project = item.name || item.projectName || item.project;
  if (!project) return null;

  const symbol = String(item.symbol || item.ticker || '').toUpperCase();
  const slug = item.slug || project.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const roundName = item.stage || item.round || item.roundName || 'unknown';
  
  const date = parseTimestamp(item.date || item.fundingDate || item.announcedDate || item.saleDate);
  const externalId = item.id?.toString() || `${slug}-${roundName}-${date || 'nodate'}`;
  const key = `dropstab:funding:${externalId}`;

  // Parse investors list
  const investors: any[] = [];
  const leadInvestors: string[] = [];
  const invData = item.investors || item.leadInvestors || [];
  
  if (Array.isArray(invData)) {
    for (const inv of invData) {
      if (typeof inv === 'string') {
        investors.push({ name: inv });
      } else if (typeof inv === 'object' && inv) {
        const invName = inv.name || inv.fundName;
        if (invName) {
          investors.push({
            name: invName,
            slug: inv.slug || inv.investorSlug,
            tier: inv.tier || inv.rating,
          });
          if (inv.isLead || inv.lead) {
            leadInvestors.push(invName);
          }
        }
      }
    }
  }

  return {
    key,
    externalId,
    source: 'dropstab',
    project,
    project_key: slug,
    symbol: symbol || slug.toUpperCase(),
    round: roundName,
    date,
    amount: item.fundsRaised || item.amount || item.raised || item.fundingAmount,
    valuation: item.preValuation || item.valuation || item.postValuation,
    investors,
    investors_count: investors.length,
    lead_investors: leadInvestors.length > 0 ? leadInvestors : (item.leadInvestor ? [item.leadInvestor] : []),
    updated_at: new Date(),
    raw: item,
  };
}

/**
 * Normalize unlock from Dropstab payload
 */
export function normalizeDropstabUnlock(item: any): NormalizedUnlock | null {
  if (!item) return null;

  const symbol = String(item.symbol || item.ticker || '').toUpperCase();
  const slug = item.slug || item.project || symbol.toLowerCase();
  if (!slug && !symbol) return null;

  const unlockDate = item.unlockDate || item.date || item.nextUnlock;
  const externalId = item.id?.toString() || `${slug}-${unlockDate || 'unknown'}`;
  const key = `dropstab:unlock:${externalId}`;

  return {
    key,
    externalId,
    source: 'dropstab',
    project_key: slug,
    symbol,
    name: item.name || item.projectName,
    unlock_date: unlockDate,
    unlock_usd: item.unlockAmount || item.unlockUsd || item.value,
    tokens_percent: item.unlockPercent || item.percent,
    allocation: item.allocation || item.type,
    updated_at: new Date(),
    raw: item,
  };
}

/**
 * Extract items from Dropstab response payload
 */
export function extractDropstabItems(payload: any, entity: string): any[] {
  if (!payload) return [];

  // Try direct data first (from API response)
  if (payload.data && Array.isArray(payload.data)) {
    return payload.data;
  }

  // Try _next/data format
  if (payload.pageProps) {
    const pageProps = payload.pageProps;
    
    // Check various known paths
    const paths: Record<string, string[]> = {
      investors: ['fallbackBody.content', 'fallbackInvestorsList', 'investors', 'data'],
      fundraising: ['fallbackBody.content', 'fallbackFundraisingList', 'fundraising', 'data'],
      unlocks: ['fallbackUnlocks', 'fallbackVesting', 'unlocks', 'data'],
      coins: ['coinsBody.coins', 'fallbackCoins', 'coins', 'data'],
    };

    for (const path of (paths[entity] || paths.investors)) {
      const value = getNestedValue(pageProps, path);
      if (Array.isArray(value) && value.length > 0) {
        return value;
      }
    }
  }

  // Try content directly
  if (payload.content && Array.isArray(payload.content)) {
    return payload.content;
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
