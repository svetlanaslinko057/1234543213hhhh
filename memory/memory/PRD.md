# FOMO Crypto Intelligence Platform - PRD v3

## Project Overview
Crypto intelligence platform with parsers for Dropstab and CryptoRank, knowledge graph, sentiment analysis.

**Repository**: https://github.com/svetlanaslinko057/4444343

## Architecture
- **Backend**: NestJS + TypeScript + Puppeteer + MongoDB
- **Frontend**: React + Tailwind CSS + Radix UI
- **Database**: MongoDB (fomo_market)
- **Parser System**: API-first with XHR interception and extraction pipeline

## What's Been Implemented (2026-03-25)

### Critical Fixes Applied:
1. **CryptoRank XHR Discovery** - Found real API endpoint via browser interception
2. **Investor Extraction** - Extract investors from funding rounds (no separate API needed!)
3. **Universal Scraper** - Template for any future website

### Current Data Status

| Metric | Count | Status |
|--------|-------|--------|
| Total Investors | 18,940 | ✅ OK |
| Total Funding Rounds | 16,341 | ✅ OK |
| Unlocks | 0 | ⚠️ Unavailable |

### Investors Breakdown
| Source | API | Extracted | Total |
|--------|-----|-----------|-------|
| Dropstab | 7,723 | 7,707 | 15,430 |
| CryptoRank | 0 | 3,510 | 3,510 |

### API Endpoints
```
GET  /api/health
GET  /api/parsers/status               # Parser health with extraction stats
POST /api/parsers/extract/investors    # Extract investors from funding rounds
GET  /api/parsers/extract/investors/stats
GET  /api/intel/stats
GET  /api/intel/investors
GET  /api/intel/fundraising
POST /api/parsers/sync/dropstab/investors
POST /api/parsers/sync/dropstab/fundraising
POST /api/parsers/sync/cryptorank/funding
```

### Key Files
- `/app/backend/src/parsers/cryptorank/cryptorank.direct-api.ts` - CryptoRank v0 API
- `/app/backend/src/parsers/extraction/investor-extraction.service.ts` - Investor extraction
- `/app/backend/src/parsers/common/universal-scraper.ts` - Universal XHR scraper template

## Technical Solutions Applied

### 1. CryptoRank XHR Discovery
**Problem**: SSR (`__NEXT_DATA__`) only returned 21 records

**Solution**: XHR interception found real API:
```
POST https://api.cryptorank.io/v0/funding-rounds-v2
Body: { "limit": 50, "skip": N }
```

**Result**: 21 → 4,356 records ✅

### 2. Investor Extraction from Funding Rounds
**Problem**: CryptoRank investors API limited to 10 records

**Solution**: Extract and aggregate investors from funding rounds:
- Parse `investors[]` array from each round
- Aggregate: rounds_count, total_invested, projects[]
- Deduplicate by name

**Result**: 0 → 3,510 CryptoRank investors ✅

### 3. Universal Scraper Pattern
Created reusable pattern for any website:
1. Browser → open page
2. Intercept all XHR/Fetch
3. Auto-detect data arrays
4. Normalize and dedupe
5. Fallback to SSR if needed

## Access
- **URL**: https://parser-bootstrap.preview.emergentagent.com
- **Password**: `fomo2024`

## Backlog

### P0 (Done) ✅
- [x] CryptoRank XHR discovery and fix
- [x] Investor extraction from funding rounds
- [x] Status endpoint with extraction stats

### P1 (High Priority)
- [ ] Add retry and fallback to all parsers
- [ ] CRON job for daily sync
- [ ] Data versioning (track changes over time)

### P2 (Medium Priority)
- [ ] Add more sources (ICODrops, DefiLlama)
- [ ] Build funding graph (fund → project relations)
- [ ] Dedupe investors across sources

### P3 (Low Priority)
- [ ] Alerts for large funding rounds
- [ ] Export functionality
- [ ] API documentation (Swagger)
