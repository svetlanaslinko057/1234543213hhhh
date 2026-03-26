/**
 * Market Gateway Service
 * Provider-agnostic market data gateway with dynamic routing
 * Active Providers: DefiLlama, Coinbase, HyperLiquid
 * Disabled (need proxy): Binance, Bybit
 */

import { Injectable, Logger } from '@nestjs/common';
import { DefiLlamaAdapter } from './adapters/defillama.adapter';
import { ExchangeAdapter } from './adapters/exchange.adapter';
import { CoinbaseAdapter } from './adapters/coinbase.adapter';
import { HyperLiquidAdapter } from './adapters/hyperliquid.adapter';
import { BaseAdapter } from './adapters/base.adapter';
import { AdapterResult, ProviderStatus } from './models';

// Simple in-memory cache
class CacheLayer {
  private cache = new Map<string, { data: any; expires: number }>();

  async get(type: string, ...keys: any[]): Promise<any | null> {
    const key = `${type}:${keys.join(':')}`;
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  async set(type: string, data: any, ...keys: any[]): Promise<void> {
    const key = `${type}:${keys.join(':')}`;
    const ttl = this.getTTL(type);
    this.cache.set(key, { data, expires: Date.now() + ttl });
  }

  private getTTL(type: string): number {
    const ttls: Record<string, number> = {
      quote: 10000,      // 10s
      quotes: 10000,     // 10s
      overview: 60000,   // 60s
      candles: 300000,   // 5min
      exchanges: 30000,  // 30s
      orderbook: 5000,   // 5s
      trades: 5000,      // 5s
      health: 30000,     // 30s
    };
    return ttls[type] || 30000;
  }

  getStats(): Record<string, any> {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

@Injectable()
export class MarketGatewayService {
  private readonly logger = new Logger(MarketGatewayService.name);
  private readonly cache = new CacheLayer();
  private readonly adapters: Map<string, BaseAdapter> = new Map();
  private initialized = false;

  private readonly LATENCY_THRESHOLD = 2000;

  constructor(
    private readonly defillamaAdapter: DefiLlamaAdapter,
    private readonly exchangeAdapter: ExchangeAdapter,
    private readonly coinbaseAdapter: CoinbaseAdapter,
    private readonly hyperliquidAdapter: HyperLiquidAdapter,
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Primary providers (no proxy needed)
    this.adapters.set('defillama', this.defillamaAdapter);
    this.adapters.set('coinbase', this.coinbaseAdapter);
    this.adapters.set('hyperliquid', this.hyperliquidAdapter);
    
    // Exchange adapters (Binance, Bybit) - now enabled with proxy
    this.adapters.set('exchanges', this.exchangeAdapter);

    this.initialized = true;
    this.logger.log(`Market Gateway initialized with ${this.adapters.size} active adapters (Coinbase, HyperLiquid, DefiLlama, Binance, Bybit)`);
  }

  private getSortedAdapters(exclude: string[] = []): BaseAdapter[] {
    return Array.from(this.adapters.entries())
      .filter(([name, adapter]) => !exclude.includes(name) && adapter.isHealthy)
      .sort((a, b) => {
        // Sort by priority first, then latency
        if (b[1].priority !== a[1].priority) {
          return b[1].priority - a[1].priority;
        }
        return a[1].latency - b[1].latency;
      })
      .map(([_, adapter]) => adapter);
  }

  private async tryAdapters(methodName: string, ...args: any[]): Promise<AdapterResult> {
    await this.initialize();

    const errors: string[] = [];
    for (const adapter of this.getSortedAdapters()) {
      const method = (adapter as any)[methodName];
      if (!method) continue;

      const result = await method.call(adapter, ...args);

      if (result.success) {
        if (result.latencyMs > this.LATENCY_THRESHOLD) {
          this.logger.warn(`[${adapter.name}] High latency: ${result.latencyMs}ms`);
        }
        return result;
      }

      errors.push(`${adapter.name}: ${result.error}`);
    }

    return {
      success: false,
      error: `All providers failed: ${errors.join('; ')}`,
      source: 'gateway',
      latencyMs: 0,
    };
  }

  // Quote endpoints
  async getQuote(asset: string): Promise<any> {
    await this.initialize();
    asset = asset.toUpperCase();

    const cached = await this.cache.get('quote', asset);
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = await this.tryAdapters('getQuote', asset);

    if (result.success) {
      const data = { ...result.data, source: result.source, latency_ms: result.latencyMs };
      await this.cache.set('quote', data, asset);
      return data;
    }

    throw new Error(result.error);
  }

  async getBulkQuotes(assets: string[]): Promise<any> {
    await this.initialize();
    assets = assets.map(a => a.toUpperCase());
    const cacheKey = assets.sort().join(',');

    const cached = await this.cache.get('quotes', cacheKey);
    if (cached) {
      return { quotes: cached, cached: true, ts: Date.now() };
    }

    const result = await this.tryAdapters('getBulkQuotes', assets);

    if (result.success) {
      await this.cache.set('quotes', result.data, cacheKey);
      return {
        ts: Date.now(),
        quotes: result.data,
        sources_used: [result.source],
        latency_ms: result.latencyMs,
      };
    }

    throw new Error(result.error);
  }

  // Market overview
  async getOverview(): Promise<any> {
    await this.initialize();

    const cached = await this.cache.get('overview');
    if (cached) {
      return { ...cached, cached: true };
    }

    // Try DefiLlama first for overview
    const defillama = this.adapters.get('defillama');
    if (defillama) {
      const result = await defillama.getOverview();
      if (result.success) {
        const data = { ts: Date.now(), ...result.data, source: result.source };
        await this.cache.set('overview', data);
        return data;
      }
    }

    throw new Error('No provider available for market overview');
  }

  // Candles
  async getCandles(asset: string, interval: string = '1h', limit: number = 100): Promise<any> {
    await this.initialize();
    asset = asset.toUpperCase();

    const cached = await this.cache.get('candles', asset, interval, limit);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Try Coinbase first (best candle data without proxy)
    const coinbase = this.adapters.get('coinbase') as CoinbaseAdapter;
    if (coinbase) {
      const result = await coinbase.getCandles(asset, interval, limit);
      if (result.success) {
        const data = {
          ts: Date.now(),
          asset,
          interval,
          candles: result.data,
          source: 'coinbase',
        };
        await this.cache.set('candles', data, asset, interval, limit);
        return data;
      }
    }

    // Try HyperLiquid for perps
    const hyperliquid = this.adapters.get('hyperliquid') as HyperLiquidAdapter;
    if (hyperliquid) {
      const result = await hyperliquid.getCandles(asset, interval, limit);
      if (result.success) {
        const data = {
          ts: Date.now(),
          asset,
          interval,
          candles: result.data,
          source: 'hyperliquid',
        };
        await this.cache.set('candles', data, asset, interval, limit);
        return data;
      }
    }

    // Fallback to DefiLlama
    const result = await this.tryAdapters('getCandles', asset, interval, limit);

    if (result.success) {
      const data = {
        ts: Date.now(),
        asset,
        interval,
        candles: result.data,
        source: result.source,
      };
      await this.cache.set('candles', data, asset, interval, limit);
      return data;
    }

    throw new Error(result.error);
  }

  // Exchange data
  async getExchanges(asset: string): Promise<any> {
    await this.initialize();
    asset = asset.toUpperCase();

    const cached = await this.cache.get('exchanges', asset);
    if (cached) {
      return { ...cached, cached: true };
    }

    const exchange = this.adapters.get('exchanges') as ExchangeAdapter;
    if (!exchange) {
      throw new Error('Exchange adapter not available');
    }

    const result = await exchange.getExchangesForAsset(asset);

    if (result.success) {
      const data = { ts: Date.now(), asset, exchanges: result.data };
      await this.cache.set('exchanges', data, asset);
      return data;
    }

    throw new Error(result.error);
  }

  async getOrderbook(asset: string, exchange: string = 'coinbase', limit: number = 20): Promise<any> {
    await this.initialize();
    asset = asset.toUpperCase();

    const cached = await this.cache.get('orderbook', asset, exchange);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Try Coinbase first
    const coinbaseAdapter = this.adapters.get('coinbase') as CoinbaseAdapter;
    if (coinbaseAdapter && (exchange === 'coinbase' || exchange === 'auto')) {
      const result = await coinbaseAdapter.getOrderbook(asset, limit);
      if (result.success) {
        const data = { ts: Date.now(), asset, ...result.data };
        await this.cache.set('orderbook', data, asset, exchange);
        return data;
      }
    }

    // Try HyperLiquid for perps
    const hlAdapter = this.adapters.get('hyperliquid') as HyperLiquidAdapter;
    if (hlAdapter && exchange === 'hyperliquid') {
      const result = await hlAdapter.getOrderbook(asset, limit);
      if (result.success) {
        const data = { ts: Date.now(), asset, ...result.data };
        await this.cache.set('orderbook', data, asset, exchange);
        return data;
      }
    }

    throw new Error(`No orderbook available for ${asset} on ${exchange}`);
  }

  async getTrades(asset: string, exchange: string = 'coinbase', limit: number = 50): Promise<any> {
    await this.initialize();
    asset = asset.toUpperCase();

    const cached = await this.cache.get('trades', asset, exchange);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Try Coinbase first
    const coinbaseAdapter = this.adapters.get('coinbase') as CoinbaseAdapter;
    if (coinbaseAdapter && (exchange === 'coinbase' || exchange === 'auto')) {
      const result = await coinbaseAdapter.getTrades(asset, limit);
      if (result.success) {
        const data = { ts: Date.now(), asset, ...result.data };
        await this.cache.set('trades', data, asset, exchange);
        return data;
      }
    }

    // Try HyperLiquid for perps
    const hlAdapter = this.adapters.get('hyperliquid') as HyperLiquidAdapter;
    if (hlAdapter && exchange === 'hyperliquid') {
      const result = await hlAdapter.getTrades(asset, limit);
      if (result.success) {
        const data = { ts: Date.now(), asset, ...result.data };
        await this.cache.set('trades', data, asset, exchange);
        return data;
      }
    }

    throw new Error(`No trades available for ${asset} on ${exchange}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // PERPETUALS (HyperLiquid)
  // ═══════════════════════════════════════════════════════════════

  async getFundingRates(): Promise<any> {
    await this.initialize();

    const cached = await this.cache.get('funding');
    if (cached) {
      return { ...cached, cached: true };
    }

    const hlAdapter = this.adapters.get('hyperliquid') as HyperLiquidAdapter;
    if (!hlAdapter) {
      throw new Error('HyperLiquid adapter not available');
    }

    const result = await hlAdapter.getFundingRates();
    if (result.success) {
      const data = { ts: Date.now(), source: 'hyperliquid', funding_rates: result.data };
      await this.cache.set('funding', data);
      return data;
    }

    throw new Error(result.error);
  }

  async getPerpsOverview(): Promise<any> {
    await this.initialize();

    const cached = await this.cache.get('perps_overview');
    if (cached) {
      return { ...cached, cached: true };
    }

    const hlAdapter = this.adapters.get('hyperliquid') as HyperLiquidAdapter;
    if (!hlAdapter) {
      throw new Error('HyperLiquid adapter not available');
    }

    const result = await hlAdapter.getOverview();
    if (result.success) {
      await this.cache.set('perps_overview', result.data);
      return result.data;
    }

    throw new Error(result.error);
  }

  async getPerpsQuote(asset: string): Promise<any> {
    await this.initialize();
    asset = asset.toUpperCase();

    const cached = await this.cache.get('perps_quote', asset);
    if (cached) {
      return { ...cached, cached: true };
    }

    const hlAdapter = this.adapters.get('hyperliquid') as HyperLiquidAdapter;
    if (!hlAdapter) {
      throw new Error('HyperLiquid adapter not available');
    }

    const result = await hlAdapter.getQuote(asset);
    if (result.success) {
      await this.cache.set('perps_quote', result.data, asset);
      return result.data;
    }

    throw new Error(result.error);
  }

  // Health & Status
  async getProvidersHealth(): Promise<any> {
    await this.initialize();

    const cached = await this.cache.get('health');
    if (cached) {
      return { ...cached, cached: true };
    }

    const providers: Record<string, any> = {};

    for (const [name, adapter] of this.adapters) {
      const result = await adapter.healthCheck();

      let status: ProviderStatus;
      if (adapter.isHealthy) {
        status = ProviderStatus.HEALTHY;
      } else if ((adapter as any)._errorCount < 5) {
        status = ProviderStatus.DEGRADED;
      } else {
        status = ProviderStatus.DOWN;
      }

      providers[name] = {
        id: name,
        name: adapter.name,
        status: status,
        latency_ms: adapter.latency,
        success_rate: adapter.successRate,
        error_count: (adapter as any)._errorCount,
        last_error: (adapter as any)._lastError,
      };
    }

    const data = { ts: Date.now(), providers };
    await this.cache.set('health', data);
    return data;
  }

  getCacheStats(): Record<string, any> {
    return this.cache.getStats();
  }
}
