#!/bin/bash
#
# FOMO Crypto Intelligence - Data Population Script v2.0
#
# Runs all parsers and pipelines to populate fresh data
# Includes RSS fallback, API parsers, and Smart Money analysis
#
# Usage: ./scripts/populate-data.sh [--full | --quick | --news-only]
#
# Options:
#   --full      Run everything including full API sync (slow)
#   --quick     Quick refresh - RSS + Entity Resolution only
#   --news-only Only sync news sources
#

set -e

API_URL="${API_URL:-http://localhost:8001}"
MODE="${1:---quick}"

echo "=============================================="
echo "  FOMO Data Population Script v2.0"
echo "=============================================="
echo ""
echo "API URL: $API_URL"
echo "Mode: $MODE"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to call API with timeout
call_api() {
    local method=$1
    local endpoint=$2
    local name=$3
    local timeout=${4:-120}
    
    echo -e "${YELLOW}[$name]${NC} $method $endpoint"
    
    start_time=$(date +%s)
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$API_URL$endpoint" --max-time $timeout 2>&1)
    else
        response=$(curl -s "$API_URL$endpoint" --max-time $timeout 2>&1)
    fi
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    # Extract key info
    if echo "$response" | grep -q '"success":true'; then
        echo -e "  ${GREEN}✓ Success${NC} (${duration}s)"
    elif echo "$response" | grep -q '"ok":true'; then
        echo -e "  ${GREEN}✓ OK${NC} (${duration}s)"
    elif echo "$response" | grep -q '"status":"success"'; then
        echo -e "  ${GREEN}✓ Success${NC} (${duration}s)"
    elif echo "$response" | grep -q '"error"'; then
        error=$(echo "$response" | grep -o '"error":"[^"]*"' | head -1)
        echo -e "  ${RED}✗ Error: $error${NC}"
    else
        # Try to get count
        count=$(echo "$response" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
        if [ -n "$count" ]; then
            echo -e "  ${GREEN}✓ Got $count items${NC} (${duration}s)"
        else
            echo "  Response: $(echo "$response" | head -c 150)..."
        fi
    fi
    echo ""
}

# Function to show stats
show_stats() {
    echo ""
    echo -e "${BLUE}=== Current Statistics ===${NC}"
    
    # Get stats
    stats=$(curl -s "$API_URL/api/entities/stats" 2>/dev/null)
    sm_stats=$(curl -s "$API_URL/api/smart-money/stats" 2>/dev/null)
    news_stats=$(curl -s "$API_URL/api/news/stats" 2>/dev/null)
    
    # Parse and display
    investors=$(echo "$stats" | grep -o '"canonical_investors":[0-9]*' | cut -d: -f2)
    raw=$(echo "$stats" | grep -o '"raw_investors":[0-9]*' | cut -d: -f2)
    funding=$(echo "$stats" | grep -o '"funding_rounds":[0-9]*' | cut -d: -f2)
    news=$(echo "$news_stats" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
    profiles=$(echo "$sm_stats" | grep -o '"smart_money_profiles":[0-9]*' | cut -d: -f2)
    
    echo "  Canonical Investors: ${investors:-0}"
    echo "  Raw Investors:       ${raw:-0}"
    echo "  Funding Rounds:      ${funding:-0}"
    echo "  Smart Money:         ${profiles:-0}"
    echo "  News Articles:       ${news:-0}"
    echo ""
}

# 1. Health check
echo -e "${BLUE}=== Step 1: Health Check ===${NC}"
call_api GET "/api/health" "System Health" 10

# Check parser health
echo -e "${BLUE}=== Step 2: Parser Health ===${NC}"
call_api GET "/api/parsers/health" "Parser Health" 10

case "$MODE" in
    --full)
        # Full data population
        
        echo -e "${BLUE}=== Step 3: Sync API Sources ===${NC}"
        call_api POST "/api/parsers/sync/dropstab/investors?pages=200" "Dropstab Investors" 300
        call_api POST "/api/parsers/sync/dropstab/fundraising?pages=400" "Dropstab Fundraising" 300
        call_api POST "/api/parsers/sync/cryptorank/funding?pages=500" "CryptoRank Funding" 300
        
        echo -e "${BLUE}=== Step 4: Sync News (with fallback) ===${NC}"
        call_api POST "/api/news/sync" "News Sources" 180
        
        echo -e "${BLUE}=== Step 5: Extract Investors ===${NC}"
        call_api POST "/api/parsers/extract/investors" "Investor Extraction" 120
        
        echo -e "${BLUE}=== Step 6: Entity Resolution ===${NC}"
        call_api POST "/api/entities/resolve" "Entity Resolution" 180
        
        echo -e "${BLUE}=== Step 7: Smart Money Analysis ===${NC}"
        call_api POST "/api/smart-money/analyze" "Smart Money" 300
        ;;
        
    --news-only)
        # News only
        echo -e "${BLUE}=== Step 3: Sync News (with fallback) ===${NC}"
        call_api POST "/api/news/sync" "News Sources" 180
        ;;
        
    --quick|*)
        # Quick refresh
        echo -e "${BLUE}=== Step 3: Quick API Sync ===${NC}"
        call_api POST "/api/parsers/sync/dropstab/investors?pages=5" "Dropstab (quick)" 60
        call_api POST "/api/parsers/sync/cryptorank/funding?pages=5" "CryptoRank (quick)" 60
        
        echo -e "${BLUE}=== Step 4: Sync News (with fallback) ===${NC}"
        call_api POST "/api/news/sync" "News Sources" 180
        
        echo -e "${BLUE}=== Step 5: Entity Resolution ===${NC}"
        call_api POST "/api/entities/resolve" "Entity Resolution" 180
        ;;
esac

# Final stats
show_stats

echo "=============================================="
echo -e "${GREEN}  Data Population Complete!${NC}"
echo "=============================================="
echo ""
echo "To run full sync: ./scripts/populate-data.sh --full"
echo "To sync news only: ./scripts/populate-data.sh --news-only"
echo ""
