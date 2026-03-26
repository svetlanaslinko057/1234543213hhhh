/**
 * OpenAPI Specification Controller
 * 
 * Provides /api/openapi.json endpoint with complete API documentation
 */

import { Controller, Get } from '@nestjs/common';

@Controller('openapi.json')
export class OpenApiController {
  @Get()
  getOpenApiSpec() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'FOMO Crypto Intelligence API',
        version: '2.1.0',
        description: `Production-grade crypto intelligence platform with:
- Parser Operations Layer (status, logs, quarantine, quality)
- Anti-Block Layer (circuit breaker, stealth, fallback)
- Entity Resolution Engine (fuzzy matching, canonicalization)
- Smart Money Intelligence (scoring, tiers, coinvest graph)
- News Aggregation (18+ RSS sources with fallback)`,
        contact: {
          name: 'FOMO Intelligence',
        },
      },
      servers: [
        {
          url: '/api',
          description: 'API Server',
        },
      ],
      tags: [
        { name: 'Health', description: 'System health and status' },
        { name: 'Parser Operations', description: 'Parser management and monitoring' },
        { name: 'Intelligence', description: 'Self-Learning Ingestion Engine - Schema drift, Strategy learning, Anomaly detection' },
        { name: 'Parser Sync', description: 'Data synchronization from sources' },
        { name: 'Entities', description: 'Entity resolution and canonical investors' },
        { name: 'Smart Money', description: 'Smart money intelligence and scoring' },
        { name: 'News', description: 'News aggregation and RSS fallback' },
        { name: 'Graph', description: 'Knowledge graph operations' },
        { name: 'Market', description: 'Market data and prices' },
      ],
      paths: {
        // ═══════════════════════════════════════════════════════════════
        // HEALTH
        // ═══════════════════════════════════════════════════════════════
        '/health': {
          get: {
            tags: ['Health'],
            summary: 'System health check',
            description: 'Returns system health status and module information',
            responses: {
              200: {
                description: 'System health status',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean', example: true },
                        service: { type: 'string', example: 'FOMO Crypto Intelligence API' },
                        version: { type: 'string', example: '2.0.0' },
                        ts: { type: 'number', example: 1774511298733 },
                        modules: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // ═══════════════════════════════════════════════════════════════
        // PARSER OPERATIONS (NEW)
        // ═══════════════════════════════════════════════════════════════
        '/parsers/ops/status': {
          get: {
            tags: ['Parser Operations'],
            summary: 'Get full status of all parsers',
            description: 'Returns runtime state of all 28 parsers including status, last run, item counts, and errors',
            responses: {
              200: {
                description: 'Parser status list',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ts: { type: 'number' },
                        summary: {
                          type: 'object',
                          properties: {
                            total: { type: 'number', example: 28 },
                            ok: { type: 'number', example: 12 },
                            degraded: { type: 'number', example: 2 },
                            failed: { type: 'number', example: 4 },
                            quarantined: { type: 'number', example: 0 },
                            disabled: { type: 'number', example: 0 },
                          },
                        },
                        parsers: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              parserId: { type: 'string' },
                              parserName: { type: 'string' },
                              status: { type: 'string', enum: ['ok', 'degraded', 'failed', 'quarantined', 'disabled', 'unknown'] },
                              activeMode: { type: 'string', enum: ['rss', 'html', 'browser', 'api'] },
                              lastRunAt: { type: 'string', format: 'date-time' },
                              lastItemCount: { type: 'number' },
                              consecutiveFailures: { type: 'number' },
                              fallbackInUse: { type: 'boolean' },
                            },
                          },
                        },
                        running: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/ops/report/daily': {
          get: {
            tags: ['Parser Operations'],
            summary: 'Get daily ingestion report',
            description: 'Returns comprehensive daily report with ingestion metrics, fallback usage, alerts, and top/problematic sources',
            responses: {
              200: {
                description: 'Daily ingestion report',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        date: { type: 'string', example: '2026-03-26' },
                        generatedAt: { type: 'string', format: 'date-time' },
                        summary: {
                          type: 'object',
                          properties: {
                            totalSources: { type: 'number' },
                            ok: { type: 'number' },
                            degraded: { type: 'number' },
                            failed: { type: 'number' },
                            successRate: { type: 'string', example: '85%' },
                          },
                        },
                        ingestion: {
                          type: 'object',
                          properties: {
                            totalRuns: { type: 'number' },
                            totalFetched: { type: 'number' },
                            totalSaved: { type: 'number' },
                            totalDuplicates: { type: 'number' },
                          },
                        },
                        fallback: {
                          type: 'object',
                          properties: {
                            rss: { type: 'number' },
                            html: { type: 'number' },
                            browser: { type: 'number' },
                          },
                        },
                        alerts: { type: 'array', items: { type: 'string' } },
                        topSources: { type: 'array' },
                        problematicSources: { type: 'array' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/ops/quality': {
          get: {
            tags: ['Parser Operations'],
            summary: 'Get source quality scores',
            description: 'Returns quality scores (0-100) for each source based on success rate, item count, recency',
            responses: {
              200: {
                description: 'Quality scores list',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          parserId: { type: 'string' },
                          parserName: { type: 'string' },
                          qualityScore: { type: 'number', example: 91 },
                          avgItemsPerDay: { type: 'number' },
                          successRate: { type: 'number' },
                          fallbackUsagePercent: { type: 'number' },
                          status: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/ops/logs/{id}': {
          get: {
            tags: ['Parser Operations'],
            summary: 'Get logs for specific parser',
            description: 'Returns run history with metrics for a specific parser',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Parser ID (e.g., news_coindesk, dropstab_investors)',
              },
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'number', default: 50 },
                description: 'Number of logs to return',
              },
            ],
            responses: {
              200: {
                description: 'Parser run logs',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          parserId: { type: 'string' },
                          startedAt: { type: 'string', format: 'date-time' },
                          finishedAt: { type: 'string', format: 'date-time' },
                          success: { type: 'boolean' },
                          fetched: { type: 'number' },
                          saved: { type: 'number' },
                          durationMs: { type: 'number' },
                          status: { type: 'string' },
                          modeUsed: { type: 'string' },
                          errors: { type: 'array', items: { type: 'string' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/ops/quarantine': {
          get: {
            tags: ['Parser Operations'],
            summary: 'Get quarantined parsers',
            description: 'Returns list of parsers currently in quarantine (5+ consecutive failures)',
            responses: {
              200: {
                description: 'Quarantined parsers list',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          parserId: { type: 'string' },
                          parserName: { type: 'string' },
                          quarantinedUntil: { type: 'string', format: 'date-time' },
                          lastError: { type: 'string' },
                          consecutiveFailures: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/ops/rerun/{id}': {
          post: {
            tags: ['Parser Operations'],
            summary: 'Rerun single parser',
            description: 'Manually triggers a parser run with fallback chain',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Parser ID to rerun',
              },
            ],
            responses: {
              201: {
                description: 'Rerun result',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        result: {
                          type: 'object',
                          properties: {
                            itemsFetched: { type: 'number' },
                            itemsSaved: { type: 'number' },
                            durationMs: { type: 'number' },
                            modeUsed: { type: 'string' },
                            fallbackUsed: { type: 'boolean' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/ops/rerun-failed': {
          post: {
            tags: ['Parser Operations'],
            summary: 'Rerun all failed parsers',
            description: 'Triggers reruns for all failed and degraded parsers',
            responses: {
              201: {
                description: 'Batch rerun results',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        attempted: { type: 'number' },
                        succeeded: { type: 'number' },
                        failed: { type: 'number' },
                        skipped: { type: 'number' },
                        results: { type: 'array' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/ops/recover/{id}': {
          post: {
            tags: ['Parser Operations'],
            summary: 'Recover parser from quarantine',
            description: 'Clears quarantine status and resets failure counters',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              201: {
                description: 'Recovery result',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/ops/disable/{id}': {
          post: {
            tags: ['Parser Operations'],
            summary: 'Disable parser',
            description: 'Disables a parser (will not run in CRON or batch operations)',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              201: {
                description: 'Disable result',
              },
            },
          },
        },
        '/parsers/ops/enable/{id}': {
          post: {
            tags: ['Parser Operations'],
            summary: 'Enable parser',
            description: 'Re-enables a disabled parser',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              201: {
                description: 'Enable result',
              },
            },
          },
        },

        // ═══════════════════════════════════════════════════════════════
        // PARSER SYNC
        // ═══════════════════════════════════════════════════════════════
        '/parsers/status': {
          get: {
            tags: ['Parser Sync'],
            summary: 'Get data collection status',
            description: 'Returns counts of collected data from Dropstab and CryptoRank',
            responses: {
              200: {
                description: 'Collection status',
              },
            },
          },
        },
        '/parsers/health': {
          get: {
            tags: ['Parser Sync'],
            summary: 'Get parser health dashboard',
            description: 'Returns health metrics and circuit breaker states',
            responses: {
              200: {
                description: 'Parser health',
              },
            },
          },
        },
        '/parsers/sync/dropstab/investors': {
          post: {
            tags: ['Parser Sync'],
            summary: 'Sync Dropstab investors',
            description: 'Fetches all investors from Dropstab API (paginated, ~7000 investors)',
            responses: {
              201: {
                description: 'Sync result',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        source: { type: 'string', example: 'dropstab' },
                        entity: { type: 'string', example: 'investors' },
                        saved: { type: 'number' },
                        total: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/sync/dropstab/fundraising': {
          post: {
            tags: ['Parser Sync'],
            summary: 'Sync Dropstab fundraising rounds',
            description: 'Fetches all fundraising rounds from Dropstab API',
            responses: {
              201: {
                description: 'Sync result',
              },
            },
          },
        },
        '/parsers/sync/cryptorank/funding': {
          post: {
            tags: ['Parser Sync'],
            summary: 'Sync CryptoRank funding rounds',
            description: 'Fetches funding rounds from CryptoRank v0 API',
            responses: {
              201: {
                description: 'Sync result',
              },
            },
          },
        },
        '/parsers/run/api': {
          post: {
            tags: ['Parser Sync'],
            summary: 'Run all API parsers',
            description: 'Runs Dropstab and CryptoRank API parsers',
            responses: {
              201: {
                description: 'Run result',
              },
            },
          },
        },
        '/parsers/run/rss': {
          post: {
            tags: ['Parser Sync'],
            summary: 'Run all RSS parsers',
            description: 'Runs all 18 RSS news parsers with fallback',
            responses: {
              201: {
                description: 'Run result',
              },
            },
          },
        },

        // ═══════════════════════════════════════════════════════════════
        // ENTITIES
        // ═══════════════════════════════════════════════════════════════
        '/entities/stats': {
          get: {
            tags: ['Entities'],
            summary: 'Get entity statistics',
            description: 'Returns counts of canonical investors, raw data, and resolution metrics',
            responses: {
              200: {
                description: 'Entity statistics',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        canonical_investors: { type: 'number', example: 8456 },
                        raw_investors: { type: 'number', example: 18959 },
                        resolution_ratio: { type: 'string', example: '55% deduplicated' },
                        coinvest_relations: { type: 'number', example: 177033 },
                        data_quality_score: { type: 'string', example: '84%' },
                        by_tier: { type: 'array' },
                        by_source: { type: 'array' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/entities/resolve': {
          post: {
            tags: ['Entities'],
            summary: 'Run full entity resolution',
            description: 'Runs entity resolution pipeline: normalize, fuzzy match, merge, build coinvest graph',
            responses: {
              201: {
                description: 'Resolution result',
              },
            },
          },
        },
        '/entities/leaderboard': {
          get: {
            tags: ['Entities'],
            summary: 'Get top investors leaderboard',
            description: 'Returns top investors by score',
            parameters: [
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'number', default: 50 },
              },
            ],
            responses: {
              200: {
                description: 'Investor leaderboard',
              },
            },
          },
        },
        '/entities/coinvest': {
          get: {
            tags: ['Entities'],
            summary: 'Get co-investors for an investor',
            description: 'Returns investors who frequently invest together with target',
            parameters: [
              {
                name: 'investor',
                in: 'query',
                required: true,
                schema: { type: 'string' },
                description: 'Investor canonical ID or name',
              },
            ],
            responses: {
              200: {
                description: 'Co-investor list',
              },
            },
          },
        },

        // ═══════════════════════════════════════════════════════════════
        // SMART MONEY
        // ═══════════════════════════════════════════════════════════════
        '/smart-money/stats': {
          get: {
            tags: ['Smart Money'],
            summary: 'Get smart money statistics',
            description: 'Returns tier distribution (ALPHA, SMART, FOLLOWER, RETAIL)',
            responses: {
              200: {
                description: 'Smart money stats',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        smart_money_profiles: { type: 'number', example: 8456 },
                        tier_distribution: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              _id: { type: 'string', example: 'ALPHA' },
                              count: { type: 'number', example: 404 },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/smart-money/analyze': {
          post: {
            tags: ['Smart Money'],
            summary: 'Run smart money analysis',
            description: 'Runs full smart money pipeline: scoring, tier assignment, follow detection',
            responses: {
              201: {
                description: 'Analysis result',
              },
            },
          },
        },
        '/smart-money/leaderboard': {
          get: {
            tags: ['Smart Money'],
            summary: 'Get smart money leaderboard',
            description: 'Returns top investors by smart money score',
            parameters: [
              {
                name: 'tier',
                in: 'query',
                schema: { type: 'string', enum: ['ALPHA', 'SMART', 'FOLLOWER', 'RETAIL'] },
              },
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'number', default: 50 },
              },
            ],
            responses: {
              200: {
                description: 'Smart money leaderboard',
              },
            },
          },
        },
        '/smart-money/profile': {
          get: {
            tags: ['Smart Money'],
            summary: 'Get investor smart money profile',
            description: 'Returns detailed profile with scores, metrics, and relations',
            parameters: [
              {
                name: 'name',
                in: 'query',
                required: true,
                schema: { type: 'string' },
                description: 'Investor name',
              },
            ],
            responses: {
              200: {
                description: 'Investor profile',
              },
            },
          },
        },

        // ═══════════════════════════════════════════════════════════════
        // NEWS
        // ═══════════════════════════════════════════════════════════════
        '/news/stats': {
          get: {
            tags: ['News'],
            summary: 'Get news statistics',
            description: 'Returns article counts by source',
            responses: {
              200: {
                description: 'News statistics',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        total_articles: { type: 'number', example: 339 },
                        by_source: { type: 'object' },
                        recent: { type: 'array' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/news/sources': {
          get: {
            tags: ['News'],
            summary: 'Get news source configuration',
            description: 'Returns list of configured RSS sources with fallback strategies',
            responses: {
              200: {
                description: 'Source configuration',
              },
            },
          },
        },
        '/news/sync': {
          post: {
            tags: ['News'],
            summary: 'Sync all news sources',
            description: 'Runs all RSS parsers with fallback chain (RSS → HTML → Browser)',
            responses: {
              201: {
                description: 'Sync result',
              },
            },
          },
        },
        '/news/sync/{id}': {
          post: {
            tags: ['News'],
            summary: 'Sync single news source',
            description: 'Runs specific RSS parser with fallback',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Source ID (e.g., news_coindesk)',
              },
            ],
            responses: {
              201: {
                description: 'Sync result',
              },
            },
          },
        },
        '/news/articles': {
          get: {
            tags: ['News'],
            summary: 'Get news articles',
            description: 'Returns paginated list of news articles',
            parameters: [
              {
                name: 'source',
                in: 'query',
                schema: { type: 'string' },
              },
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'number', default: 50 },
              },
            ],
            responses: {
              200: {
                description: 'Article list',
              },
            },
          },
        },

        // ═══════════════════════════════════════════════════════════════
        // GRAPH
        // ═══════════════════════════════════════════════════════════════
        '/graph/stats': {
          get: {
            tags: ['Graph'],
            summary: 'Get knowledge graph statistics',
            description: 'Returns node and edge counts',
            responses: {
              200: {
                description: 'Graph statistics',
              },
            },
          },
        },
        '/graph/rebuild': {
          post: {
            tags: ['Graph'],
            summary: 'Rebuild knowledge graph',
            description: 'Rebuilds the entire knowledge graph from entity data',
            responses: {
              201: {
                description: 'Rebuild result',
              },
            },
          },
        },

        // ═══════════════════════════════════════════════════════════════
        // MARKET - Extended endpoints (Coinbase, HyperLiquid, DefiLlama)
        // ═══════════════════════════════════════════════════════════════
        '/market/quote': {
          get: {
            tags: ['Market'],
            summary: 'Get asset price quote',
            description: 'Returns current price for an asset from Coinbase/DefiLlama',
            parameters: [
              {
                name: 'asset',
                in: 'query',
                required: true,
                schema: { type: 'string' },
                description: 'Asset symbol (e.g., BTC, ETH)',
              },
            ],
            responses: {
              200: { description: 'Price quote with source info' },
            },
          },
        },
        '/market/quotes': {
          get: {
            tags: ['Market'],
            summary: 'Get bulk price quotes',
            description: 'Returns prices for multiple assets',
            parameters: [
              {
                name: 'assets',
                in: 'query',
                required: true,
                schema: { type: 'string' },
                description: 'Comma-separated asset symbols',
              },
            ],
            responses: {
              200: { description: 'Bulk quotes' },
            },
          },
        },
        '/market/overview': {
          get: {
            tags: ['Market'],
            summary: 'Get market overview',
            description: 'Returns global market overview from DefiLlama',
            responses: {
              200: { description: 'Market overview' },
            },
          },
        },
        '/market/tvl': {
          get: {
            tags: ['Market'],
            summary: 'Get TVL data',
            description: 'Returns Total Value Locked data from DeFiLlama',
            responses: {
              200: { description: 'TVL data' },
            },
          },
        },
        '/market/candles': {
          get: {
            tags: ['Market'],
            summary: 'Get OHLCV candles',
            description: 'Returns candlestick data from Coinbase',
            parameters: [
              { name: 'asset', in: 'query', required: true, schema: { type: 'string' } },
              { name: 'interval', in: 'query', schema: { type: 'string', default: '1h', enum: ['1m', '5m', '15m', '1h', '6h', '1d'] } },
              { name: 'limit', in: 'query', schema: { type: 'number', default: 100 } },
            ],
            responses: {
              200: { description: 'Candle data' },
            },
          },
        },
        '/market/orderbook': {
          get: {
            tags: ['Market'],
            summary: 'Get orderbook',
            description: 'Returns order book from Coinbase/HyperLiquid',
            parameters: [
              { name: 'asset', in: 'query', required: true, schema: { type: 'string' } },
              { name: 'exchange', in: 'query', schema: { type: 'string', default: 'coinbase', enum: ['coinbase', 'hyperliquid'] } },
              { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
            ],
            responses: {
              200: { description: 'Order book with bids/asks' },
            },
          },
        },
        '/market/trades': {
          get: {
            tags: ['Market'],
            summary: 'Get recent trades',
            description: 'Returns recent trades from Coinbase/HyperLiquid',
            parameters: [
              { name: 'asset', in: 'query', required: true, schema: { type: 'string' } },
              { name: 'exchange', in: 'query', schema: { type: 'string', default: 'coinbase' } },
              { name: 'limit', in: 'query', schema: { type: 'number', default: 50 } },
            ],
            responses: {
              200: { description: 'Recent trades' },
            },
          },
        },
        '/market/perps/quote': {
          get: {
            tags: ['Market'],
            summary: 'Get perpetual futures quote',
            description: 'Returns perp price from HyperLiquid',
            parameters: [
              { name: 'asset', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: {
              200: { description: 'Perp quote with funding' },
            },
          },
        },
        '/market/perps/funding': {
          get: {
            tags: ['Market'],
            summary: 'Get funding rates',
            description: 'Returns funding rates for all perps from HyperLiquid',
            responses: {
              200: { description: 'Funding rates list' },
            },
          },
        },
        '/market/perps/overview': {
          get: {
            tags: ['Market'],
            summary: 'Get perpetuals overview',
            description: 'Returns HyperLiquid perps overview with OI and volume',
            responses: {
              200: { description: 'Perps overview' },
            },
          },
        },
        '/market/providers/health': {
          get: {
            tags: ['Market'],
            summary: 'Get market providers health',
            description: 'Returns health status of Coinbase, HyperLiquid, DefiLlama',
            responses: {
              200: { description: 'Provider health status' },
            },
          },
        },
        '/market/providers/list': {
          get: {
            tags: ['Market'],
            summary: 'List available market providers',
            description: 'Returns list of active and disabled providers',
            responses: {
              200: { description: 'Provider list' },
            },
          },
        },
        '/market/cache/stats': {
          get: {
            tags: ['Market'],
            summary: 'Get cache statistics',
            description: 'Returns market data cache stats',
            responses: {
              200: { description: 'Cache stats' },
            },
          },
        },

        // ═══════════════════════════════════════════════════════════════
        // INTELLIGENCE - Self-Learning Ingestion Engine
        // ═══════════════════════════════════════════════════════════════
        '/parsers/intelligence/overview': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get intelligence overview',
            description: 'Returns summary of schema drift, anomalies, trust scores, and recovery status',
            responses: {
              200: {
                description: 'Intelligence overview',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ts: { type: 'number' },
                        summary: {
                          type: 'object',
                          properties: {
                            sourcesTracked: { type: 'number' },
                            schemaSignatures: { type: 'number' },
                            sourcesInRecovery: { type: 'number' },
                          },
                        },
                        last24h: {
                          type: 'object',
                          properties: {
                            schemaDrifts: { type: 'number' },
                            anomalies: { type: 'number' },
                            recoveryActions: { type: 'number' },
                          },
                        },
                        trustScores: {
                          type: 'object',
                          properties: {
                            high: { type: 'number' },
                            medium: { type: 'number' },
                            low: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/intelligence/drift/recent': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get recent schema drifts',
            description: 'Returns schema changes detected in last N hours',
            parameters: [
              { name: 'hours', in: 'query', schema: { type: 'number', default: 24 } },
            ],
            responses: {
              200: { description: 'Schema drift list' },
            },
          },
        },
        '/parsers/intelligence/drift/{sourceId}': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get drift history for source',
            parameters: [
              { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
              200: { description: 'Source drift history and current signature' },
            },
          },
        },
        '/parsers/intelligence/strategy/metrics': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get strategy learning metrics',
            description: 'Returns success rates, trust scores, and recommended modes for all sources',
            responses: {
              200: {
                description: 'Strategy metrics',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          sourceId: { type: 'string' },
                          successRates: { type: 'object' },
                          avgItems: { type: 'object' },
                          recommendedMode: { type: 'string' },
                          confidence: { type: 'number' },
                          trustScore: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/parsers/intelligence/strategy/{sourceId}': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get strategy for specific source',
            parameters: [
              { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
              200: { description: 'Source strategy with recommendation' },
            },
          },
        },
        '/parsers/intelligence/strategy/trust-ranking': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get sources ranked by trust score',
            parameters: [
              { name: 'minScore', in: 'query', schema: { type: 'number', default: 0 } },
            ],
            responses: {
              200: { description: 'Trust score ranking' },
            },
          },
        },
        '/parsers/intelligence/strategy/decisions': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get strategy decision history',
            description: 'Returns auto-switch decisions made by the learning engine',
            responses: {
              200: { description: 'Decision history' },
            },
          },
        },
        '/parsers/intelligence/anomalies/recent': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get recent anomalies',
            description: 'Returns detected anomalies (drops, spikes, pattern breaks)',
            parameters: [
              { name: 'hours', in: 'query', schema: { type: 'number', default: 24 } },
              { name: 'minSeverity', in: 'query', schema: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] } },
            ],
            responses: {
              200: { description: 'Anomaly list' },
            },
          },
        },
        '/parsers/intelligence/anomalies/{sourceId}': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get anomalies for source',
            parameters: [
              { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
              200: { description: 'Source anomaly history and baseline' },
            },
          },
        },
        '/parsers/intelligence/recovery/status': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get auto-recovery status',
            description: 'Returns recovery states for all sources',
            responses: {
              200: { description: 'Recovery status' },
            },
          },
        },
        '/parsers/intelligence/recovery/actions': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get recent recovery actions',
            description: 'Returns automatic recovery actions (mode switches, quarantine, etc)',
            parameters: [
              { name: 'hours', in: 'query', schema: { type: 'number', default: 24 } },
            ],
            responses: {
              200: { description: 'Recovery actions' },
            },
          },
        },
        '/parsers/intelligence/recovery/{sourceId}/trigger': {
          post: {
            tags: ['Intelligence'],
            summary: 'Trigger manual recovery',
            parameters: [
              { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
              201: { description: 'Recovery triggered' },
            },
          },
        },
        '/parsers/intelligence/discovery/candidates': {
          get: {
            tags: ['Intelligence'],
            summary: 'Get discovered API endpoints',
            description: 'Returns automatically discovered API endpoints from browser interception',
            parameters: [
              { name: 'minScore', in: 'query', schema: { type: 'number', default: 50 } },
            ],
            responses: {
              200: { description: 'Discovered endpoints' },
            },
          },
        },

        // ═══════════════════════════════════════════════════════════════
        // INTEL EXTENDED - Projects, Investors, Funding, Unlocks
        // ═══════════════════════════════════════════════════════════════
        '/intel/projects/trending': {
          get: {
            tags: ['Intel'],
            summary: 'Get trending projects',
            parameters: [{ name: 'limit', in: 'query', schema: { type: 'number', default: 20 } }],
            responses: { 200: { description: 'Trending projects list' } },
          },
        },
        '/intel/projects/search': {
          get: {
            tags: ['Intel'],
            summary: 'Search projects',
            parameters: [
              { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
              { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
            ],
            responses: { 200: { description: 'Search results' } },
          },
        },
        '/intel/projects/categories': {
          get: { tags: ['Intel'], summary: 'Get project categories', responses: { 200: { description: 'Categories list' } } },
        },
        '/intel/projects/{slug}': {
          get: {
            tags: ['Intel'],
            summary: 'Get project by slug',
            parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Project details' } },
          },
        },
        '/intel/projects/{slug}/investors': {
          get: { tags: ['Intel'], summary: 'Get project investors', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Investors list' } } },
        },
        '/intel/projects/{slug}/funding': {
          get: { tags: ['Intel'], summary: 'Get project funding rounds', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Funding rounds' } } },
        },
        '/intel/projects/{slug}/unlocks': {
          get: { tags: ['Intel'], summary: 'Get project unlocks', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Token unlocks' } } },
        },
        '/intel/investors/top': {
          get: { tags: ['Intel'], summary: 'Get top investors by AUM', parameters: [{ name: 'limit', in: 'query', schema: { type: 'number', default: 50 } }], responses: { 200: { description: 'Top investors' } } },
        },
        '/intel/investors/search': {
          get: { tags: ['Intel'], summary: 'Search investors', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Search results' } } },
        },
        '/intel/investors/{slug}': {
          get: { tags: ['Intel'], summary: 'Get investor details', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Investor details' } } },
        },
        '/intel/investors/{slug}/portfolio': {
          get: { tags: ['Intel'], summary: 'Get investor portfolio', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Portfolio investments' } } },
        },
        '/intel/investors/{slug}/coinvested': {
          get: { tags: ['Intel'], summary: 'Get co-investors', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Co-investors list' } } },
        },
        '/intel/funding/recent': {
          get: { tags: ['Intel'], summary: 'Get recent funding rounds', parameters: [{ name: 'days', in: 'query', schema: { type: 'number', default: 30 } }], responses: { 200: { description: 'Recent funding' } } },
        },
        '/intel/funding/stages': {
          get: { tags: ['Intel'], summary: 'Get funding stages', responses: { 200: { description: 'Stages list' } } },
        },
        '/intel/funding/top': {
          get: { tags: ['Intel'], summary: 'Get top funding rounds', responses: { 200: { description: 'Top rounds by amount' } } },
        },
        '/intel/funding/stats': {
          get: { tags: ['Intel'], summary: 'Get funding statistics', responses: { 200: { description: 'Funding stats' } } },
        },
        '/intel/unlocks/upcoming': {
          get: { tags: ['Intel'], summary: 'Get upcoming token unlocks', parameters: [{ name: 'days', in: 'query', schema: { type: 'number', default: 30 } }], responses: { 200: { description: 'Upcoming unlocks' } } },
        },
        '/intel/unlocks/major': {
          get: { tags: ['Intel'], summary: 'Get major unlocks', parameters: [{ name: 'min_value', in: 'query', schema: { type: 'number', default: 1000000 } }], responses: { 200: { description: 'Major unlocks' } } },
        },
        '/intel/funds/top': {
          get: { tags: ['Intel'], summary: 'Get top funds', responses: { 200: { description: 'Top funds by AUM' } } },
        },
        '/intel/aggregated/market': {
          get: { tags: ['Intel'], summary: 'Get aggregated market overview', responses: { 200: { description: 'Market summary' } } },
        },
        '/intel/aggregated/search': {
          get: { tags: ['Intel'], summary: 'Universal search', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Search results across all entities' } } },
        },
        '/intel/curated/feed': {
          get: { tags: ['Intel'], summary: 'Get curated intel feed', responses: { 200: { description: 'Curated feed sections' } } },
        },
        '/intel/curated/funding': {
          get: { tags: ['Intel'], summary: 'Get curated funding', responses: { 200: { description: 'Curated funding rounds' } } },
        },
        '/intel/curated/unlocks': {
          get: { tags: ['Intel'], summary: 'Get curated unlocks', responses: { 200: { description: 'Curated unlocks' } } },
        },
        '/intel/curated/trending': {
          get: { tags: ['Intel'], summary: 'Get trending projects', responses: { 200: { description: 'Trending projects' } } },
        },

        // ═══════════════════════════════════════════════════════════════
        // INTEL ADMIN - Proxy Management
        // ═══════════════════════════════════════════════════════════════
        '/intel/admin/proxy/status': {
          get: { tags: ['Admin'], summary: 'Get proxy status', responses: { 200: { description: 'Proxy list with stats' } } },
        },
        '/intel/admin/proxy/add': {
          post: {
            tags: ['Admin'],
            summary: 'Add proxy',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      server: { type: 'string', example: 'http://host:port' },
                      username: { type: 'string' },
                      password: { type: 'string' },
                      priority: { type: 'number', default: 1 },
                    },
                  },
                },
              },
            },
            responses: { 200: { description: 'Proxy added' } },
          },
        },
        '/intel/admin/proxy/{id}': {
          delete: { tags: ['Admin'], summary: 'Delete proxy', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Proxy deleted' } } },
        },
        '/intel/admin/proxy/{id}/toggle': {
          post: { tags: ['Admin'], summary: 'Toggle proxy enabled/disabled', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'enabled', in: 'query', schema: { type: 'boolean' } }], responses: { 200: { description: 'Proxy toggled' } } },
        },
        '/intel/admin/proxy/{id}/test': {
          post: { tags: ['Admin'], summary: 'Test proxy connectivity', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Test result with IP and latency' } } },
        },
        '/intel/admin/proxy/test-all': {
          post: { tags: ['Admin'], summary: 'Test all active proxies', responses: { 200: { description: 'Batch test results' } } },
        },

        // ═══════════════════════════════════════════════════════════════
        // MARKET EXTENDED - Derivatives, Spot, On-chain
        // ═══════════════════════════════════════════════════════════════
        '/market/derivatives/funding': {
          get: { tags: ['Market'], summary: 'Get all funding rates', responses: { 200: { description: 'Funding rates from HyperLiquid' } } },
        },
        '/market/derivatives/funding/{symbol}': {
          get: { tags: ['Market'], summary: 'Get symbol funding rate', parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Symbol funding rate' } } },
        },
        '/market/derivatives/funding/extremes': {
          get: { tags: ['Market'], summary: 'Get extreme funding rates', responses: { 200: { description: 'Most positive and negative funding' } } },
        },
        '/market/derivatives/open-interest': {
          get: { tags: ['Market'], summary: 'Get open interest', responses: { 200: { description: 'Total OI from HyperLiquid' } } },
        },
        '/market/derivatives/long-short': {
          get: { tags: ['Market'], summary: 'Get long/short ratio', responses: { 200: { description: 'Market sentiment based on funding' } } },
        },
        '/market/spot/top': {
          get: { tags: ['Market'], summary: 'Get top spot assets', parameters: [{ name: 'limit', in: 'query', schema: { type: 'number', default: 20 } }], responses: { 200: { description: 'Top assets by market cap' } } },
        },
        '/market/onchain/tvl': {
          get: { tags: ['Market'], summary: 'Get total TVL', responses: { 200: { description: 'TVL from DeFiLlama' } } },
        },
        '/market/global/stats': {
          get: { tags: ['Market'], summary: 'Get global market stats', responses: { 200: { description: 'Combined spot and derivatives stats' } } },
        },
        '/market/exchanges/list': {
          get: { tags: ['Market'], summary: 'List supported exchanges', responses: { 200: { description: 'Exchange list with status' } } },
        },
        '/market/asset/{symbol}': {
          get: { tags: ['Market'], summary: 'Get asset data', parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Spot and perp data for asset' } } },
        },
        '/market/asset/{symbol}/full': {
          get: { tags: ['Market'], summary: 'Get full asset data', parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Quote, orderbook, and candles' } } },
        },
        '/market/historical/{symbol}': {
          get: { tags: ['Market'], summary: 'Get historical data', parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }, { name: 'interval', in: 'query', schema: { type: 'string', default: '1d' } }], responses: { 200: { description: 'Historical candles' } } },
        },
      },
    };
  }
}
