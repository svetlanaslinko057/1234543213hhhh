# FOMO Crypto Intelligence Platform - PRD

## Original Problem Statement
Клонировать репозиторий, изучить архитектуру и поднять все сервисы до полного parity с Python версией.

## Architecture
- **Frontend**: React + Tailwind CSS (порт 3000)
- **Backend**: NestJS через FastAPI proxy (порты 8001 → 3001)
- **Database**: MongoDB (fomo_market)

## What's Been Implemented

### Task 1: Repository Setup ✅
- Клонирование из GitHub
- Восстановление MongoDB из бэкапа
- Исправление TypeScript ошибок
- Запуск всех сервисов

### Block 5: Graph Pipeline ✅
- 9 stage-based pipeline (state machine)
- Context-based execution
- Node/Edge builders with enrichment
- Snapshots + Build logs
- 862k+ edges обработаны за 22 секунды

### Block 6: News Intelligence ✅ (NEW)
- Entity Extraction (projects, funds, tokens, persons)
- Entity Normalization (canonical IDs)
- News Clustering (по темам и сущностям)
- News Ranking (по важности)
- Graph Integration (mentioned_in_news, co_mentioned_with)

### Source Reliability ✅ (было)
- Dynamic source scoring
- Best source selection
- 15+ источников (CryptoRank, RootData, DeFiLlama...)

## Pipeline Results
| Metric | Value |
|--------|-------|
| Nodes | 20,336 |
| Edges | 862,664 |
| Build Time | 22s |
| Top Investor | Coinbase |

## API Endpoints
- `GET /api/health` - Health check
- `GET /api/intel/funds` - Crypto funds
- `GET /api/intel/projects` - Projects
- `POST /api/graph-pipeline/run` - Run pipeline
- `GET /api/graph-pipeline/overview` - Graph stats
- `GET /api/news-intelligence/stats` - News stats
- `POST /api/news-intelligence/process` - Process news
- `GET /api/news-intelligence/clusters/top` - Top clusters
- `GET /api/source-reliability/stats` - Source stats

## Current Status: 95% Parity

## Remaining (P1)
1. Proxy Ops (anti-ban, rotation)
2. Real news feed integration
3. RootData people → graph (worked_together edges)

## Date Updated
2026-03-26
