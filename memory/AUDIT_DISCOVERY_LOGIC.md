# АУДИТ ЛОГИКИ DISCOVERY И ПАРСИНГА

## ОБЩАЯ АРХИТЕКТУРА ПАРСИНГА

Система разделена на **3 НЕЗАВИСИМЫХ ЛОГИКИ ПАРСИНГА**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FOMO PARSER ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │   ЛОГИКА 1       │  │   ЛОГИКА 2       │  │   ЛОГИКА 3       │          │
│  │   INTEL DATA     │  │   NEWS/RSS       │  │   MARKET DATA    │          │
│  │                  │  │                  │  │                  │          │
│  │  Dropstab API    │  │  26 RSS Feeds    │  │  Coinbase API    │          │
│  │  CryptoRank API  │  │  Tier A/B/C      │  │  Binance API     │          │
│  │  ICODrops HTML   │  │  HTML Fallback   │  │  Bybit API       │          │
│  │                  │  │  Browser Backup  │  │  HyperLiquid     │          │
│  │                  │  │                  │  │  DefiLlama       │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           ▼                     ▼                     ▼                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  intel_investors │  │  news_articles   │  │   In-Memory      │          │
│  │  intel_fundrais  │  │  news_sources    │  │   Cache Layer    │          │
│  │  intel_unlocks   │  │                  │  │                  │          │
│  │  intel_projects  │  │                  │  │                  │          │
│  │  intel_funds     │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ЛОГИКА 1: INTEL DATA (Инвестиционные данные)

### Источники и Тиры

| Тир | Источник | Тип | Данные | Статус |
|-----|----------|-----|--------|--------|
| **TIER 1** | Dropstab | API | investors, rounds, unlocks | ✅ Active |
| **TIER 1** | CryptoRank | API | investors, rounds, unlocks | ✅ Active |
| **TIER 2** | ICODrops | HTML | ICO/IDO active, upcoming, ended | ✅ Enabled |

### Dropstab API Endpoints

```typescript
// Файл: /app/backend/src/parsers/dropstab/dropstab.api.ts
{
  id: 'dropstab_investors',
  sourceUrl: 'https://api2.dropstab.com/portfolio/api/investors',
  paginationType: 'page',  // ?page=0&size=100
  entityType: 'investors',
  mongoCollection: 'intel_investors',
}

{
  id: 'dropstab_fundraising',
  sourceUrl: 'https://api2.dropstab.com/portfolio/api/fundraisingRounds',
  paginationType: 'page',
  entityType: 'rounds',
  mongoCollection: 'intel_fundraising',
}

{
  id: 'dropstab_unlocks',
  sourceUrl: 'https://api2.dropstab.com/portfolio/api/vesting',
  paginationType: 'page',
  entityType: 'unlocks',
  mongoCollection: 'intel_unlocks',
}
```

### CryptoRank API Endpoints

```typescript
// Файл: /app/backend/src/parsers/cryptorank/cryptorank.direct-api.ts
{
  id: 'cryptorank_funding',
  sourceUrl: 'https://api.cryptorank.io/v0/funding-rounds-v2',
  paginationType: 'offset',  // POST { limit: N, skip: N }
  entityType: 'rounds',
  mongoCollection: 'intel_fundraising',
}

{
  id: 'cryptorank_investors',
  sourceUrl: 'https://api.cryptorank.io/v0/funds',
  paginationType: 'offset',
  entityType: 'investors',
  mongoCollection: 'intel_investors',
}

{
  id: 'cryptorank_unlocks',
  sourceUrl: 'https://api.cryptorank.io/v0/token-unlocks',
  paginationType: 'offset',
  entityType: 'unlocks',
  mongoCollection: 'intel_unlocks',
}
```

### ICODrops HTML Scraper

```typescript
// Файл: /app/backend/src/parsers/registry/parser.registry.ts
{
  id: 'icodrops_active',
  sourceUrl: 'https://icodrops.com/ico-live',
  kind: 'html',
  entityType: 'icos',
}

{
  id: 'icodrops_upcoming',
  sourceUrl: 'https://icodrops.com/upcoming-ico',
  kind: 'html',
}

{
  id: 'icodrops_ended',
  sourceUrl: 'https://icodrops.com/ico-ended',
  kind: 'html',
  paginationType: 'page',
}
```

### API вызовы

```bash
# Sync all intel data
POST /api/parsers/sync/all

# Sync по источникам
POST /api/parsers/sync/dropstab/investors?pages=50
POST /api/parsers/sync/dropstab/fundraising?pages=100
POST /api/parsers/sync/cryptorank/funding?pages=50
POST /api/parsers/sync/cryptorank/investors?pages=30

# Статус парсеров
GET /api/parsers/status
```

---

## ЛОГИКА 2: NEWS/RSS (Новостные данные)

### Тировая система

| Тир | Описание | Кол-во | Fallback стратегия |
|-----|----------|--------|-------------------|
| **TIER A** | Major crypto news (MUST work) | 7 | HTML → Browser |
| **TIER B** | Secondary sources | 7 | HTML → Browser |
| **TIER C** | Research & Official | 5 | Browser → Replace |

### TIER A - Primary Sources (7 источников)

```typescript
// Файл: /app/backend/src/parsers/fallback/source.config.ts

// 1. CoinDesk
{
  id: 'news_coindesk',
  rssUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  fallback: {
    mode: 'html',
    htmlUrl: 'https://www.coindesk.com/tag/news/',
  },
  tier: 'A',
}

// 2. Cointelegraph
{
  id: 'news_cointelegraph',
  rssUrl: 'https://cointelegraph.com/rss',
  fallback: { mode: 'html', htmlUrl: 'https://cointelegraph.com/tags/altcoin' },
  tier: 'A',
}

// 3. The Block
{
  id: 'news_theblock',
  rssUrl: 'https://www.theblock.co/rss.xml',
  fallback: { mode: 'html', htmlUrl: 'https://www.theblock.co/latest' },
  tier: 'A',
}

// 4. Decrypt
{
  id: 'news_decrypt',
  rssUrl: 'https://decrypt.co/feed',
  fallback: { mode: 'html', htmlUrl: 'https://decrypt.co/news' },
  tier: 'A',
}

// 5. Blockworks
{
  id: 'news_blockworks',
  rssUrl: 'https://blockworks.co/feed/',
  fallback: { mode: 'html', htmlUrl: 'https://blockworks.co/news' },
  tier: 'A',
}

// 6. DL News (BROKEN - needs fallback)
{
  id: 'news_dlnews',
  rssUrl: 'https://www.dlnews.com/rss/',
  fallback: { mode: 'html', htmlUrl: 'https://www.dlnews.com/articles/' },
  tier: 'A',
}

// 7. The Defiant (DeFi focused)
{
  id: 'news_defiant',
  rssUrl: 'https://thedefiant.io/feed/',
  fallback: { mode: 'html', htmlUrl: 'https://thedefiant.io/' },
  tier: 'A',
}
```

### TIER B - Secondary Sources (7 источников)

```typescript
// Russian/Ukrainian
{ id: 'news_forklog', rssUrl: 'https://forklog.com/feed/', tier: 'B' }
{ id: 'news_incrypted', rssUrl: 'https://incrypted.com/feed/', tier: 'B' }

// English Secondary
{ id: 'news_bitcoinmagazine', rssUrl: 'https://bitcoinmagazine.com/.rss/full/', tier: 'B' }
{ id: 'news_cryptoslate', rssUrl: 'https://cryptoslate.com/feed/', tier: 'B' }
{ id: 'news_beincrypto', rssUrl: 'https://beincrypto.com/feed/', fallback: { mode: 'browser' }, tier: 'B' }
{ id: 'news_utoday', rssUrl: 'https://u.today/rss', tier: 'B' }

// DeFi Research (BROKEN)
{ id: 'news_bankless', rssUrl: 'https://www.bankless.com/rss/', fallback: { mode: 'browser' }, tier: 'B' }
```

### TIER C - Research & Official (5 источников)

```typescript
// Research
{ id: 'news_messari', rssUrl: 'https://messari.io/rss', tier: 'C' }
{ id: 'news_rekt', rssUrl: 'https://rekt.news/rss/feed.xml', tier: 'C' }

// Official Exchange Blogs
{ id: 'news_binance_blog', rssUrl: 'https://www.binance.com/en/blog/rss', fallback: { mode: 'replace' }, tier: 'C' }
{ id: 'news_coinbase_blog', rssUrl: 'https://blog.coinbase.com/feed', fallback: { mode: 'browser' }, tier: 'C' }
```

### Fallback стратегия

```
RSS Feed Failed?
       │
       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  mode: 'html'   │ ──► │  mode: 'browser'│ ──► │  mode: 'replace'│
│  Parse HTML     │     │  Puppeteer      │     │  Use alt URL    │
│  with selectors │     │  Full render    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### API вызовы

```bash
# Sync all news
POST /api/news/sync/all

# Get news sources status
GET /api/news/sources

# Master run (includes news)
POST /api/parsers/master/run
```

---

## ЛОГИКА 3: MARKET DATA (Биржевые данные)

### Провайдеры и приоритеты

| Провайдер | Приоритет | Тип | Данные | Proxy |
|-----------|-----------|-----|--------|-------|
| **Coinbase** | 90 | Spot | quotes, candles, orderbook, trades | ❌ No |
| **HyperLiquid** | 85 | Perps | funding, positions, liquidations | ❌ No |
| **DefiLlama** | 70 | DeFi | TVL, protocols, yields | ❌ No |
| **Binance** | 80 | Spot | quotes, candles, orderbook | ✅ Yes |
| **Bybit** | 80 | Spot/Perps | quotes, candles | ✅ Yes |

### Coinbase Adapter (No proxy needed)

```typescript
// Файл: /app/backend/src/modules/market-gateway/adapters/coinbase.adapter.ts

baseUrl = 'https://api.exchange.coinbase.com';

// Endpoints
GET /products/{product_id}/ticker    → getQuote()
GET /products/{product_id}/stats     → 24h stats
GET /products/{product_id}/candles   → getCandles()
GET /products/{product_id}/book      → getOrderbook()
GET /products/{product_id}/trades    → getTrades()
GET /products                        → getProducts()
```

### HyperLiquid Adapter (Perps, no proxy)

```typescript
// Файл: /app/backend/src/modules/market-gateway/adapters/hyperliquid.adapter.ts

baseUrl = 'https://api.hyperliquid.xyz';

// Endpoints
POST /info   → getFundingRates(), getOpenInterest()
             → getCandles(), getOrderbook()
```

### Exchange Adapter (Binance/Bybit, needs proxy)

```typescript
// Файл: /app/backend/src/modules/market-gateway/adapters/exchange.adapter.ts

binance = {
  ticker: 'https://api.binance.com/api/v3/ticker/24hr',
  klines: 'https://api.binance.com/api/v3/klines',
  orderbook: 'https://api.binance.com/api/v3/depth',
  trades: 'https://api.binance.com/api/v3/trades',
}

bybit = {
  ticker: 'https://api.bybit.com/v5/market/tickers',
  klines: 'https://api.bybit.com/v5/market/kline',
}
```

### Кэширование

```typescript
// Файл: /app/backend/src/modules/market-gateway/market-gateway.service.ts

TTL по типам:
- quote: 10s
- quotes: 10s
- candles: 5min
- orderbook: 5s
- trades: 5s
- overview: 60s
- health: 30s
```

### API вызовы

```bash
# Quotes
GET /api/market/quote?asset=BTC
GET /api/market/bulk-quotes?assets=BTC,ETH,SOL

# Candles
GET /api/market/candles/:symbol?interval=1h&limit=100

# Orderbook & Trades
GET /api/market/orderbook/:symbol?exchange=coinbase
GET /api/market/trades/:symbol?exchange=coinbase

# Perps (HyperLiquid)
GET /api/market/perps/funding
GET /api/market/perps/overview
GET /api/market/perps/quote/:symbol

# Health
GET /api/market/providers
```

---

## REGISTRY SUMMARY

```typescript
// Файл: /app/backend/src/parsers/registry/parser.registry.ts

getRegistrySummary() = {
  total: 27,
  enabled: 27,
  byKind: {
    api: 6,      // Dropstab + CryptoRank APIs
    xhr: 1,      // CryptoRank categories
    html: 3,     // ICODrops scrapers
    rss: 17,     // News feeds
  },
  byEntity: {
    investors: 2,
    rounds: 2,
    unlocks: 2,
    icos: 3,
    categories: 1,
    news: 17,
  }
}
```

---

## PROXY CONFIGURATION

```typescript
// Файл: /app/backend/src/parsers/antiblock/proxy-pool.service.ts

// ENV variable
PROXY_URLS="http://proxy1:port,http://proxy2:port"

// Proxy pool features:
- Round-robin selection
- Failure tracking
- Exponential cooldown (1min → 15min max)
- Health monitoring
```

---

## ВЫВОД

| Логика | Источников | Тиров | Fallback | Proxy |
|--------|------------|-------|----------|-------|
| **Intel Data** | 3 | 2 | API → Browser | Optional |
| **News/RSS** | 19 | 3 (A/B/C) | RSS → HTML → Browser → Replace | No |
| **Market Data** | 5 | - | Provider failover | Binance/Bybit only |

**Всего уникальных источников данных: 27**
