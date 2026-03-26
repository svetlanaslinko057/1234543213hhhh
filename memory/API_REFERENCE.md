# API Reference - FOMO Crypto Intelligence

## Base URL
```
http://localhost:8001/api
```

---

## Core Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "ok": true,
  "service": "FOMO Crypto Intelligence API v2.0.0",
  "timestamp": "2026-03-25T22:00:00.000Z",
  "modules": {
    "parsers": { "status": "active" },
    "intelligence": { "status": "active" }
  }
}
```

### Parser Status
```http
GET /parsers/status
```

**Response:**
```json
{
  "ts": 1774465000000,
  "parsers": {
    "dropstab": {
      "investors": 15449,
      "fundraising": 12011,
      "last_sync": "2026-03-25T20:00:00.000Z"
    },
    "cryptorank": {
      "investors": 3510,
      "funding": 4356
    }
  },
  "totals": {
    "investors": 18959,
    "funding": 16367
  }
}
```

---

## Entity Resolution

### Run Full Resolution
```http
POST /entities/resolve
```

**Response:**
```json
{
  "status": "success",
  "duration_ms": 79105,
  "raw_investors": 18959,
  "resolved_entities": 8456,
  "fuzzy_matches": 142,
  "coinvest_relations": 177033,
  "data_quality": {
    "before": 57,
    "after": 84
  }
}
```

### Get Entity Stats
```http
GET /entities/stats
```

**Response:**
```json
{
  "canonical_investors": 8456,
  "raw_investors": 18959,
  "resolution_ratio": "55% deduplicated",
  "coinvest_relations": 138175,
  "data_quality_score": "84%",
  "by_tier": [
    { "_id": "TIER_1", "count": 2093 },
    { "_id": "TIER_2", "count": 1717 },
    { "_id": "TIER_3", "count": 4646 }
  ]
}
```

### Get Leaderboard
```http
GET /entities/leaderboard?tier=TIER_1&limit=20
```

**Parameters:**
- `tier` (optional): Filter by tier (TIER_1, TIER_2, TIER_3)
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
[
  {
    "rank": 1,
    "canonical_id": "coinbase",
    "name": "Coinbase Ventures",
    "tier": "TIER_1",
    "score": 32045.81,
    "rounds": 1313,
    "total_invested": 30034805234,
    "avg_check": 22874947,
    "projects_count": 349
  }
]
```

### Get Coinvestors
```http
GET /entities/coinvest?investor=Coinbase%20Ventures&min_count=5&limit=20
```

**Parameters:**
- `investor` (required): Investor name
- `min_count` (optional): Minimum joint investments (default: 2)
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
{
  "investor": "Coinbase Ventures",
  "canonical_id": "coinbase",
  "coinvestors": [
    {
      "canonical_id": "andreessenhorowitza16z",
      "name": "Andreessen Horowitz (a16z)",
      "tier": "TIER_1",
      "count": 164,
      "volume": 9331595427,
      "projects_together": 50,
      "sample_projects": ["Kalshi", "LayerZero", "Farcaster"]
    }
  ]
}
```

### Data Quality
```http
GET /entities/quality
```

**Response:**
```json
{
  "data_quality_score": 84,
  "status": "GOOD",
  "target": 75
}
```

---

## Smart Money Intelligence

### Run Smart Money Analysis
```http
POST /smart-money/analyze
```

**Response:**
```json
{
  "status": "success",
  "duration_ms": 120000,
  "coinvest_cleanup": {
    "before": 177033,
    "after": 138175,
    "removed": 38858
  },
  "enhanced_scores": {
    "updated": 8456
  },
  "top_smart_money": [...]
}
```

### Get Smart Money Stats
```http
GET /smart-money/stats
```

**Response:**
```json
{
  "smart_money_profiles": 1462,
  "coinvest_relations_clean": 138175,
  "follow_relations": 0,
  "tier_distribution": [
    { "_id": "ALPHA", "count": 346 },
    { "_id": "SMART", "count": 1000 },
    { "_id": "FOLLOWER", "count": 18 },
    { "_id": "RETAIL", "count": 105 }
  ]
}
```

### Get Smart Money Leaderboard
```http
GET /smart-money/leaderboard?tier=ALPHA&limit=20
```

**Parameters:**
- `tier` (optional): Filter by tier (ALPHA, SMART, FOLLOWER, RETAIL)
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
[
  {
    "rank": 1,
    "name": "Coinbase Ventures",
    "smart_money_tier": "ALPHA",
    "smart_money_score": 2143,
    "early_score": 1413,
    "leader_score": 318,
    "recency_score": 412,
    "tier1_partners": 1155,
    "enhanced_score": 74181.61
  }
]
```

### Get Investor Profile
```http
GET /smart-money/profile?investor=Paradigm
```

**Parameters:**
- `investor` (required): Investor name

**Response:**
```json
{
  "canonical_id": "paradigm",
  "display_name": "Paradigm",
  "smart_money_tier": "ALPHA",
  "smart_money_score": 897,
  "early_investor_score": 394,
  "early_ratio": 0.41,
  "seed_rounds_count": 61,
  "pre_seed_count": 3,
  "series_a_count": 45,
  "leader_score": 378,
  "lead_rounds_count": 189,
  "lead_ratio": 0.7,
  "recency_score": 125,
  "investments_last_90_days": 7,
  "investments_last_year": 48,
  "tier1_coinvest_count": 392,
  "enhanced_score": 29779.94
}
```

### Get Follow Relations
```http
GET /smart-money/follow?investor=Paradigm
```

**Parameters:**
- `investor` (required): Investor name

**Response:**
```json
{
  "investor": "Paradigm",
  "leaders_they_follow": [
    {
      "name": "Sequoia Capital",
      "tier": "TIER_1",
      "follow_count": 12,
      "sample_projects": ["Project A", "Project B"]
    }
  ],
  "followers": [
    {
      "name": "Some VC",
      "tier": "TIER_2",
      "follow_count": 8,
      "sample_projects": ["Project C"]
    }
  ]
}
```

---

## Parsers

### Sync Dropstab Investors
```http
POST /parsers/sync/dropstab/investors
```

### Sync Dropstab Fundraising
```http
POST /parsers/sync/dropstab/fundraising
```

### Sync CryptoRank Funding
```http
POST /parsers/sync/cryptorank/funding
```

### Extract Investors from Rounds
```http
POST /parsers/extract/investors
```

---

## Error Responses

```json
{
  "error": "investor parameter required"
}
```

```json
{
  "error": "Investor not found",
  "searched": "Unknown VC"
}
```

---

## Rate Limits

Currently no rate limiting. Recommended for production:
- 100 requests/minute for GET
- 10 requests/minute for POST
