# FOMO Crypto Intelligence Platform - PRD

## Original Problem Statement
Клонировать репозиторий https://github.com/svetlanaslinko057/r4r4f4f4, изучить архитектуру и полностью поднять все сервисы.

## Architecture
- **Frontend**: React + Tailwind CSS (порт 3000)
- **Backend**: NestJS через FastAPI proxy (порты 8001 → 3001)
- **Database**: MongoDB (fomo_market)

## What's Been Implemented

### Task 1: Repository Setup ✅ (2026-03-26)
- Клонирование репозитория из GitHub
- Восстановление MongoDB из бэкапа
- Исправление TypeScript ошибок
- Запуск всех сервисов

### Block 5: Graph Pipeline ✅ (2026-03-26)
- Stage-based pipeline (9 stages)
- Context-based execution
- Node/Edge builders with enrichment
- Snapshots + Build logs
- Optimized для 800k+ edges

## Pipeline Results (7d window)
| Metric | Value |
|--------|-------|
| Nodes | 20,336 |
| Edges | 862,664 |
| Build Time | 22.5s |
| Top Investor | Coinbase |

## Database Statistics
| Collection | Count |
|------------|-------|
| intel_funds | 9,293 |
| intel_projects | 6,354 |
| intel_investors | 18,959 |
| intel_fundraising | 16,368 |
| coinvest_relations | 177,033 |
| canonical_investors | 8,456 |
| smart_money_profiles | 8,456 |

## Key API Endpoints
- `GET /api/health` - Health check
- `GET /api/intel/funds` - Crypto funds
- `GET /api/intel/projects` - Projects
- `POST /api/graph-pipeline/run` - Run pipeline
- `GET /api/graph-pipeline/overview` - Graph stats

## Next Action Items (P0)
1. ✅ Graph Pipeline - DONE
2. RootData → pipeline integration
3. Source Reliability → pipeline integration
4. News Intelligence (Block 6)
5. Proxy Ops

## Date Updated
2026-03-26
