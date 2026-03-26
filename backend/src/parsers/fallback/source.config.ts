/**
 * SOURCE CONFIG
 * 
 * Each source has a fallback strategy.
 * RSS → HTML → Browser → Replace
 */

export type FallbackMode = 'html' | 'browser' | 'replace' | 'none';

export interface SourceFallback {
  mode: FallbackMode;
  htmlUrl?: string;
  replacementUrl?: string;
  selectors?: {
    container?: string;
    title?: string;
    link?: string;
    date?: string;
    summary?: string;
  };
}

export interface SourceConfig {
  id: string;
  name: string;
  type: 'rss';
  enabled: boolean;
  
  // Primary RSS
  rssUrl: string;
  
  // Fallback config
  fallback: SourceFallback;
  
  // Optional metadata
  category?: string;
  tier?: 'A' | 'B' | 'C';
}

// ==============================
// SOURCE REGISTRY
// ==============================

export const NEWS_SOURCES: SourceConfig[] = [
  // ═══════════════════════════════════════════════════════════════
  // TIER A - Major Crypto News (must work)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'news_coindesk',
    name: 'CoinDesk',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://www.coindesk.com/tag/news/',
      selectors: {
        container: 'article',
        title: 'h2, h3',
        link: 'a',
      },
    },
    category: 'news',
    tier: 'A',
  },
  {
    id: 'news_cointelegraph',
    name: 'Cointelegraph',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://cointelegraph.com/rss',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://cointelegraph.com/tags/altcoin',
      selectors: {
        container: '.post-card',
        title: '.post-card__title',
        link: 'a',
      },
    },
    category: 'news',
    tier: 'A',
  },
  {
    id: 'news_theblock',
    name: 'The Block',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://www.theblock.co/rss.xml',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://www.theblock.co/latest',
      selectors: {
        container: 'article',
        title: 'h2',
        link: 'a',
      },
    },
    category: 'news',
    tier: 'A',
  },
  {
    id: 'news_decrypt',
    name: 'Decrypt',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://decrypt.co/feed',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://decrypt.co/news',
      selectors: {
        container: 'article',
        title: 'h2',
        link: 'a',
      },
    },
    category: 'news',
    tier: 'A',
  },
  {
    id: 'news_blockworks',
    name: 'Blockworks',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://blockworks.co/feed/',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://blockworks.co/news',
      selectors: {
        container: '.post-card',
        title: 'h3',
        link: 'a',
      },
    },
    category: 'news',
    tier: 'A',
  },

  // ═══════════════════════════════════════════════════════════════
  // TIER A - BROKEN (need fallback)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'news_dlnews',
    name: 'DL News',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://www.dlnews.com/rss/',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://www.dlnews.com/articles/',
      selectors: {
        container: 'article, .article-card',
        title: 'h2, h3',
        link: 'a',
      },
    },
    category: 'news',
    tier: 'A',
  },
  {
    id: 'news_defiant',
    name: 'The Defiant',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://thedefiant.io/feed/',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://thedefiant.io/',
      selectors: {
        container: 'article',
        title: 'h2',
        link: 'a',
      },
    },
    category: 'defi',
    tier: 'A',
  },

  // ═══════════════════════════════════════════════════════════════
  // TIER B - Secondary Sources
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'news_forklog',
    name: 'Forklog',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://forklog.com/feed/',
    fallback: {
      mode: 'html', // Changed: try HTML first with proper selectors
      htmlUrl: 'https://forklog.com/news/',
      selectors: {
        // Forklog-specific selectors
        container: '.post-card, article.post, .news-item, .masonry-item',
        title: '.post-card__title, h2.entry-title, h3.post-title, .title a',
        link: 'a[href*="/news/"], a.post-card__link, h2 a, h3 a',
        summary: '.post-card__excerpt, .entry-excerpt, .excerpt',
      },
    },
    category: 'news',
    tier: 'B',
  },
  {
    id: 'news_incrypted',
    name: 'Incrypted',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://incrypted.com/feed/',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://incrypted.com/news/',
      selectors: {
        container: 'article',
        title: 'h2',
        link: 'a',
      },
    },
    category: 'news',
    tier: 'B',
  },
  {
    id: 'news_bitcoinmagazine',
    name: 'Bitcoin Magazine',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://bitcoinmagazine.com/.rss/full/',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://bitcoinmagazine.com/articles',
      selectors: {
        container: 'article',
        title: 'h2',
        link: 'a',
      },
    },
    category: 'bitcoin',
    tier: 'B',
  },
  {
    id: 'news_cryptoslate',
    name: 'CryptoSlate',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://cryptoslate.com/feed/',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://cryptoslate.com/news/',
      selectors: {
        container: 'article',
        title: 'h2',
        link: 'a',
      },
    },
    category: 'news',
    tier: 'B',
  },
  {
    id: 'news_beincrypto',
    name: 'BeInCrypto',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://beincrypto.com/feed/',
    fallback: {
      mode: 'browser', // Cloudflare protection
      htmlUrl: 'https://beincrypto.com/news/',
      selectors: {
        // BeInCrypto-specific selectors
        container: 'article.post, .news-card, .article-card, [class*="ArticleCard"]',
        title: 'h2.entry-title, h3.post-title, [class*="title"], h2 a, h3 a',
        link: 'a[href*="/news/"], a[href*="/learn/"], h2 a, h3 a',
        summary: '.excerpt, .entry-summary, p.desc',
      },
    },
    category: 'news',
    tier: 'B',
  },
  {
    id: 'news_utoday',
    name: 'U.Today',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://u.today/rss',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://u.today/latest-cryptocurrency-news',
      selectors: {
        container: '.news-item',
        title: 'h3',
        link: 'a',
      },
    },
    category: 'news',
    tier: 'B',
  },

  // ═══════════════════════════════════════════════════════════════
  // TIER B - BROKEN (need replacement)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'news_bankless',
    name: 'Bankless',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://www.bankless.com/rss/', // 404
    fallback: {
      mode: 'browser', // Changed to browser - it's an SPA
      replacementUrl: 'https://www.bankless.com/articles',
      htmlUrl: 'https://www.bankless.com/articles',
      selectors: {
        // Bankless-specific selectors (Next.js SPA)
        container: 'article, [class*="ArticleCard"], [class*="post-card"], a[href*="/articles/"]',
        title: 'h2, h3, [class*="title"], [class*="headline"]',
        link: 'a[href*="/articles/"]',
        summary: 'p, [class*="excerpt"], [class*="description"]',
      },
    },
    category: 'defi',
    tier: 'B',
  },

  // ═══════════════════════════════════════════════════════════════
  // TIER C - Research & Official
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'news_messari',
    name: 'Messari Research',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://messari.io/rss',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://messari.io/research',
      selectors: {
        container: 'article',
        title: 'h2',
        link: 'a',
      },
    },
    category: 'research',
    tier: 'C',
  },
  {
    id: 'news_rekt',
    name: 'Rekt News',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://rekt.news/rss/feed.xml',
    fallback: {
      mode: 'html',
      htmlUrl: 'https://rekt.news/',
      selectors: {
        container: 'article',
        title: 'h2',
        link: 'a',
      },
    },
    category: 'security',
    tier: 'C',
  },
  {
    id: 'news_binance_blog',
    name: 'Binance Blog',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://www.binance.com/en/blog/rss', // XML error
    fallback: {
      mode: 'replace',
      replacementUrl: 'https://www.binance.com/en/blog',
      htmlUrl: 'https://www.binance.com/en/blog',
      selectors: {
        container: 'article, .blog-card',
        title: 'h2, h3',
        link: 'a',
      },
    },
    category: 'official',
    tier: 'C',
  },
  {
    id: 'news_coinbase_blog',
    name: 'Coinbase Blog',
    type: 'rss',
    enabled: true,
    rssUrl: 'https://blog.coinbase.com/feed', // 403
    fallback: {
      mode: 'browser',
      htmlUrl: 'https://www.coinbase.com/blog',
      selectors: {
        container: 'article',
        title: 'h2',
        link: 'a',
      },
    },
    category: 'official',
    tier: 'C',
  },
];

// ==============================
// HELPERS
// ==============================

export function getEnabledSources(): SourceConfig[] {
  return NEWS_SOURCES.filter(s => s.enabled);
}

export function getSourceById(id: string): SourceConfig | undefined {
  return NEWS_SOURCES.find(s => s.id === id);
}

export function getSourcesByTier(tier: 'A' | 'B' | 'C'): SourceConfig[] {
  return NEWS_SOURCES.filter(s => s.enabled && s.tier === tier);
}

export function getBrokenSources(): SourceConfig[] {
  return NEWS_SOURCES.filter(s => s.fallback.mode !== 'html' && s.fallback.mode !== 'none');
}
