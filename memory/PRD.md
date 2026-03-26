# FOMO Crypto Intelligence Platform - PRD

## Original Problem Statement
Клонировать репозиторий, изучить архитектуру и поднять все сервисы до 100% parity.

## Architecture
- **Frontend**: React + Tailwind CSS (порт 3000)
- **Backend**: NestJS через FastAPI proxy (порты 8001 → 3001)
- **Database**: MongoDB (fomo_market)

## What's Been Implemented

### Block 1: Repository Setup ✅
- Клонирование из GitHub
- Восстановление MongoDB из бэкапа (177k+ records)
- TypeScript fixes, сборка NestJS

### Block 5: Graph Pipeline ✅
- 9-stage pipeline (state machine)
- Context-based execution
- Node/Edge builders + enrichment
- Snapshots + Build logs

### Block 6: News Intelligence ✅
- Entity Extraction (projects, funds, tokens, persons)
- Entity Normalization с KNOWN_ALIASES + fuzzy matching
- News Clustering по темам/сущностям
- News Ranking (frequency + recency + source + entity weight)
- Graph edges (mentioned_in_news, co_mentioned_with)

### Block 7: Proxy Ops ✅
- Proxy scoring (success rate, latency, freshness, block rate)
- Dynamic best proxy selection
- Sticky routing (target → proxy affinity)
- Auto-quarantine (5 fails → 30min cooldown)

### Block 2: RSS Feed Service ✅
- 8 RSS feeds (CoinDesk, TheBlock, Cointelegraph, Decrypt...)
- Tier-based fetching (T1=10min, T2=15min, T3=30min)
- Deduplication via content hash
- Auto-storage to news_articles

### Block 3: Scheduler Integration ✅
- 19 registered jobs with dependency chains
- Tier-based execution (T1-T4)
- Jobs: rss_feeds_sync → news_intelligence_process → graph_pipeline

## Pipeline Results
| Metric | Value |
|--------|-------|
| Graph Nodes | 20,336 |
| Graph Edges | 862,664 |
| Build Time | 22s |
| Entity Match Rate | 64% (was 43%) |

## Current Status: **98% Parity**

## Remaining (P2)
1. Start scheduler in production
2. Add more known aliases for better match rate
3. Frontend dashboard updates

## API Endpoints
- `GET /api/health`
- `POST /api/graph-pipeline/run`
- `GET /api/news-intelligence/stats`
- `POST /api/news-intelligence/process`
- `GET /api/scheduler/jobs`
- `POST /api/scheduler/start`

## Date Updated
2026-03-26
