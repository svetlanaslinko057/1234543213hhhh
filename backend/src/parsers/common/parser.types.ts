/**
 * Common types for the parser system
 */

export interface ParsedBatch<T> {
  source: 'dropstab' | 'cryptorank';
  entity: 'investors' | 'fundraising' | 'funding_rounds' | 'unlocks' | 'funds' | 'categories';
  page: number;
  items: T[];
  rawCount: number;
  uniqueCount: number;
  hasMore: boolean;
  debug?: {
    matchedUrls: string[];
    fallbackUsed: boolean;
    interceptedPayloads: number;
  };
}

export interface PageCollectionResult {
  page: number;
  matchedUrls: string[];
  payloads: any[];
  itemsFound: number;
  uniqueIds: string[];
  errors: string[];
}

export interface CollectionSummary {
  source: string;
  entity: string;
  totalPages: number;
  totalRaw: number;
  totalUnique: number;
  items: any[];
  debug: {
    pagesData: Array<{
      page: number;
      matchedUrls: string[];
      payloadCount: number;
      itemsFound: number;
    }>;
  };
}

export interface NormalizedInvestor {
  key: string;
  externalId: string;
  source: 'dropstab' | 'cryptorank';
  name: string;
  slug: string;
  tier?: number;
  type?: string;
  category?: string;
  image?: string;
  investments_count: number;
  portfolio_value?: number;
  website?: string;
  twitter?: string;
  description?: string;
  updated_at: Date;
  raw?: any;
}

export interface NormalizedFunding {
  key: string;
  externalId: string;
  source: 'dropstab' | 'cryptorank';
  project: string;
  project_key: string;
  symbol?: string;
  round: string;
  date?: number;
  amount?: number;
  valuation?: number;
  investors: any[];
  investors_count: number;
  lead_investors: string[];
  category?: string;
  updated_at: Date;
  raw?: any;
}

export interface NormalizedUnlock {
  key: string;
  externalId: string;
  source: 'dropstab' | 'cryptorank';
  project_key: string;
  symbol: string;
  name?: string;
  unlock_date?: string;
  unlock_usd?: number;
  tokens_percent?: number;
  allocation?: string;
  updated_at: Date;
  raw?: any;
}

export interface ProxyConfig {
  host: string;
  httpPort: number;
  socks5Port: number;
  username: string;
  password: string;
}
