#!/bin/bash
# FOMO Crypto Intelligence Platform - Quickstart Script v3.0
# For rapid development restart

set -e

echo "🚀 FOMO Quickstart v3.0"
echo "========================"

# Build backend
cd /app/backend && npm run build --silent 2>/dev/null || npm run build
sudo supervisorctl restart backend
sleep 3

echo ""
echo "✓ Backend restarted"
echo ""

# Quick health check
HEALTH=$(curl -s http://localhost:8001/api/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('ok') else 'FAIL')" 2>/dev/null || echo "FAIL")
echo "Backend: $HEALTH"

# Database stats
mongosh fomo_market --quiet --eval "
print('Data Statistics:');
print('  Funds:       ' + db.intel_funds.countDocuments({}));
print('  Projects:    ' + db.intel_projects.countDocuments({}));
print('  Investors:   ' + db.intel_investors.countDocuments({}));
print('  Fundraising: ' + db.intel_fundraising.countDocuments({}));
print('  Canonical:   ' + db.canonical_investors.countDocuments({}));
print('  Smart Money: ' + db.smart_money_profiles.countDocuments({}));
"

echo ""
echo "Ready at http://localhost:8001/api"
echo ""
echo "Key Endpoints:"
echo "  - GET /api/intel/funds"
echo "  - GET /api/intel/projects" 
echo "  - GET /api/intel/investors/top"
echo "  - GET /api/intel/funding/recent"
echo "  - GET /api/entities/stats"
echo "  - GET /api/smart-money/stats"
