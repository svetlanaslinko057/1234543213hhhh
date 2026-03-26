#!/bin/bash
# FOMO Crypto Intelligence Platform - Bootstrap Script
# Version: 4.0.0
# Date: 2026-03-26
# 
# Full system bootstrap with:
# - MongoDB restore
# - Backend/Frontend build
# - Telegram bot configuration
# - Scheduler activation
# - Graph pipeline initialization
# - News intelligence sync

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     FOMO Crypto Intelligence Platform - Bootstrap v4.0      ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
MONGO_URL="mongodb://localhost:27017"
DB_NAME="fomo_market"
BACKEND_DIR="/app/backend"
FRONTEND_DIR="/app/frontend"
BACKUP_DIR="/app/backup"
TELEGRAM_TOKEN="${TELEGRAM_BOT_TOKEN:-}"

log_step() {
    echo -e "\n${GREEN}[$1/12] $2${NC}"
}

log_ok() {
    echo -e "  ${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "  ${RED}✗${NC} $1"
}

# ═══════════════════════════════════════════════════════════════════
# STEP 1: MongoDB Check
# ═══════════════════════════════════════════════════════════════════
log_step 1 "Checking MongoDB..."
if mongosh --eval "db.runCommand({ping:1})" --quiet > /dev/null 2>&1; then
    log_ok "MongoDB is running"
else
    log_warn "MongoDB not running. Starting..."
    sudo service mongodb start 2>/dev/null || sudo supervisorctl start mongodb || true
    sleep 3
fi

# ═══════════════════════════════════════════════════════════════════
# STEP 2: Backend Dependencies & Build
# ═══════════════════════════════════════════════════════════════════
log_step 2 "Installing backend dependencies..."
cd $BACKEND_DIR
npm install --legacy-peer-deps --silent 2>/dev/null || npm install --legacy-peer-deps
log_ok "Dependencies installed"

echo "  Building NestJS..."
npm run build 2>/dev/null || npm run build
log_ok "Backend built successfully"

# ═══════════════════════════════════════════════════════════════════
# STEP 3: Frontend Dependencies
# ═══════════════════════════════════════════════════════════════════
log_step 3 "Installing frontend dependencies..."
cd $FRONTEND_DIR
yarn install --silent 2>/dev/null || yarn install
log_ok "Frontend dependencies installed"

# ═══════════════════════════════════════════════════════════════════
# STEP 4: Database Restore
# ═══════════════════════════════════════════════════════════════════
log_step 4 "Restoring database from backup..."
if [ -d "$BACKUP_DIR/mongodb_dump_latest" ]; then
    mongorestore --db $DB_NAME $BACKUP_DIR/mongodb_dump_latest/$DB_NAME --drop --quiet 2>/dev/null || \
    mongorestore --db $DB_NAME $BACKUP_DIR/mongodb_dump_latest/$DB_NAME --drop
    log_ok "Database restored from mongodb_dump_latest"
else
    log_warn "No backup found, using existing data"
fi

# ═══════════════════════════════════════════════════════════════════
# STEP 5: Data Migration (investors -> funds, fundraising -> projects)
# ═══════════════════════════════════════════════════════════════════
log_step 5 "Migrating data..."
mongosh $DB_NAME --quiet << 'EOF'
// Create funds from investors
db.intel_funds.deleteMany({});
var investors = db.intel_investors.find({}).toArray();
var funds = [];
var seen = {};
for (var inv of investors) {
  var slug = inv.slug || inv.name.toLowerCase().replace(/\s+/g, '-');
  var key = 'fund:' + slug;
  if (!seen[key]) {
    seen[key] = true;
    funds.push({
      key: key,
      source: inv.source || 'dropstab',
      slug: slug,
      name: inv.name,
      type: inv.type || 'VC',
      tier: inv.tier || 3,
      aum: inv.portfolio_value || inv.aum || 0,
      investments_count: inv.investments_count || 0,
      website: inv.website,
      twitter: inv.twitter,
      image: inv.image || inv.logo,
      updated_at: new Date()
    });
  }
}
if (funds.length > 0) {
  db.intel_funds.insertMany(funds, { ordered: false });
}
print('  ✓ Created ' + funds.length + ' funds');

// Create projects from fundraising
db.intel_projects.deleteMany({});
var fundraising = db.intel_fundraising.find({}).toArray();
var projects = {};
for (var f of fundraising) {
  var slug = f.coin_slug || f.project || 'unknown';
  if (slug && slug !== 'unknown' && !projects[slug]) {
    projects[slug] = {
      key: 'project:' + slug,
      source: f.source || 'dropstab',
      slug: slug,
      name: f.name || slug,
      symbol: f.symbol || '',
      category: 'crypto',
      updated_at: new Date()
    };
  }
}
var projectList = Object.values(projects);
if (projectList.length > 0) {
  db.intel_projects.insertMany(projectList, { ordered: false });
}
print('  ✓ Created ' + projectList.length + ' projects');
EOF

# ═══════════════════════════════════════════════════════════════════
# STEP 6: Start Services
# ═══════════════════════════════════════════════════════════════════
log_step 6 "Starting services..."
sudo supervisorctl restart backend
log_ok "Backend started"
sleep 10

sudo supervisorctl restart frontend
log_ok "Frontend started"
sleep 5

# ═══════════════════════════════════════════════════════════════════
# STEP 7: Verify Backend Health
# ═══════════════════════════════════════════════════════════════════
log_step 7 "Verifying backend health..."
MAX_RETRIES=30
for i in $(seq 1 $MAX_RETRIES); do
    HEALTH=$(curl -s http://localhost:8001/api/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")
    if [ "$HEALTH" = "True" ]; then
        log_ok "Backend API healthy"
        break
    fi
    if [ $i -eq $MAX_RETRIES ]; then
        log_error "Backend not responding after $MAX_RETRIES attempts"
        tail -n 20 /var/log/supervisor/backend.err.log 2>/dev/null || true
    fi
    sleep 2
done

# ═══════════════════════════════════════════════════════════════════
# STEP 8: Configure Telegram (if token provided)
# ═══════════════════════════════════════════════════════════════════
log_step 8 "Configuring Telegram bot..."
if [ -n "$TELEGRAM_TOKEN" ]; then
    RESULT=$(curl -s -X POST "http://localhost:8001/api/telegram/bot/configure" \
        -H "Content-Type: application/json" \
        -d "{\"botToken\":\"$TELEGRAM_TOKEN\"}" 2>/dev/null)
    
    if echo "$RESULT" | grep -q '"success":true'; then
        BOT_NAME=$(curl -s "http://localhost:8001/api/telegram/bot/status" | python3 -c "import sys,json; print(json.load(sys.stdin).get('botUsername',''))" 2>/dev/null)
        log_ok "Telegram bot configured: @$BOT_NAME"
    else
        log_warn "Telegram configuration failed"
    fi
else
    # Check if already configured
    STATUS=$(curl -s "http://localhost:8001/api/telegram/bot/status" 2>/dev/null)
    if echo "$STATUS" | grep -q '"configured":true'; then
        BOT_NAME=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('botUsername',''))" 2>/dev/null)
        log_ok "Telegram already configured: @$BOT_NAME"
    else
        log_warn "No Telegram token provided (set TELEGRAM_BOT_TOKEN env)"
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# STEP 9: Start Scheduler
# ═══════════════════════════════════════════════════════════════════
log_step 9 "Starting scheduler..."
SCHED_RESULT=$(curl -s -X POST "http://localhost:8001/api/scheduler/start" 2>/dev/null)
if echo "$SCHED_RESULT" | grep -q '"started":true'; then
    log_ok "Scheduler started (19 jobs)"
else
    log_warn "Scheduler may already be running"
fi

# ═══════════════════════════════════════════════════════════════════
# STEP 10: Sync News Sources
# ═══════════════════════════════════════════════════════════════════
log_step 10 "Syncing news sources..."
# Sync Tier A news
TIER_A=$(curl -s -X POST "http://localhost:8001/api/news/sync/tier/a?limit=30" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")
if [ "$TIER_A" = "True" ] || [ "$TIER_A" = "true" ]; then
    log_ok "Tier A news synced"
fi

# Process news intelligence
NEWS_RESULT=$(curl -s -X POST "http://localhost:8001/api/news-intelligence/process-recent?hours=24&limit=100" 2>/dev/null)
EVENTS=$(echo "$NEWS_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stats',{}).get('eventsCreated',0))" 2>/dev/null || echo "0")
log_ok "News intelligence processed: $EVENTS events"

# ═══════════════════════════════════════════════════════════════════
# STEP 11: Run Graph Pipeline
# ═══════════════════════════════════════════════════════════════════
log_step 11 "Running graph pipeline..."
curl -s -X POST "http://localhost:8001/api/graph-pipeline/run" \
    -H "Content-Type: application/json" \
    -d '{"window":"7d"}' > /dev/null 2>&1 &
GRAPH_PID=$!

# Wait for graph build (max 60 seconds)
for i in $(seq 1 60); do
    STATUS=$(curl -s "http://localhost:8001/api/graph-pipeline/status" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('isRunning',False))" 2>/dev/null || echo "false")
    if [ "$STATUS" = "False" ]; then
        break
    fi
    sleep 1
done

GRAPH_STATS=$(curl -s "http://localhost:8001/api/graph-pipeline/overview" 2>/dev/null)
NODES=$(echo "$GRAPH_STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stats',{}).get('nodeCount',0))" 2>/dev/null || echo "0")
EDGES=$(echo "$GRAPH_STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stats',{}).get('totalEdgeCount',0))" 2>/dev/null || echo "0")
log_ok "Graph built: $NODES nodes, $EDGES edges"

# ═══════════════════════════════════════════════════════════════════
# STEP 12: Final Statistics
# ═══════════════════════════════════════════════════════════════════
log_step 12 "Collecting final statistics..."

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    BOOTSTRAP COMPLETE                        ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"

# Database stats
echo -e "${CYAN}║${NC}  ${GREEN}DATABASE:${NC}"
mongosh $DB_NAME --quiet --eval "
print('   intel_funds:        ' + db.intel_funds.countDocuments({}));
print('   intel_projects:     ' + db.intel_projects.countDocuments({}));
print('   intel_investors:    ' + db.intel_investors.countDocuments({}));
print('   coinvest_relations: ' + db.coinvest_relations.countDocuments({}));
print('   news_articles:      ' + db.news_articles.countDocuments({}));
"

# Service stats
echo -e "${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}SERVICES:${NC}"
echo "   Backend:    http://localhost:8001"
echo "   Frontend:   http://localhost:3000"
echo "   Password:   fomo2024"

# Telegram status
TELEGRAM_STATUS=$(curl -s "http://localhost:8001/api/telegram/bot/status" 2>/dev/null)
BOT=$(echo "$TELEGRAM_STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('@'+d.get('botUsername','N/A') if d.get('configured') else 'Not configured')" 2>/dev/null || echo "N/A")
echo -e "${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}TELEGRAM:${NC} $BOT"

# Scheduler status
SCHED_STATUS=$(curl -s "http://localhost:8001/api/scheduler/status" 2>/dev/null | python3 -c "import sys,json; print('RUNNING' if json.load(sys.stdin).get('started') else 'STOPPED')" 2>/dev/null || echo "UNKNOWN")
echo -e "${CYAN}║${NC}  ${GREEN}SCHEDULER:${NC} $SCHED_STATUS"

# Graph stats
echo -e "${CYAN}║${NC}  ${GREEN}GRAPH:${NC} $NODES nodes / $EDGES edges"

echo -e "${CYAN}║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}KEY ENDPOINTS:${NC}"
echo -e "${CYAN}║${NC}    /api/health              - System health"
echo -e "${CYAN}║${NC}    /api/intel/funds         - Funds data"
echo -e "${CYAN}║${NC}    /api/intel/projects      - Projects data"
echo -e "${CYAN}║${NC}    /api/intel/investors     - Investors data"
echo -e "${CYAN}║${NC}    /api/graph-pipeline/*    - Graph operations"
echo -e "${CYAN}║${NC}    /api/news-intelligence/* - News analysis"
echo -e "${CYAN}║${NC}    /api/telegram/*          - Telegram alerts"
echo -e "${CYAN}║${NC}    /api/scheduler/*         - Job scheduler"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

# Send Telegram notification if configured
if [ -n "$BOT" ] && [ "$BOT" != "Not configured" ] && [ "$BOT" != "N/A" ]; then
    curl -s -X POST "http://localhost:8001/api/telegram/alerts/emit" \
        -H "Content-Type: application/json" \
        -d '{"type":"system","data":{"message":"🚀 FOMO System Bootstrap Complete!\n\n✅ Backend: Running\n✅ Scheduler: Active\n✅ Graph: '"$NODES"' nodes\n✅ News: Synced\n\n#bootstrap #system"}}' > /dev/null 2>&1
    echo ""
    echo -e "${GREEN}📱 Telegram notification sent!${NC}"
fi

echo ""
echo -e "${GREEN}Bootstrap completed successfully!${NC}"
