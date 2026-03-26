# FOMO Crypto Intelligence Platform - PRD

## Original Problem Statement
Клонировать репозиторий https://github.com/svetlanaslinko057/r4r4f4f4, изучить архитектуру и полностью поднять все сервисы.

## Architecture
- **Frontend**: React с Tailwind CSS, порт 3000
- **Backend**: NestJS (TypeScript) проксируется через FastAPI, порт 8001
- **NestJS**: Порт 3001 (внутренний)
- **Database**: MongoDB (fomo_market)

## Core Features Implemented
- ✅ Клонирование репозитория из GitHub
- ✅ Восстановление базы данных из бэкапа (177k+ записей)
- ✅ Миграция данных (funds, projects)
- ✅ Сборка NestJS бэкенда (исправлены TypeScript ошибки)
- ✅ Запуск всех сервисов через supervisor
- ✅ API эндпоинты работают

## Database Statistics
| Collection | Count |
|------------|-------|
| intel_funds | 9,293 |
| intel_projects | 6,354 |
| intel_investors | 18,959 |
| intel_fundraising | 16,368 |
| canonical_investors | 8,456 |
| smart_money_profiles | 8,456 |
| coinvest_relations | 177,033 |

## Key API Endpoints
- `GET /api/health` - Health check
- `GET /api/intel/funds` - Crypto funds
- `GET /api/intel/projects` - Projects
- `GET /api/intel/investors/top` - Top investors
- `GET /api/entities/stats` - Entity resolution stats
- `GET /api/smart-money/stats` - Smart money analytics
- `POST /api/auth/verify` - Authentication (password: fomo2024)

## What's Working
- All backend APIs (tested via localhost:8001)
- MongoDB with restored data
- NestJS build and runtime
- Frontend UI (login page)

## Known Issues
- External URL proxy may have delays during NestJS startup
- Browser-based scraping disabled (Chromium not configured)

## Date Completed
2026-03-26
