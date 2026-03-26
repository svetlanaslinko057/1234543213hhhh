#!/bin/bash
#
# FOMO Platform - Quick Health Check
#

API_URL="${API_URL:-http://localhost:8001}"

echo "FOMO Platform Health Check"
echo "════════════════════════════════════════════"
echo ""

# Health
echo -n "API Health:     "
curl -s "$API_URL/api/health" | grep -q '"ok":true' && echo "✓ OK" || echo "✗ FAIL"

# Intel
echo -n "Intel Module:   "
curl -s "$API_URL/api/intel/stats" | grep -q '"collections"' && echo "✓ OK" || echo "✗ FAIL"

# News
echo -n "News Module:    "
curl -s "$API_URL/api/news/sources" | grep -q '"ok":true' && echo "✓ OK" || echo "✗ FAIL"

# Graph
echo -n "Graph Module:   "
curl -s "$API_URL/api/graph/stats" | grep -q '"total_nodes"' && echo "✓ OK" || echo "✗ FAIL"

# Sentiment
echo -n "Sentiment:      "
curl -s "$API_URL/api/sentiment/status" | grep -q '"providers_configured"' && echo "✓ OK" || echo "✗ FAIL"

# Market
echo -n "Market Gateway: "
curl -s "$API_URL/api/market/quote?asset=BTC" | grep -q '"price"' && echo "✓ OK" || echo "✗ FAIL"

echo ""
echo "════════════════════════════════════════════"

# Quick data test
echo ""
echo "Sample Data:"
echo -n "  BTC Price: "
curl -s "$API_URL/api/market/quote?asset=BTC" | grep -o '"price":[0-9.]*' | cut -d: -f2

echo ""
echo -n "  Graph Nodes: "
curl -s "$API_URL/api/graph/stats" | grep -o '"total_nodes":[0-9]*' | cut -d: -f2

echo ""
