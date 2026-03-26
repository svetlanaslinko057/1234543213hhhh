# FOMO Crypto Intelligence - Architecture Document

## Overview

This document describes the technical architecture of the FOMO Crypto Intelligence Platform.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FOMO Intelligence                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Frontend   │    │   Backend    │    │   MongoDB    │          │
│  │   (React)    │◄──►│   (NestJS)   │◄──►│  (fomo_mkt)  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│        :3000              :8001              :27017                  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    INTELLIGENCE LAYERS                         │  │
│  │                                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │   Parser    │  │   Entity    │  │    Smart Money      │   │  │
│  │  │  Orchestr.  │─►│ Resolution  │─►│   Intelligence      │   │  │
│  │  │             │  │             │  │                     │   │  │
│  │  │ - Dropstab  │  │ - Fuzzy     │  │ - Early Score       │   │  │
│  │  │ - CryptoRk  │  │ - Merge     │  │ - Leader Score      │   │  │
│  │  │ - Retry     │  │ - Dedupe    │  │ - Follow Pattern    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │
│  │                                                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
External Sources                 Processing                    Output
─────────────────               ───────────                   ──────

┌─────────────┐
│  Dropstab   │──┐
│   API       │  │    ┌──────────────┐    ┌──────────────┐
└─────────────┘  │    │              │    │              │
                 ├───►│  Raw Data    │───►│  Canonical   │
┌─────────────┐  │    │  Collection  │    │  Investors   │
│ CryptoRank  │──┘    │              │    │  (8,456)     │
│   API       │       └──────────────┘    └──────────────┘
└─────────────┘              │                   │
                             │                   ▼
                             │            ┌──────────────┐
                             │            │  Coinvest    │
                             └───────────►│  Relations   │
                                          │  (138,175)   │
                                          └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │ Smart Money  │
                                          │  Profiles    │
                                          │  (1,462)     │
                                          └──────────────┘
```

## Module Structure

### 1. Parser Layer (`/parsers`)

```
parsers/
├── dropstab/
│   ├── dropstab.api.ts        # Direct API client
│   └── dropstab.runner.ts     # Browser-based scraper
├── cryptorank/
│   ├── cryptorank.api.ts      # API client
│   └── cryptorank.direct-api.ts
├── application/
│   ├── parser.orchestrator.ts # Main orchestration
│   └── master.orchestrator.ts
└── common/
    ├── retry-fallback.ts      # Retry/fallback utilities
    └── browser.service.ts     # Puppeteer management
```

### 2. Resolution Layer (`/resolution`)

```
resolution/
├── entity-resolution.engine.ts    # Core algorithms
│   ├── normalizeRawName()         # Name normalization
│   ├── findBestMatch()            # Fuzzy matching (0.92)
│   ├── resolveInvestor()          # Full resolution
│   ├── mergeEntities()            # Entity merging
│   └── buildCoinvestMap()         # Coinvest graph
│
├── entity-resolution.service.ts   # NestJS service
│   ├── runFullResolution()
│   ├── getCoinvestors()
│   └── getLeaderboard()
│
├── smart-money.service.ts         # Smart Money Intelligence
│   ├── cleanupCoinvest()          # Filter weak relations
│   ├── calculateEnhancedScores()  # Enhanced scoring
│   ├── detectFollowPatterns()     # Follow detection
│   └── getSmartMoneyProfile()
│
└── smart-money.controller.ts      # API endpoints
```

## Database Schema

### Collections

#### `intel_investors` (Raw)
```javascript
{
  key: String,           // Unique key
  source: String,        // "dropstab" | "cryptorank"
  name: String,
  slug: String,
  tier: Number,          // 1-5
  investments_count: Number,
  portfolio_value: Number,
  projects: Array,
  updated_at: Date
}
```

#### `canonical_investors` (Resolved)
```javascript
{
  canonical_id: String,  // Normalized ID
  display_name: String,  // Display name
  normalized: String,    // For matching
  aliases: Array,        // All known names
  sources: Array,        // Data sources
  confidence: Number,    // 0-1
  metrics: {
    rounds_count: Number,
    total_invested: Number,
    avg_check: Number,
    unique_projects: Number
  },
  tier: String,          // "TIER_1" | "TIER_2" | "TIER_3"
  score: Number,
  enhanced_score: Number,
  smart_money_tier: String,
  projects: Array
}
```

#### `coinvest_relations`
```javascript
{
  investor_a: String,    // canonical_id
  investor_b: String,    // canonical_id
  count: Number,         // Times together
  volume: Number,        // Total $ volume
  projects: Array,       // Project names
  quality_score: Number  // 0-100
}
```

#### `smart_money_profiles`
```javascript
{
  canonical_id: String,
  display_name: String,
  smart_money_score: Number,
  smart_money_tier: String,  // "ALPHA" | "SMART" | "FOLLOWER" | "RETAIL"
  early_investor_score: Number,
  seed_rounds_count: Number,
  pre_seed_count: Number,
  leader_score: Number,
  lead_rounds_count: Number,
  lead_ratio: Number,
  recency_score: Number,
  investments_last_90_days: Number,
  tier1_coinvest_count: Number
}
```

## Algorithms

### 1. Name Normalization

```typescript
function normalizeRawName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*(fund|capital|ventures|vc|labs|dao|llc|inc|ltd)\s*/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
```

### 2. Fuzzy Matching

```typescript
const FUZZY_THRESHOLD = 0.92; // High precision

function findBestMatch(name: string, candidates: string[]) {
  const result = stringSimilarity.findBestMatch(name, candidates);
  
  if (result.bestMatch.rating >= FUZZY_THRESHOLD) {
    return { target: result.bestMatch.target, needsReview: false };
  }
  
  if (result.bestMatch.rating >= 0.85) {
    return { target: result.bestMatch.target, needsReview: true };
  }
  
  return null;
}
```

### 3. Investor Scoring

```typescript
// Base score
score = rounds * 1 + (total_invested / 1_000_000) + unique_projects * 2

// Enhanced score
enhanced_score = 
  base_score +
  (recency_score * 3) +      // Recent activity
  (leader_score * 5) +        // Lead rounds
  (tier1_coinvest_count * 2) + // TIER_1 partners
  (early_score * 4)           // Early investing
```

### 4. Smart Money Tier

```typescript
function getSmartMoneyTier(score: number, tier1Partners: number) {
  if (score >= 100 && tier1Partners >= 10) return 'ALPHA';
  if (score >= 50 || tier1Partners >= 5) return 'SMART';
  if (score >= 20 || tier1Partners >= 2) return 'FOLLOWER';
  return 'RETAIL';
}
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health |
| GET | `/api/parsers/status` | Parser status |
| POST | `/api/entities/resolve` | Run entity resolution |
| GET | `/api/entities/stats` | Entity statistics |
| GET | `/api/entities/leaderboard` | Top investors |
| GET | `/api/entities/coinvest` | Co-investor data |
| POST | `/api/smart-money/analyze` | Smart money pipeline |
| GET | `/api/smart-money/leaderboard` | Smart money ranking |
| GET | `/api/smart-money/profile` | Investor profile |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Backend port |
| `MONGO_URL` | mongodb://localhost:27017 | MongoDB connection |
| `DB_NAME` | fomo_market | Database name |
| `CORS_ORIGINS` | * | CORS configuration |

### Thresholds

| Threshold | Value | Purpose |
|-----------|-------|---------|
| FUZZY_THRESHOLD | 0.92 | Minimum similarity for auto-merge |
| FUZZY_REVIEW | 0.85 | Threshold for review queue |
| COINVEST_MIN_COUNT | 3 | Minimum co-investments |
| COINVEST_MIN_VOLUME | $1M | Minimum volume |

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Entity Resolution | ~80s | Full pipeline, 18k investors |
| Smart Money Analysis | ~120s | Enhanced scoring |
| Coinvest Cleanup | ~30s | 177k → 138k relations |

## Security Considerations

1. No authentication on API (add before production)
2. Rate limiting recommended
3. Input validation on all endpoints
4. MongoDB injection prevention via Mongoose

## Monitoring

- Health endpoint: `/api/health`
- Data quality: `/api/entities/quality`
- Parser status: `/api/parsers/status`

## Backup Strategy

1. Daily MongoDB dump: `mongodump --db fomo_market`
2. Backup retention: 7 days
3. Restore: `mongorestore --db fomo_market ./backup/`
