/**
 * Coinbase Adapter - Direct Coinbase Exchange API (no proxy needed)
 */

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BaseAdapter } from './base.adapter';
import { AdapterResult } from '../models';

@Injectable()
export class CoinbaseAdapter extends BaseAdapter {
  private readonly logger = new Logger(CoinbaseAdapter.name);
  
  name = 'Coinbase';
  priority = 90;

  private readonly baseUrl = 'https://api.exchange.coinbase.com';

  async getQuote(asset: string): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const productId = `${asset.toUpperCase()}-USD`;
      
      const [tickerResponse, statsResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/products/${productId}/ticker`, { timeout: 5000 }),
        axios.get(`${this.baseUrl}/products/${productId}/stats`, { timeout: 5000 }),
      ]);

      const ticker = tickerResponse.data;
      const stats = statsResponse.data;

      const result = {
        asset: asset.toUpperCase(),
        price: parseFloat(ticker.price),
        bid: parseFloat(ticker.bid),
        ask: parseFloat(ticker.ask),
        volume24h: parseFloat(ticker.volume),
        high24h: parseFloat(stats.high),
        low24h: parseFloat(stats.low),
        open24h: parseFloat(stats.open),
        change24h: ((parseFloat(ticker.price) - parseFloat(stats.open)) / parseFloat(stats.open)),
        timestamp: Date.now(),
        source: 'coinbase',
      };

      this.recordSuccess(Date.now() - start);
      return { success: true, data: result, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getBulkQuotes(assets: string[]): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const quotes = [];
      
      // Get all products first
      const productsResponse = await axios.get(`${this.baseUrl}/products`, { timeout: 10000 });
      const products = productsResponse.data;
      
      // Filter USD pairs for requested assets
      const usdProducts = products.filter((p: any) => 
        p.quote_currency === 'USD' && 
        assets.map(a => a.toUpperCase()).includes(p.base_currency)
      );

      // Get tickers for each
      for (const product of usdProducts) {
        try {
          const tickerResponse = await axios.get(
            `${this.baseUrl}/products/${product.id}/ticker`,
            { timeout: 3000 }
          );
          
          quotes.push({
            asset: product.base_currency,
            price: parseFloat(tickerResponse.data.price),
            volume24h: parseFloat(tickerResponse.data.volume),
            timestamp: Date.now(),
            source: 'coinbase',
          });
        } catch (e) {
          // Skip failed assets
        }
      }

      this.recordSuccess(Date.now() - start);
      return { success: true, data: quotes, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getOverview(): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const productsResponse = await axios.get(`${this.baseUrl}/products`, { timeout: 5000 });
      const products = productsResponse.data;
      
      const usdPairs = products.filter((p: any) => p.quote_currency === 'USD');
      
      const result = {
        ts: Date.now(),
        exchange: 'coinbase',
        totalProducts: products.length,
        usdPairs: usdPairs.length,
        tradingPairs: products.map((p: any) => p.id),
        source: this.name,
      };

      this.recordSuccess(Date.now() - start);
      return { success: true, data: result, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getCandles(asset: string, interval: string, limit: number): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const productId = `${asset.toUpperCase()}-USD`;
      const granularity = this.mapInterval(interval);
      
      const response = await axios.get(
        `${this.baseUrl}/products/${productId}/candles`,
        {
          params: { granularity },
          timeout: 10000,
        }
      );

      // Coinbase returns [timestamp, low, high, open, close, volume]
      const candles = response.data.slice(0, limit).map((c: number[]) => ({
        timestamp: c[0] * 1000,
        open: c[3],
        high: c[2],
        low: c[1],
        close: c[4],
        volume: c[5],
      })).reverse();

      this.recordSuccess(Date.now() - start);
      return { success: true, data: candles, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getOrderbook(asset: string, limit: number = 20): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const productId = `${asset.toUpperCase()}-USD`;
      const level = limit > 50 ? 3 : 2; // level 2 = top 50, level 3 = full
      
      const response = await axios.get(
        `${this.baseUrl}/products/${productId}/book`,
        {
          params: { level },
          timeout: 5000,
        }
      );

      const result = {
        exchange: 'coinbase',
        bids: response.data.bids.slice(0, limit).map((b: string[]) => ({
          price: parseFloat(b[0]),
          amount: parseFloat(b[1]),
          orders: parseInt(b[2] || '1', 10),
        })),
        asks: response.data.asks.slice(0, limit).map((a: string[]) => ({
          price: parseFloat(a[0]),
          amount: parseFloat(a[1]),
          orders: parseInt(a[2] || '1', 10),
        })),
        sequence: response.data.sequence,
      };

      this.recordSuccess(Date.now() - start);
      return { success: true, data: result, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getTrades(asset: string, limit: number = 50): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const productId = `${asset.toUpperCase()}-USD`;
      
      const response = await axios.get(
        `${this.baseUrl}/products/${productId}/trades`,
        {
          params: { limit },
          timeout: 5000,
        }
      );

      const trades = response.data.map((t: any) => ({
        id: t.trade_id.toString(),
        price: parseFloat(t.price),
        amount: parseFloat(t.size),
        side: t.side,
        timestamp: new Date(t.time).getTime(),
      }));

      const result = { exchange: 'coinbase', trades };

      this.recordSuccess(Date.now() - start);
      return { success: true, data: result, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getProducts(): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const response = await axios.get(`${this.baseUrl}/products`, { timeout: 5000 });
      
      const products = response.data.map((p: any) => ({
        id: p.id,
        base: p.base_currency,
        quote: p.quote_currency,
        status: p.status,
        minSize: p.base_min_size,
        maxSize: p.base_max_size,
      }));

      this.recordSuccess(Date.now() - start);
      return { success: true, data: products, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async healthCheck(): Promise<AdapterResult> {
    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/products/BTC-USD/ticker`, { timeout: 3000 });
      this.recordSuccess(Date.now() - start);
      return { success: true, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  private mapInterval(interval: string): number {
    // Coinbase granularity in seconds
    const mapping: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400,
    };
    return mapping[interval] || 3600;
  }
}
