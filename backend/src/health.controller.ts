import { Controller, Get, Post, Body } from '@nestjs/common';

// Simple access password
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || 'fomo2024';

@Controller()
export class HealthController {
  @Post('auth/verify')
  verifyAuth(@Body() body: { password: string }) {
    const { password } = body;
    if (password === ACCESS_PASSWORD) {
      return { success: true, message: 'Authenticated' };
    }
    return { success: false, message: 'Invalid password' };
  }
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'FOMO Crypto Intelligence API',
      version: '2.0.0',
      stack: 'NestJS + Puppeteer + MongoDB',
      ts: Date.now(),
      modules: {
        intel: { status: 'active', scrapers: ['dropstab', 'cryptorank'] },
        news: { status: 'active', sources: '26+ RSS feeds' },
        graph: { status: 'active', description: 'Knowledge Graph' },
        sentiment: { status: 'active', engine: 'FOMO Algorithm' },
        market: { status: 'active', providers: ['defillama', 'binance', 'bybit'] },
      },
    };
  }

  @Get()
  root() {
    return {
      service: 'FOMO Crypto Intelligence API',
      version: '2.0.0',
      description: 'Crypto intelligence platform with scrapers, knowledge graph, sentiment analysis',
      endpoints: {
        health: '/api/health',
        intel: '/api/intel/*',
        news: '/api/news/*',
        graph: '/api/graph/*',
        sentiment: '/api/sentiment/*',
        market: '/api/market/*',
      },
      quickStart: {
        health: 'GET /api/health',
        stats: 'GET /api/intel/stats',
        btcPrice: 'GET /api/market/quote?asset=BTC',
        sentiment: 'POST /api/sentiment/analyze {"text":"..."}',
        graphRebuild: 'POST /api/graph/rebuild',
      },
    };
  }
}
