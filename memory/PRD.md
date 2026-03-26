# FOMO Crypto Intelligence Platform - PRD

## Sprint 1.5 Complete - 2026-03-26

### 🎯 CRITICAL FIX: DENSE GRAPH

**Before:**
- coinvested_with: 21 edges
- shares_investor_with: 137 edges
- Total: ~177 edges

**After:**
- coinvested_with: **47,708 edges** (2,270x increase!)
- avg_weight: 12.2 (times together)
- max_weight: 383 (au21 ↔ x21)

### Top Coinvested Pairs
```
au21 ↔ x21: 383 times, $230M volume
magnus ↔ x21: 324 times, $344M volume
au21 ↔ magnus: 301 times, $172M volume
au21 ↔ ngc: 300 times, $1.3B volume
```

### a16z Network (REAL DATA!)
```
a16z ↔ Coinbase: 164 times together
a16z ↔ Polychain: 90 times
a16z ↔ Hashed: 75 times
a16z ↔ Multicoin: 66 times
a16z ↔ Paradigm: 61 times
```

---

## Changes Made

### V2 Derived Edges Builder
- Uses `coinvest_relations` (138k pre-computed!) instead of sparse graph_edges
- Uses `intel_fundraising` for shared_investor edges
- Bulk write operations (1000 batch size)
- Progress logging every 10k records
- Edge key normalization: `sorted(from, to) + type`

### Confidence Formula
```
confidence = 
  0.3 + 
  countFactor × 0.3 +     // min(1.0, count/50)
  recencyFactor × 0.2 +   // based on last_together
  qualityFactor × 0.2     // quality_score/100
```

---

## API Endpoints

### Graph Builders
```bash
POST /api/graph-builders/derived/build-all
GET  /api/graph-builders/derived/stats
GET  /api/graph-builders/derived/node/:nodeId
GET  /api/graph-builders/derived/related/:nodeId?type=coinvested_with
```

### Example Query
```javascript
// Find all funds that coinvested with a16z
db.graph_derived_edges.find({
  $or: [
    { from_node_id: /a16z/i },
    { to_node_id: /a16z/i }
  ],
  relation_type: "coinvested_with"
}).sort({weight: -1})
```

---

## Next Steps

### P1 - Graph Snapshots
- [ ] Create graph_snapshots collection
- [ ] Store top nodes/edges for fast UI
- [ ] Temporal snapshots for history

### P1 - Scheduler
- [ ] Tier-based scheduling (T1=10m, T2=15m, T3=30m)
- [ ] Source priority orchestration

### P2 - Complete Derived Edges
- [ ] shares_investor_with (from fundraising)
- [ ] worked_together (from people data)
- [ ] shares_founder_with

---

## Collections

| Collection | Count | Purpose |
|------------|-------|---------|
| coinvest_relations | 138,175 | Pre-computed investor pairs |
| graph_derived_edges | 47,708 | Intelligence edges |
| intel_fundraising | 16,808 | Funding rounds |
| intel_investors | 18,959 | Investors |
