/**
 * Exchange Adapter - Direct exchange APIs (Binance, Coinbase, etc.)
 */

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BaseAdapter } from './base.adapter';
import { AdapterResult } from '../models';

@Injectable()
export class ExchangeAdapter extends BaseAdapter {
  private readonly logger = new Logger(ExchangeAdapter.name);
  
  name = 'Exchanges';
  priority = 80;

  private readonly exchanges = {
    binance: {
      ticker: 'https://api.binance.com/api/v3/ticker/24hr',
      klines: 'https://api.binance.com/api/v3/klines',
      orderbook: 'https://api.binance.com/api/v3/depth',
      trades: 'https://api.binance.com/api/v3/trades',
    },
    coinbase: {
      ticker: 'https://api.exchange.coinbase.com/products',
      candles: 'https://api.exchange.coinbase.com/products',
    },
    bybit: {
      ticker: 'https://api.bybit.com/v5/market/tickers',
      klines: 'https://api.bybit.com/v5/market/kline',
    },
  };

  async getQuote(asset: string): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const symbol = `${asset.toUpperCase()}USDT`;
      const response = await axios.get(`${this.exchanges.binance.ticker}?symbol=${symbol}`, {
        timeout: 5000,
      });

      const data = response.data;
      const result = {
        asset: asset.toUpperCase(),
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.priceChangePercent) / 100,
        volume24h: parseFloat(data.volume),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        timestamp: Date.now(),
        source: 'binance',
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
      // Get all tickers from Binance
      const response = await axios.get(this.exchanges.binance.ticker, { timeout: 10000 });

      const usdtPairs = new Set(assets.map(a => `${a.toUpperCase()}USDT`));
      const quotes = response.data
        .filter((t: any) => usdtPairs.has(t.symbol))
        .map((t: any) => ({
          asset: t.symbol.replace('USDT', ''),
          price: parseFloat(t.lastPrice),
          change24h: parseFloat(t.priceChangePercent) / 100,
          volume24h: parseFloat(t.volume),
          timestamp: Date.now(),
          source: 'binance',
        }));

      this.recordSuccess(Date.now() - start);
      return { success: true, data: quotes, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getOverview(): Promise<AdapterResult> {
    // Exchanges don't provide global overview
    return { success: false, error: 'Not supported', source: this.name, latencyMs: 0 };
  }

  async getCandles(asset: string, interval: string, limit: number): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const symbol = `${asset.toUpperCase()}USDT`;
      const binanceInterval = this.mapInterval(interval);
      
      const response = await axios.get(this.exchanges.binance.klines, {
        params: { symbol, interval: binanceInterval, limit },
        timeout: 10000,
      });

      const candles = response.data.map((k: any[]) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      this.recordSuccess(Date.now() - start);
      return { success: true, data: candles, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getOrderbook(asset: string, exchange: string = 'binance', limit: number = 20): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const symbol = `${asset.toUpperCase()}USDT`;
      const response = await axios.get(this.exchanges.binance.orderbook, {
        params: { symbol, limit },
        timeout: 5000,
      });

      const result = {
        exchange: 'binance',
        bids: response.data.bids.map((b: string[]) => ({ price: parseFloat(b[0]), amount: parseFloat(b[1]) })),
        asks: response.data.asks.map((a: string[]) => ({ price: parseFloat(a[0]), amount: parseFloat(a[1]) })),
      };

      this.recordSuccess(Date.now() - start);
      return { success: true, data: result, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getTrades(asset: string, exchange: string = 'binance', limit: number = 50): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const symbol = `${asset.toUpperCase()}USDT`;
      const response = await axios.get(this.exchanges.binance.trades, {
        params: { symbol, limit },
        timeout: 5000,
      });

      const trades = response.data.map((t: any) => ({
        id: t.id.toString(),
        price: parseFloat(t.price),
        amount: parseFloat(t.qty),
        side: t.isBuyerMaker ? 'sell' : 'buy',
        timestamp: t.time,
      }));

      const result = { exchange: 'binance', trades };

      this.recordSuccess(Date.now() - start);
      return { success: true, data: result, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getExchangesForAsset(asset: string): Promise<AdapterResult> {
    const start = Date.now();
    const exchanges = [];

    // Check Binance
    try {
      const symbol = `${asset.toUpperCase()}USDT`;
      const response = await axios.get(`${this.exchanges.binance.ticker}?symbol=${symbol}`, { timeout: 3000 });
      exchanges.push({
        exchange: 'binance',
        symbol,
        price: parseFloat(response.data.lastPrice),
        volume24h: parseFloat(response.data.volume),
        status: 'active',
      });
    } catch (e) {
      // Not available on Binance
    }

    // Check Bybit
    try {
      const symbol = `${asset.toUpperCase()}USDT`;
      const response = await axios.get(this.exchanges.bybit.ticker, {
        params: { category: 'spot', symbol },
        timeout: 3000,
      });
      if (response.data.result?.list?.[0]) {
        const data = response.data.result.list[0];
        exchanges.push({
          exchange: 'bybit',
          symbol,
          price: parseFloat(data.lastPrice),
          volume24h: parseFloat(data.volume24h),
          status: 'active',
        });
      }
    } catch (e) {
      // Not available on Bybit
    }

    this.recordSuccess(Date.now() - start);
    return { success: true, data: exchanges, source: this.name, latencyMs: Date.now() - start };
  }

  async healthCheck(): Promise<AdapterResult> {
    const start = Date.now();
    try {
      await axios.get(`${this.exchanges.binance.ticker}?symbol=BTCUSDT`, { timeout: 3000 });
      this.recordSuccess(Date.now() - start);
      return { success: true, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  private mapInterval(interval: string): string {
    const mapping: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1w',
    };
    return mapping[interval] || '1h';
  }
}
