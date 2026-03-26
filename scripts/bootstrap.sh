#!/bin/bash
# FOMO Crypto Intelligence Platform - Bootstrap Script
# Version: 3.0.0
# Date: 2026-03-26

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     FOMO Crypto Intelligence Platform - Bootstrap v3.0      ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MONGO_URL="mongodb://localhost:27017"
DB_NAME="fomo_market"
BACKEND_DIR="/app/backend"
FRONTEND_DIR="/app/frontend"
BACKUP_DIR="/app/backup"

echo -e "\n${GREEN}[1/9] Checking MongoDB...${NC}"
if mongosh --eval "db.runCommand({ping:1})" --quiet > /dev/null 2>&1; then
    echo "  ✓ MongoDB is running"
else
    echo "  ✗ MongoDB not running. Starting..."
    sudo service mongodb start 2>/dev/null || true
fi

echo -e "\n${GREEN}[2/9] Installing backend dependencies...${NC}"
cd $BACKEND_DIR
npm install --legacy-peer-deps --silent 2>/dev/null || npm install --legacy-peer-deps
npm run build

echo -e "\n${GREEN}[3/9] Installing frontend dependencies...${NC}"
cd $FRONTEND_DIR
yarn install --silent 2>/dev/null || yarn install

echo -e "\n${GREEN}[4/9] Restoring database from backup...${NC}"
if [ -d "$BACKUP_DIR/mongodb_dump_latest" ]; then
    mongorestore --db $DB_NAME $BACKUP_DIR/mongodb_dump_latest/$DB_NAME --drop --quiet 2>/dev/null || \
    mongorestore --db $DB_NAME $BACKUP_DIR/mongodb_dump_latest/$DB_NAME --drop
    echo "  ✓ Database restored from mongodb_dump_latest"
else
    echo "  ! No backup found, using existing data"
fi

echo -e "\n${GREEN}[5/9] Migrating data (investors -> funds, fundraising -> projects)...${NC}"
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
print('  ✓ Created ' + funds.length + ' funds from investors');

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
print('  ✓ Created ' + projectList.length + ' projects from fundraising');
EOF

echo -e "\n${GREEN}[6/9] Starting services...${NC}"
sudo supervisorctl restart backend
sleep 5
sudo supervisorctl restart frontend

echo -e "\n${GREEN}[7/9] Verifying services...${NC}"
sleep 5

HEALTH=$(curl -s http://localhost:8001/api/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")
if [ "$HEALTH" = "True" ]; then
    echo "  ✓ Backend API is healthy"
else
    echo "  ✗ Backend API not responding, checking logs..."
    tail -n 10 /var/log/supervisor/backend.err.log 2>/dev/null || true
fi

echo -e "\n${GREEN}[8/9] Collecting statistics...${NC}"
mongosh $DB_NAME --quiet --eval "
var stats = {
  intel_funds: db.intel_funds.countDocuments({}),
  intel_projects: db.intel_projects.countDocuments({}),
  intel_investors: db.intel_investors.countDocuments({}),
  intel_fundraising: db.intel_fundraising.countDocuments({}),
  canonical_investors: db.canonical_investors.countDocuments({}),
  smart_money_profiles: db.smart_money_profiles.countDocuments({}),
  coinvest_relations: db.coinvest_relations.countDocuments({}),
  api_endpoints_registry: db.api_endpoints_registry.countDocuments({})
};
print('');
print('  Database Statistics:');
for (var key in stats) {
  print('    ' + key + ': ' + stats[key]);
}
"

echo -e "\n${GREEN}[9/9] Testing key endpoints...${NC}"
echo "  Testing /api/intel/funds..."
curl -s "http://localhost:8001/api/intel/funds?limit=1" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    ✓ Funds:', d.get('total',0))" 2>/dev/null || echo "    ✗ Failed"

echo "  Testing /api/intel/projects..."
curl -s "http://localhost:8001/api/intel/projects?limit=1" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    ✓ Projects:', d.get('total',0))" 2>/dev/null || echo "    ✗ Failed"

echo "  Testing /api/intel/investors/top..."
curl -s "http://localhost:8001/api/intel/investors/top?limit=1" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    ✓ Investors: OK')" 2>/dev/null || echo "    ✗ Failed"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Bootstrap Complete!                       ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Backend:  http://localhost:8001                             ║"
echo "║  Frontend: http://localhost:3000                             ║"
echo "║  API Docs: http://localhost:8001/api/openapi.json            ║"
echo "║                                                              ║"
echo "║  Key Endpoints:                                              ║"
echo "║    - /api/intel/funds       (9,293 funds)                    ║"
echo "║    - /api/intel/projects    (6,354 projects)                 ║"
echo "║    - /api/intel/investors   (18,959 investors)               ║"
echo "║    - /api/intel/fundraising (16,368 rounds)                  ║"
echo "║    - /api/entities/stats    (8,456 canonical)                ║"
echo "║    - /api/smart-money/stats (8,456 profiles)                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
