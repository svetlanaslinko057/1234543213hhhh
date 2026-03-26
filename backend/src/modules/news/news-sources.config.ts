/**
 * News Sources Configuration
 * 40+ RSS feeds from crypto news sources
 */

export interface NewsSourceConfig {
  id: string;
  name: string;
  domain: string;
  rss_url: string;
  tier: 'A' | 'B' | 'C';
  language: string;
  region: string;
  refresh_interval_sec: number;
  source_weight: number;
  is_official: boolean;
  is_active: boolean;
}

export const NEWS_SOURCES: NewsSourceConfig[] = [
  // ═══════════════════════════════════════════════════════════════
  // TIER A - Primary Sources (fast, reliable)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'coindesk',
    name: 'CoinDesk',
    domain: 'coindesk.com',
    rss_url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    tier: 'A',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 300,
    source_weight: 1.0,
    is_official: false,
    is_active: true,
  },
  {
    id: 'cointelegraph',
    name: 'Cointelegraph',
    domain: 'cointelegraph.com',
    rss_url: 'https://cointelegraph.com/rss',
    tier: 'A',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 300,
    source_weight: 1.0,
    is_official: false,
    is_active: true,
  },
  {
    id: 'theblock',
    name: 'The Block',
    domain: 'theblock.co',
    rss_url: 'https://www.theblock.co/rss.xml',
    tier: 'A',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 300,
    source_weight: 1.0,
    is_official: false,
    is_active: true,
  },
  {
    id: 'decrypt',
    name: 'Decrypt',
    domain: 'decrypt.co',
    rss_url: 'https://decrypt.co/feed',
    tier: 'A',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 300,
    source_weight: 0.95,
    is_official: false,
    is_active: true,
  },
  {
    id: 'blockworks',
    name: 'Blockworks',
    domain: 'blockworks.co',
    rss_url: 'https://blockworks.co/feed/',
    tier: 'A',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 300,
    source_weight: 0.95,
    is_official: false,
    is_active: true,
  },
  {
    id: 'dlnews',
    name: 'DL News',
    domain: 'dlnews.com',
    rss_url: 'https://www.dlnews.com/rss/',
    tier: 'A',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 300,
    source_weight: 0.95,
    is_official: false,
    is_active: true,
  },
  {
    id: 'defiant',
    name: 'The Defiant',
    domain: 'thedefiant.io',
    rss_url: 'https://thedefiant.io/feed/',
    tier: 'A',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 300,
    source_weight: 0.9,
    is_official: false,
    is_active: true,
  },

  // Russian/Ukrainian Tier A
  {
    id: 'incrypted',
    name: 'Incrypted',
    domain: 'incrypted.com',
    rss_url: 'https://incrypted.com/feed/',
    tier: 'A',
    language: 'ru',
    region: 'UA',
    refresh_interval_sec: 300,
    source_weight: 1.0,
    is_official: false,
    is_active: true,
  },
  {
    id: 'forklog',
    name: 'Forklog',
    domain: 'forklog.com',
    rss_url: 'https://forklog.com/feed/',
    tier: 'A',
    language: 'ru',
    region: 'RU',
    refresh_interval_sec: 300,
    source_weight: 0.95,
    is_official: false,
    is_active: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // TIER B - Secondary Sources
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'bitcoinmagazine',
    name: 'Bitcoin Magazine',
    domain: 'bitcoinmagazine.com',
    rss_url: 'https://bitcoinmagazine.com/.rss/full/',
    tier: 'B',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 600,
    source_weight: 0.85,
    is_official: false,
    is_active: true,
  },
  {
    id: 'cryptoslate',
    name: 'CryptoSlate',
    domain: 'cryptoslate.com',
    rss_url: 'https://cryptoslate.com/feed/',
    tier: 'B',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 600,
    source_weight: 0.8,
    is_official: false,
    is_active: true,
  },
  {
    id: 'beincrypto',
    name: 'BeInCrypto',
    domain: 'beincrypto.com',
    rss_url: 'https://beincrypto.com/feed/',
    tier: 'B',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 600,
    source_weight: 0.8,
    is_official: false,
    is_active: true,
  },
  {
    id: 'newsbtc',
    name: 'NewsBTC',
    domain: 'newsbtc.com',
    rss_url: 'https://www.newsbtc.com/feed/',
    tier: 'B',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 600,
    source_weight: 0.75,
    is_official: false,
    is_active: true,
  },
  {
    id: 'cryptopotato',
    name: 'CryptoPotato',
    domain: 'cryptopotato.com',
    rss_url: 'https://cryptopotato.com/feed/',
    tier: 'B',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 600,
    source_weight: 0.75,
    is_official: false,
    is_active: true,
  },
  {
    id: 'utoday',
    name: 'U.Today',
    domain: 'u.today',
    rss_url: 'https://u.today/rss',
    tier: 'B',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 600,
    source_weight: 0.75,
    is_official: false,
    is_active: true,
  },
  {
    id: 'cryptobriefing',
    name: 'CryptoBriefing',
    domain: 'cryptobriefing.com',
    rss_url: 'https://cryptobriefing.com/feed/',
    tier: 'B',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 600,
    source_weight: 0.8,
    is_official: false,
    is_active: true,
  },
  {
    id: 'bitcoinist',
    name: 'Bitcoinist',
    domain: 'bitcoinist.com',
    rss_url: 'https://bitcoinist.com/feed/',
    tier: 'B',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 600,
    source_weight: 0.7,
    is_official: false,
    is_active: true,
  },
  {
    id: 'ambcrypto',
    name: 'AMBCrypto',
    domain: 'ambcrypto.com',
    rss_url: 'https://ambcrypto.com/feed/',
    tier: 'B',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 600,
    source_weight: 0.7,
    is_official: false,
    is_active: true,
  },
  {
    id: 'cryptonews_en',
    name: 'CryptoNews EN',
    domain: 'cryptonews.com',
    rss_url: 'https://cryptonews.com/news/feed/',
    tier: 'B',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 600,
    source_weight: 0.75,
    is_official: false,
    is_active: true,
  },

  // Russian Tier B
  {
    id: 'bits_media',
    name: 'Bits.media',
    domain: 'bits.media',
    rss_url: 'https://bits.media/rss/',
    tier: 'B',
    language: 'ru',
    region: 'RU',
    refresh_interval_sec: 600,
    source_weight: 0.8,
    is_official: false,
    is_active: true,
  },
  {
    id: 'cryptonews_ru',
    name: 'CryptoNews RU',
    domain: 'cryptonews.net',
    rss_url: 'https://ru.cryptonews.com/news/feed/',
    tier: 'B',
    language: 'ru',
    region: 'RU',
    refresh_interval_sec: 600,
    source_weight: 0.75,
    is_official: false,
    is_active: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // TIER C - Niche / Research Sources
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'bankless',
    name: 'Bankless',
    domain: 'bankless.com',
    rss_url: 'https://www.bankless.com/rss/',
    tier: 'C',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 1800,
    source_weight: 0.85,
    is_official: false,
    is_active: true,
  },
  {
    id: 'messari_blog',
    name: 'Messari Research',
    domain: 'messari.io',
    rss_url: 'https://messari.io/rss',
    tier: 'C',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 1800,
    source_weight: 0.9,
    is_official: false,
    is_active: true,
  },
  {
    id: 'rekt_news',
    name: 'Rekt News',
    domain: 'rekt.news',
    rss_url: 'https://rekt.news/rss/feed.xml',
    tier: 'C',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 1800,
    source_weight: 0.75,
    is_official: false,
    is_active: true,
  },

  // Exchange blogs
  {
    id: 'binance_blog',
    name: 'Binance Blog',
    domain: 'binance.com',
    rss_url: 'https://www.binance.com/en/blog/rss',
    tier: 'C',
    language: 'en',
    region: 'Global',
    refresh_interval_sec: 1800,
    source_weight: 0.9,
    is_official: true,
    is_active: true,
  },
  {
    id: 'coinbase_blog',
    name: 'Coinbase Blog',
    domain: 'coinbase.com',
    rss_url: 'https://blog.coinbase.com/feed',
    tier: 'C',
    language: 'en',
    region: 'US',
    refresh_interval_sec: 1800,
    source_weight: 0.9,
    is_official: true,
    is_active: true,
  },
];

export function getActiveSources(): NewsSourceConfig[] {
  return NEWS_SOURCES.filter(s => s.is_active);
}

export function getSourcesByTier(tier: 'A' | 'B' | 'C'): NewsSourceConfig[] {
  return NEWS_SOURCES.filter(s => s.is_active && s.tier === tier);
}

export function getSourceById(id: string): NewsSourceConfig | undefined {
  return NEWS_SOURCES.find(s => s.id === id);
}

export function getSourceWeight(id: string): number {
  const source = getSourceById(id);
  if (!source) return 0.5;
  let weight = source.source_weight;
  if (source.is_official) weight *= 1.5;
  if (source.tier === 'A') weight *= 1.2;
  return weight;
}
