# BLOCK 1: Scheduler Engine — COMPLETE ✅

## Что реализовано

### 1.1 Scheduler Registry
```
16 jobs зарегистрировано:
- T1 (10 min): 3 jobs (dropstab, cryptorank)
- T2 (15 min): 3 jobs (news tier A, entity resolution, smart money)
- T3 (30 min): 3 jobs (news tier B, icodrops, derived edges)
- T4 (3 hours): 7 jobs (rootdata, news tier C, extraction, clustering, graph rebuild, snapshot, reliability)
```

### 1.2 Tier Execution
```
T1: */10 * * * *  — critical sources
T2: */15 * * * *  — important (with dependencies)
T3: */30 * * * *  — medium
T4: 0 */3 * * *   — low frequency heavy jobs
```

### 1.3 Dependency Scheduler
```
Пример: graph_full_rebuild
Chain: dropstab_investors → cryptorank_funding → entity_resolution → 
       smart_money_analysis → derived_edges_build → rootdata_full_sync → 
       graph_full_rebuild → graph_snapshot
```

### 1.4 Concurrency Pools
```
rss_html:    limit 5
browser:     limit 2
graph_build: limit 1
heavy_sync:  limit 2
default:     limit 3
```

### 1.5 Manual Override
```
POST /api/scheduler/run/job/:jobId?skipDeps=true&force=true
POST /api/scheduler/run/chain/:jobId
POST /api/scheduler/maintenance/on
POST /api/scheduler/maintenance/off
```

## API Endpoints

```bash
# Control
POST /api/scheduler/start
POST /api/scheduler/stop
GET  /api/scheduler/status

# Execution
POST /api/scheduler/run/tier/:tier
POST /api/scheduler/run/job/:jobId
POST /api/scheduler/run/chain/:jobId

# Jobs
GET  /api/scheduler/jobs
GET  /api/scheduler/jobs/:jobId
POST /api/scheduler/jobs/:jobId/enable
POST /api/scheduler/jobs/:jobId/disable

# Maintenance
POST /api/scheduler/maintenance/on
POST /api/scheduler/maintenance/off

# History
GET  /api/scheduler/runs
GET  /api/scheduler/stats
```

## Done Criteria ✅

- [x] Все jobs запускаются через scheduler registry
- [x] Dependencies работают (chain execution)
- [x] Tier execution работает
- [x] Нет одновременного запуска конфликтующих builders
- [x] Graph/build pipeline завязан на scheduler
- [x] Manual override (force, skip deps, maintenance)

## Collections

- scheduler_jobs
- scheduler_runs
- scheduler_locks
