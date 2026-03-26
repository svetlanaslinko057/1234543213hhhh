# FOMO Crypto Intelligence - Changelog

All notable changes to this project are documented here.

## [2.0.0] - 2026-03-25

### Added

#### Entity Resolution Engine
- Fuzzy matching with string-similarity (0.92 threshold)
- Auto-merge engine for duplicate consolidation
- Canonical investor entities (18,959 → 8,456, 55% dedup)
- Review queue for uncertain matches (0.85-0.92)

#### Smart Money Intelligence
- Smart Money tiers: ALPHA, SMART, FOLLOWER, RETAIL
- Early Investor Score (seed/pre-seed focus)
- Leader Detection (who leads rounds)
- Follow Pattern Detection (who follows whom)
- Enhanced scoring formula with recency, leads, tier1 partners
- 1,462 smart money profiles created
- 346 ALPHA tier investors identified

#### Coinvest Analysis
- Weighted coinvest graph (138,175 relations)
- Quality score for each relation
- Filtering: count >= 3, volume >= $1M
- Top co-investors with volume and project data

#### Data Quality
- Improved from 57% → 84%
- Schema validation for funding rounds and investors
- Health check endpoints

#### API Endpoints
- `/api/entities/resolve` - Full resolution pipeline
- `/api/entities/stats` - Entity statistics
- `/api/entities/leaderboard` - Top investors
- `/api/entities/coinvest` - Co-investor data
- `/api/smart-money/analyze` - Smart money pipeline
- `/api/smart-money/leaderboard` - Smart money ranking
- `/api/smart-money/profile` - Investor profiles

### Changed
- Fuzzy threshold increased from 0.88 to 0.92 (safer)
- Investor scoring formula enhanced
- Coinvest building optimized

### Technical
- Added string-similarity package
- New MongoDB collections: canonical_investors, coinvest_relations, smart_money_profiles, follow_relations
- Retry/fallback for all parser operations
- Circuit breaker pattern for resilience

## [1.0.0] - 2026-03-25 (Initial)

### Added
- Project cloned from repository
- NestJS backend setup
- React frontend setup
- Dropstab parser (investors + fundraising)
- CryptoRank parser (funding rounds via Direct API v0)
- Basic investor normalization
- MongoDB backup/restore
- Bootstrap scripts

### Data
- 18,959 raw investors
- 16,367 funding rounds
- Sources: Dropstab + CryptoRank

---

## Metrics Summary

| Version | Canonical Investors | Coinvest Relations | Data Quality | Smart Money Profiles |
|---------|---------------------|-------------------|--------------|----------------------|
| 1.0.0   | 18,959 (raw)        | 0                 | 57%          | 0                    |
| 2.0.0   | 8,456               | 138,175           | 84%          | 1,462                |

## Top Smart Money (v2.0.0)

| Rank | Investor | Smart Score | Tier |
|------|----------|-------------|------|
| 1 | Coinbase Ventures | 2,143 | ALPHA |
| 2 | Animoca Brands | 1,988 | ALPHA |
| 3 | YZi Labs (Binance) | 1,763 | ALPHA |
| 4 | Polychain Capital | 1,690 | ALPHA |
| 5 | Andreessen Horowitz | 1,520 | ALPHA |
