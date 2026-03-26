# СРАВНИТЕЛЬНЫЙ ОТЧЁТ: Python vs NestJS
## Дата: 2026-03-26 (после Sprint 1.5)

---

## 📊 ОБЩАЯ КАРТИНА

```
                    PYTHON (Old)              NESTJS (Current)           STATUS
─────────────────────────────────────────────────────────────────────────────────
Источники данных    45 уникальных             27 парсеров                🟡 -40%
API Endpoints       937                       ~250                       🟡 -73%
Derived Edges       ~20k                      96,362                     🟢 +380%
Source Reliability  Полная система            16 источников tracked      🟢 ВОССТАНОВЛЕНО
Graph Intelligence  23 edge types             5 + derived                🟡 В ПРОЦЕССЕ
News Pipeline       7 этапов                  2 этапа                    🔴 ОТСТАЁМ
Scheduler           10+ schedulers            Базовый cron               🔴 ОТСТАЁМ
Proxy System        Failover + DB             Failover + DB              🟢 ВОССТАНОВЛЕНО
```

---

## ✅ ГДЕ NESTJS ОПЕРЕЖАЕТ

### 1. Derived Graph Edges
```
Python:  ~20,000 derived edges
NestJS:  96,362 derived edges (+380%!)

coinvested_with: 96,362 edges
avg_weight: 9 (раз вместе)
max_weight: 383 (au21 ↔ x21)
```

**Пример Intelligence:**
```
a16z ↔ Coinbase: 164 раза вместе
a16z ↔ Polychain: 90 раз
a16z ↔ Paradigm: 61 раз
```

### 2. Pre-computed Relations
```
Python:  coinvest вычислялся на лету
NestJS:  138,175 pre-computed coinvest_relations
```

### 3. Parser Operations Layer
```
NestJS имеет:
- ParserOpsService (runtime state)
- StrategyLearningService
- SchemaDriftService
- AnomalyDetectionService
- AutoRecoveryService
- ParserLogs collection
```

### 4. Self-Learning Ingestion
```
NestJS имеет:
- SourceLearningMetrics
- PayloadDiscoveryService
- Schema drift detection
```

### 5. Documentation & Architecture
```
NestJS:
- Полная OpenAPI документация
- Архитектурные файлы в /memory
- Типизация TypeScript
```

---

## 🟢 ГДЕ ДОСТИГНУТ ПАРИТЕТ

### 1. Source Reliability System ✅
```
Python: source_metrics + history + fetch_log
NestJS: source_metrics + history + fetch_log

16 источников с scoring:
- reliability_score
- latency_score
- freshness_score
- error_rate
- final_score

getBestSource(dataType) работает!
```

### 2. Proxy System ✅
```
Python: Failover + DB persistence + Admin API
NestJS: Failover + DB persistence + Admin API

Endpoints:
- POST /api/admin/proxy/add
- DELETE /api/admin/proxy/remove/:id
- POST /api/admin/proxy/test
- POST /api/admin/proxy/priority/:id
```

### 3. Core Parsers ✅
```
Python: Dropstab + CryptoRank
NestJS: Dropstab + CryptoRank

Status: OK
Investors: 18,959
Funding: 16,808
```

### 4. Entity Resolution ✅
```
Python: canonical_investors + coinvest_relations
NestJS: canonical_investors + coinvest_relations

Canonical: 8,456
Coinvest relations: 138,175
Quality score: 84%
```

### 5. Smart Money ✅
```
Python: smart_money_profiles + tiers
NestJS: smart_money_profiles + tiers

Profiles: 8,456
ALPHA: 404 | SMART: 3,721 | FOLLOWER: 398 | RETAIL: 3,933
```

---

## 🟡 ГДЕ ЧАСТИЧНЫЙ ПАРИТЕТ

### 1. RootData Module
```
Python: Полная интеграция
NestJS: Модуль создан, но данные не синхронизированы (0 records)

ПРИЧИНА: Требуется API ключ RootData
РЕШЕНИЕ: Получить ключ и запустить sync
```

### 2. Graph Builder
```
Python:
- 23 edge types
- derived + intelligence edges
- temporal graph
- projections

NestJS:
- 5 base edge types
- coinvested_with (96k edges!)
- НЕТ: worked_together, shares_investor_with, shares_founder_with
- НЕТ: temporal graph
- НЕТ: projections

СТАТУС: coinvested_with готов, остальные в процессе
```

### 3. News Sources
```
Python: 120 RSS источников
NestJS: 19 RSS источников (411 статей)

СТАТУС: Базовый набор работает, расширение возможно
```

---

## 🔴 ГДЕ ОТСТАЁМ

### 1. News Intelligence Pipeline
```
Python:
1. Ingestion (120 sources)
2. Normalizer
3. Entity Extractor
4. Clustering
5. Ranker
6. Story Synthesizer (AI)
7. Output (events, stories)

NestJS:
1. RSS Fetch (19 sources)
2. Save

ОТСТАВАНИЕ: 5 этапов не реализовано
ПРИОРИТЕТ: P1
```

### 2. Scheduler System
```
Python:
- data_sync_scheduler (tier-based)
- discovery_scheduler
- entity_candidate_scheduler
- exchange_scheduler
- feed_queue_scheduler
- health_alerts
- intelligence_scheduler
- self_learning_scheduler
- sentiment_scheduler
- telegram_integration
- webhook_scheduler

NestJS:
- Базовый cron для RSS (каждые 15 мин)

ОТСТАВАНИЕ: 10 schedulers не реализовано
ПРИОРИТЕТ: P1
```

### 3. Потерянные Источники
```
❌ RootData (API ключ нужен)
❌ CoinGecko (API ключ нужен)
❌ CoinMarketCap (API ключ нужен)
❌ TokenUnlocks
❌ DropsEarn
❌ DappRadar
❌ AirdropAlert
❌ Messari
❌ GitHub
❌ ~100 RSS источников
❌ 19 бирж (только 5 есть)

ПРИОРИТЕТ: P2 (после scheduler)
```

### 4. Sentiment Engine
```
Python:
- FOMO Provider (built-in)
- OpenAI Provider
- Consensus formula
- Keyword analysis

NestJS: НЕТ

ПРИОРИТЕТ: P3
```

### 5. Telegram Alerts
```
Python:
- price alerts
- funding alerts
- unlock alerts
- news alerts
- momentum alerts
- scheduled reports

NestJS: НЕТ

ПРИОРИТЕТ: P3
```

---

## 📈 КОЛИЧЕСТВЕННОЕ СРАВНЕНИЕ

| Метрика | Python | NestJS | Δ |
|---------|--------|--------|---|
| Источники данных | 45 | 27 | -40% |
| API Endpoints | 937 | ~250 | -73% |
| Investors | 18,959 | 18,959 | = |
| Funding rounds | 16,368 | 16,808 | +3% |
| Canonical investors | 8,456 | 8,456 | = |
| Coinvest relations | 138,175 | 138,175 | = |
| Derived edges | ~20k | 96,362 | +380% |
| News sources | 120 | 19 | -84% |
| News articles | - | 411 | NEW |
| Graph nodes | ~500 | 11,121 | +2124% |
| Graph edges | ~600 | 5,288 | +781% |
| Schedulers | 10+ | 1 | -90% |
| Source reliability | ✅ | ✅ | = |
| Proxy failover | ✅ | ✅ | = |

---

## 🎯 ВЕРДИКТ

### NestJS СИЛЬНЕЕ в:
1. **Derived edges** — 96k vs 20k (+380%)
2. **Parser operations** — self-learning, anomaly detection
3. **Pre-computed data** — 138k coinvest relations
4. **Graph density** — 11k nodes, 5k edges vs 500/600
5. **Code quality** — TypeScript, модульность

### Python СИЛЬНЕЕ в:
1. **News Intelligence** — полный 7-этапный pipeline
2. **Scheduler system** — 10+ schedulers vs 1
3. **Источники данных** — 45 vs 27
4. **Sentiment engine** — multi-provider
5. **Telegram alerts** — полная система
6. **Graph edge types** — 23 vs 5+derived

### КРИТИЧЕСКИЕ GAPS (P0-P1):
```
1. Scheduler parity         — БЛОКЕР для автоматизации
2. News entity extraction   — БЛОКЕР для intelligence
3. RootData sync            — БЛОКЕР для graph enrichment
4. Remaining derived edges  — worked_together, shares_investor_with
```

---

## 📋 ПЛАН ДОСТИЖЕНИЯ ПАРИТЕТА

### Sprint 2 (P1)
```
[ ] Scheduler system (tier-based)
[ ] News entity extraction
[ ] News clustering
[ ] shares_investor_with edges
[ ] worked_together edges
[ ] Graph snapshots
```

### Sprint 3 (P2)
```
[ ] RootData API sync
[ ] News ranking
[ ] Missing strategic sources (CoinGecko, TokenUnlocks)
[ ] Graph projections
```

### Sprint 4 (P3)
```
[ ] Sentiment engine
[ ] Telegram alerts
[ ] News story synthesis
[ ] Remaining sources
```

---

## 💡 ЗАКЛЮЧЕНИЕ

**NestJS версия уже не "отстаёт" — она ДРУГАЯ.**

- В **graph intelligence** NestJS опережает (96k derived edges)
- В **parser ops** NestJS опережает (self-learning)
- В **news pipeline** Python опережает (7 этапов)
- В **scheduler** Python опережает (10+ vs 1)
- В **источниках** Python опережает (45 vs 27)

**Рекомендация:** Не "догонять" Python, а достраивать критические gaps (scheduler, news extraction) и использовать преимущества NestJS (плотный граф, self-learning).
