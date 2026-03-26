# ГЛУБОКИЙ СРАВНИТЕЛЬНЫЙ АУДИТ
## Python (Old) vs NestJS (Current) Version

**Дата аудита:** 2026-03-26
**Цель:** Сравнить архитектуру, источники, защиту, граф между двумя версиями

---

## ОБЩЕЕ СРАВНЕНИЕ

| Критерий | Python (Old) | NestJS (Current) | Winner |
|----------|--------------|------------------|--------|
| API Routes | **937** endpoints | ~200 endpoints | 🏆 Python |
| Источники данных | **45** уникальных | **27** парсеров | 🏆 Python |
| Тировая система | 4 тира + Person + News | 3 класса (A/B/C) | 🏆 Python |
| Proxy система | Failover + DB persistence | Round-robin + env only | 🏆 Python |
| Source Reliability | Полная система скоринга | Нет | 🏆 Python |
| Graph Builder | Полный с derived edges | Упрощенный | 🏆 Python |
| Data Validation | BaseReliableParser + validator | DataValidationService | ≈ Равно |
| News Intelligence | Полный pipeline (7 этапов) | RSS + HTML fallback | 🏆 Python |
| Sentiment Engine | Multi-provider (FOMO + OpenAI) | Нет | 🏆 Python |
| Telegram Alerts | Полная система | Нет | 🏆 Python |

---

## 1. ИСТОЧНИКИ ДАННЫХ - ДЕТАЛЬНОЕ СРАВНЕНИЕ

### Python Version: 45 источников

#### TIER 1 — CORE DATA (sync каждые 10 мин)
```
| # | Source | Type | API | Parser | Status in NestJS |
|---|--------|------|-----|--------|------------------|
| 1 | CryptoRank | funding, ico, unlocks | ✅ | ✅ | ✅ Есть |
| 2 | RootData | funding, funds, persons | ✅ | ✅ | ❌ ПОТЕРЯНО |
| 3 | DefiLlama | defi, protocols, tvl | ✅ | - | ✅ Есть (adapter) |
| 4 | Dropstab | activities, airdrops | - | ✅ | ✅ Есть |
```

#### TIER 2 — TOKEN / MARKET DATA (sync каждые 15 мин)
```
| # | Source | Type | API | Parser | Status in NestJS |
|---|--------|------|-----|--------|------------------|
| 1 | CoinGecko | market, prices | ✅ | ✅ | ❌ ПОТЕРЯНО |
| 2 | CoinMarketCap | market, prices | ✅🔑 | ✅ | ❌ ПОТЕРЯНО |
| 3 | TokenUnlocks | unlocks | ✅ | ✅ | ❌ ПОТЕРЯНО |
```

#### TIER 3 — ACTIVITIES (sync каждые 30 мин)
```
| # | Source | Type | API | Parser | Status in NestJS |
|---|--------|------|-----|--------|------------------|
| 1 | DropsEarn | activities | - | ✅ | ❌ ПОТЕРЯНО |
| 2 | ICO Drops | ico | - | ✅ | ✅ Есть (HTML) |
| 3 | DappRadar | dapps | ✅ | ✅ | ❌ ПОТЕРЯНО |
| 4 | AirdropAlert | airdrops | - | ✅ | ❌ ПОТЕРЯНО |
```

#### TIER 4 — RESEARCH DATA (sync каждые 3 часа)
```
| # | Source | Type | API | Parser | Status in NestJS |
|---|--------|------|-----|--------|------------------|
| 1 | Messari | research | ✅🔑 | - | ❌ ПОТЕРЯНО |
```

#### PERSON / TEAM DATA (для графа)
```
| # | Source | Type | API | Parser | Status in NestJS |
|---|--------|------|-----|--------|------------------|
| 1 | RootData | teams, founders | ✅ | ✅ | ❌ ПОТЕРЯНО |
| 2 | CryptoRank | teams | ✅ | ✅ | ❌ ПОТЕРЯНО |
| 3 | GitHub | developers | ✅ | - | ❌ ПОТЕРЯНО |
| 4 | Twitter/X | social | ✅🔑 | ✅ | ❌ ПОТЕРЯНО |
| 5 | LinkedIn | professional | ✅🔑 | - | ❌ ПОТЕРЯНО |
```

#### NEWS SOURCES (отдельная категория)
```
Python: 120 RSS источников
NestJS: 19 RSS источников

| Source | Python | NestJS |
|--------|--------|--------|
| CoinDesk | ✅ Tier 1 | ✅ Tier A |
| Cointelegraph | ✅ Tier 3 | ✅ Tier A |
| The Block | ✅ Tier 3 | ✅ Tier A |
| Incrypted | ✅ Tier 1 | ✅ Tier B |
| Forklog | ❌ | ✅ Tier B |
| Messari RSS | ✅ | ✅ Tier C |
| Bankless | ✅ | ✅ Tier B |
| Binance Blog | ✅ | ✅ Tier C |
| + 100 других | ✅ | ❌ |
```

#### БИРЖИ
```
Python: 24 биржи (14 CEX + 10 DEX)
NestJS: 5 провайдеров (Coinbase, Binance, Bybit, HyperLiquid, DefiLlama)

CEX потеряны: OKX, Kraken, KuCoin, Gate.io, Huobi, MEXC, Bitget, Bitfinex, Bitstamp, Crypto.com, Gemini
DEX потеряны: Uniswap, dYdX, PancakeSwap, Curve, GMX, Raydium, Jupiter, 1inch, SushiSwap
```

### ИТОГО ПОТЕРЯНО:
```
- RootData (funding, funds, persons, teams) - КРИТИЧНО
- CoinGecko (market data)
- CoinMarketCap (market data)
- TokenUnlocks (unlock schedules)
- DropsEarn (activities)
- DappRadar (dapps)
- AirdropAlert (airdrops)
- Messari (research)
- GitHub (developer activity)
- Twitter/X (social)
- LinkedIn (professional)
- Crunchbase (company data)
- ~100 RSS news sources
- 19 бирж
```

---

## 2. PROXY СИСТЕМА - СРАВНЕНИЕ

### Python Version
```python
class ProxyManager:
    """
    - Multiple proxies with priority order
    - Automatic failover (NOT rotation!)
    - MongoDB persistence for restarts
    - Admin API for management
    - Per-proxy success/error tracking
    - Test proxy connectivity
    """
    
    # Загрузка из DB
    async def load_from_db(self):
        docs = await db.system_proxies.find({}).to_list(100)
    
    # Failover logic (NOT rotation!)
    def request_with_failover(self, func):
        for proxy in sorted_by_priority:
            try:
                result = func(proxy)
                proxy.success_count += 1
                return result
            except:
                proxy.error_count += 1
                continue
        raise "All proxies failed"
    
    # Admin API
    POST /api/intel/admin/proxy/add
    POST /api/intel/admin/proxy/remove/{id}
    POST /api/intel/admin/proxy/reorder
    GET  /api/intel/admin/proxy/status
    POST /api/intel/admin/proxy/test
```

### NestJS Version
```typescript
class ProxyPoolService {
    // Только env loading
    const proxyList = process.env.PROXY_URLS?.split(',')
    
    // Round-robin (не failover!)
    getNextProxyRoundRobin(): ProxyEndpoint | null {
        const proxy = this.proxies[this.currentIndex % this.proxies.length];
        this.currentIndex++;
        return proxy;
    }
    
    // Cooldown (но не persistence)
    const cooldownMs = Math.min(15 * 60 * 1000, proxy.failCount * 60 * 1000);
    
    // НЕТ Admin API
    // НЕТ MongoDB persistence
    // НЕТ proxy test endpoint
}
```

### Что потеряно в NestJS:
```
❌ MongoDB persistence - proxies теряются при рестарте
❌ Priority-based failover - вместо этого round-robin
❌ Admin API для управления proxy
❌ Test proxy connectivity endpoint
❌ Per-source proxy assignment
```

---

## 3. SOURCE RELIABILITY СИСТЕМА

### Python Version
```python
class SourceReliabilitySystem:
    """
    Dynamic scoring based on:
    - reliability_score: How often data is correct
    - latency_score: Response time
    - freshness_score: How up-to-date is data
    - error_rate: Failure rate
    - final_score: Weighted combination
    """
    
    SCORE_WEIGHTS = {
        "reliability": 0.35,
        "latency": 0.20,
        "freshness": 0.25,
        "error_rate": 0.20
    }
    
    SOURCE_CAPABILITIES = {
        "cryptorank": ["funding", "ico", "unlocks", "activities", "persons"],
        "rootdata": ["funding", "funds", "persons", "portfolio"],
        "defillama": ["tvl", "defi", "chains", "protocols"],
        "coingecko": ["prices", "market_cap", "volume", "token_info"],
        ...
    }
    
    async def get_best_source(self, data_type: str) -> str:
        """Выбирает лучший источник по скору"""
    
    async def record_fetch(self, source_id, success, latency_ms, freshness_hours):
        """Записывает результат и обновляет скор"""
    
    # Collections:
    - source_metrics (текущие скоры)
    - source_reliability_history (история скоров)
    - source_fetch_log (лог всех запросов, TTL 7 дней)
```

### NestJS Version
```
❌ ПОЛНОСТЬЮ ОТСУТСТВУЕТ

Нет системы для:
- Выбора лучшего источника
- Отслеживания reliability
- Автоматического failover между источниками
- Исторических данных по качеству
```

---

## 4. KNOWLEDGE GRAPH - СРАВНЕНИЕ

### Python Version
```python
# Node Types (10)
project, token, person, asset, fund, exchange,
activity, funding_round, unlock_event, ico_sale

# Edge Types (23)
invested_in, led_round, works_at, worked_at, founded,
advisor_of, has_token, mapped_to_asset, traded_on,
listed_on, has_activity, has_unlock, has_funding_round,
has_ico, coinvested_with (derived), worked_together (derived),
shares_investor_with (derived), shares_founder_with (derived),
shares_ecosystem_with (derived), related_to (derived)

# Collections
graph_nodes: 423
graph_edges: 546
graph_derived_edges: 1,877
graph_intelligence_edges: 2,735
graph_edge_types: 23
graph_snapshots: 2
graph_projection: 22

# Builder Features
- build_projects_graph()
- build_exchanges_graph()
- build_traded_on_edges()
- build_real_investments_network() - REAL VC DATA!
- build_coinvested_edges() - Derived edges
- full_rebuild() with snapshot
```

### NestJS Version
```typescript
// Node Types (6)
fund, project, token, person, asset, exchange

// Edge Types (5)
invested_in, has_token, traded_on, works_at, founded

// Collections
graph_nodes: 11,121
graph_edges: 5,288
(No derived edges!)
(No intelligence edges!)

// Builder Features
- buildFromIntelData()
- buildProjectsGraph()
- buildFundsGraph()
- (No derived edge building!)
- (No coinvested_with!)
- (No worked_together!)
```

### Что потеряно в NestJS Graph:
```
❌ 17 типов связей (derived + intelligence)
❌ graph_derived_edges collection
❌ graph_intelligence_edges collection
❌ coinvested_with computation
❌ worked_together computation
❌ shares_investor_with computation
❌ shares_founder_with computation
❌ Temporal graph (время связей)
❌ Graph projections (precomputed views)
```

---

## 5. NEWS INTELLIGENCE PIPELINE

### Python Version (7 этапов)
```
1. INGESTION
   - 120 RSS sources
   - Rate limiting per source
   - Deduplication

2. NORMALIZER
   - Clean HTML
   - Extract metadata
   - Language detection

3. ENTITY EXTRACTOR
   - Asset mentions (BTC, ETH)
   - Organization detection
   - Person names
   - Amount/price extraction

4. CLUSTERING
   - Group related articles
   - Detect duplicate stories
   - Create events from clusters

5. RANKER
   - Freshness (35%)
   - Importance (20%)
   - Confidence (20%)
   - Source Quality (15%)
   - Market Relevance (10%)

6. STORY SYNTHESIZER
   - Generate EN/RU stories via GPT-4o
   - AI View generation
   - Cover image via gpt-image-1

7. OUTPUT
   - news_events (215)
   - news_stories (40)
   - event_entities (1,989)
```

### NestJS Version (2 этапа)
```
1. RSS FETCH
   - 19 RSS sources
   - HTML fallback
   - Browser fallback

2. SAVE
   - news_articles collection
   - news_sources collection
   
❌ No clustering
❌ No entity extraction
❌ No ranking
❌ No story synthesis
❌ No AI generation
```

---

## 6. SENTIMENT ENGINE

### Python Version
```python
class SentimentEngine:
    """
    Multi-provider sentiment analysis:
    - FOMO Provider (built-in, crypto-specific)
    - OpenAI Provider (GPT-4o)
    
    Consensus formula:
    consensus = Σ(weight × score × confidence) / Σ(weight × confidence)
    Agreement bonus: +15% confidence when providers agree
    """
    
    POSITIVE_KEYWORDS = {
        'high': ['bullish', 'moon', 'pump', 'surge', 'rally', 'breakout', 
                 'ath', 'adoption', 'partnership', 'launch', 'approved', 
                 'etf', 'institutional', 'upgrade', 'mainnet'],
        'medium': ['growth', 'gain', 'profit', 'positive', 'strong', 
                   'support', 'accumulation', 'buy', 'long', 'hodl']
    }
    
    NEGATIVE_KEYWORDS = {
        'high': ['bearish', 'crash', 'dump', 'plunge', 'hack', 'exploit',
                 'scam', 'rug', 'sec', 'lawsuit', 'ban', 'delist'],
        'medium': ['decline', 'loss', 'drop', 'weak', 'resistance', 
                   'sell', 'short', 'fud', 'concern']
    }
```

### NestJS Version
```
❌ ПОЛНОСТЬЮ ОТСУТСТВУЕТ

Нет:
- Keyword-based sentiment
- LLM sentiment
- Consensus engine
- Sentiment caching
```

---

## 7. TELEGRAM SERVICE

### Python Version
```python
# Alert Types
- price: Price crosses threshold
- funding: New funding announced
- unlock: Token unlock within 24h
- news: High-importance news
- momentum: Unusual momentum detected

# API
GET  /api/telegram/bot/status
POST /api/telegram/bot/test
POST /api/telegram/bot/send-report
POST /api/telegram/alerts/emit
GET  /api/telegram/alerts/recent
GET  /api/telegram/alerts/stats

# Features
- Alert templates (RU)
- Scheduled reports
- Custom triggers
```

### NestJS Version
```
❌ ПОЛНОСТЬЮ ОТСУТСТВУЕТ
```

---

## 8. DATA VALIDATION - СРАВНЕНИЕ

### Python Version
```python
class BaseReliableParser:
    """
    Base class with:
    - Automatic retry logic
    - Proxy support
    - Rate limiting
    - Error handling
    - Reliability tracking integration
    """
    
    @asynccontextmanager
    async def track_fetch(self, endpoint: str):
        """Track fetch with timing and reliability recording"""
        tracker = FetchTracker(self, endpoint)
        async with tracker:
            yield tracker
        
        await self._record_fetch(
            endpoint=endpoint,
            success=tracker.success,
            latency_ms=tracker.latency_ms,
            data_freshness_hours=tracker.freshness_hours,
            error=tracker.error
        )

class ParserValidator:
    """
    Per-source field ownership:
    - Which source owns which field
    - Conflict resolution strategy
    """
```

### NestJS Version
```typescript
class DataValidationService {
    /**
     * - Funding round validation
     * - Investor validation  
     * - Batch validation with stats
     * - Data health check
     */
    
    validateFundingRound(data): ValidationResult
    validateInvestor(data): ValidationResult
    validateBatch(items, type): { valid, invalid, stats }
    checkDataHealth(model, type): { total, healthy, issues }
}
```

### Разница:
```
Python: Validation + Reliability tracking + Field ownership
NestJS: Validation only (no tracking, no ownership)
```

---

## 9. SCHEDULER СИСТЕМА

### Python Version
```python
# Модули scheduler
data_sync_scheduler.py      # Sync по тирам
discovery_scheduler.py       # Auto-discovery
entity_candidate_scheduler.py
exchange_scheduler.py        # Exchange data
feed_queue_scheduler.py      # Feed processing
health_alerts.py             # Health monitoring
intelligence_scheduler.py    # Intelligence jobs
self_learning_scheduler.py   # Self-learning
sentiment_scheduler.py       # Sentiment jobs
telegram_integration.py      # Telegram scheduler
webhook_scheduler.py         # Webhook jobs

# Интервалы
Tier 1: каждые 10 мин
Tier 2: каждые 15 мин
Tier 3: каждые 30 мин
Tier 4: каждые 3 часа
```

### NestJS Version
```
❌ НЕТ SCHEDULER СИСТЕМЫ

Все запуски только через API вручную:
POST /api/parsers/sync/all
POST /api/parsers/master/run
```

---

## 10. ADMIN PANEL

### Python Version
```
| Tab | Description |
|-----|-------------|
| Proxy Pool | Manage proxy configurations |
| API Keys | External API keys (CoinGecko, etc.) |
| LLM Keys | OpenAI/Anthropic keys |
| Sentiment | Sentiment provider keys |
| Provider Pool | Data provider management |
| Health Monitor | System health dashboard |
| Discovery System | Auto-discovery controls |
| Parser Jobs | Parser execution status |
```

### NestJS Version
```
Только базовый health endpoint:
GET /api/health
```

---

## ИТОГОВАЯ ОЦЕНКА

### Python побеждает в:
```
✅ Количество источников данных (45 vs 27)
✅ Тировая система (4 тира vs 3 класса)
✅ Proxy система (failover + persistence vs round-robin)
✅ Source Reliability (полная система vs нет)
✅ Knowledge Graph (23 edge types vs 5)
✅ News Intelligence (7 этапов vs 2)
✅ Sentiment Engine (multi-provider vs нет)
✅ Telegram Alerts (полная система vs нет)
✅ Scheduler (10+ schedulers vs 0)
✅ Admin Panel (8 tabs vs 1 endpoint)
✅ API endpoints (937 vs ~200)
```

### NestJS побеждает в:
```
✅ Современный стек (NestJS + TypeScript)
✅ Модульность кода
✅ Больше узлов в графе (11,121 vs 423)
✅ Data validation service (более структурированный)
```

---

## РЕКОМЕНДАЦИИ ПО МИГРАЦИИ

### КРИТИЧНО ВОССТАНОВИТЬ:
```
1. RootData парсер (funding, funds, persons, teams)
2. Source Reliability система
3. Derived edges для графа (coinvested_with, worked_together)
4. Proxy failover с persistence
5. Scheduler система
```

### ВЫСОКИЙ ПРИОРИТЕТ:
```
6. CoinGecko/CoinMarketCap (market data)
7. TokenUnlocks (unlock schedules)
8. News entity extraction
9. Sentiment engine
10. Telegram alerts
```

### СРЕДНИЙ ПРИОРИТЕТ:
```
11. DropsEarn, DappRadar, AirdropAlert
12. GitHub developer activity
13. News ranking и synthesis
14. Admin panel
```

---

## ЗАКЛЮЧЕНИЕ

**Python версия значительно полнее по функционалу:**
- 45 источников vs 27
- 937 API endpoints vs ~200
- Полная система reliability
- Развитый граф с derived edges
- News pipeline с AI
- Sentiment engine
- Telegram alerts
- Scheduler система

**NestJS версия:**
- Более современный стек
- Базовый функционал парсинга работает
- Граф работает (но упрощенный)
- Требует значительной доработки для паритета

**Рекомендация:** Портировать критические компоненты из Python в NestJS.
