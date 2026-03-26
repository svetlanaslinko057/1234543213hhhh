#!/bin/bash
# FOMO Crypto Intelligence Platform - Quickstart Script v4.0
# For rapid development restart (faster than full bootstrap)

set -e

echo "🚀 FOMO Quickstart v4.0"
echo "========================"
echo ""

# Build backend
echo "Building backend..."
cd /app/backend && npm run build --silent 2>/dev/null || npm run build

# Restart services
echo "Restarting services..."
sudo supervisorctl restart backend
sleep 5

# Quick health check
HEALTH=$(curl -s http://localhost:8001/api/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('ok') else 'FAIL')" 2>/dev/null || echo "WAITING...")

# Wait for NestJS to be ready
if [ "$HEALTH" != "OK" ]; then
    echo "Waiting for NestJS..."
    for i in {1..30}; do
        HEALTH=$(curl -s http://localhost:8001/api/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('ok') else 'FAIL')" 2>/dev/null || echo "WAITING...")
        if [ "$HEALTH" = "OK" ]; then
            break
        fi
        sleep 1
    done
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║         QUICKSTART COMPLETE            ║"
echo "╠════════════════════════════════════════╣"

# Backend status
echo "║ Backend: $HEALTH"

# Scheduler - start if not running
SCHED=$(curl -s "http://localhost:8001/api/scheduler/status" 2>/dev/null | python3 -c "import sys,json; print('RUNNING' if json.load(sys.stdin).get('started') else 'STOPPED')" 2>/dev/null || echo "UNKNOWN")
if [ "$SCHED" != "RUNNING" ]; then
    curl -s -X POST "http://localhost:8001/api/scheduler/start" > /dev/null 2>&1
    SCHED="STARTED"
fi
echo "║ Scheduler: $SCHED"

# Telegram status
TELEGRAM=$(curl -s "http://localhost:8001/api/telegram/bot/status" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('@'+d.get('botUsername','N/A') if d.get('configured') else 'Not configured')" 2>/dev/null || echo "N/A")
echo "║ Telegram: $TELEGRAM"

# Graph stats
GRAPH=$(curl -s "http://localhost:8001/api/graph-pipeline/overview" 2>/dev/null | python3 -c "import sys,json; s=json.load(sys.stdin).get('stats',{}); print(f'{s.get(\"nodeCount\",0)} nodes / {s.get(\"totalEdgeCount\",0)} edges')" 2>/dev/null || echo "N/A")
echo "║ Graph: $GRAPH"

echo "╠════════════════════════════════════════╣"

# Database stats
mongosh fomo_market --quiet --eval "
print('║ DATA:');
print('║   Funds:     ' + db.intel_funds.countDocuments({}));
print('║   Projects:  ' + db.intel_projects.countDocuments({}));
print('║   Investors: ' + db.intel_investors.countDocuments({}));
print('║   News:      ' + db.news_articles.countDocuments({}));
"

echo "╠════════════════════════════════════════╣"
echo "║ URLs:"
echo "║   Backend:  http://localhost:8001"
echo "║   Frontend: http://localhost:3000"
echo "║   Password: fomo2024"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Key Endpoints:"
echo "  GET  /api/health"
echo "  GET  /api/intel/funds"
echo "  GET  /api/intel/projects" 
echo "  GET  /api/intel/investors/top"
echo "  GET  /api/graph-pipeline/overview"
echo "  GET  /api/news-intelligence/stats"
echo "  POST /api/scheduler/start"
echo "  GET  /api/telegram/bot/status"
