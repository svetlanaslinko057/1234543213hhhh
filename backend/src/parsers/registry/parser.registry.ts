/**
 * UNIFIED PARSER REGISTRY
 * 
 * Centralized registry for all discovery parsers.
 * Each parser has a standardized definition and result contract.
 */

// ==============================
// TYPES
// ==============================

export type ParserKind = 'api' | 'xhr' | 'rss' | 'session_api' | 'html';

export type EntityType = 
  | 'investors' 
  | 'projects' 
  | 'rounds' 
  | 'funds' 
  | 'unlocks' 
  | 'news' 
  | 'icos' 
  | 'categories';

export type ParserStatus = 'active' | 'broken' | 'disabled' | 'unknown';

export interface ParserRunResult {
  parserId: string;
  parserName: string;
  success: boolean;
  status: ParserStatus;
  fetched: number;
  normalized: number;
  saved: number;
  durationMs: number;
  errors: string[];
  warnings: string[];
  lastRun: Date;
  metadata?: Record<string, any>;
}

export interface ParserDefinition {
  id: string;
  name: string;
  kind: ParserKind;
  enabled: boolean;
  sourceUrl: string;
  entityType: EntityType;
  authRequired: boolean;
  paginationType: 'none' | 'page' | 'offset' | 'cursor' | 'scroll';
  description: string;
  mongoCollection: string;
  
  // Runtime
  lastRun?: Date;
  lastStatus?: ParserStatus;
  lastItemCount?: number;
  lastError?: string;
}

// ==============================
// PARSER REGISTRY
// ==============================

export const DISCOVERY_PARSERS: ParserDefinition[] = [
  // ═══════════════════════════════════════════════════════════════
  // CLASS A: Direct API Parsers
  // ═══════════════════════════════════════════════════════════════
  
  // DROPSTAB
  {
    id: 'dropstab_investors',
    name: 'Dropstab Investors',
    kind: 'api',
    enabled: true,
    sourceUrl: 'https://api2.dropstab.com/portfolio/api/investors',
    entityType: 'investors',
    authRequired: false,
    paginationType: 'page',
    description: 'Crypto venture capital investors from Dropstab',
    mongoCollection: 'intel_investors',
  },
  {
    id: 'dropstab_fundraising',
    name: 'Dropstab Fundraising Rounds',
    kind: 'api',
    enabled: true,
    sourceUrl: 'https://api2.dropstab.com/portfolio/api/fundraisingRounds',
    entityType: 'rounds',
    authRequired: false,
    paginationType: 'page',
    description: 'Funding rounds from Dropstab',
    mongoCollection: 'intel_fundraising',
  },
  {
    id: 'dropstab_unlocks',
    name: 'Dropstab Token Unlocks',
    kind: 'api',
    enabled: true,
    sourceUrl: 'https://api2.dropstab.com/portfolio/api/vesting',
    entityType: 'unlocks',
    authRequired: false,
    paginationType: 'page',
    description: 'Token unlock schedules from Dropstab',
    mongoCollection: 'intel_unlocks',
  },

  // CRYPTORANK
  {
    id: 'cryptorank_funding',
    name: 'CryptoRank Funding Rounds',
    kind: 'api',
    enabled: true,
    sourceUrl: 'https://api.cryptorank.io/v0/funding-rounds-v2',
    entityType: 'rounds',
    authRequired: false,
    paginationType: 'offset',
    description: 'Funding rounds via CryptoRank v0 API',
    mongoCollection: 'intel_fundraising',
  },
  {
    id: 'cryptorank_investors',
    name: 'CryptoRank Investors/Funds',
    kind: 'api',
    enabled: true,
    sourceUrl: 'https://api.cryptorank.io/v0/funds',
    entityType: 'investors',
    authRequired: false,
    paginationType: 'offset',
    description: 'Investors from CryptoRank v0 API',
    mongoCollection: 'intel_investors',
  },
  {
    id: 'cryptorank_unlocks',
    name: 'CryptoRank Token Unlocks',
    kind: 'api',
    enabled: true,
    sourceUrl: 'https://api.cryptorank.io/v0/token-unlocks',
    entityType: 'unlocks',
    authRequired: false,
    paginationType: 'offset',
    description: 'Token unlocks from CryptoRank v0 API',
    mongoCollection: 'intel_unlocks',
  },
  {
    id: 'cryptorank_categories',
    name: 'CryptoRank Categories',
    kind: 'xhr',
    enabled: true,
    sourceUrl: 'https://cryptorank.io/categories',
    entityType: 'categories',
    authRequired: false,
    paginationType: 'none',
    description: 'Crypto market categories from CryptoRank',
    mongoCollection: 'intel_categories',
  },

  // ═══════════════════════════════════════════════════════════════
  // CLASS B: HTML/XHR Scrapers
  // ═══════════════════════════════════════════════════════════════
  
  {
    id: 'icodrops_active',
    name: 'ICODrops Active ICOs',
    kind: 'html',
    enabled: true,
    sourceUrl: 'https://icodrops.com/ico-live',
    entityType: 'icos',
    authRequired: false,
    paginationType: 'none',
    description: 'Active ICO/IDO sales from ICODrops',
    mongoCollection: 'intel_icos',
  },
  {
    id: 'icodrops_upcoming',
    name: 'ICODrops Upcoming ICOs',
    kind: 'html',
    enabled: true,
    sourceUrl: 'https://icodrops.com/upcoming-ico',
    entityType: 'icos',
    authRequired: false,
    paginationType: 'none',
    description: 'Upcoming ICO/IDO sales from ICODrops',
    mongoCollection: 'intel_icos',
  },
  {
    id: 'icodrops_ended',
    name: 'ICODrops Ended ICOs',
    kind: 'html',
    enabled: true,
    sourceUrl: 'https://icodrops.com/ico-ended',
    entityType: 'icos',
    authRequired: false,
    paginationType: 'page',
    description: 'Ended ICO/IDO sales with ROI from ICODrops',
    mongoCollection: 'intel_icos',
  },

  // ═══════════════════════════════════════════════════════════════
  // CLASS C: RSS Feed Parsers (News)
  // ═══════════════════════════════════════════════════════════════
  
  // Tier A
  {
    id: 'news_coindesk',
    name: 'CoinDesk RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Breaking crypto news from CoinDesk',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_cointelegraph',
    name: 'Cointelegraph RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://cointelegraph.com/rss',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Crypto news from Cointelegraph',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_theblock',
    name: 'The Block RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://www.theblock.co/rss.xml',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Institutional crypto news from The Block',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_decrypt',
    name: 'Decrypt RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://decrypt.co/feed',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Crypto news from Decrypt',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_blockworks',
    name: 'Blockworks RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://blockworks.co/feed/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Institutional crypto insights from Blockworks',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_dlnews',
    name: 'DL News RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://www.dlnews.com/rss/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Crypto news from DL News',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_defiant',
    name: 'The Defiant RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://thedefiant.io/feed/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'DeFi news from The Defiant',
    mongoCollection: 'news_articles',
  },
  
  // Russian
  {
    id: 'news_forklog',
    name: 'Forklog RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://forklog.com/feed/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Crypto news in Russian from Forklog',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_incrypted',
    name: 'Incrypted RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://incrypted.com/feed/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Ukrainian crypto news from Incrypted',
    mongoCollection: 'news_articles',
  },

  // Tier B
  {
    id: 'news_bitcoinmagazine',
    name: 'Bitcoin Magazine RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://bitcoinmagazine.com/.rss/full/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Bitcoin-focused news',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_cryptoslate',
    name: 'CryptoSlate RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://cryptoslate.com/feed/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Crypto news from CryptoSlate',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_beincrypto',
    name: 'BeInCrypto RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://beincrypto.com/feed/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Crypto news from BeInCrypto',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_utoday',
    name: 'U.Today RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://u.today/rss',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Crypto news from U.Today',
    mongoCollection: 'news_articles',
  },

  // Research
  {
    id: 'news_bankless',
    name: 'Bankless RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://www.bankless.com/rss/',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'DeFi research from Bankless',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_messari',
    name: 'Messari Research RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://messari.io/rss',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Crypto research from Messari',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_rekt',
    name: 'Rekt News RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://rekt.news/rss/feed.xml',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'DeFi exploit analysis from Rekt',
    mongoCollection: 'news_articles',
  },

  // Official
  {
    id: 'news_binance_blog',
    name: 'Binance Blog RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://www.binance.com/en/blog/rss',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Official Binance announcements',
    mongoCollection: 'news_articles',
  },
  {
    id: 'news_coinbase_blog',
    name: 'Coinbase Blog RSS',
    kind: 'rss',
    enabled: true,
    sourceUrl: 'https://blog.coinbase.com/feed',
    entityType: 'news',
    authRequired: false,
    paginationType: 'none',
    description: 'Official Coinbase announcements',
    mongoCollection: 'news_articles',
  },
];

// ==============================
// REGISTRY HELPERS
// ==============================

export function getAllParsers(): ParserDefinition[] {
  return DISCOVERY_PARSERS;
}

export function getEnabledParsers(): ParserDefinition[] {
  return DISCOVERY_PARSERS.filter(p => p.enabled);
}

export function getParsersByKind(kind: ParserKind): ParserDefinition[] {
  return DISCOVERY_PARSERS.filter(p => p.enabled && p.kind === kind);
}

export function getParsersByEntity(entityType: EntityType): ParserDefinition[] {
  return DISCOVERY_PARSERS.filter(p => p.enabled && p.entityType === entityType);
}

export function getParserById(id: string): ParserDefinition | undefined {
  return DISCOVERY_PARSERS.find(p => p.id === id);
}

export function getApiParsers(): ParserDefinition[] {
  return DISCOVERY_PARSERS.filter(p => p.enabled && p.kind === 'api');
}

export function getRssParsers(): ParserDefinition[] {
  return DISCOVERY_PARSERS.filter(p => p.enabled && p.kind === 'rss');
}

export function getScraperParsers(): ParserDefinition[] {
  return DISCOVERY_PARSERS.filter(p => p.enabled && (p.kind === 'html' || p.kind === 'xhr'));
}

// Summary
export function getRegistrySummary(): {
  total: number;
  enabled: number;
  byKind: Record<ParserKind, number>;
  byEntity: Record<EntityType, number>;
} {
  const enabled = getEnabledParsers();
  
  const byKind: Record<string, number> = {};
  const byEntity: Record<string, number> = {};
  
  for (const p of enabled) {
    byKind[p.kind] = (byKind[p.kind] || 0) + 1;
    byEntity[p.entityType] = (byEntity[p.entityType] || 0) + 1;
  }
  
  return {
    total: DISCOVERY_PARSERS.length,
    enabled: enabled.length,
    byKind: byKind as Record<ParserKind, number>,
    byEntity: byEntity as Record<EntityType, number>,
  };
}
