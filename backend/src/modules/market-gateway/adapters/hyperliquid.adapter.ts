/**
 * HyperLiquid Adapter - Decentralized Perpetuals Exchange (no proxy needed)
 */

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BaseAdapter } from './base.adapter';
import { AdapterResult } from '../models';

@Injectable()
export class HyperLiquidAdapter extends BaseAdapter {
  private readonly logger = new Logger(HyperLiquidAdapter.name);
  
  name = 'HyperLiquid';
  priority = 85;

  private readonly baseUrl = 'https://api.hyperliquid.xyz';

  async getQuote(asset: string): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const response = await axios.post(
        `${this.baseUrl}/info`,
        { type: 'allMids' },
        { timeout: 5000 }
      );

      const mids = response.data;
      const price = mids[asset.toUpperCase()];
      
      if (!price) {
        throw new Error(`Asset ${asset} not found on HyperLiquid`);
      }

      // Get 24h stats
      const metaResponse = await axios.post(
        `${this.baseUrl}/info`,
        { type: 'metaAndAssetCtxs' },
        { timeout: 5000 }
      );

      const assetCtx = metaResponse.data[1]?.find(
        (ctx: any) => ctx.coin === asset.toUpperCase()
      );

      const result = {
        asset: asset.toUpperCase(),
        price: parseFloat(price),
        funding: assetCtx?.funding ? parseFloat(assetCtx.funding) : null,
        openInterest: assetCtx?.openInterest ? parseFloat(assetCtx.openInterest) : null,
        volume24h: assetCtx?.dayNtlVlm ? parseFloat(assetCtx.dayNtlVlm) : null,
        timestamp: Date.now(),
        source: 'hyperliquid',
        type: 'perpetual',
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
      const [midsResponse, metaResponse] = await Promise.all([
        axios.post(
          `${this.baseUrl}/info`,
          { type: 'allMids' },
          { timeout: 5000 }
        ),
        axios.post(
          `${this.baseUrl}/info`,
          { type: 'metaAndAssetCtxs' },
          { timeout: 5000 }
        ),
      ]);

      const mids = midsResponse.data;
      const assetCtxs = metaResponse.data[1] || [];

      const quotes = assets.map(asset => {
        const upperAsset = asset.toUpperCase();
        const price = mids[upperAsset];
        const ctx = assetCtxs.find((c: any) => c.coin === upperAsset);
        
        if (!price) return null;
        
        return {
          asset: upperAsset,
          price: parseFloat(price),
          funding: ctx?.funding ? parseFloat(ctx.funding) : null,
          openInterest: ctx?.openInterest ? parseFloat(ctx.openInterest) : null,
          volume24h: ctx?.dayNtlVlm ? parseFloat(ctx.dayNtlVlm) : null,
          timestamp: Date.now(),
          source: 'hyperliquid',
          type: 'perpetual',
        };
      }).filter(Boolean);

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
      const metaResponse = await axios.post(
        `${this.baseUrl}/info`,
        { type: 'metaAndAssetCtxs' },
        { timeout: 5000 }
      );

      const meta = metaResponse.data[0];
      const assetCtxs = metaResponse.data[1] || [];

      // Calculate totals
      let totalOpenInterest = 0;
      let totalVolume24h = 0;
      
      for (const ctx of assetCtxs) {
        if (ctx.openInterest) totalOpenInterest += parseFloat(ctx.openInterest);
        if (ctx.dayNtlVlm) totalVolume24h += parseFloat(ctx.dayNtlVlm);
      }

      const result = {
        ts: Date.now(),
        exchange: 'hyperliquid',
        type: 'perpetuals',
        totalAssets: assetCtxs.length,
        totalOpenInterest,
        totalVolume24h,
        universe: meta?.universe?.map((u: any) => ({
          coin: u.name,
          maxLeverage: u.maxLeverage,
        })) || [],
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
      const intervalMs = this.mapIntervalToMs(interval);
      const endTime = Date.now();
      const startTime = endTime - (limit * intervalMs);
      
      const response = await axios.post(
        `${this.baseUrl}/info`,
        {
          type: 'candleSnapshot',
          req: {
            coin: asset.toUpperCase(),
            interval: interval,
            startTime,
            endTime,
          },
        },
        { timeout: 10000 }
      );

      const candles = response.data.map((c: any) => ({
        timestamp: c.t,
        open: parseFloat(c.o),
        high: parseFloat(c.h),
        low: parseFloat(c.l),
        close: parseFloat(c.c),
        volume: parseFloat(c.v),
      }));

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
      const response = await axios.post(
        `${this.baseUrl}/info`,
        {
          type: 'l2Book',
          coin: asset.toUpperCase(),
        },
        { timeout: 5000 }
      );

      const book = response.data.levels;
      
      const result = {
        exchange: 'hyperliquid',
        type: 'perpetual',
        bids: book[0].slice(0, limit).map((b: any) => ({
          price: parseFloat(b.px),
          amount: parseFloat(b.sz),
          orders: b.n,
        })),
        asks: book[1].slice(0, limit).map((a: any) => ({
          price: parseFloat(a.px),
          amount: parseFloat(a.sz),
          orders: a.n,
        })),
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
      const response = await axios.post(
        `${this.baseUrl}/info`,
        {
          type: 'recentTrades',
          coin: asset.toUpperCase(),
        },
        { timeout: 5000 }
      );

      const trades = response.data.slice(0, limit).map((t: any) => ({
        id: t.tid?.toString() || t.hash,
        price: parseFloat(t.px),
        amount: parseFloat(t.sz),
        side: t.side,
        timestamp: t.time,
      }));

      const result = { exchange: 'hyperliquid', type: 'perpetual', trades };

      this.recordSuccess(Date.now() - start);
      return { success: true, data: result, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getFundingRates(): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const response = await axios.post(
        `${this.baseUrl}/info`,
        { type: 'metaAndAssetCtxs' },
        { timeout: 5000 }
      );

      const assetCtxs = response.data[1] || [];
      
      const fundingRates = assetCtxs.map((ctx: any) => ({
        coin: ctx.coin,
        funding: parseFloat(ctx.funding),
        fundingAnnualized: parseFloat(ctx.funding) * 365 * 3 * 100, // 8h funding * 3 * 365 * 100%
        openInterest: parseFloat(ctx.openInterest),
        markPrice: parseFloat(ctx.markPx),
        oraclePrice: parseFloat(ctx.oraclePx),
      }));

      this.recordSuccess(Date.now() - start);
      return { success: true, data: fundingRates, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getUserState(address: string): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const response = await axios.post(
        `${this.baseUrl}/info`,
        {
          type: 'clearinghouseState',
          user: address,
        },
        { timeout: 5000 }
      );

      this.recordSuccess(Date.now() - start);
      return { success: true, data: response.data, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async healthCheck(): Promise<AdapterResult> {
    const start = Date.now();
    try {
      await axios.post(
        `${this.baseUrl}/info`,
        { type: 'allMids' },
        { timeout: 3000 }
      );
      this.recordSuccess(Date.now() - start);
      return { success: true, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  private mapIntervalToMs(interval: string): number {
    const mapping: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };
    return mapping[interval] || 3600000;
  }
}
